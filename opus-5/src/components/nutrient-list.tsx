import { StyleSheet, View } from 'react-native';

import { formatAmount } from '@/components/macros';
import { Card, T } from '@/components/ui';
import { colors } from '@/constants/theme';
import type { NutrientKey, Nutrients } from '@/lib/january/types';

const ROWS: [NutrientKey, string][] = [
  ['fiber', 'Fiber'],
  ['total_sugars', 'Sugar'],
  ['added_sugars', 'Added sugar'],
  ['net_carbohydrates', 'Net carbs'],
  ['saturated_fat', 'Saturated fat'],
  ['trans_fat', 'Trans fat'],
  ['cholesterol', 'Cholesterol'],
  ['sodium', 'Sodium'],
  ['potassium', 'Potassium'],
  ['calcium', 'Calcium'],
  ['iron', 'Iron'],
  ['vitamin_d', 'Vitamin D'],
];

/** Only nutrients January has values for (its maps are sparse: missing means unknown, not zero). */
export function NutrientList({ nutrients }: { nutrients: Nutrients }) {
  const rows = ROWS.flatMap(([key, label]) => {
    const amount = nutrients[key];
    return amount ? [{ key, label, amount }] : [];
  });
  if (!rows.length) return null;
  return (
    <Card style={styles.card}>
      <T variant="label" style={styles.title}>
        More nutrients
      </T>
      {rows.map(({ key, label, amount }, i) => (
        <View key={key} style={[styles.row, i > 0 && styles.divider]}>
          <T color={colors.textMuted}>{label}</T>
          <T variant="label">
            {formatAmount(amount.value)} {amount.unit}
          </T>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 6 },
  title: { paddingVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
