import sharp from "sharp";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
// A credited real meal image drives Chromium's fake webcam for deterministic input.
// No January request is made here.
export async function prepareCamera() {
  const response = await fetch(
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1280&h=1024&fit=crop&q=80&fm=jpg",
  );
  if (!response.ok)
    throw Error("Could not load the Anna Pelzer / Unsplash camera fixture.");
  const w = 640,
    h = 480,
    { data } = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(w, h)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  const y = Buffer.alloc(w * h),
    u = Buffer.alloc((w * h) / 4),
    v = Buffer.alloc((w * h) / 4);
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 3,
        r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      y[row * w + col] = Math.min(
        235,
        Math.max(16, 16 + 0.257 * r + 0.504 * g + 0.098 * b),
      );
      if (!(row % 2) && !(col % 2)) {
        const p = ((row / 2) * w) / 2 + col / 2;
        u[p] = Math.min(
          240,
          Math.max(16, 128 - 0.148 * r - 0.291 * g + 0.439 * b),
        );
        v[p] = Math.min(
          240,
          Math.max(16, 128 + 0.439 * r - 0.368 * g - 0.071 * b),
        );
      }
    }
  await mkdir(".tmp", { recursive: true });
  const path = resolve(".tmp/camera.y4m");
  await writeFile(
    path,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${w} H${h} F30:1 Ip A1:1 C420jpeg\nFRAME\n`),
      y,
      u,
      v,
    ]),
  );
  return path;
}
export const cleanupCamera = () => rm(".tmp/camera.y4m", { force: true });
