import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GetApiKeyButton } from '@/components/api-key-button';
import { Icon, MIcon } from '@/components/icons';
import { EXTRAS, MACROS, RingStatCard } from '@/components/macros';
import { MealCard, PendingCard } from '@/components/meal-card';
import { Ring } from '@/components/ring';
import { Button, Card, Dots, ProgressBar, Skeleton, T } from '@/components/ui';
import { WeekStrip } from '@/components/week-strip';
import { APP_NAME, colors, radius } from '@/constants/theme';
import { logDayKey, relativeDayLabel, todayKey } from '@/lib/dates';
import { useAppWidth, useWidth } from '@/lib/hooks';
import { errorMessage, isApiKeyError } from '@/lib/january/client';
import { logTotals, num, sumNutrients } from '@/lib/january/mapping';
import type { Nutrients } from '@/lib/january/types';
import { dayHealthScore, healthScoreColor, healthScoreNote, type Targets } from '@/lib/nutrition';
import { useLogs } from '@/lib/queries';
import { caloriesByDay, currentStreak } from '@/lib/stats';
import { useApp } from '@/lib/store';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const targets = useApp((s) => s.targets);
  const selectedDay = useApp((s) => s.selectedDay);
  const setSelectedDay = useApp((s) => s.setSelectedDay);
  const pending = useApp((s) => s.pending);
  const logsQuery = useLogs();
  const logs = logsQuery.data;

  const dayLogs = useMemo(
    () =>
      (logs ?? [])
        .filter((l) => logDayKey(l.eaten_at) === selectedDay)
        .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at)),
    [logs, selectedDay],
  );
  const kcalByDay = useMemo(() => caloriesByDay(logs), [logs]);
  const mealTotals = useMemo(() => dayLogs.map(logTotals), [dayLogs]);
  const totals = useMemo(() => sumNutrients(mealTotals), [mealTotals]);
  const streak = currentStreak(kcalByDay);
  const dayPending = pending.filter((p) => p.day === selectedDay);
  const isToday = selectedDay === todayKey();

  if (!targets) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
      refreshControl={
        Platform.OS === 'web' ? undefined : (
          <RefreshControl refreshing={logsQuery.isRefetching} onRefresh={() => void logsQuery.refetch()} />
        )
      }>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <MIcon name="food-apple" size={18} color="#FFFFFF" />
          </View>
          <T style={styles.brandText}>{APP_NAME}</T>
        </View>
        <View style={styles.streak} accessibilityLabel={`${streak} day streak`}>
          <Icon name="flame" size={17} color={streak ? colors.streak : colors.textFaint} />
          <T variant="label">{streak}</T>
        </View>
      </View>

      <WeekStrip
        selected={selectedDay}
        onSelect={setSelectedDay}
        caloriesByDay={kcalByDay}
        target={targets.calories}
      />

      {logsQuery.error ? <ApiNotice error={logsQuery.error} onRetry={() => void logsQuery.refetch()} /> : null}

      <SummaryPager totals={totals} targets={targets} healthScore={dayHealthScore(mealTotals)} />

      <View style={styles.sectionHeader}>
        <T variant="heading">Recently uploaded</T>
        {!isToday ? <T variant="caption">{relativeDayLabel(selectedDay)}</T> : null}
      </View>
      <View style={styles.list}>
        {dayPending.map((item) => (
          <PendingCard key={item.id} item={item} />
        ))}
        {logsQuery.isLoading ? (
          <>
            <MealSkeleton />
            <MealSkeleton />
          </>
        ) : dayLogs.length || dayPending.length ? (
          dayLogs.map((log) => (
            <MealCard
              key={log.id ?? log.eaten_at}
              log={log}
              onPress={() => {
                if (log.id) router.push(`/meal/${log.id}`);
              }}
            />
          ))
        ) : (
          <EmptyState isToday={isToday} />
        )}
      </View>
    </ScrollView>
  );
}

function SummaryPager({
  totals,
  targets,
  healthScore,
}: {
  totals: Nutrients;
  targets: Targets;
  healthScore: number | null;
}) {
  const [width, onLayout] = useWidth(useAppWidth());
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<'left' | 'eaten'>('left');
  const toggle = () => setMode((m) => (m === 'left' ? 'eaten' : 'left'));

  return (
    <View onLayout={onLayout} style={styles.pagerWrap}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
          <View style={[styles.page, { width }]}>
            <CaloriesCard eaten={num(totals, 'calories')} target={targets.calories} mode={mode} onPress={toggle} />
            <View style={styles.statRow}>
              {MACROS.map((m) => (
                <RingStatCard key={m.key} stat={m} eaten={num(totals, m.nutrient)} target={targets[m.key]} mode={mode} />
              ))}
            </View>
          </View>
          <View style={[styles.page, { width }]}>
            <View style={styles.statRow}>
              {EXTRAS.map((m) => (
                <RingStatCard key={m.key} stat={m} eaten={num(totals, m.nutrient)} target={targets[m.key]} mode={mode} />
              ))}
            </View>
            <HealthScoreCard score={healthScore} />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.pagerPlaceholder} />
      )}
      <Dots count={2} active={page} />
    </View>
  );
}

function CaloriesCard({
  eaten,
  target,
  mode,
  onPress,
}: {
  eaten: number;
  target: number;
  mode: 'left' | 'eaten';
  onPress: () => void;
}) {
  const left = target - eaten;
  const over = left < 0;
  return (
    <Card onPress={onPress} style={styles.caloriesCard}>
      <View style={styles.flex}>
        <T style={styles.caloriesValue}>
          {Math.round(mode === 'eaten' ? eaten : Math.abs(left))}
          {mode === 'eaten' ? <T style={styles.caloriesOf}> /{target}</T> : null}
        </T>
        <T variant="label" color={over && mode === 'left' ? colors.danger : colors.textMuted}>
          Calories {mode === 'eaten' ? 'eaten' : over ? 'over' : 'left'}
        </T>
      </View>
      <Ring size={96} stroke={9} progress={target ? eaten / target : 0} color={over ? colors.danger : colors.text}>
        <Icon name="flame" size={26} color={colors.text} />
      </Ring>
    </Card>
  );
}

function HealthScoreCard({ score }: { score: number | null }) {
  return (
    <Card style={styles.healthCard}>
      <View style={styles.rowBetween}>
        <T variant="label">Health score</T>
        <T variant="label">{score ?? '–'}/10</T>
      </View>
      <ProgressBar value={(score ?? 0) / 10} color={healthScoreColor(score)} height={7} />
      <T variant="caption">{healthScoreNote(score)}</T>
    </Card>
  );
}

function ApiNotice({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const keyProblem = isApiKeyError(error);
  return (
    <Card style={[styles.notice, keyProblem && styles.noticeWarn]}>
      <View style={styles.noticeHeader}>
        <Icon name={keyProblem ? 'key-outline' : 'cloud-offline-outline'} size={18} color={colors.text} />
        <T variant="label">{keyProblem ? 'Set up your January API key' : 'Couldn’t load your food log'}</T>
      </View>
      <T variant="caption">{errorMessage(error)}</T>
      <View style={styles.noticeActions}>
        {keyProblem ? <GetApiKeyButton /> : null}
        <Button size="sm" variant="secondary" title="Try again" onPress={onRetry} />
      </View>
    </Card>
  );
}

function EmptyState({ isToday }: { isToday: boolean }) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="camera-outline" size={24} color={colors.textMuted} />
      </View>
      <T variant="label" align="center">
        You haven’t uploaded any food
      </T>
      <T variant="caption" align="center">
        Start tracking {isToday ? 'today’s' : 'this day’s'} meals by taking a quick picture.
      </T>
      <Button size="sm" icon="scan-outline" title="Scan a meal" onPress={() => router.push('/scan')} style={styles.emptyButton} />
    </Card>
  );
}

function MealSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton width={88} height={88} style={styles.skeletonThumb} />
      <View style={styles.skeletonBody}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="45%" height={12} />
        <Skeleton width="60%" height={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 48, gap: 16 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 23, fontWeight: '800', letterSpacing: -0.7, color: colors.text },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    height: 34,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pagerWrap: { marginHorizontal: -18 },
  pagerPlaceholder: { height: 290 },
  page: { paddingHorizontal: 18, paddingVertical: 4, gap: 12 },
  statRow: { flexDirection: 'row', gap: 10 },
  caloriesCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  caloriesValue: { fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2, color: colors.text },
  caloriesOf: { fontSize: 18, fontWeight: '600', color: colors.textMuted, letterSpacing: 0 },
  healthCard: { gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 },
  list: { gap: 12 },
  notice: { gap: 8 },
  noticeWarn: { backgroundColor: '#FFF7E8' },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { alignItems: 'center', paddingVertical: 26, gap: 6 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyButton: { marginTop: 10 },
  skeletonCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  skeletonThumb: { borderRadius: 18 },
  skeletonBody: { flex: 1, justifyContent: 'center', gap: 10 },
});
