import { StyleSheet, View } from 'react-native';

import { GlucoseChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import { Button, Card, Skeleton, T } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAppWidth, useWidth } from '@/lib/hooks';
import { errorMessage } from '@/lib/january/client';
import type { FoodLog } from '@/lib/january/types';
import { useGlucosePrediction } from '@/lib/queries';
import { useApp } from '@/lib/store';

const IMPACT = {
  low: { label: 'Low impact', color: colors.success },
  medium: { label: 'Medium impact', color: colors.warning },
  high: { label: 'High impact', color: colors.danger },
} as const;

const formatMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 10) / 10} h`);

/** January's predicted glucose curve for this meal, personalized by the onboarding profile. */
export function GlucoseCard({ log }: { log: FoodLog }) {
  const profile = useApp((s) => s.profile);
  const query = useGlucosePrediction(log);
  // Screen padding (18) and card padding (16) on each side.
  const [width, onLayout] = useWidth(useAppWidth() - 68);

  if (!profile) return null;
  const prediction = query.data;
  const impact = prediction?.impact_score ? IMPACT[prediction.impact_score] : null;
  const color = impact?.color ?? colors.text;
  const peak = prediction?.points.length
    ? prediction.points.reduce((a, b) => (b.value > a.value ? b : a))
    : null;

  let body;
  if (profile.condition === 'type_1_diabetes') {
    body = (
      <T variant="caption">January’s glucose model doesn’t support type 1 diabetes, so predictions are turned off.</T>
    );
  } else if (prediction) {
    body = (
      <>
        <GlucoseChart
          points={prediction.points}
          low={prediction.chart.min ?? 70}
          high={prediction.chart.max ?? 140}
          width={width}
          color={color}
        />
        {peak ? (
          <T variant="caption">
            Peaks around {Math.round(peak.value)} mg/dL about {formatMinutes(peak.minutes)} after eating. The shaded band
            is the target range.
          </T>
        ) : null}
      </>
    );
  } else if (query.error) {
    body = (
      <View style={styles.error}>
        <T variant="caption" style={styles.flex}>
          {errorMessage(query.error)}
        </T>
        <Button size="sm" variant="muted" title="Retry" onPress={() => query.refetch()} />
      </View>
    );
  } else {
    body = (
      <>
        <Skeleton height={120} style={styles.skeleton} />
        <T variant="caption">Predicting your glucose response…</T>
      </>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <Icon name="pulse-outline" size={18} color={colors.text} />
          <T variant="label">Blood sugar impact</T>
        </View>
        {impact ? (
          <View style={[styles.badge, { backgroundColor: `${impact.color}1F` }]}>
            <T style={[styles.badgeText, { color: impact.color }]}>{impact.label}</T>
          </View>
        ) : null}
      </View>
      <View onLayout={onLayout} style={styles.body}>
        {body}
      </View>
      <T style={styles.footnote}>Predicted by January AI · not medical advice</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  body: { gap: 8 },
  skeleton: { borderRadius: 12 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  footnote: { fontSize: 11, color: colors.textFaint, fontWeight: '500' },
});
