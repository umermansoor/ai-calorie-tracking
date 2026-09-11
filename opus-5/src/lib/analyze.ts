import * as ImagePicker from 'expo-image-picker';

import { eatenAtFor } from '@/lib/dates';
import { moveImage, prepareImage, removeImage, saveImage } from '@/lib/images';
import { errorMessage, isApiKeyError, january } from '@/lib/january/client';
import { analysisToSelections, mealName } from '@/lib/january/mapping';
import type { FoodAnalysisResult, FoodLog } from '@/lib/january/types';
import { deleteLog, fixPortions, saveLog } from '@/lib/queries';
import { type MealSource, useApp } from '@/lib/store';

export type AnalysisInput = { kind: 'image'; image: string } | { kind: 'text'; text: string };

// Inputs stay in memory rather than in persisted state, so a failed analysis can be retried without
// picking the photo again. The result is kept too: if only the save failed, a retry doesn't pay twice. So is
// the saved log: if only its portion fix failed, a retry finishes that log instead of logging the meal again.
const inputs = new Map<string, { input: AnalysisInput; result?: FoodAnalysisResult; saved?: FoodLog }>();
let counter = 0;

/**
 * Cal AI-style flow: show an "Analyzing…" card on the home screen right away, analyze with January, then
 * log the detected foods as one January food log.
 */
export async function startAnalysis(
  input: AnalysisInput,
  options: { source: MealSource; thumb?: string; label?: string },
) {
  const id = `pending-${Date.now()}-${counter++}`;
  inputs.set(id, { input });
  if (options.thumb) await saveImage(id, options.thumb);
  const { selectedDay, addPending } = useApp.getState();
  addPending({
    id,
    source: options.source,
    day: selectedDay,
    startedAt: Date.now(),
    status: 'analyzing',
    label: options.label,
  });
  void run(id);
  return id;
}

async function run(id: string) {
  const entry = inputs.get(id);
  const item = useApp.getState().pending.find((p) => p.id === id);
  if (!entry || !item) return;
  const { updatePending, removePending } = useApp.getState();
  try {
    let analysis = entry.result;
    if (!analysis) {
      updatePending(id, { status: 'analyzing', error: undefined, needsKey: undefined, startedAt: Date.now() });
      analysis =
        entry.input.kind === 'image'
          ? await january.analyzeImage(entry.input.image)
          : await january.analyzeText(entry.input.text);
      entry.result = analysis;
    }

    const { selections, portions, unmatched } = analysisToSelections(analysis);
    if (!selections.length) {
      entry.result = undefined; // a retry should analyze again
      throw new Error(
        entry.input.kind === 'image'
          ? 'No food found in that photo. Try a closer, well-lit shot.'
          : 'Couldn’t match that to any foods. Try adding a bit more detail.',
      );
    }

    updatePending(id, { status: 'saving', error: undefined });
    const fallbackName = entry.input.kind === 'text' ? entry.input.text : 'Meal';
    entry.saved ??= await january.createFoodLog(useApp.getState().endUserId, {
      foods: selections,
      eaten_at: eatenAtFor(item.day),
      name: mealName(analysis, fallbackName).slice(0, 256),
    });
    // The saved log shows each catalog serving's size, so any quantity that assumed one unit is fixed now.
    const log = await fixPortions(entry.saved, portions);
    saveLog(log, { source: item.source, multiplier: 1, unmatched: unmatched.length ? unmatched : undefined });
    if (log.id) await moveImage(id, log.id);
    inputs.delete(id);
    removePending(id);
  } catch (error) {
    updatePending(id, { status: 'error', error: errorMessage(error), needsKey: isApiKeyError(error) });
  }
}

/**
 * Opens the camera or photo library; null if the user cancels. On web this must be called straight from a
 * tap handler (before any await), or the browser blocks the file dialog.
 */
export async function pickPhoto(from: 'camera' | 'library') {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0] ?? null);
}

export async function analyzePhoto(uri: string, source: MealSource, width?: number, height?: number) {
  const { image, thumb } = await prepareImage(uri, width, height);
  return startAnalysis({ kind: 'image', image }, { source, thumb });
}

export const retryAnalysis = (id: string) => void run(id);

export async function dismissAnalysis(id: string) {
  const saved = inputs.get(id)?.saved;
  inputs.delete(id);
  useApp.getState().removePending(id);
  await removeImage(id);
  // Saved, but its portions couldn't be fixed: don't leave the wrong amounts in the log.
  if (saved?.id) await deleteLog(saved.id).catch(() => undefined);
}
