import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultWater,
  changeWater,
  waterAmount,
  toMl,
  waterPreferences,
} from "../lib/water";
import { Autocomplete } from "../lib/autocomplete";
import { allowedEndpoint } from "../lib/policy";
import { calorieProgress, energySummary } from "../lib/domain";

test("daily average includes logged zero-calorie days and excludes unlogged days", () => {
  const meals: any[] = [
    {
      eatenAt: "2026-09-10T12:00:00",
      status: "ready",
      nutrients: { calories: { value: 500 } },
    },
    {
      eatenAt: "2026-09-09T12:00:00",
      status: "ready",
      nutrients: { calories: { value: 0 } },
    },
    {
      eatenAt: "2026-09-08T12:00:00",
      status: "analyzing",
      nutrients: { calories: { value: 999 } },
    },
    {
      eatenAt: "2026-09-01T12:00:00",
      status: "ready",
      nutrients: { calories: { value: 999 } },
    },
  ];
  const summary = energySummary(meals, [
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
  ]);
  assert.equal(summary.average, 250);
  assert.equal(summary.loggedDays, 2);
  assert.equal(summary.days[0]!.logged, false);
  assert.equal(summary.days[1]!.logged, true);
  assert.equal(energySummary([], ["2026-09-10"]).average, null);
});

test("three default cups equal 24 US fl oz, and days stay independent", () => {
  let state = defaultWater();
  for (let i = 0; i < 3; i++) state = changeWater(state, "2026-09-10", 1);
  assert.ok(
    Math.abs(waterAmount(state.dailyMl["2026-09-10"]!, "floz") - 24) < 0.001,
  );
  assert.equal(state.dailyMl["2026-09-09"], undefined);
  state = changeWater(state, "2026-09-09", 1);
  assert.notEqual(state.dailyMl["2026-09-10"], state.dailyMl["2026-09-09"]);
});
test("removing water clamps at zero and settings preserve consumed volume", () => {
  const initial = changeWater(defaultWater(), "2026-09-10", -1);
  assert.equal(initial.dailyMl["2026-09-10"], 0);
  const added = changeWater(initial, "2026-09-10", 1);
  const changed = waterPreferences(added, "ml", 250, 2000);
  assert.equal(changed.dailyMl["2026-09-10"], added.dailyMl["2026-09-10"]);
  assert.equal(changed.cupMl, 250);
  assert.throws(() => waterPreferences(added, "ml", 0, 2000));
  assert.throws(() => waterPreferences(added, "floz", 8, NaN));
  assert.ok(Math.abs(toMl(8, "floz") - 236.588) < 0.001);
});
test("autocomplete rejects short queries, caches repeats and uses the exact endpoint", async () => {
  let count = 0;
  const auto = new Autocomplete(async (q) => {
    count++;
    return [q];
  });
  assert.deepEqual(await auto.search("b"), []);
  assert.deepEqual(await auto.search("  ban  "), ["ban"]);
  assert.deepEqual(await auto.search("ban"), ["ban"]);
  assert.equal(count, 1);
  assert.ok(allowedEndpoint("GET", "/foods/autocomplete"));
  assert.ok(!allowedEndpoint("POST", "/foods/autocomplete"));
});
test("autocomplete serializes requests and ignores stale suggestions", async () => {
  const requests: string[] = [];
  let finish!: (items: string[]) => void;
  const auto = new Autocomplete<string>((q) => {
    requests.push(q);
    return q === "ba"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve([q]);
  });
  const first = auto.search("ba");
  const stale = auto.search("ban");
  const latest = auto.search("banana");
  assert.deepEqual(requests, ["ba"]);
  finish(["ba"]);
  assert.equal(await first, null);
  assert.equal(await stale, null);
  assert.deepEqual(await latest, ["banana"]);
  assert.deepEqual(requests, ["ba", "banana"]);
});
test("calendar rings count only saved meals on the selected local day", () => {
  const meals: any[] = [
    {
      eatenAt: "2026-09-10T12:00:00",
      status: "ready",
      nutrients: { calories: { value: 500 } },
    },
    {
      eatenAt: "2026-09-10T12:00:00",
      status: "analyzing",
      nutrients: { calories: { value: 900 } },
    },
    {
      eatenAt: "2026-09-09T12:00:00",
      status: "ready",
      nutrients: { calories: { value: 1000 } },
    },
  ];
  assert.equal(calorieProgress(meals, "2026-09-10", 2000).progress, 0.25);
  assert.equal(calorieProgress(meals, "2026-09-10", 100).progress, 1);
  assert.equal(calorieProgress(meals, "2026-09-08", 2000).calories, 0);
});
test("changing query while food details load discards the old selection and serializes typeahead", async () => {
  let finish!: (food: string) => void;
  const requested: string[] = [];
  const auto = new Autocomplete(async (query) => {
    requested.push(query);
    return [query];
  });
  const detail = auto.resolve(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  auto.cancel();
  const suggestions = auto.search("pear");
  assert.deepEqual(requested, []);
  finish("old banana");
  assert.equal(await detail, null);
  assert.deepEqual(await suggestions, ["pear"]);
});
