import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GetApiKeyButton } from '@/components/api-key-button';
import { FoodThumb } from '@/components/food-thumb';
import { Icon, MIcon } from '@/components/icons';
import { MACROS } from '@/components/macros';
import { Ring } from '@/components/ring';
import { Button, Skeleton, T } from '@/components/ui';
import { colors, radius, shadow } from '@/constants/theme';
import { dismissAnalysis, retryAnalysis } from '@/lib/analyze';
import { formatTime } from '@/lib/dates';
import { useStoredImage } from '@/lib/images';
import { capitalize, logTotals, num } from '@/lib/january/mapping';
import type { FoodLog } from '@/lib/january/types';
import { type PendingAnalysis, useApp } from '@/lib/store';

export function MealCard({ log, onPress }: { log: FoodLog; onPress: () => void }) {
  const stored = useStoredImage(log.id);
  const meta = useApp((s) => (log.id ? s.meta[log.id] : undefined));
  const totals = logTotals(log);
  const image = stored ?? meta?.imageUrl ?? log.foods.find((f) => f.image_url)?.image_url ?? null;
  const title = log.name ?? capitalize(log.foods[0]?.name ?? 'Meal');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${Math.round(num(totals, 'calories'))} calories`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <FoodThumb uri={image} size={88} rounded={18} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <T variant="label" numberOfLines={1} style={styles.title}>
            {title}
          </T>
          <View style={styles.time}>
            <T style={styles.timeText}>{formatTime(log.eaten_at)}</T>
          </View>
        </View>
        <View style={styles.kcalRow}>
          <Icon name="flame" size={16} color={colors.text} />
          <T style={styles.kcal}>{Math.round(num(totals, 'calories'))} calories</T>
        </View>
        <View style={styles.macros}>
          {MACROS.map((m) => (
            <View key={m.key} style={styles.macro}>
              <MIcon name={m.icon} size={14} color={m.color} />
              <T style={styles.macroText}>{Math.round(num(totals, m.nutrient))}g</T>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

/** Eased progress toward 95% over roughly `expectedMs`; January doesn't report real progress. */
function useEstimatedProgress(startedAt: number, active: boolean, expectedMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [active]);
  const t = Math.max(0, now - startedAt) / expectedMs;
  return Math.min(95, Math.round((1 - Math.exp(-2.3 * t)) * 100));
}

export function PendingCard({ item }: { item: PendingAnalysis }) {
  const image = useStoredImage(item.id);
  const failed = item.status === 'error';
  const estimate = useEstimatedProgress(item.startedAt, !failed, item.source === 'text' ? 5000 : 12000);
  const progress = item.status === 'saving' ? Math.max(estimate, 90) : estimate;

  return (
    <View style={styles.card}>
      <View>
        <FoodThumb uri={image} size={88} rounded={18} />
        {!failed ? (
          <View style={styles.overlay}>
            <Ring size={50} stroke={4} progress={progress / 100} color="#FFFFFF" track="rgba(255,255,255,0.3)">
              <T style={styles.percent}>{progress}%</T>
            </Ring>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {failed ? (
          <>
            <T variant="label" color={colors.danger}>
              {item.needsKey ? 'January API key needed' : 'Couldn’t analyze this meal'}
            </T>
            <T variant="caption" numberOfLines={5}>
              {item.error}
            </T>
            <View style={styles.actions}>
              {item.needsKey ? <GetApiKeyButton /> : null}
              <Button
                size="sm"
                variant={item.needsKey ? 'muted' : 'primary'}
                icon="refresh"
                title="Retry"
                onPress={() => retryAnalysis(item.id)}
              />
              <Button size="sm" variant="muted" title="Remove" onPress={() => void dismissAnalysis(item.id)} />
            </View>
          </>
        ) : (
          <>
            <T variant="label" numberOfLines={1}>
              {item.status === 'saving' ? 'Saving to your log…' : item.label ? `“${item.label}”` : 'Analyzing food…'}
            </T>
            <Skeleton width="85%" height={10} />
            <Skeleton width="55%" height={10} />
            <T variant="caption">{item.status === 'saving' ? 'Almost done' : 'We’ll add it as soon as it’s ready'}</T>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  body: { flex: 1, justifyContent: 'center', gap: 7, paddingRight: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15.5 },
  time: { backgroundColor: colors.muted, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  timeText: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted },
  kcalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kcal: { fontSize: 15, fontWeight: '700', color: colors.text },
  macros: { flexDirection: 'row', gap: 14 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  macroText: { fontSize: 13, fontWeight: '600', color: colors.text },
  overlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
});
