#!/usr/bin/env node
/**
 * Adds a music track to a demo video: loops or trims it to the video's length, fades it in and out, and sets
 * the volume. The video stream is copied untouched.
 *
 *   npm run demo:music -- <track.mp3> [--video demo/output/forkcast-demo.mp4] [--volume 0.7] [--start 12] [--out file.mp4]
 *
 * --start skips into the track (e.g. past a slow intro). Use music you have the rights to (royalty-free or
 * licensed): X can mute or take down videos that use copyrighted songs.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import ffmpegStatic from 'ffmpeg-static';

const FFMPEG = process.env.FFMPEG ?? (ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg');

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    video: { type: 'string', default: 'demo/output/forkcast-demo.mp4' },
    out: { type: 'string' },
    volume: { type: 'string', default: '0.7' },
    start: { type: 'string', default: '0' },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

const track = positionals[0] ? path.resolve(positionals[0]) : null;
if (!track) fail('Usage: npm run demo:music -- <track.mp3> [--video file.mp4] [--volume 0.7] [--start 12]');
const video = path.resolve(opts.video);
const out = path.resolve(opts.out ?? video.replace(/\.mp4$/, '-music.mp4'));
for (const file of [video, track]) if (!fs.existsSync(file)) fail(`Missing file: ${file}`);

// ffmpeg prints the input's duration, then exits non-zero because no output was given.
let banner = '';
try {
  execFileSync(FFMPEG, ['-hide_banner', '-i', video], { stdio: 'pipe' });
} catch (error) {
  banner = String(error.stderr);
}
const match = /Duration: (\d+):(\d+):([\d.]+)/.exec(banner);
if (!match) fail('Could not read the video length.');
const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
const fadeOut = Math.min(2, seconds / 4);

const music = [
  `atrim=0:${seconds.toFixed(2)}`,
  'asetpts=PTS-STARTPTS',
  `volume=${Number(opts.volume)}`,
  'afade=t=in:d=0.6',
  `afade=t=out:st=${(seconds - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`,
].join(',');

execFileSync(
  FFMPEG,
  [
    '-y', '-loglevel', 'error',
    '-i', video,
    '-stream_loop', '-1', '-ss', String(Number(opts.start)), '-i', track, // loop short tracks
    '-filter_complex', `[1:a]${music}[music]`,
    '-map', '0:v', '-map', '[music]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
console.log(`Saved ${path.relative(process.cwd(), out)} (${seconds.toFixed(1)} s with music)`);
