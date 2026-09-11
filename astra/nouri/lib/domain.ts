import type {
  DetectionServing,
  Food,
  Ingredient,
  Nutrients,
  Profile,
  Targets,
  Meal,
} from "./types";
export function calorieProgress(meals: Meal[], date: string, target: number) {
  const calories = meals
    .filter((m) => m.status === "ready" && dayKey(m.eatenAt) === date)
    .reduce((sum, meal) => sum + value(meal.nutrients, "calories"), 0);
  return {
    calories,
    progress: target > 0 ? Math.max(0, Math.min(1, calories / target)) : 0,
  };
}
export const value = (n: Nutrients, key: keyof Nutrients) => n[key]?.value ?? 0;
export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return Object.fromEntries(
    Object.entries(n).map(([key, amount]) => [
      key,
      { ...amount, value: amount.value * factor },
    ]),
  );
}
export function sumNutrients(items: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of items)
    for (const [key, amount] of Object.entries(n)) {
      const k = key as keyof Nutrients;
      out[k] = {
        unit: amount.unit,
        value: (out[k]?.value ?? 0) + amount.value,
      };
    }
  return out;
}
export function ingredient(
  food: Food,
  servingId: string,
  quantity: number,
): Ingredient {
  const s = food.servings.find((s) => s.id === servingId);
  if (
    !s ||
    s.scaling_factor == null ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 10000
  )
    throw new Error("Choose a valid serving and an amount greater than zero.");
  return {
    food,
    servingId,
    quantity,
    nutrients: scaleNutrients(food.nutrients, s.scaling_factor * quantity),
  };
}
export function resolvePortion(d: DetectionServing, food: Food): Ingredient {
  const serving = food.servings.find((s) => s.id === d.id);
  if (!d.id || !serving || !serving.quantity || !d.unit)
    throw new Error(
      "This ingredient has no matching catalog serving. Use Fix results or replace it with a search result.",
    );
  const consumed = d.selected_quantity ?? d.quantity;
  if (consumed == null)
    throw new Error(
      "The portion is missing. Use Fix results and include an amount.",
    );
  const normalize = (s: string | null) =>
    s
      ?.toLowerCase()
      .replace(/grams?/g, "g")
      .trim();
  if (normalize(d.unit) !== normalize(serving.unit))
    throw new Error(
      "The detected portion unit differs from the catalog. Use Fix results and specify grams.",
    );
  return ingredient(food, d.id, consumed / serving.quantity);
}
export function consistent(expected: Nutrients, actual: Nutrients): boolean {
  return (["calories", "protein", "carbohydrates", "total_fat"] as const).every(
    (k) => {
      if (!expected[k]) return true;
      if (!actual[k]) return false;
      const e = value(expected, k),
        a = value(actual, k);
      return (
        Number.isFinite(a) &&
        Math.abs(e - a) <=
          Math.max(k === "calories" ? 8 : 1.5, Math.abs(e) * 0.08)
      );
    },
  );
}
export function healthScore(n: Nutrients) {
  const cal = Math.max(value(n, "calories"), 1),
    density = 100 / cal;
  const fiber = value(n, "fiber") * density,
    protein = value(n, "protein") * density;
  const sugar = value(n, "total_sugars") * density,
    saturated = value(n, "saturated_fat") * density,
    sodium = value(n, "sodium") * density;
  const score = Math.max(
    1,
    Math.min(
      10,
      Math.round(
        6 +
          Math.min(2.5, fiber * 0.9) +
          Math.min(1, protein * 0.16) -
          Math.min(4, sugar * 0.4) -
          Math.min(2, saturated * 0.6) -
          Math.max(0, (sodium - 160) / 160),
      ),
    ),
  );
  return {
    score,
    label:
      score >= 8
        ? "Nutrient-rich"
        : score >= 5
          ? "Room for balance"
          : "Enjoy mindfully",
    detail:
      "A Nouri estimate based on fiber, protein, sugar, saturated fat and sodium per calorie. Missing nutrients count as unknown; this is not a clinical rating.",
  };
}
export const defaultProfile: Profile = {
  sex: "female",
  age: 30,
  height: 170,
  weight: 70,
  goal: "maintain",
  pace: "gentle",
  activity: "moderately_active",
  diet: "balanced",
};
export function targetsFor(p: Profile): Targets {
  const bmr =
    10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "male" ? 5 : -161);
  const activity = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
  }[p.activity];
  const delta =
    (p.pace === "gentle" ? 250 : 500) *
    (p.goal === "lose" ? -1 : p.goal === "gain" ? 1 : 0);
  const calories =
    Math.round(
      Math.max(p.sex === "female" ? 1200 : 1500, bmr * activity + delta) / 10,
    ) * 10;
  const protein = Math.round(
    (calories * (p.diet === "high_protein" ? 0.3 : 0.25)) / 4,
  );
  const fat = Math.round(
    (calories * (p.diet === "low_carbohydrate" ? 0.4 : 0.3)) / 9,
  );
  return {
    calories,
    protein,
    fat,
    carbs: Math.round((calories - protein * 4 - fat * 9) / 4),
  };
}
export function isoWithOffset(date: Date) {
  const offset = -date.getTimezoneOffset(),
    pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}
export const timezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
export function energySummary(meals: Meal[], dates: string[]) {
  const ready = meals.filter((meal) => meal.status === "ready");
  const days = dates.map((date) => {
    const entries = ready.filter((meal) => dayKey(meal.eatenAt) === date);
    return {
      date,
      logged: entries.length > 0,
      total: value(
        sumNutrients(entries.map((meal) => meal.nutrients)),
        "calories",
      ),
    };
  });
  const logged = days.filter((day) => day.logged);
  return {
    days,
    loggedDays: logged.length,
    average: logged.length
      ? Math.round(
          logged.reduce((sum, day) => sum + day.total, 0) / logged.length,
        )
      : null,
  };
}
export function dayKey(date: Date | string = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const daysBack = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    return dayKey(d);
  });
export const selections = (ingredients: Ingredient[]) =>
  ingredients.map((i) => ({
    food_id: i.food.id,
    serving_id: i.servingId,
    quantity: i.quantity,
  }));
export function streak(meals: { eatenAt: string; status: string }[]) {
  const dates = new Set(
    meals.filter((m) => m.status === "ready").map((m) => dayKey(m.eatenAt)),
  );
  const d = new Date();
  if (!dates.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (dates.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function correctionDescription(
  analysis: import("./types").Analysis,
): string {
  const text = analysis.detections
    .map(({ food }) => {
      const serving = food.servings[0],
        amount = serving?.selected_quantity ?? serving?.quantity;
      if (!food.name || !serving?.unit || amount == null || amount <= 0)
        throw new Error(
          "The corrected food is missing an amount. Specify each ingredient and its grams in Fix results.",
        );
      return `${amount} ${serving.unit} ${food.name}`;
    })
    .join("; ");
  if (!text || text.length > 512)
    throw new Error(
      "This correction has too many ingredients. Edit the individual portions instead.",
    );
  return text;
}
