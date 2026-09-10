import { addDays, logDayKey, todayKey } from '@/lib/dates';
import { logTotals, num } from '@/lib/january/mapping';
import type { FoodLog } from '@/lib/january/types';

export function caloriesByDay(logs: FoodLog[] | undefined): Record<string, number> {
  const byDay: Record<string, number> = {};
  for (const log of logs ?? []) {
    const day = logDayKey(log.eaten_at);
    byDay[day] = (byDay[day] ?? 0) + num(logTotals(log), 'calories');
  }
  return byDay;
}

/** Consecutive days with at least one log, ending today (or yesterday, since today isn't over). */
export function currentStreak(byDay: Record<string, number>): number {
  let day = todayKey();
  if (!byDay[day]) day = addDays(day, -1);
  let streak = 0;
  while (byDay[day]) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}
