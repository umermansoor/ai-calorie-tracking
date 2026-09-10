import { StyleSheet, View } from 'react-native';

import { MIcon, type MIconName } from '@/components/icons';
import { Ring } from '@/components/ring';
import { Card, T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import type { NutrientKey } from '@/lib/january/types';
import type { Targets } from '@/lib/nutrition';

export type Stat = {
  key: keyof Targets;
  label: string;
  nutrient: NutrientKey;
  color: string;
  icon: MIconName;
  unit: 'g' | 'mg';
};

export const MACROS: Stat[] = [
  { key: 'protein', label: 'Protein', nutrient: 'protein', color: colors.protein, icon: 'food-drumstick', unit: 'g' },
  { key: 'carbs', label: 'Carbs', nutrient: 'carbohydrates', color: colors.carbs, icon: 'barley', unit: 'g' },
  { key: 'fat', label: 'Fats', nutrient: 'total_fat', color: colors.fat, icon: 'water', unit: 'g' },
];

export const EXTRAS: Stat[] = [
  { key: 'fiber', label: 'Fiber', nutrient: 'fiber', color: colors.fiber, icon: 'leaf', unit: 'g' },
  { key: 'sugar', label: 'Sugar', nutrient: 'total_sugars', color: colors.sugar, icon: 'candy', unit: 'g' },
  { key: 'sodium', label: 'Sodium', nutrient: 'sodium', color: colors.sodium, icon: 'shaker-outline', unit: 'mg' },
];

export const formatAmount = (value: number) =>
  value >= 10 || value === 0 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);

/** Home-screen card: grams left (or over, or eaten) against the daily target, with a ring. */
export function RingStatCard({
  stat,
  eaten,
  target,
  mode,
}: {
  stat: Stat;
  eaten: number;
  target: number;
  mode: 'left' | 'eaten';
}) {
  const left = target - eaten;
  const over = left < 0;
  const value = mode === 'eaten' ? eaten : Math.abs(left);
  const status = mode === 'eaten' ? 'eaten' : over ? 'over' : 'left';
  return (
    <Card style={styles.statCard}>
      <T style={styles.statValue} numberOfLines={1}>
        {Math.round(value)}
        {stat.unit}
      </T>
      <T variant="caption" numberOfLines={1} style={over && mode === 'left' ? styles.over : undefined}>
        {stat.label} {status}
      </T>
      <View style={styles.statRing}>
        <Ring size={62} stroke={6} progress={target ? eaten / target : 0} color={over ? colors.danger : stat.color}>
          <MIcon name={stat.icon} size={18} color={stat.color} />
        </Ring>
      </View>
    </Card>
  );
}

/** Meal-detail tile: one macro's amount for the meal. */
export function MacroTile({ stat, value }: { stat: Stat; value: number }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHeader}>
        <MIcon name={stat.icon} size={15} color={stat.color} />
        <T variant="caption">{stat.label}</T>
      </View>
      <T style={styles.tileValue}>
        {formatAmount(value)}
        {stat.unit}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, gap: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  over: { color: colors.danger },
  statRing: { alignItems: 'center', marginTop: 12 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
    backgroundColor: colors.surface,
  },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileValue: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
});
