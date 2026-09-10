import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart, LineChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import { NumberField } from '@/components/number-field';
import { Ring } from '@/components/ring';
import { Sheet } from '@/components/sheet';
import { Button, Card, ProgressBar, T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { keyToDate, todayKey, weekOf } from '@/lib/dates';
import { useAppWidth, useWidth } from '@/lib/hooks';
import { bmi, bmiCategory, formatWeight, kgToLb, lbToKg } from '@/lib/nutrition';
import { useLogs } from '@/lib/queries';
import { caloriesByDay, currentStreak } from '@/lib/stats';
import { showToast, useApp } from '@/lib/store';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// BMI scale from 15 to 40, split into the standard categories.
const BMI_SEGMENTS = [
  { span: 3.5, color: colors.fat },
  { span: 6.5, color: colors.success },
  { span: 5, color: colors.carbs },
  { span: 10, color: colors.danger },
];

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const profile = useApp((s) => s.profile);
  const targets = useApp((s) => s.targets);
  const weights = useApp((s) => s.weights);
  const logs = useLogs().data;
  const [weightOpen, setWeightOpen] = useState(false);
  const chartFallback = useAppWidth() - 68; // screen + card padding
  const [lineWidth, onLineLayout] = useWidth(chartFallback);
  const [barWidth, onBarLayout] = useWidth(chartFallback);
  const kcalByDay = useMemo(() => caloriesByDay(logs), [logs]);

  if (!profile || !targets) return null;

  const imperial = profile.units === 'imperial';
  const unit = imperial ? 'lbs' : 'kg';
  const display = (kg: number) => (imperial ? kgToLb(kg) : kg);
  const digits = imperial ? 0 : 1;
  const start = weights[0]?.kg ?? profile.weightKg;
  const current = profile.weightKg;
  const goalSpan = start - profile.targetWeightKg;
  const progress =
    profile.goal === 'maintain' || Math.abs(goalSpan) < 0.1
      ? 1
      : Math.max(0, Math.min(1, (start - current) / goalSpan));

  const today = todayKey();
  const week = weekOf(today).map((day) => ({
    label: DAY_LETTERS[keyToDate(day).getDay()],
    value: Math.round(kcalByDay[day] ?? 0),
    highlight: day === today,
  }));
  const logged = week.filter((d) => d.value > 0);
  const average = logged.length ? Math.round(logged.reduce((sum, d) => sum + d.value, 0) / logged.length) : 0;
  const streak = currentStreak(kcalByDay);

  const bmiValue = bmi(profile.heightCm, current);
  const category = bmiCategory(bmiValue);
  const marker = Math.max(0, Math.min(1, (bmiValue - 15) / 25));
  const weightSeries = weights.map((w) => ({
    label: keyToDate(w.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    value: display(w.kg),
  }));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}>
      <T variant="title">Progress</T>

      <View style={styles.row}>
        <Card style={[styles.half, styles.gap6]}>
          <T variant="caption">Current weight</T>
          <T style={styles.big}>
            {display(current).toFixed(digits)}
            <T style={styles.unit}> {unit}</T>
          </T>
          <ProgressBar value={progress} />
          <T variant="caption" numberOfLines={2}>
            {profile.goal === 'maintain'
              ? 'Goal: maintain'
              : `Goal ${formatWeight(profile.targetWeightKg, profile.units, digits)}`}
          </T>
          <Button size="sm" title="Log weight" onPress={() => setWeightOpen(true)} style={styles.logButton} />
        </Card>
        <Card style={[styles.half, styles.streakCard]}>
          <Ring size={84} stroke={7} progress={Math.min(1, streak / 7)} color={colors.streak}>
            <Icon name="flame" size={30} color={streak ? colors.streak : colors.textFaint} />
          </Ring>
          <T style={styles.big}>{streak}</T>
          <T variant="caption">Day streak</T>
        </Card>
      </View>

      <Card style={styles.gap12}>
        <View style={styles.rowBetween}>
          <T variant="label">Weight progress</T>
          <T variant="caption">{Math.round(progress * 100)}% of goal</T>
        </View>
        <View onLayout={onLineLayout}>
          {weightSeries.length >= 2 ? (
            <LineChart
              data={weightSeries}
              width={lineWidth}
              goal={profile.goal === 'maintain' ? undefined : display(profile.targetWeightKg)}
              format={(v) => `${Math.round(v)} ${unit}`}
            />
          ) : (
            <View style={styles.emptyChart}>
              <Icon name="scale-outline" size={26} color={colors.textFaint} />
              <T variant="caption" align="center">
                Log your weight a few times to see your trend.
              </T>
            </View>
          )}
        </View>
      </Card>

      <Card style={styles.gap12}>
        <View style={styles.rowBetween}>
          <T variant="label">Calories this week</T>
          <T variant="caption">{average ? `Avg ${average} kcal/day` : 'Nothing logged yet'}</T>
        </View>
        <View onLayout={onBarLayout}>
          <BarChart data={week} width={barWidth} target={targets.calories} />
        </View>
        <View style={styles.legend}>
          <View style={styles.legendSwatch} />
          <T variant="caption">Daily target · {targets.calories} kcal</T>
        </View>
      </Card>

      <Card style={styles.gap12}>
        <View style={styles.rowBetween}>
          <T variant="label">Your BMI</T>
          <View style={[styles.badge, { backgroundColor: `${category.color}1F` }]}>
            <T style={[styles.badgeText, { color: category.color }]}>{category.label}</T>
          </View>
        </View>
        <T style={styles.big}>{bmiValue.toFixed(1)}</T>
        <View>
          <View style={styles.bands}>
            {BMI_SEGMENTS.map((s) => (
              <View key={s.color} style={{ flex: s.span, backgroundColor: s.color }} />
            ))}
          </View>
          <View style={[styles.marker, { left: `${marker * 100}%` }]} />
        </View>
        <T variant="caption">Underweight &lt;18.5 · Healthy 18.5–24.9 · Overweight 25–29.9 · Obese 30+</T>
      </Card>

      <WeightSheet visible={weightOpen} onClose={() => setWeightOpen(false)} />
    </ScrollView>
  );
}

function WeightSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const profile = useApp((s) => s.profile);
  const logWeight = useApp((s) => s.logWeight);
  return (
    <Sheet visible={visible} onClose={onClose} title="Log weight">
      {profile ? (
        <WeightForm
          key={String(visible)}
          initialKg={profile.weightKg}
          imperial={profile.units === 'imperial'}
          onSave={(kg) => {
            logWeight(kg);
            showToast('Weight logged');
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function WeightForm({ initialKg, imperial, onSave }: { initialKg: number; imperial: boolean; onSave: (kg: number) => void }) {
  const [value, setValue] = useState(Math.round((imperial ? kgToLb(initialKg) : initialKg) * 10) / 10);
  return (
    <>
      <NumberField
        big
        value={value}
        onChange={setValue}
        unit={imperial ? 'lb' : 'kg'}
        step={imperial ? 0.5 : 0.1}
        decimals={1}
        min={imperial ? 60 : 30}
        max={imperial ? 700 : 320}
      />
      <Button title="Save" onPress={() => onSave(imperial ? lbToKg(value) : value)} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  gap6: { gap: 6 },
  gap12: { gap: 12 },
  big: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, color: colors.text },
  unit: { fontSize: 15, fontWeight: '600', color: colors.textMuted, letterSpacing: 0 },
  logButton: { marginTop: 6 },
  streakCard: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  emptyChart: { height: 130, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.protein },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  bands: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  marker: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 18,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
