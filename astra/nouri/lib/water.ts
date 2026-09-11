export type WaterUnit = "floz" | "ml";
export type WaterState = {
  unit: WaterUnit;
  cupMl: number;
  goalMl: number;
  dailyMl: Record<string, number>;
};
const ML_PER_OZ = 29.5735295625;
export const toMl = (amount: number, unit: WaterUnit) =>
  unit === "floz" ? amount * ML_PER_OZ : amount;
export const waterAmount = (ml: number, unit: WaterUnit) =>
  unit === "floz" ? ml / ML_PER_OZ : ml;
export const defaultWater = (): WaterState => ({
  unit: "floz",
  cupMl: toMl(8, "floz"),
  goalMl: toMl(64, "floz"),
  dailyMl: {},
});
export function changeWater(
  state: WaterState,
  date: string,
  direction: 1 | -1,
): WaterState {
  const ml = Math.max(0, (state.dailyMl[date] ?? 0) + direction * state.cupMl);
  if (ml > 12000)
    throw new Error(
      "That exceeds the daily logging limit. Check your cup size in Water settings.",
    );
  return { ...state, dailyMl: { ...state.dailyMl, [date]: ml } };
}
export function waterPreferences(
  state: WaterState,
  unit: WaterUnit,
  cup: number,
  goal: number,
): WaterState {
  const cupMl = toMl(cup, unit),
    goalMl = toMl(goal, unit);
  if (
    !Number.isFinite(cupMl) ||
    cupMl < 50 ||
    cupMl > 1500 ||
    !Number.isFinite(goalMl) ||
    goalMl < 250 ||
    goalMl > 6000
  )
    throw new Error(
      "Choose a cup of 50–1,500 ml (2–50 fl oz) and a goal of 250–6,000 ml (9–200 fl oz).",
    );
  return { ...state, unit, cupMl, goalMl };
}
