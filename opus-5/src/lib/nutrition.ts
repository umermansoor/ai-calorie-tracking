import { colors } from '@/constants/theme';
import { has, num } from '@/lib/january/mapping';
import type { DietPreference, GlucoseUserProfile, Nutrients } from '@/lib/january/types';

export type Sex = 'male' | 'female';
export type Workouts = '0-2' | '3-5' | '6+';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Diet = 'classic' | 'pescatarian' | 'vegetarian' | 'vegan';
export type Condition = 'none' | 'prediabetes' | 'type_2_diabetes' | 'type_1_diabetes';
export type Units = 'imperial' | 'metric';

export type Profile = {
  sex: Sex;
  /** YYYY-MM-DD */
  birthdate: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  /** Weekly change toward the goal weight. */
  paceKg: number;
  goal: Goal;
  workouts: Workouts;
  diet: Diet;
  condition: Condition;
  units: Units;
};

export type Targets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  /** mg */
  sodium: number;
};

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function ageFromBirthdate(birthdate: string, now = new Date()): number {
  const [y, m, d] = birthdate.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

const ACTIVITY_FACTOR: Record<Workouts, number> = { '0-2': 1.375, '3-5': 1.55, '6+': 1.725 };
export const ACTIVITY_LEVEL = {
  '0-2': 'lightly_active',
  '3-5': 'moderately_active',
  '6+': 'very_active',
} as const satisfies Record<Workouts, GlucoseUserProfile['activity_level']>;

/** Daily targets: Mifflin-St Jeor BMR × activity, adjusted by the weekly pace (7,700 kcal ≈ 1 kg). */
export function computeTargets(p: Profile): Targets {
  const age = ageFromBirthdate(p.birthdate);
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[p.workouts];
  const delta = p.goal === 'maintain' ? 0 : (p.paceKg * 7700) / 7;
  const raw = p.goal === 'lose' ? tdee - delta : tdee + (p.goal === 'gain' ? delta : 0);
  const calories = Math.round(Math.max(p.sex === 'male' ? 1500 : 1200, raw) / 10) * 10;
  const protein = Math.round(clamp(1.6 * p.weightKg, 60, 220));
  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: Math.round((calories / 1000) * 14),
    sugar: Math.round((calories * 0.1) / 4),
    sodium: 2300,
  };
}

export function goalDate(p: Profile): Date | null {
  if (p.goal === 'maintain' || p.paceKg <= 0) return null;
  const weeks = Math.abs(p.weightKg - p.targetWeightKg) / p.paceKg;
  const d = new Date();
  d.setDate(d.getDate() + Math.ceil(weeks * 7));
  return d;
}

export const bmi = (heightCm: number, weightKg: number) => weightKg / (heightCm / 100) ** 2;

export function bmiCategory(value: number): { label: string; color: string } {
  if (value < 18.5) return { label: 'Underweight', color: colors.fat };
  if (value < 25) return { label: 'Healthy', color: colors.success };
  if (value < 30) return { label: 'Overweight', color: colors.carbs };
  return { label: 'Obese', color: colors.danger };
}

/**
 * A 1–10 meal score like Cal AI's. January doesn't return one, so this is an app-side heuristic over
 * nutrient density. Protein and fiber per 100 kcal help. Sugar and heavy loads of starchy (net) carbs hurt
 * most, in line with the app's focus on blood sugar; saturated fat, sodium and very large portions also hurt.
 * Uses added sugar when January provides it, otherwise discounts total sugar, since fruit and dairy sugars
 * count for less.
 */
export function healthScore(n: Nutrients): number | null {
  const kcal = num(n, 'calories');
  if (kcal <= 0) return null;
  const per100 = (x: number) => (x / kcal) * 100;
  const sugar = has(n, 'added_sugars') ? num(n, 'added_sugars') : num(n, 'total_sugars') * 0.6;
  const netCarbs = has(n, 'net_carbohydrates')
    ? num(n, 'net_carbohydrates')
    : Math.max(0, num(n, 'carbohydrates') - num(n, 'fiber'));
  let s = 5.5;
  s += Math.min(per100(num(n, 'protein')) * 0.45, 2.5);
  s += Math.min(per100(num(n, 'fiber')) * 0.9, 2);
  s -= Math.min(per100(sugar) * 0.5, 3.5);
  s -= Math.min(Math.max(per100(netCarbs) - 10, 0) * 0.15, 1.5);
  s -= Math.min(per100(num(n, 'saturated_fat')) * 0.6, 2);
  s -= Math.min(per100(num(n, 'sodium')) / 150, 1.5);
  s -= Math.min(Math.max(kcal - 700, 0) / 200, 1.5);
  return Math.round(clamp(s, 1, 10));
}

/** Calorie-weighted average of per-meal scores, so a big day doesn't count as one huge "portion". */
export function dayHealthScore(meals: Nutrients[]): number | null {
  let weighted = 0;
  let total = 0;
  for (const n of meals) {
    const score = healthScore(n);
    if (score == null) continue;
    const kcal = num(n, 'calories');
    weighted += score * kcal;
    total += kcal;
  }
  return total > 0 ? Math.round(weighted / total) : null;
}

export function healthScoreNote(score: number | null): string {
  if (score == null) return 'Log a meal to see your health score.';
  if (score >= 8) return 'Great choices: plenty of protein and fiber, little added sugar.';
  if (score >= 6) return 'Good balance. More fiber or protein would push it higher.';
  if (score >= 4) return 'Room to improve. Watch added sugar, saturated fat and sodium.';
  return 'Mostly sugary or heavy foods. Try adding vegetables and lean protein.';
}

export const healthScoreColor = (score: number | null) =>
  score == null ? colors.textFaint : score >= 7 ? colors.success : score >= 4 ? colors.warning : colors.danger;

export function formatWeight(kg: number, units: Units, digits = 0): string {
  const v = units === 'imperial' ? kgToLb(kg) : kg;
  return `${v.toFixed(digits)} ${units === 'imperial' ? 'lbs' : 'kg'}`;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const inches = Math.round(cm / CM_PER_IN);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

export const DIET_PREFERENCES: Record<Diet, DietPreference[]> = {
  classic: [],
  pescatarian: ['pescatarian'],
  vegetarian: ['vegetarian'],
  vegan: ['vegan'],
};

/** The profile January's glucose model takes, or null when it can't predict for this user (type 1). */
export function glucoseProfile(p: Profile): GlucoseUserProfile | null {
  if (p.condition === 'type_1_diabetes') return null;
  return {
    age: ageFromBirthdate(p.birthdate),
    sex: p.sex,
    height: { value: Math.round(p.heightCm), unit: 'cm' },
    weight: { value: Math.round(p.weightKg * 10) / 10, unit: 'kg' },
    activity_level: ACTIVITY_LEVEL[p.workouts],
    health_conditions: p.condition === 'none' ? [] : [p.condition],
  };
}
