import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { todayKey } from '@/lib/dates';
import type { GlucosePrediction } from '@/lib/january/types';
import type { Profile, Targets } from '@/lib/nutrition';

export type MealSource = 'photo' | 'label' | 'text' | 'database' | 'barcode';

/** What the app remembers about a January food log beyond what January stores. */
export type MealMeta = {
  source: MealSource;
  /** Servings multiplier shown in the meal's stepper; the logged quantities already include it. */
  multiplier: number;
  /** Items January recognized but couldn't match to a catalog food (so they aren't in the log). */
  unmatched?: string[];
  /** Remote picture (database foods, sample photo). Captured photos live in the image store. */
  imageUrl?: string;
  /** Cached so reopening a meal doesn't spend another credit. */
  glucose?: { key: string; prediction: GlucosePrediction };
};

export type PendingAnalysis = {
  id: string;
  source: MealSource;
  /** Day the meal will be logged to. */
  day: string;
  startedAt: number;
  status: 'analyzing' | 'saving' | 'error';
  error?: string;
  /** The failure was the API key (missing or rejected), so the card offers a link to get one. */
  needsKey?: boolean;
  /** What the user typed, for text analyses. */
  label?: string;
};

export type WeightEntry = { date: string; kg: number };
export type Toast = { id: number; message: string; tone: 'default' | 'error' };

type AppState = {
  /** The id January stores this user's food logs under. */
  endUserId: string;
  onboarded: boolean;
  profile: Profile | null;
  targets: Targets | null;
  weights: WeightEntry[];
  meta: Record<string, MealMeta>;

  // Session-only state (not persisted).
  pending: PendingAnalysis[];
  selectedDay: string;
  addMenuOpen: boolean;
  toast: Toast | null;

  completeOnboarding: (profile: Profile, targets: Targets) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setTargets: (targets: Targets) => void;
  logWeight: (kg: number) => void;
  setMeta: (logId: string, meta: MealMeta) => void;
  patchMeta: (logId: string, patch: Partial<MealMeta>) => void;
  removeMeta: (logId: string) => void;
  addPending: (item: PendingAnalysis) => void;
  updatePending: (id: string, patch: Partial<PendingAnalysis>) => void;
  removePending: (id: string) => void;
  setSelectedDay: (day: string) => void;
  setAddMenuOpen: (open: boolean) => void;
  showToast: (message: string, tone?: Toast['tone']) => void;
  hideToast: () => void;
  /** Starts over as a brand-new January end user. Logs under the old id stay on January's side. */
  resetAll: () => void;
};

const newEndUserId = () => `forkcast-${randomUUID()}`;

// Web server rendering has no localStorage; persist nothing there.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';
const storage: StateStorage = {
  getItem: (name) => (isServer ? null : AsyncStorage.getItem(name)),
  setItem: (name, value) => (isServer ? undefined : AsyncStorage.setItem(name, value)),
  removeItem: (name) => (isServer ? undefined : AsyncStorage.removeItem(name)),
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      endUserId: '',
      onboarded: false,
      profile: null,
      targets: null,
      weights: [],
      meta: {},
      pending: [],
      selectedDay: todayKey(),
      addMenuOpen: false,
      toast: null,

      completeOnboarding: (profile, targets) =>
        set({ profile, targets, onboarded: true, weights: [{ date: todayKey(), kg: profile.weightKg }] }),
      updateProfile: (patch) => set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : {})),
      setTargets: (targets) => set({ targets }),
      logWeight: (kg) =>
        set((s) => {
          const date = todayKey();
          const weights = [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          return { weights, profile: s.profile ? { ...s.profile, weightKg: kg } : null };
        }),
      setMeta: (logId, meta) => set((s) => ({ meta: { ...s.meta, [logId]: meta } })),
      patchMeta: (logId, patch) =>
        set((s) => (s.meta[logId] ? { meta: { ...s.meta, [logId]: { ...s.meta[logId], ...patch } } } : {})),
      removeMeta: (logId) =>
        set((s) => {
          const meta = { ...s.meta };
          delete meta[logId];
          return { meta };
        }),
      addPending: (item) => set((s) => ({ pending: [item, ...s.pending] })),
      updatePending: (id, patch) =>
        set((s) => ({ pending: s.pending.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePending: (id) => set((s) => ({ pending: s.pending.filter((p) => p.id !== id) })),
      setSelectedDay: (selectedDay) => set({ selectedDay }),
      setAddMenuOpen: (addMenuOpen) => set({ addMenuOpen }),
      showToast: (message, tone = 'default') => set({ toast: { id: Date.now(), message, tone } }),
      hideToast: () => set({ toast: null }),
      resetAll: () =>
        set({
          endUserId: newEndUserId(),
          onboarded: false,
          profile: null,
          targets: null,
          weights: [],
          meta: {},
          pending: [],
          selectedDay: todayKey(),
        }),
    }),
    {
      name: 'forkcast/state/v1',
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        endUserId: s.endUserId,
        onboarded: s.onboarded,
        profile: s.profile,
        targets: s.targets,
        weights: s.weights,
        meta: s.meta,
      }),
    },
  ),
);

export function ensureEndUserId() {
  if (!useApp.getState().endUserId) useApp.setState({ endUserId: newEndUserId() });
}

export function useHydrated() {
  const [hydrated, setHydrated] = useState(() => useApp.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useApp.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useApp.persist.hasHydrated());
    return unsubscribe;
  }, []);
  return hydrated;
}

export const showToast = (message: string, tone?: Toast['tone']) => useApp.getState().showToast(message, tone);
