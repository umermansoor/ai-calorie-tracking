// Calendar helpers. Day keys are local "YYYY-MM-DD" strings, the same local days January groups logs by
// when we pass the device's IANA timezone.

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dayKey(new Date());

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** The Sunday-to-Saturday week containing `key`. */
export function weekOf(key: string): string[] {
  const start = addDays(key, -keyToDate(key).getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const logDayKey = (isoTimestamp: string) => dayKey(new Date(isoTimestamp));

export function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const formatMonthDay = (d: Date) => d.toLocaleDateString([], { month: 'long', day: 'numeric' });

export function relativeDayLabel(key: string): string {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return keyToDate(key).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Timestamp for a meal logged while viewing `key`: now for today, otherwise that day at the current time. */
export function eatenAtFor(key: string): string {
  const now = new Date();
  if (key === dayKey(now)) return now.toISOString();
  const d = keyToDate(key);
  d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return d.toISOString();
}
