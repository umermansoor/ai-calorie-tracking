import type {
  Food,
  FoodAnalysisResult,
  FoodLog,
  FoodSelection,
  FoodServing,
  LoggedFood,
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

/** A number of catalog servings January accepts as a logged quantity (above 0, at most 10,000). */
const servingsCount = (n: number) => (n > 0 ? Math.max(round3(Math.min(n, 10000)), 0.001) : 1);

const sameUnit = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** How much of a detected food was eaten, in the unit of the catalog serving it was matched to ("40 g" is 40). */
export type Portion = { food_id: string; serving_id: string; amount: number | null; unit: string | null };

/** How much of a logged food was eaten, in its serving's unit: servings eaten × the serving's size. */
export const loggedAmount = (f: LoggedFood) => (f.quantity ?? 1) * (f.serving.quantity ?? 1);

/** Serving id → that serving's size in its unit ("100 g" → 100), for the foods in a log. */
export const servingSizes = (log: FoodLog) =>
  new Map(
    log.foods.flatMap((f) => (f.serving.id && f.serving.quantity ? [[f.serving.id, f.serving.quantity] as const] : [])),
  );

/**
 * Turns an analysis into loggable selections; detections January couldn't match to its catalog are returned by name.
 *
 * A detection's serving says how much was eaten, in the serving's unit: image and corrected analyses in `quantity`
 * ("40 g" → 40), text analyses in `selected_quantity` ("2 cups" → 2, with `quantity` holding the serving's size).
 * A food log counts catalog servings instead, and a catalog serving can be more than one unit ("100 g", "2 cups
 * shredded"). Image analyses don't say how big it is, so unless `sizes` knows (see `servingSizes`), it's taken to
 * be one unit, and `portionFixes` corrects the quantity once the saved log shows the real size.
 */
export function analysisToSelections(analysis: FoodAnalysisResult, sizes?: ReadonlyMap<string, number>) {
  const selections: FoodSelection[] = [];
  const portions: Portion[] = [];
  const unmatched: string[] = [];
  for (const d of analysis.detections) {
    const serving = d.food.servings.find((s) => s.id && CATALOG_ID.test(s.id));
    if (d.food.id && CATALOG_ID.test(d.food.id) && serving?.id) {
      const fromText = serving.selected_quantity != null;
      const amount = fromText ? serving.selected_quantity : serving.quantity;
      const size = sizes?.get(serving.id) ?? (fromText ? serving.quantity : null) ?? 1;
      const quantity = amount != null ? servingsCount(amount / (size || 1)) : 1;
      selections.push({ food_id: d.food.id, serving_id: serving.id, quantity });
      portions.push({ food_id: d.food.id, serving_id: serving.id, amount, unit: serving.unit });
    } else if (d.food.name) {
      unmatched.push(d.food.name);
    }
  }
  return { selections, portions, unmatched };
}

export const logToSelections = (log: FoodLog): FoodSelection[] =>
  log.foods.flatMap((f) =>
    f.food_id && f.serving.id && f.quantity != null
      ? [{ food_id: f.food_id, serving_id: f.serving.id, quantity: f.quantity }]
      : [],
  );

/**
 * Checks a log saved from `analysisToSelections` against its portions, now that the log shows each catalog
 * serving's size. Returns every food, with corrected quantities, when any is off (for one PATCH), or null when
 * the log already matches.
 */
export function portionFixes(log: FoodLog, portions: Portion[]): FoodSelection[] | null {
  const foods = logToSelections(log);
  if (foods.length !== log.foods.length || foods.length !== portions.length) return null;
  let changed = false;
  const fixed = foods.map((f, i) => {
    const p = portions[i];
    const serving = log.foods[i].serving;
    if (p.amount == null || !serving.quantity || f.food_id !== p.food_id || f.serving_id !== p.serving_id) return f;
    if (!sameUnit(serving.unit, p.unit)) return f;
    const quantity = servingsCount(p.amount / serving.quantity);
    if (Math.abs(quantity - f.quantity) < 0.0005) return f;
    changed = true;
    return { ...f, quantity };
  });
  return changed ? fixed : null;
}

/**
 * Rebuilds what's currently logged as an analysis, so "Fix results" corrects the meal as the user sees it
 * (after serving or ingredient edits). Corrections read a serving's quantity as the amount eaten in its unit,
 * and a detection's nutrients as that whole amount's.
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
        servings: [{ id: f.serving.id, quantity: loggedAmount(f), unit: f.serving.unit, selected_quantity: null }],
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
