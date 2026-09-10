import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { IconButton, T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';

/** A large number with −/+ buttons that can also be typed into. */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  max = 999,
  decimals = 0,
  big,
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  big?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clampRound = (v: number) => {
    const p = 10 ** decimals;
    return Math.round(Math.min(max, Math.max(min, v)) * p) / p;
  };
  const text = draft ?? value.toFixed(decimals);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(parsed)) onChange(clampRound(parsed));
    setDraft(null);
  };

  return (
    <View style={styles.field}>
      {label ? <T variant="caption">{label}</T> : null}
      <View style={styles.row}>
        <IconButton
          icon="remove"
          label={`Decrease ${label ?? unit}`}
          background={colors.surface}
          onPress={() => onChange(clampRound(value - step))}
        />
        <View style={styles.value}>
          <TextInput
            accessibilityLabel={label ?? unit}
            value={text}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            inputMode="decimal"
            selectTextOnFocus
            maxLength={6}
            style={[
              styles.input,
              big && styles.inputBig,
              { width: Math.max(2, text.length) * (big ? 27 : 16) + 6 },
            ]}
          />
          <T style={[styles.unit, big && styles.unitBig]}>{unit}</T>
        </View>
        <IconButton
          icon="add"
          label={`Increase ${label ?? unit}`}
          background={colors.surface}
          onPress={() => onChange(clampRound(value + step))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { backgroundColor: colors.muted, borderRadius: radius.lg, padding: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  value: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  input: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    padding: 0,
  },
  inputBig: { fontSize: 44, letterSpacing: -1 },
  unit: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  unitBig: { fontSize: 20 },
});
