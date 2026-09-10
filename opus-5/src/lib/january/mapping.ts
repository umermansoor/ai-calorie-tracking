import type {
  Detection,
  Food,
  FoodAnalysisResult,
  FoodLog,
  FoodSelection,
  FoodServing,
  NutrientKey,
  Nutrients,
} from './types';

export const num = (n: Nutrients | undefined, key: NutrientKey) => n?.[key]?.value ?? 0;
export const has = (n: Nutrients | undefined, key: NutrientKey) => n?.[key] !== undefined;

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const key of Object.keys(n) as NutrientKey[]) {
      const v = n[key];
      if (!v) continue;
      out[key] = { value: (out[key]?.value ?? 0) + v.value, unit: v.unit };
    }
  }
  return out;
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const key of Object.keys(n) as NutrientKey[]) {
    const v = n[key];
    if (v) out[key] = { value: v.value * factor, unit: v.unit };
  }
  return out;
}

export const logTotals = (log: FoodLog) => sumNutrients(log.foods.map((f) => f.nutrients));

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const CATALOG_ID = /^\d{1,16}$/;

/**
 * How many of a detection's serving were eaten.
 *
 * January reports this two ways (checked against `total_nutrients`):
 * - text analyses set `selected_quantity` in units of the serving ("2 cups" → 2), so divide by the serving size;
 * - image and corrected analyses leave it null, and `quantity` is already the number of servings.
 */
export function detectionQuantity(d: Detection): number {
  const serving = d.food.servings.find((s) => s.id) ?? d.food.servings[0];
  if (!serving) return 1;
  const q =
    serving.selected_quantity != null
      ? serving.selected_quantity / (serving.quantity || 1)
      : (serving.quantity ?? 1);
  return q > 0 ? round3(Math.min(q, 10000)) : 1;
}

/** Turns an analysis into loggable selections; detections January couldn't match to its catalog are returned by name. */
export function analysisToSelections(analysis: FoodAnalysisResult) {
  const selections: FoodSelection[] = [];
  const unmatched: string[] = [];
  for (const d of analysis.detections) {
    const serving = d.food.servings.find((s) => s.id && CATALOG_ID.test(s.id));
    if (d.food.id && CATALOG_ID.test(d.food.id) && serving?.id) {
      selections.push({ food_id: d.food.id, serving_id: serving.id, quantity: detectionQuantity(d) });
    } else if (d.food.name) {
      unmatched.push(d.food.name);
    }
  }
  return { selections, unmatched };
}

export const logToSelections = (log: FoodLog): FoodSelection[] =>
  log.foods.flatMap((f) =>
    f.food_id && f.serving.id && f.quantity != null
      ? [{ food_id: f.food_id, serving_id: f.serving.id, quantity: f.quantity }]
      : [],
  );

/**
 * Rebuilds what's currently logged as an analysis, so "Fix results" corrects the meal as the user sees it
 * (after serving or ingredient edits). Quantities are servings counts with portion-level nutrients, the
 * same convention corrections return.
 */
export function logAsAnalysis(log: FoodLog): FoodAnalysisResult {
  return {
    meal_name: log.name,
    total_nutrients: logTotals(log),
    detections: log.foods.map((f) => ({
      confidence: null,
      food: {
        id: f.food_id,
        name: f.name,
        brand_name: f.brand_name,
        nutrients: f.nutrients,
        servings: [{ id: f.serving.id, quantity: f.quantity, unit: f.serving.unit, selected_quantity: null }],
      },
    })),
  };
}

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function mealName(analysis: FoodAnalysisResult, fallback = 'Meal'): string {
  const named = analysis.meal_name?.trim();
  if (named) return named;
  const names = analysis.detections.map((d) => d.food.name?.trim()).filter((n): n is string => !!n);
  if (!names.length) return fallback;
  const list = names.length <= 2 ? names.join(' & ') : `${names.slice(0, 2).join(', ')} & more`;
  return capitalize(list);
}

export function formatQty(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function servingLabel(quantity: number | null | undefined, unit: string | null | undefined): string {
  const u = unit?.trim() || 'serving';
  return `${formatQty(quantity ?? 1)} ${u}`;
}

export const primaryServing = (food: Food): FoodServing | undefined =>
  food.servings.find((s) => s.is_primary) ?? food.servings[0];

/** Nutrients for `quantity` × `serving` of a catalog food (food.nutrients are per primary serving). */
export function servingNutrients(food: Food, serving: FoodServing | undefined, quantity: number): Nutrients {
  const primary = primaryServing(food);
  let factor = 1;
  if (serving && serving !== primary) {
    if (serving.scaling_factor != null) factor = serving.scaling_factor / (primary?.scaling_factor || 1);
    else if (serving.weight_grams && primary?.weight_grams) factor = serving.weight_grams / primary.weight_grams;
  }
  return scaleNutrients(food.nutrients, factor * quantity);
}

export const foodDisplayName = (food: { name: string | null }) => capitalize(food.name?.trim() || 'Food');
