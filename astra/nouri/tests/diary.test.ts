import test from "node:test";
import assert from "node:assert/strict";
import {
  DiaryGate,
  reconcileDiary as reconcile,
  unconfirmedCreate,
} from "../lib/diary";
import type { FoodLog, Meal } from "../lib/types";
const reconcileDiary = (
  meals: Meal[],
  logs: FoodLog[],
  start: string,
  end: string,
) => reconcile(meals, logs, start, end, () => crypto.randomUUID());

const log = {
  id: "saved-1",
  name: "Salad",
  eaten_at: "2026-09-10T12:00:00-07:00",
  foods: [
    {
      food_id: "food-1",
      quantity: 0.4,
      serving: { id: "100g" },
      nutrients: { calories: { value: 106, unit: "kcal" } },
    },
  ],
} as FoodLog;
const meal: Meal = {
  localId: "draft-1",
  name: "Salad",
  eatenAt: log.eaten_at,
  source: "Photo",
  status: "uncertain",
  photo: "data:image/jpeg;base64,photo",
  ingredients: [
    {
      food: { id: "food-1" } as any,
      servingId: "100g",
      quantity: 0.4,
      nutrients: {},
    },
  ],
  nutrients: {},
  error: "Could not confirm save",
};
test("confirmed absence unlocks an interrupted draft for discard or correction", () => {
  const [result] = reconcileDiary([meal], [], "2026-09-10", "2026-09-10");
  assert.equal(result!.status, "error");
  assert.match(result!.error!, /Nothing was found.*add it again/);
});
test("refresh recovers one saved log and preserves its photo, ingredients and source", () => {
  const results = reconcileDiary([meal], [log], "2026-09-10", "2026-09-10");
  assert.equal(results.length, 1);
  assert.equal(results[0]!.localId, meal.localId);
  assert.equal(results[0]!.status, "ready");
  assert.equal(results[0]!.photo, meal.photo);
  assert.equal(results[0]!.source, "Photo");
  assert.equal(results[0]!.ingredients, meal.ingredients);
  assert.equal(results[0]!.error, undefined);
  assert.equal(results[0]!.nutrients.calories?.value, 106);
});
test("refresh leaves old drafts alone and does not match a nearby different meal", () => {
  const old = { ...meal, eatenAt: "2026-08-01T12:00:00-07:00" };
  assert.equal(reconcileDiary([old], [], "2026-09-10", "2026-09-10")[0], old);
  const nearby = { ...log, eaten_at: "2026-09-10T12:00:30-07:00" };
  assert.equal(
    reconcileDiary([meal], [nearby], "2026-09-10", "2026-09-10").length,
    2,
  );
});
test("external portion changes invalidate cached ingredients and glucose", () => {
  const saved = {
    ...meal,
    log,
    status: "ready" as const,
    prediction: {} as any,
  };
  const changed = { ...log, foods: [{ ...log.foods[0]!, quantity: 2 }] };
  const [result] = reconcileDiary(
    [saved],
    [changed],
    "2026-09-10",
    "2026-09-10",
  );
  assert.deepEqual(result!.ingredients, []);
  assert.equal(result!.prediction, undefined);
});
test("nullable January log IDs still receive unique, navigable local IDs", () => {
  const results = reconcileDiary(
    [],
    [
      { ...log, id: null },
      { ...log, id: null },
    ],
    "2026-09-10",
    "2026-09-10",
  );
  assert.equal(typeof results[0]!.localId, "string");
  assert.notEqual(results[0]!.localId, results[1]!.localId);
});
test("definitive rejected creates differ from ambiguous transport failures", () => {
  assert.equal(unconfirmedCreate({ code: "unauthorized", status: 401 }), false);
  assert.equal(
    unconfirmedCreate({ code: "rate_limit_exceeded", status: 429 }),
    false,
  );
  assert.equal(
    unconfirmedCreate({ code: "invalid_request", status: 400 }),
    false,
  );
  assert.equal(unconfirmedCreate({ code: "transport_error", status: 0 }), true);
  assert.equal(
    unconfirmedCreate({ code: "transport_error", status: 201 }),
    true,
  );
  assert.equal(
    unconfirmedCreate({ code: "internal_error", status: 500 }),
    true,
  );
});
test("refresh and writes cannot overlap; the gate releases even after failure", async () => {
  const gate = new DiaryGate();
  let finish!: () => void;
  const save = gate.run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let requests = 0;
  await assert.rejects(
    gate.run(async () => {
      requests++;
    }),
    /already updating/,
  );
  assert.equal(requests, 0);
  finish();
  await save;
  await assert.rejects(
    gate.run(async () => {
      throw new Error("rejected");
    }),
    /rejected/,
  );
  await gate.run(async () => {
    requests++;
  });
  assert.equal(requests, 1);
});
