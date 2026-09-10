import { Pressable, StyleSheet, View } from 'react-native';

import { Ring } from '@/components/ring';
import { T } from '@/components/ui';
import { colors, shadow } from '@/constants/theme';
import { keyToDate, todayKey, weekOf } from '@/lib/dates';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** This week's days; each ring fills with that day's calories against the target. */
export function WeekStrip({
  selected,
  onSelect,
  caloriesByDay,
  target,
}: {
  selected: string;
  onSelect: (day: string) => void;
  caloriesByDay: Record<string, number>;
  target: number;
}) {
  const today = todayKey();
  return (
    <View style={styles.row}>
      {weekOf(today).map((day) => {
        const date = keyToDate(day);
        const future = day > today;
        const kcal = caloriesByDay[day] ?? 0;
        const isSelected = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={date.toDateString()}
            accessibilityState={{ selected: isSelected, disabled: future }}
            disabled={future}
            onPress={() => onSelect(day)}
            style={[styles.day, isSelected && styles.daySelected]}>
            <T style={[styles.dayName, isSelected && styles.strong, future && styles.faint]}>
              {DAY_NAMES[date.getDay()]}
            </T>
            <Ring
              size={36}
              stroke={2.5}
              progress={target ? kcal / target : 0}
              color={kcal > target * 1.05 ? colors.danger : colors.text}
              track={kcal ? colors.track : '#CFCFD6'}
              dashed={!kcal}>
              <T style={[styles.dayNumber, day === today && styles.today, future && styles.faint]}>
                {date.getDate()}
              </T>
            </Ring>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  day: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 16 },
  daySelected: { backgroundColor: colors.surface, boxShadow: shadow.card },
  dayName: { fontSize: 12, lineHeight: 15, fontWeight: '600', color: colors.textMuted },
  strong: { color: colors.text },
  dayNumber: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  today: { fontWeight: '800' },
  faint: { color: colors.textFaint },
});
