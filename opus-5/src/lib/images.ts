import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';

// January recommends ~1,024 px on the shorter side; larger photos only add upload time and latency.
const ANALYSIS_SHORT_SIDE = 1024;
const MAX_LONG_SIDE = 2048;
const THUMB_SHORT_SIDE = 480;

async function encodeJpeg(uri: string, width: number, height: number, shortSide: number, compress: number) {
  const scale = Math.min(1, shortSide / Math.min(width, height), MAX_LONG_SIDE / Math.max(width, height));
  const context = ImageManipulator.manipulate(uri);
  const sized =
    scale < 1 ? context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) }) : context;
  const image = await sized.renderAsync();
  const result = await image.saveAsync({ base64: true, compress, format: SaveFormat.JPEG });
  if (!result.base64) throw new Error('Could not encode the photo.');
  return result.base64.startsWith('data:') ? result.base64 : `data:image/jpeg;base64,${result.base64}`;
}

/** Turns a picked or captured photo into the analysis payload (a JPEG data URI) and a small thumbnail. */
export async function prepareImage(uri: string, width?: number, height?: number) {
  let w = width ?? 0;
  let h = height ?? 0;
  if (!w || !h) {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    w = probe.width;
    h = probe.height;
  }
  const image = await encodeJpeg(uri, w, h, ANALYSIS_SHORT_SIDE, 0.72);
  const thumb = await encodeJpeg(uri, w, h, THUMB_SHORT_SIDE, 0.6);
  return { image, thumb };
}

// ---------------------------------------------------------------------------------------------------------
// Meal photos. January stores the log, not the picture, so thumbnails are kept on the device under their
// log id. They're stored apart from the app state so the state stays small, and capped because browsers
// only give localStorage ~5 MB.

const imageKey = (id: string) => `forkcast/img/${id}`;
const INDEX_KEY = 'forkcast/img-index';
const MAX_IMAGES = 60;

const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<(uri: string | null) => void>>();

function emit(id: string, uri: string | null) {
  cache.set(id, uri);
  listeners.get(id)?.forEach((listener) => listener(uri));
}

// Index updates are read-modify-write, so run them one at a time.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readIndex(): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function evict(ids: string[]) {
  for (const id of ids) {
    await AsyncStorage.removeItem(imageKey(id)).catch(() => undefined);
    emit(id, null);
  }
}

export function saveImage(id: string, uri: string) {
  emit(id, uri);
  return serial(async () => {
    const index = (await readIndex()).filter((x) => x !== id);
    index.push(id);
    await evict(index.splice(0, Math.max(0, index.length - MAX_IMAGES)));
    try {
      await AsyncStorage.setItem(imageKey(id), uri);
    } catch {
      // Storage is full: drop the oldest half and try once more; otherwise keep it in memory only.
      await evict(index.splice(0, Math.floor((index.length - 1) / 2)));
      await AsyncStorage.setItem(imageKey(id), uri).catch(() => undefined);
    }
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index)).catch(() => undefined);
  });
}

export async function loadImage(id: string): Promise<string | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  const uri = await AsyncStorage.getItem(imageKey(id)).catch(() => null);
  cache.set(id, uri);
  return uri;
}

export function removeImage(id: string) {
  emit(id, null);
  return serial(async () => {
    await AsyncStorage.removeItem(imageKey(id)).catch(() => undefined);
    const index = (await readIndex()).filter((x) => x !== id);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index)).catch(() => undefined);
  });
}

export async function copyImage(from: string, to: string) {
  const uri = await loadImage(from);
  if (uri) await saveImage(to, uri);
}

export async function moveImage(from: string, to: string) {
  await copyImage(from, to);
  await removeImage(from);
}

export function clearImages() {
  return serial(async () => {
    const index = await readIndex();
    await AsyncStorage.multiRemove([...index.map(imageKey), INDEX_KEY]).catch(() => undefined);
    for (const id of index) emit(id, null);
    cache.clear();
  });
}

export function useStoredImage(id: string | null | undefined): string | null {
  const [uri, setUri] = useState<string | null>(() => (id ? (cache.get(id) ?? null) : null));
  useEffect(() => {
    if (!id) {
      setUri(null);
      return;
    }
    let alive = true;
    const listener = (next: string | null) => {
      if (alive) setUri(next);
    };
    const set = listeners.get(id) ?? new Set();
    listeners.set(id, set);
    set.add(listener);
    loadImage(id).then(listener);
    return () => {
      alive = false;
      set.delete(listener);
    };
  }, [id]);
  return uri;
}
