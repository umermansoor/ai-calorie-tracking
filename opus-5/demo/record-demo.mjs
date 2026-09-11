#!/usr/bin/env node
/**
 * Records a vertical 1080×1920 demo video of Forkcast, sized for X, Reels and TikTok.
 *
 * It drives the real app in headless Chrome. A fake camera "sees" a sample meal, January analyzes it, and the
 * video shows the breakdown and the predicted blood sugar curve. Then it does the same for an uploaded,
 * healthier meal. Waits on the AI are fast-forwarded; captions and tap markers are drawn around a phone frame.
 *
 *   1. Start the app with a working January key (e.g. `npm run build:web && npm run serve`).
 *   2. npm run demo:record -- --url http://localhost:3000
 *
 * Options: --url, --camera <image>, --upload <image>, --out <file.mp4>, --chrome <path>, --headed,
 * --pace <n> (e.g. 1.3 holds every caption and screen 30% longer).
 * Each take makes real January calls (about 7 credits) under a new demo end user.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import ffmpegStatic from 'ffmpeg-static';
import { chromium } from 'playwright-core';

const { values: opts } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    camera: { type: 'string', default: 'demo/sample-meals/pancakes.jpg' },
    upload: { type: 'string', default: 'demo/sample-meals/greek-salad.jpg' },
    out: { type: 'string', default: 'demo/output/forkcast-demo.mp4' },
    chrome: {
      type: 'string',
      default: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
    headed: { type: 'boolean', default: false },
    pace: { type: 'string', default: '1' },
  },
});

const FFMPEG = process.env.FFMPEG ?? (ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg');
const FPS = 30;
const PACE = Math.max(0.25, Number(opts.pace) || 1); // above 1 lengthens every pause
const VIEWPORT = { width: 540, height: 960 }; // CSS px, recorded at 2× → 1080×1920
const PHONE = { top: 150, width: 390, height: 760, radius: 44 };
const PHONE_LEFT = (VIEWPORT.width - PHONE.width) / 2;

// Edit these to change the story.
const CAPTIONS = {
  hook: ['I one-shotted a Cal AI clone', 'Claude Opus 5 + the January AI API'],
  snap: ['Snap your meal 📸', ''],
  analyze: ['AI finds every food and portion', 'January food photo analysis'],
  breakdown: ['Calories and macros in seconds', ''],
  twist: ['The twist: it predicts your blood sugar 🩸', 'before you take a bite'],
  healthy: ['Now something lighter 🥗', ''],
  compare: ['And its blood sugar curve?', ''],
  day: ['Your whole day, from two photos', ''],
  end: ['A Cal AI clone, built in one shot', 'Claude Opus 5 × January AI API', 'Free & open source 🎁'],
};
const FOOTER = 'Built with Claude Opus 5 × January AI';

const STAGE_CSS = `
html, body { background: radial-gradient(130% 70% at 50% 0%, #2b2b36 0%, #101014 55%, #08080a 100%) !important; }
#root, [aria-modal="true"] {
  position: fixed !important; top: ${PHONE.top}px !important; left: ${PHONE_LEFT}px !important;
  right: auto !important; bottom: auto !important;
  width: ${PHONE.width}px !important; height: ${PHONE.height}px !important;
  border-radius: ${PHONE.radius}px !important; overflow: hidden !important;
}
#root { box-shadow: 0 0 0 9px #050506, 0 0 0 10.5px #3b3b46, 0 40px 90px rgba(0, 0, 0, 0.65) !important; }
#demo-caption {
  position: fixed; top: 30px; left: 22px; right: 22px; z-index: 100000; text-align: center; color: #fff;
  font: 800 30px/1.12 -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif;
  letter-spacing: -0.6px; text-wrap: balance; transition: opacity 0.2s ease;
}
#demo-caption small {
  display: block; margin-top: 8px; font-size: 17px; font-weight: 600; letter-spacing: 0; color: rgba(255, 255, 255, 0.7);
}
#demo-footer {
  position: fixed; left: 0; right: 0; bottom: 18px; z-index: 100000; text-align: center;
  color: rgba(255, 255, 255, 0.72); font: 600 15px -apple-system, BlinkMacSystemFont, sans-serif;
}
#demo-badge {
  position: fixed; top: ${PHONE.top + 16}px; right: ${PHONE_LEFT + 16}px; z-index: 100001; padding: 6px 11px;
  border-radius: 999px; background: rgba(0, 0, 0, 0.75); color: #fff;
  font: 700 14px -apple-system, BlinkMacSystemFont, sans-serif; opacity: 0; transition: opacity 0.2s;
}
.demo-tap {
  position: fixed; z-index: 100002; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.5); border: 2px solid rgba(17, 17, 20, 0.35); pointer-events: none;
  animation: demo-tap 0.6s ease-out forwards;
}
@keyframes demo-tap { from { transform: scale(0.45); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
#demo-endcard {
  position: fixed; inset: 0; z-index: 100003; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 16px; padding: 48px; text-align: center; color: #fff;
  background: rgba(8, 8, 11, 0.94); opacity: 0; transition: opacity 0.6s ease; pointer-events: none;
}
#demo-endcard.show { opacity: 1; }
#demo-endcard .title { font: 800 40px/1.08 -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; letter-spacing: -1px; text-wrap: balance; }
#demo-endcard .sub { font: 600 20px/1.3 -apple-system, BlinkMacSystemFont, sans-serif; color: rgba(255, 255, 255, 0.75); }
#demo-endcard .link {
  margin-top: 18px; padding: 14px 18px; border-radius: 18px;
  background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.16);
}
#demo-endcard .free { font: 800 22px/1.2 -apple-system, BlinkMacSystemFont, sans-serif; color: #fff; }
#demo-endcard .url {
  margin-top: 6px; font: 600 16px/1.35 ui-monospace, "SF Mono", Menlo, monospace; color: rgba(255, 255, 255, 0.85);
  word-break: break-all;
}
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** A pause the viewer sees (for reading a caption or a screen), scaled by --pace. */
const hold = (ms) => sleep(ms * PACE);

function seedState() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  // A finished onboarding, so the video starts on the home screen.
  return {
    state: {
      endUserId: `forkcast-demo-${Date.now()}`,
      onboarded: true,
      profile: {
        sex: 'female',
        birthdate: `${now.getFullYear() - 32}-04-12`,
        heightCm: 168,
        weightKg: 68,
        targetWeightKg: 63.5,
        paceKg: 0.45,
        goal: 'lose',
        workouts: '3-5',
        diet: 'classic',
        condition: 'prediabetes', // the audience glucose predictions matter most to
        units: 'imperial',
      },
      targets: { calories: 1690, protein: 109, carbs: 194, fat: 53, fiber: 24, sugar: 42, sodium: 2300 },
      weights: [{ date: today, kg: 68 }],
      meta: {},
    },
    version: 0,
  };
}

async function main() {
  const cameraImage = path.resolve(opts.camera);
  const uploadImage = path.resolve(opts.upload);
  const outFile = path.resolve(opts.out);
  for (const file of [cameraImage, uploadImage]) {
    if (!fs.existsSync(file)) throw new Error(`Missing image: ${file}`);
  }
  if (!fs.existsSync(opts.chrome)) throw new Error(`Chrome not found at ${opts.chrome}. Pass --chrome <path>.`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'forkcast-demo-'));
  const framesDir = path.join(work, 'frames');
  fs.mkdirSync(framesDir);

  // The fake camera streams this still, cropped to a portrait phone frame.
  const cameraFeed = path.join(work, 'camera.mjpeg');
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error', '-i', cameraImage,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-q:v', '3', '-frames:v', '1', '-f', 'mjpeg', cameraFeed,
  ]);

  const browser = await chromium.launch({
    executablePath: opts.chrome,
    headless: !opts.headed,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${cameraFeed}`,
      '--force-color-profile=srgb',
    ],
  });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await context.grantPermissions(['camera'], { origin: new URL(opts.url).origin });
  await context.addInitScript((state) => {
    try {
      if (!localStorage.getItem('forkcast/state/v1')) localStorage.setItem('forkcast/state/v1', state);
    } catch {}
  }, JSON.stringify(seedState()));
  const page = await context.newPage();

  // Capture every composited frame with its timestamp; the encoder resamples them to a steady 30 fps.
  const frames = [];
  const markers = []; // { t, speed }: 1 = real time, 3 = fast-forward
  let posterAt = null;
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(framesDir, `${String(frames.length).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ t: metadata.timestamp, file });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const speed = (s) => markers.push({ t: Date.now() / 1000, speed: s });

  const fastForward = async (work, factor = 3) => {
    speed(factor);
    await badge(page, `⏩ ${factor}×`);
    try {
      return await work();
    } finally {
      await badge(page, '');
      speed(1);
    }
  };

  try {
    await page.goto(opts.url, { waitUntil: 'load' });
    await waitForText(page, /haven’t uploaded any food|\d+ calories|Set up your January API key|Couldn’t load/, 45000);
    if (await hasText(page, /Set up your January API key|Couldn’t load/)) {
      throw new Error('The app can’t reach January. Check the server’s JANUARY_API_KEY (or keyotter proxy).');
    }
    await setUpStage(page);
    await caption(page, ...CAPTIONS.hook);
    await sleep(600);
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: VIEWPORT.width * 2,
      maxHeight: VIEWPORT.height * 2,
      everyNthFrame: 1,
    });
    speed(1);
    await hold(2600);

    // 1. Point the (fake) camera at the first meal and snap it. Keep this brisk: the photo scan should show up
    //    within the first few seconds, before viewers scroll past.
    await caption(page, ...CAPTIONS.snap);
    await tap(page, page.locator('[aria-label="Add food"]').filter({ visible: true }), 700);
    await tap(page, page.getByText('Scan food', { exact: true }).first(), 300);
    await page.waitForFunction(
      () => [...document.querySelectorAll('video')].some((v) => v.readyState >= 2 && v.videoWidth > 0),
      null,
      { timeout: 20000 },
    );
    await hold(1500);
    await tap(page, page.locator('[aria-label="Take photo"]'), 200);
    await waitForText(page, /Analyzing food|Saving to your log/, 20000);
    await caption(page, ...CAPTIONS.analyze);
    await fastForward(() => waitForMeals(page, 1));
    await hold(1300);

    // 2. Open it: the breakdown, then January's glucose prediction.
    const first = await openNewestMeal(page);
    await caption(page, ...CAPTIONS.breakdown);
    await hold(2700);
    await caption(page, ...CAPTIONS.twist);
    await hold(1500);
    await smoothScrollTo(page, 'Blood sugar impact', 110, 1900);
    const spike = await fastForward(() => waitForGlucose(page), 2);
    await hold(600);
    await caption(page, ...glucoseCaption(spike, first));
    posterAt = Date.now() / 1000 + 0.6;
    await hold(3800);
    await backToHome(page);

    // 3. Upload a lighter meal from the photo library.
    await caption(page, ...CAPTIONS.healthy);
    await hold(1200);
    await tap(page, page.locator('[aria-label="Add food"]').filter({ visible: true }), 1300);
    const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
    await tap(page, page.getByText('Upload photo', { exact: true }).first(), 0);
    await (await chooser).setFiles(uploadImage);
    await waitForText(page, /Analyzing food|Saving to your log/, 20000);
    await hold(700);
    await caption(page, ...CAPTIONS.analyze);
    await fastForward(() => waitForMeals(page, 2));
    await hold(1100);
    const second = await openNewestMeal(page);
    await caption(page, ...CAPTIONS.compare);
    await hold(2400);
    await smoothScrollTo(page, 'Blood sugar impact', 110, 1900);
    const calm = await fastForward(() => waitForGlucose(page), 2);
    await hold(600);
    await caption(page, ...glucoseCaption(calm, second));
    await hold(3800);
    await backToHome(page);

    // 4. The day so far, then the end card with the link.
    await caption(page, ...CAPTIONS.day);
    await hold(2800);
    await endCard(page, ...CAPTIONS.end);
    await hold(4500);
  } catch (error) {
    await page.screenshot({ path: outFile.replace(/\.mp4$/, '-error.png') }).catch(() => {});
    throw error;
  } finally {
    speed(0);
    await cdp.send('Page.stopScreencast').catch(() => {});
    await browser.close();
  }

  const seconds = encode(frames, markers, outFile, work);
  if (posterAt) {
    const poster = frames.filter((f) => f.t <= posterAt).pop();
    if (poster) fs.copyFileSync(poster.file, outFile.replace(/\.mp4$/, '-poster.jpg'));
  }
  fs.rmSync(work, { recursive: true, force: true });
  const mb = (fs.statSync(outFile).size / 1e6).toFixed(1);
  console.log(`Saved ${path.relative(process.cwd(), outFile)} (${seconds.toFixed(1)} s, ${mb} MB)`);
}

/** Resamples the captured frames to a constant frame rate, honoring the fast-forward markers, then encodes H.264. */
function encode(frames, markers, outFile, work) {
  if (!frames.length) throw new Error('No frames were captured.');
  const sequence = path.join(work, 'sequence');
  fs.mkdirSync(sequence);
  const sorted = [...markers].sort((a, b) => a.t - b.t);
  const times = [];
  let videoTime = 0;
  let next = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const { t: t0, speed } = sorted[i];
    const t1 = sorted[i + 1].t;
    if (!(speed > 0) || t1 <= t0) continue;
    const end = videoTime + (t1 - t0) / speed;
    for (; next < end; next += 1 / FPS) times.push(t0 + (next - videoTime) * speed);
    videoTime = end;
  }
  let j = 0;
  times.forEach((t, i) => {
    while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
    fs.symlinkSync(frames[j].file, path.join(sequence, `${String(i).padStart(6, '0')}.jpg`));
  });
  execFileSync(
    FFMPEG,
    [
      '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(sequence, '%06d.jpg'),
      '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-movflags', '+faststart',
      outFile,
    ],
    { stdio: 'inherit' },
  );
  return times.length / FPS;
}

async function setUpStage(page) {
  await page.addStyleTag({ content: STAGE_CSS });
  await page.evaluate((footer) => {
    for (const id of ['demo-caption', 'demo-footer', 'demo-badge', 'demo-endcard']) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    document.getElementById('demo-footer').textContent = footer;
  }, FOOTER);
}

async function caption(page, title, sub = '') {
  await page.evaluate(
    ({ title, sub }) => {
      const el = document.getElementById('demo-caption');
      el.style.opacity = '0';
      setTimeout(() => {
        el.replaceChildren(document.createTextNode(title));
        if (sub) {
          const small = document.createElement('small');
          small.textContent = sub;
          el.append(small);
        }
        el.style.opacity = '1';
      }, 200);
    },
    { title, sub },
  );
}

const badge = (page, text) =>
  page.evaluate((text) => {
    const el = document.getElementById('demo-badge');
    el.textContent = text;
    el.style.opacity = text ? '1' : '0';
  }, text);

async function endCard(page, title, sub, free = '', link = '') {
  await page.evaluate(
    ({ title, sub, free, link }) => {
      const el = document.getElementById('demo-endcard');
      const line = (className, text) => {
        const div = document.createElement('div');
        div.className = className;
        div.textContent = text;
        return div;
      };
      el.replaceChildren(line('title', title), line('sub', sub));
      if (free || link) {
        const box = line('link', '');
        if (free) box.append(line('free', free));
        if (link) box.append(line('url', link));
        el.append(box);
      }
      el.classList.add('show');
    },
    { title, sub, free, link },
  );
}

/** Shows a touch marker, then clicks the element's center like a finger tap. */
async function tap(page, locator, after = 400) {
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  const onScreen = (b) => b && b.y + b.height / 2 > PHONE.top && b.y + b.height / 2 < PHONE.top + PHONE.height;
  let box = await locator.boundingBox();
  if (!onScreen(box)) {
    // Scrolled out of the phone's view: bring it back before tapping.
    await locator.scrollIntoViewIfNeeded();
    box = await locator.boundingBox();
  }
  if (!box) throw new Error('Tap target has no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(
    ([x, y]) => {
      const dot = document.createElement('div');
      dot.className = 'demo-tap';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 800);
    },
    [x, y],
  );
  await sleep(140);
  await page.mouse.click(x, y);
  await hold(after);
}

const hasText = (page, re) =>
  page.evaluate(({ source, flags }) => new RegExp(source, flags).test(document.body.innerText), {
    source: re.source,
    flags: re.flags,
  });

const waitForText = (page, re, timeout) =>
  page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
    { source: re.source, flags: re.flags },
    { timeout, polling: 250 },
  );

/** Waits until the home screen lists `count` meals, failing fast if the analysis card shows an error. */
async function waitForMeals(page, count, timeout = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const state = await page.evaluate(() => ({
      meals: document.querySelectorAll('[aria-label$=" calories"]').length,
      text: document.body.innerText,
    }));
    if (state.meals >= count) return;
    const failure = /(Couldn’t analyze this meal|January API key needed)\s+([^\n]+)/.exec(state.text);
    if (failure) throw new Error(`Analysis failed: ${failure[2]}`);
    await sleep(300);
  }
  throw new Error(`Timed out waiting for meal ${count}`);
}

/** Leaves a meal with its Done button; the header's back button scrolls away with the photo. */
async function backToHome(page) {
  await tap(page, page.getByText('Done', { exact: true }).filter({ visible: true }).first(), 300);
  await page.waitForFunction(() => !document.body.innerText.includes('Ingredients'), null, { timeout: 10000 });
  await sleep(400);
}

/** Taps the newest meal card and returns its name. */
async function openNewestMeal(page) {
  const card = page.locator('[aria-label$=" calories"]').first();
  const label = (await card.getAttribute('aria-label')) ?? '';
  await tap(page, card, 300);
  await waitForText(page, /Ingredients/, 15000);
  return label.replace(/, \d+ calories$/, '');
}

async function waitForGlucose(page) {
  await page.waitForFunction(() => /(High|Medium|Low) impact|Peaks around/.test(document.body.innerText), null, {
    timeout: 60000,
    polling: 250,
  });
  return page.evaluate(() => {
    const text = document.body.innerText;
    return {
      impact: /(High|Medium|Low) impact/.exec(text)?.[1] ?? null,
      peak: Number(/Peaks around (\d+)/.exec(text)?.[1]) || null,
    };
  });
}

// January's portion estimates vary a little between takes, so a meal near the line can come back Medium or
// High; lead with the peak, which reads well either way.
function glucoseCaption({ impact, peak }, meal) {
  if (!impact || !peak) return ['Predicted blood sugar curve', meal];
  const title = impact === 'Low' ? `✅ Barely moves: ${peak} mg/dL` : `📈 Spikes to ${peak} mg/dL`;
  return [title, `${meal} · ${impact} impact`];
}

/** Eases the screen's scroll view until `label` sits near the top, like a thumb scroll. */
async function smoothScrollTo(page, label, offset = 110, ms = 1300) {
  await page.evaluate(
    async ({ label, offset, ms }) => {
      const target = [...document.querySelectorAll('#root div')].find(
        (d) => d.children.length === 0 && d.textContent.trim() === label && d.getClientRects().length > 0,
      );
      let box = target?.parentElement;
      while (box && !(box.scrollHeight > box.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) {
        box = box.parentElement;
      }
      if (!target || !box) return;
      const from = box.scrollTop;
      const to = Math.min(
        box.scrollHeight - box.clientHeight,
        from + target.getBoundingClientRect().top - box.getBoundingClientRect().top - offset,
      );
      const t0 = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          box.scrollTop = from + (to - from) * eased;
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    },
    { label, offset, ms },
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
