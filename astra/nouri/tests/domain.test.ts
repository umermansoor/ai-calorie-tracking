import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePortion,
  sumNutrients,
  consistent,
  healthScore,
  targetsFor,
  isoWithOffset,
} from "../lib/domain";
import { allowedEndpoint, errorAction, canRetry } from "../lib/policy";
const nutrients = (
  calories: number,
  protein = 0,
  carbohydrates = 0,
  total_fat = 0,
  fiber = 0,
  total_sugars = 0,
) =>
  Object.fromEntries(
    Object.entries({
      calories,
      protein,
      carbohydrates,
      total_fat,
      fiber,
      total_sugars,
    }).map(([k, value]) => [
      k,
      { value, unit: k === "calories" ? "kcal" : "g" },
    ]),
  );
const feta: any = {
  id: "1",
  name: "Feta",
  nutrients: nutrients(75, 4, 1, 6),
  servings: [
    {
      id: "oz",
      quantity: 1,
      unit: "oz",
      weight_grams: 28.4,
      scaling_factor: 1,
      is_primary: true,
    },
    {
      id: "100",
      quantity: 100,
      unit: "g",
      weight_grams: 100,
      scaling_factor: 100 / 28.4,
    },
  ],
};
test("image 40 g feta becomes 0.4 catalog servings, not 40", () => {
  const p = resolvePortion(
    { id: "100", quantity: 40, unit: "g", selected_quantity: null },
    feta,
  );
  assert.equal(p.quantity, 0.4);
  assert.ok(p.nutrients.calories!.value < 110);
});
test("text selected grams override the detection serving definition", () => {
  assert.equal(
    resolvePortion(
      { id: "100", quantity: 100, unit: "g", selected_quantity: 40 },
      feta,
    ).quantity,
    0.4,
  );
});
test("non-gram units divide by catalog quantity", () => {
  const f: any = {
    ...feta,
    servings: [{ id: "half", unit: "cup", quantity: 0.5, scaling_factor: 1 }],
  };
  assert.equal(
    resolvePortion(
      { id: "half", unit: "cup", quantity: 2, selected_quantity: null },
      f,
    ).quantity,
    4,
  );
});
test("unknown ids and invalid amounts block logging", () => {
  assert.throws(() =>
    resolvePortion(
      { id: null, quantity: 1, unit: "g", selected_quantity: null },
      feta,
    ),
  );
  assert.throws(() =>
    resolvePortion(
      { id: "100", quantity: -1, unit: "g", selected_quantity: null },
      feta,
    ),
  );
});
test("reconciliation allows rounding but rejects calorie explosions and macro mismatch", () => {
  assert.equal(
    consistent(
      nutrients(106, 5.7, 1.6, 8.5),
      nutrients(105.6, 5.67, 1.63, 8.49),
    ),
    true,
  );
  assert.equal(consistent(nutrients(106), nutrients(10560)), false);
  assert.equal(consistent(nutrients(106, 25), nutrients(106, 2)), false);
});
test("hydrated log nutrients are already consumed totals", () => {
  assert.equal(
    sumNutrients([nutrients(106), nutrients(15)]).calories?.value,
    121,
  );
});
test("syrupy pancakes score below fiber-rich salad", () => {
  assert.ok(
    healthScore(nutrients(450, 14, 45, 20, 13, 7)).score >
      healthScore(nutrients(600, 8, 100, 18, 2, 50)).score,
  );
});
test("profile targets obey the calorie budget", () => {
  const t = targetsFor({
    sex: "female",
    age: 30,
    height: 170,
    weight: 70,
    goal: "maintain",
    pace: "gentle",
    activity: "moderately_active",
    diet: "balanced",
  });
  assert.ok(
    Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.calories) < 10,
  );
});
test("glucose times have an explicit offset", () => {
  assert.match(isoWithOffset(new Date()), /[+-]\d\d:\d\d$/);
});
test("only used endpoints can pass the server", () => {
  assert.ok(allowedEndpoint("POST", "/food-analysis/image"));
  assert.ok(allowedEndpoint("GET", "/foods/123"));
  assert.ok(!allowedEndpoint("POST", "/auth/client-tokens"));
  assert.ok(!allowedEndpoint("GET", "//evil.com"));
  assert.ok(!allowedEndpoint("GET", "/foods/123/../../credits"));
});
test("retry codes, never creates or exhausted credits", () => {
  assert.ok(canRetry("upstream_timeout", "GET", "/foods"));
  assert.ok(!canRetry("not_implemented", "GET", "/foods"));
  assert.ok(!canRetry("credit_limit_exceeded", "GET", "/foods"));
  assert.ok(!canRetry("internal_error", "POST", "/food-logs"));
  assert.match(errorAction("unauthorized"), /developer.january.ai/);
});

test("corrected text preserves consumed grams instead of original catalog serving size", async () => {
  const { correctionDescription } = await import("../lib/domain");
  const analysis: any = {
    detections: [
      {
        food: {
          name: "feta cheese",
          servings: [{ quantity: 20, unit: "g", selected_quantity: null }],
        },
      },
      {
        food: {
          name: "cucumber",
          servings: [{ quantity: 100, unit: "g", selected_quantity: null }],
        },
      },
    ],
  };
  assert.equal(
    correctionDescription(analysis),
    "20 g feta cheese; 100 g cucumber",
  );
});
