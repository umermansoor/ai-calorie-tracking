import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type {
  Analysis,
  Food,
  FoodLog,
  Ingredient,
  Journal,
  Meal,
  Prediction,
  Profile,
  Targets,
} from "./types";
import {
  dayKey,
  daysBack,
  isoWithOffset,
  selections,
  sumNutrients,
  consistent,
  timezone,
} from "./domain";
import {
  getFood,
  rememberFood,
  request,
  resolveAnalysis,
  NutritionMismatch,
} from "./api";
import { correctionDescription } from "./domain";
import { DiaryGate, reconcileDiary, unconfirmedCreate } from "./diary";
import {
  changeWater,
  defaultWater,
  waterPreferences,
  type WaterUnit,
} from "./water";
const EMPTY: Journal = { profile: null, targets: null, meals: [], weights: [] };
const Context = createContext<ReturnType<typeof useJournal> | null>(null);
function useJournal() {
  const [journal, setJournal] = useState<Journal>(EMPTY),
    [ready, setReady] = useState(false),
    [deviceId, setDeviceId] = useState(""),
    [storageError, setStorageError] = useState("");
  const ref = useRef(journal),
    queue = useRef(Promise.resolve()),
    gate = useRef(new DiaryGate());
  ref.current = journal;
  useEffect(() => {
    (async () => {
      try {
        let id = await AsyncStorage.getItem("nouri-device");
        if (!id) {
          id = `nouri-${Crypto.randomUUID()}`;
          await AsyncStorage.setItem("nouri-device", id);
        }
        setDeviceId(id);
        const saved = await AsyncStorage.getItem("nouri-journal");
        if (saved) {
          const j: Journal = JSON.parse(saved);
          j.meals.forEach((meal) =>
            meal.ingredients.forEach((item) => rememberFood(item.food)),
          );
          j.meals = j.meals.map((m) =>
            m.status === "analyzing"
              ? {
                  ...m,
                  status: "uncertain",
                  error:
                    "This operation was interrupted. Refresh the diary before adding the meal again.",
                }
              : m,
          );
          ref.current = j;
          setJournal(j);
        }
      } catch {
        setStorageError(
          "Your browser or device blocked local storage. Enable storage and reload before logging so your diary identity is preserved.",
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const update = (fn: (j: Journal) => Journal) => {
    const next = fn(ref.current);
    ref.current = next;
    setJournal(next);
    queue.current = queue.current
      .then(() => AsyncStorage.setItem("nouri-journal", JSON.stringify(next)))
      .catch(() =>
        setStorageError(
          "This device could not save your journal. Free some storage, then refresh your diary.",
        ),
      );
  };
  const patch = (id: string, values: Partial<Meal>) =>
    update((j) => ({
      ...j,
      meals: j.meals.map((m) => (m.localId === id ? { ...m, ...values } : m)),
    }));
  const saveProfile = (profile: Profile, targets: Targets) =>
    update((j) => ({
      ...j,
      profile,
      targets,
      weights: j.weights.length
        ? j.weights
        : [{ date: dayKey(), value: profile.weight }],
    }));
  const list = async (start: string, end = start) =>
    request<{ items: FoodLog[] }>("/food-logs", {
      query: { start_date: start, end_date: end, timezone: timezone() },
      userId: deviceId,
    });
  const sync = async (date?: string) => {
    const start = date ?? daysBack(30)[0]!,
      end = date ?? dayKey();
    const { data } = await list(start, end);
    update((j) => ({
      ...j,
      meals: reconcileDiary(j.meals, data.items, start, end, () =>
        Crypto.randomUUID(),
      ),
    }));
  };
  const verifyLog = (log: FoodLog, expected: Meal["nutrients"]) =>
    consistent(expected, sumNutrients(log.foods.map((f) => f.nutrients)));
  const add = async (input: {
    name: string;
    source: string;
    photo?: string;
    text?: string;
    food?: Food;
    quantity?: number;
    servingId?: string;
  }) => {
    if (!deviceId || storageError)
      throw new Error("Enable local storage and reload before adding a meal.");
    const id = Crypto.randomUUID(),
      eatenAt = isoWithOffset(new Date());
    let creating = false;
    update((j) => ({
      ...j,
      meals: [
        ...j.meals,
        {
          localId: id,
          name: input.name,
          eatenAt,
          photo: input.photo,
          source: input.source,
          status: "analyzing",
          ingredients: [],
          nutrients: {},
        },
      ],
    }));
    try {
      let analysis: Analysis | undefined,
        ingredients: Ingredient[],
        nutrients: Meal["nutrients"];
      if (input.food) {
        const { ingredient } = await import("./domain");
        ingredients = [
          ingredient(
            input.food,
            input.servingId ?? input.food.servings[0]!.id!,
            input.quantity ?? 1,
          ),
        ];
        nutrients = sumNutrients(ingredients.map((i) => i.nutrients));
      } else {
        const path = input.text
          ? "/food-analysis/text"
          : "/food-analysis/image";
        analysis = (
          await request<Analysis>(path, {
            method: "POST",
            body: input.text ? { text: input.text } : { image: input.photo },
          })
        ).data;
        patch(id, { analysis, name: analysis.meal_name ?? input.name });
        ({ ingredients, nutrients } = await resolveAnalysis(analysis));
      }
      const name = analysis?.meal_name ?? input.name;
      patch(id, { ingredients, nutrients, name });
      creating = true;
      const { data: log } = await request<FoodLog>("/food-logs", {
        method: "POST",
        userId: deviceId,
        body: { foods: selections(ingredients), name, eaten_at: eatenAt },
      });
      patch(id, {
        log,
        status: "ready",
        nutrients: sumNutrients(log.foods.map((f) => f.nutrients)),
        warning: verifyLog(log, analysis?.total_nutrients ?? nutrients)
          ? undefined
          : "January’s saved total differs from the analysis. Review the portions below before relying on this meal.",
      });
    } catch (error) {
      patch(id, {
        status: creating && unconfirmedCreate(error) ? "uncertain" : "error",
        error:
          error instanceof Error
            ? error.message
            : "Could not analyze this meal. Try a clearer photo.",
      });
    }
    return id;
  };
  const loadIngredients = async (meal: Meal) => {
    if (meal.ingredients.length) return meal.ingredients;
    const items: Ingredient[] = [];
    const { ingredient } = await import("./domain");
    for (const f of meal.log?.foods ?? []) {
      if (!f.food_id || !f.serving.id || !f.quantity)
        throw new Error(
          "This saved food has no editable serving. Replace it using Search.",
        );
      items.push(
        ingredient(await getFood(f.food_id), f.serving.id, f.quantity),
      );
    }
    patch(meal.localId, { ingredients: items });
    return items;
  };
  const freshEtag = async (meal: Meal) => {
    const result = await list(dayKey(meal.eatenAt));
    const latest = result.data.items.find((l) => l.id === meal.log?.id);
    if (!latest || JSON.stringify(latest) !== JSON.stringify(meal.log)) {
      await sync(dayKey(meal.eatenAt));
      throw new Error(
        "This meal changed in January. The diary has been refreshed. Reopen the meal and review it before saving.",
      );
    }
    if (!result.etag)
      throw new Error(
        "January did not return the day’s version. Refresh the diary and try again.",
      );
    return result.etag;
  };
  const edit = async (
    meal: Meal,
    items: Ingredient[],
    name: string,
    analysis?: Analysis,
  ) => {
    if (!meal.log?.id)
      throw new Error("Refresh the diary to find this meal before editing it.");
    const etag = await freshEtag(meal),
      nutrients = sumNutrients(items.map((i) => i.nutrients));
    const { data: log } = await request<FoodLog>(`/food-logs/${meal.log.id}`, {
      method: "PATCH",
      etag,
      userId: deviceId,
      body: { foods: selections(items), name },
    });
    patch(meal.localId, {
      log,
      name,
      ingredients: items,
      nutrients: sumNutrients(log.foods.map((f) => f.nutrients)),
      analysis,
      prediction: undefined,
      warning: verifyLog(log, analysis?.total_nutrients ?? nutrients)
        ? undefined
        : "Saved nutrition differs from the intended portions. Review the ingredients.",
    });
  };
  const correct = async (meal: Meal, instruction: string) => {
    let original = meal.analysis;
    if (!original) {
      const ingredients = await loadIngredients(meal);
      const text = ingredients
        .map((item) => {
          const serving = item.food.servings.find(
            (s) => s.id === item.servingId,
          )!;
          return `${item.quantity * (serving.quantity ?? 1)} ${serving.unit} ${item.food.brand_name ?? ""} ${item.food.name}`;
        })
        .join("; ");
      if (text.length > 512)
        throw new Error(
          "This meal has too many ingredients for a text correction. Use Edit meal to adjust individual portions.",
        );
      original = (
        await request<Analysis>("/food-analysis/text", {
          method: "POST",
          body: { text },
        })
      ).data;
    }
    let analysis = (
      await request<Analysis>("/food-analysis/corrections", {
        method: "POST",
        body: { analysis: original, instruction },
      })
    ).data;
    let resolved: Awaited<ReturnType<typeof resolveAnalysis>>;
    try {
      resolved = await resolveAnalysis(analysis);
    } catch (error) {
      if (!(error instanceof NutritionMismatch)) throw error;
      // Corrections can inherit advisory text nutrient scaling. Re-analyze the
      // corrected physical amounts ONCE; never massage totals or retry a log.
      analysis = (
        await request<Analysis>("/food-analysis/text", {
          method: "POST",
          body: { text: correctionDescription(analysis) },
        })
      ).data;
      resolved = await resolveAnalysis(analysis);
    }
    const { ingredients, nutrients } = resolved;
    if (meal.log) {
      await edit(meal, ingredients, analysis.meal_name ?? meal.name, analysis);
    } else {
      patch(meal.localId, {
        analysis,
        ingredients,
        nutrients,
        name: analysis.meal_name ?? meal.name,
        error: undefined,
        status: "analyzing",
      });
      try {
        const { data: log } = await request<FoodLog>("/food-logs", {
          method: "POST",
          userId: deviceId,
          body: {
            name: analysis.meal_name ?? meal.name,
            foods: selections(ingredients),
            eaten_at: meal.eatenAt,
          },
        });
        patch(meal.localId, {
          log,
          status: "ready",
          nutrients: sumNutrients(log.foods.map((f) => f.nutrients)),
          warning: verifyLog(log, analysis.total_nutrients)
            ? undefined
            : "Saved total differs from the analysis. Review your portions.",
        });
      } catch (error) {
        patch(meal.localId, {
          status: unconfirmedCreate(error) ? "uncertain" : "error",
          error: unconfirmedCreate(error)
            ? "Saving could not be confirmed. Refresh the diary before trying to add this meal again."
            : error instanceof Error
              ? error.message
              : "Saving was rejected. Review your ingredients and try again.",
        });
        throw error;
      }
    }
  };
  const remove = async (meal: Meal) => {
    if (meal.log?.id) {
      const etag = await freshEtag(meal);
      await request(`/food-logs/${meal.log.id}`, {
        method: "DELETE",
        etag,
        userId: deviceId,
      });
    }
    if (meal.status === "uncertain")
      throw new Error(
        "Refresh your diary before removing an unconfirmed meal.",
      );
    update((j) => ({
      ...j,
      meals: j.meals.filter((m) => m.localId !== meal.localId),
    }));
  };
  const predict = async (meal: Meal) => {
    const p = ref.current.profile;
    if (!p) throw new Error("Finish your profile in Settings first.");
    const items = await loadIngredients(meal);
    const { data } = await request<Prediction>("/glucose/predictions", {
      method: "POST",
      body: {
        user_profile: {
          sex: p.sex,
          age: p.age,
          height: { value: p.height, unit: "cm" },
          weight: { value: p.weight, unit: "kg" },
          activity_level: p.activity,
        },
        timezone: timezone(),
        start_time: isoWithOffset(new Date(meal.eatenAt)),
        foods: selections(items),
      },
    });
    if (!data.points.length)
      throw new Error(
        "January returned no curve for this meal. Try again later.",
      );
    patch(meal.localId, {
      prediction: data,
      predictionProfile: JSON.stringify(p),
    });
  };
  const recordWeight = (value: number) => {
    if (!Number.isFinite(value) || value < 30 || value > 350)
      throw new Error("Enter a weight from 30 to 350 kg.");
    update((j) => ({
      ...j,
      weights: [
        ...j.weights.filter((w) => w.date !== dayKey()),
        { date: dayKey(), value },
      ],
      profile: j.profile ? { ...j.profile, weight: value } : null,
    }));
  };
  const reset = () =>
    update(() => ({
      ...EMPTY,
      meals: ref.current.meals,
      water: ref.current.water,
    }));
  const logWater = (date: string, direction: 1 | -1) =>
    update((j) => ({
      ...j,
      water: changeWater(j.water ?? defaultWater(), date, direction),
    }));
  const saveWaterPreferences = (unit: WaterUnit, cup: number, goal: number) =>
    update((j) => ({
      ...j,
      water: waterPreferences(j.water ?? defaultWater(), unit, cup, goal),
    }));
  return {
    journal,
    ready,
    deviceId,
    storageError,
    isUpdating: () => gate.current.isBusy,
    saveProfile,
    add: (...args: Parameters<typeof add>) =>
      gate.current.run(() => add(...args)),
    sync: (date?: string) => gate.current.run(() => sync(date)),
    edit: (...args: Parameters<typeof edit>) =>
      gate.current.run(() => edit(...args)),
    correct: (...args: Parameters<typeof correct>) =>
      gate.current.run(() => correct(...args)),
    remove: (...args: Parameters<typeof remove>) =>
      gate.current.run(() => remove(...args)),
    predict: (...args: Parameters<typeof predict>) =>
      gate.current.run(() => predict(...args)),
    loadIngredients: (...args: Parameters<typeof loadIngredients>) =>
      gate.current.run(() => loadIngredients(...args)),
    recordWeight,
    reset,
    logWater,
    saveWaterPreferences,
  };
}
export function JournalProvider({ children }: { children: React.ReactNode }) {
  const store = useJournal();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("Journal provider missing");
  return store;
}
