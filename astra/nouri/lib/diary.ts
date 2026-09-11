import type { FoodLog, Meal } from "./types";
import { consistent, dayKey, sumNutrients } from "./domain";

/** Reject overlapping diary operations before issuing any paid request. */
export class DiaryGate {
  private busy = false;
  get isBusy() {
    return this.busy;
  }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy)
      throw new Error(
        "Your diary is already updating. Wait for it to finish, then try again.",
      );
    this.busy = true;
    try {
      return await operation();
    } finally {
      this.busy = false;
    }
  }
}

export function unconfirmedCreate(error: unknown) {
  const value = error as { code?: string; status?: number } | null;
  if (value?.code === "transport_error") return true;
  const status = value?.status ?? 0;
  return !(status >= 400 && status < 500 && status !== 408);
}

export function reconcileDiary(
  meals: Meal[],
  logs: FoodLog[],
  start: string,
  end: string,
  createLocalId: () => string,
): Meal[] {
  const matched = new Set<string>();
  const merged = logs.map((log): Meal => {
    const existing =
      (log.id ? meals.find((m) => m.log?.id === log.id) : undefined) ??
      meals.find(
        (m) =>
          !matched.has(m.localId) &&
          m.status === "uncertain" &&
          m.name === log.name &&
          Date.parse(m.eatenAt) === Date.parse(log.eaten_at),
      );
    if (existing) matched.add(existing.localId);
    const same = existing?.log
      ? JSON.stringify(existing.log.foods) === JSON.stringify(log.foods)
      : !!existing &&
        existing.ingredients.length === log.foods.length &&
        existing.ingredients.every((item, i) => {
          const saved = log.foods[i]!;
          return (
            item.food.id === saved.food_id &&
            item.servingId === saved.serving.id &&
            item.quantity === saved.quantity
          );
        });
    return {
      ...existing,
      localId: existing?.localId ?? log.id ?? createLocalId(),
      name: log.name ?? "Meal",
      eatenAt: log.eaten_at,
      source: existing?.source ?? "January diary",
      status: "ready",
      log,
      ingredients: same ? existing!.ingredients : [],
      nutrients: sumNutrients(log.foods.map((f) => f.nutrients)),
      analysis: same ? existing?.analysis : undefined,
      prediction: same ? existing?.prediction : undefined,
      predictionProfile: same ? existing?.predictionProfile : undefined,
      error: undefined,
      warning:
        same &&
        existing?.analysis &&
        !consistent(
          existing.analysis.total_nutrients,
          sumNutrients(log.foods.map((f) => f.nutrients)),
        )
          ? "January’s saved total differs from the analysis. Review the portions before relying on this meal."
          : same
            ? existing?.warning
            : undefined,
    };
  });
  const retained = meals.flatMap((meal): Meal[] => {
    if (matched.has(meal.localId)) return [];
    const day = dayKey(meal.eatenAt);
    if (day < start || day > end) return [meal];
    if (meal.status === "ready") return [];
    if (meal.status === "uncertain")
      return [
        {
          ...meal,
          status: "error",
          error:
            "Nothing was found in January for this draft. Discard it and add it again, or use Fix results to correct the analysis.",
        },
      ];
    return [meal];
  });
  return [...retained, ...merged];
}
