# Demo kit

## Sample meals

`sample-meals/` holds six free-to-use food photos from Pexels (credits in `sample-meals/CREDITS.md`). Use them
to try the app without cooking: open it, tap **+ → Upload photo** and pick one.

| Photo | Good for showing |
| --- | --- |
| `pancakes.jpg` | A sugary breakfast with a big predicted glucose spike |
| `avocado-toast.jpg` | A balanced breakfast; its two slices of bread still move blood sugar |
| `salmon-poke-bowl.jpg` | A bowl with many ingredients |
| `burger-and-fries.jpg` | A heavy meal with a low health score |
| `pizza.jpg` | Slices and portion estimates |
| `greek-salad.jpg` | A light, low-carb meal |

## Record a demo video

`record-demo.mjs` records a vertical 1080×1920 MP4 (the format X, Instagram Reels and TikTok want) of the real app
running in headless Chrome. A fake camera "sees" `pancakes.jpg`, January analyzes it, and the video shows the
breakdown and the predicted blood sugar curve. Then it uploads `greek-salad.jpg` for a contrasting result.
Waits on the AI are fast-forwarded, and captions and tap markers are drawn around a phone frame.

1. Build and start the app from `opus-5`. `npm run serve` reads your key from `.env`, like `npm run web` does:

   ```bash
   npm run build:web
   ```

   ```bash
   npm run serve
   ```

2. In another terminal, also from `opus-5`:

   ```bash
   npm run demo:record
   ```

The video lands in `demo/output/forkcast-demo.mp4`, with a poster frame (`forkcast-demo-poster.jpg`) for the
thumbnail. `demo/output/` is gitignored.

- Change the story by editing `CAPTIONS` at the top of `record-demo.mjs`.
- Options: `--url` (default `http://localhost:3000`), `--camera <image>`, `--upload <image>`, `--out <file.mp4>`,
  `--chrome <path to Chrome>`, `--headed` to watch the browser while it records, and `--pace 1.3` to hold every
  caption and screen 30% longer.
- Each take makes real January calls (about 7 to 9 credits) under a fresh demo end user.
- It needs Google Chrome. ffmpeg comes from the `ffmpeg-static` dev dependency; if its binary is missing (npm can
  block install scripts), allow that package's install script and reinstall, or set `FFMPEG` to your own ffmpeg.

## Add music

Most people watch X videos muted, so the burned-in captions carry the story; music is a bonus for anyone who turns
the sound on. Use a track you have the rights to, because X can mute or remove videos with copyrighted songs.
[Mixkit's free music](https://mixkit.co/free-stock-music/) is licensed for social media videos and needs no credit.
Keep the track out of Git (`demo/output/` is ignored): stock music licenses don't let you share the audio file
itself. Then, from `opus-5`:

```bash
npm run demo:music -- path/to/track.mp3
```

It loops or trims the track to the video's length, fades it in and out, and writes
`demo/output/forkcast-demo-music.mp4`. Options: `--volume 0.7`, `--start 12` (skip into the track), `--video`,
`--out`.
