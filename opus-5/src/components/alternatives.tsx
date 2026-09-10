import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Button, Card, Skeleton, T } from '@/components/ui';
import { colors } from '@/constants/theme';
import { errorMessage } from '@/lib/january/client';
import { capitalize, num, servingLabel } from '@/lib/january/mapping';
import type { AlternativeFood } from '@/lib/january/types';
import { useAlternatives } from '@/lib/queries';
import { useApp } from '@/lib/store';

/** January's healthier alternatives for a food, filtered by the user's diet. Fetched on demand (1 credit). */
export function HealthierSwaps({ foodId, foodName }: { foodId: string; foodName: string }) {
  const [requested, setRequested] = useState(false);
  const diet = useApp((s) => s.profile?.diet ?? 'classic');
  const query = useAlternatives(foodId, requested);

  let body;
  if (!requested) {
    body = (
      <>
        <T variant="caption">
          Find better-for-you alternatives to {foodName}
          {diet !== 'classic' ? ` that fit your ${diet} diet` : ''}.
        </T>
        <Button size="md" variant="secondary" icon="swap-horizontal" title="Find swaps" onPress={() => setRequested(true)} />
      </>
    );
  } else if (query.isPending) {
    body = (
      <View style={styles.list}>
        <Skeleton height={40} />
        <Skeleton height={40} />
      </View>
    );
  } else if (query.error) {
    body = <T variant="caption">{errorMessage(query.error)}</T>;
  } else if (!query.data.length) {
    body = <T variant="caption">No better alternatives found for this one. Nice pick.</T>;
  } else {
    body = (
      <View style={styles.list}>
        {query.data.slice(0, 5).map((alt, i) => (
          <SwapRow key={alt.id ?? `${alt.name}-${i}`} alt={alt} />
        ))}
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Icon name="leaf-outline" size={18} color={colors.success} />
        <T variant="label">Healthier swaps</T>
      </View>
      {body}
    </Card>
  );
}

function SwapRow({ alt }: { alt: AlternativeFood }) {
  const serving = alt.servings[0];
  const details = [
    alt.brand_name,
    serving ? servingLabel(serving.quantity, serving.unit) : null,
    `${Math.round(num(alt.nutrients, 'calories'))} cal`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!alt.id}
      onPress={() => alt.id && router.push(`/food/${alt.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <T variant="label" numberOfLines={1}>
          {capitalize(alt.name ?? 'Food')}
        </T>
        <T variant="caption" numberOfLines={1}>
          {details}
        </T>
      </View>
      {alt.id ? <Icon name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.muted,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { flex: 1, gap: 1 },
  pressed: { opacity: 0.8 },
});
