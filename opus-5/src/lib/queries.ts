import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query';

import { addDays, timeZone, todayKey } from '@/lib/dates';
import { copyImage, removeImage } from '@/lib/images';
import { january } from '@/lib/january/client';
import { logToSelections } from '@/lib/january/mapping';
import type { CreateFoodLogRequest, FoodLog, UpdateFoodLogRequest } from '@/lib/january/types';
import { DIET_PREFERENCES, glucoseProfile, type Profile } from '@/lib/nutrition';
import { type MealMeta, useApp } from '@/lib/store';

export const queryClient = new QueryClient({
  defaultOptions: {
    // Every January call costs a credit, so fetch deliberately: no background refetching or blind retries
    // (the client retries the error codes January marks as retryable).
    queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 5 * 60 * 1000 },
    mutations: { retry: false },
  },
});

/** January lists at most 60 days per request; one request feeds the week strip, streak and charts. */
export const HISTORY_DAYS = 60;

export function historyRange() {
  const end = todayKey();
  return { start: addDays(end, -(HISTORY_DAYS - 1)), end };
}

export function useLogs() {
  const endUserId = useApp((s) => s.endUserId);
  const { start, end } = historyRange();
  return useQuery({
    queryKey: ['logs', endUserId, start, end],
    queryFn: async () => (await january.listFoodLogs(endUserId, start, end, timeZone())).items,
    enabled: !!endUserId,
    staleTime: 15 * 60 * 1000,
  });
}

// Writes return the hydrated log, so the cache is patched in place instead of refetching the list.
function updateCachedLogs(update: (items: FoodLog[]) => FoodLog[]) {
  queryClient.setQueriesData<FoodLog[]>({ queryKey: ['logs'] }, (old) => (old ? update(old) : old));
}

function upsertCachedLog(log: FoodLog) {
  updateCachedLogs((items) => {
    const i = items.findIndex((x) => x.id === log.id);
    return i === -1 ? [...items, log] : items.map((x, j) => (j === i ? log : x));
  });
  if (log.id) queryClient.setQueryData(['log', useApp.getState().endUserId, log.id], log);
}

/** A single log: from the history list when it's there, otherwise fetched (e.g. an old deep link). */
export function useLog(id: string | undefined) {
  const endUserId = useApp((s) => s.endUserId);
  const logs = useLogs();
  const cached = id ? logs.data?.find((l) => l.id === id) : undefined;
  const single = useQuery({
    queryKey: ['log', endUserId, id],
    queryFn: () => january.getFoodLog(endUserId, id!),
    enabled: !!id && !!endUserId && logs.isFetched && !cached,
  });
  return {
    log: cached ?? single.data,
    isLoading: !cached && (logs.isLoading || single.isLoading),
    error: cached ? null : (single.error ?? logs.error),
  };
}

export async function createLog(body: CreateFoodLogRequest, meta: MealMeta): Promise<FoodLog> {
  const { endUserId, setMeta } = useApp.getState();
  const log = await january.createFoodLog(endUserId, body);
  if (log.id) setMeta(log.id, meta);
  upsertCachedLog(log);
  return log;
}

export async function updateLog(id: string, body: UpdateFoodLogRequest): Promise<FoodLog> {
  const log = await january.updateFoodLog(useApp.getState().endUserId, id, body);
  upsertCachedLog(log);
  return log;
}

export async function deleteLog(id: string) {
  await january.deleteFoodLog(useApp.getState().endUserId, id);
  updateCachedLogs((items) => items.filter((x) => x.id !== id));
  useApp.getState().removeMeta(id);
  await removeImage(id);
}

/** Logs the same foods again, now. */
export async function relogMeal(log: FoodLog): Promise<FoodLog> {
  const meta = log.id ? useApp.getState().meta[log.id] : undefined;
  const copy = await createLog(
    { foods: logToSelections(log), name: log.name ?? undefined, eaten_at: new Date().toISOString() },
    { source: meta?.source ?? 'database', multiplier: meta?.multiplier ?? 1, imageUrl: meta?.imageUrl },
  );
  if (log.id && copy.id) await copyImage(log.id, copy.id);
  return copy;
}

export const useFood = (id: string | undefined) =>
  useQuery({ queryKey: ['food', id], queryFn: () => january.getFood(id!), enabled: !!id, staleTime: Infinity });

export const useBarcodeFood = (barcode: string | undefined) =>
  useQuery({
    queryKey: ['barcode', barcode],
    queryFn: () => january.getFoodByBarcode(barcode!),
    enabled: !!barcode,
    staleTime: Infinity,
  });

export const useFoodSearch = (query: string) =>
  useQuery({
    queryKey: ['search', query.toLowerCase()],
    queryFn: async () => (await january.searchFoods(query)).items,
    enabled: query.length >= 2,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

// Free: /credits costs nothing.
export const useCredits = () => useQuery({ queryKey: ['credits'], queryFn: january.getCredits, staleTime: 30_000 });

export function useAlternatives(foodId: string | undefined, enabled: boolean) {
  const diet = useApp((s) => s.profile?.diet ?? 'classic');
  return useQuery({
    queryKey: ['alternatives', foodId, diet],
    queryFn: async () => (await january.suggestAlternatives(foodId!, DIET_PREFERENCES[diet])).alternatives,
    enabled: enabled && !!foodId,
    staleTime: Infinity,
  });
}

const glucoseKey = (log: FoodLog, profile: Profile) =>
  JSON.stringify([logToSelections(log), log.eaten_at, glucoseProfile(profile), timeZone()]);

/** January's predicted glucose curve for a logged meal, cached per meal so reopening it is free. */
export function useGlucosePrediction(log: FoodLog | undefined) {
  const profile = useApp((s) => s.profile);
  const cached = useApp((s) => (log?.id ? s.meta[log.id]?.glucose : undefined));
  const userProfile = profile ? glucoseProfile(profile) : null;
  const key = log && profile ? glucoseKey(log, profile) : '';
  const foods = log ? logToSelections(log) : [];
  return useQuery({
    queryKey: ['glucose', key],
    queryFn: async () => {
      const prediction = await january.predictGlucose({
        user_profile: userProfile!,
        timezone: timeZone(),
        foods,
        start_time: log!.eaten_at,
      });
      if (log?.id) useApp.getState().patchMeta(log.id, { glucose: { key, prediction } });
      return prediction;
    },
    enabled: !!userProfile && foods.length > 0,
    initialData: cached?.key === key ? cached.prediction : undefined,
    staleTime: Infinity,
  });
}
