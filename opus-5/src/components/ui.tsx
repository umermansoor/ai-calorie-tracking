import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons';
import { colors, radius, shadow } from '@/constants/theme';
import { formatQty } from '@/lib/january/mapping';

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export function T({
  variant = 'body',
  color,
  weight,
  align,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string; weight?: TextStyle['fontWeight']; align?: TextStyle['textAlign'] }) {
  return (
    <Text
      {...rest}
      style={[
        textStyles[variant],
        color !== undefined && { color },
        weight !== undefined && { fontWeight: weight },
        align !== undefined && { textAlign: align },
        style,
      ]}
    />
  );
}

const textStyles = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500', color: colors.text },
  label: { fontSize: 14.5, lineHeight: 20, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500', color: colors.textMuted },
});

type ButtonVariant = 'primary' | 'secondary' | 'muted' | 'danger' | 'ghost' | 'inverse' | 'onDark';

const BUTTON: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  muted: { bg: colors.muted, fg: colors.text },
  danger: { bg: '#FDECEC', fg: colors.danger },
  ghost: { bg: 'transparent', fg: colors.text },
  inverse: { bg: '#FFFFFF', fg: colors.text },
  onDark: { bg: 'rgba(255,255,255,0.14)', fg: '#FFFFFF' },
};

const BUTTON_SIZE = {
  sm: { height: 38, paddingHorizontal: 14, gap: 6 },
  md: { height: 48, paddingHorizontal: 18, gap: 8 },
  lg: { height: 56, paddingHorizontal: 22, gap: 8 },
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZE;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = BUTTON[variant];
  const dimmed = disabled && !loading;
  const fg = dimmed && variant === 'primary' ? '#FFFFFF' : v.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        BUTTON_SIZE[size],
        { backgroundColor: v.bg, borderColor: v.border ?? 'transparent' },
        dimmed && (variant === 'primary' ? styles.primaryDisabled : styles.disabled),
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} /> : null}
          <Text numberOfLines={1} style={[styles.buttonText, { color: fg }, size === 'sm' && styles.buttonTextSm]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 40,
  iconSize,
  color = colors.text,
  background = colors.muted,
  disabled,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  size?: number;
  iconSize?: number;
  color?: string;
  background?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        styles.center,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.5)} color={color} />
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}>
      {children}
    </Pressable>
  );
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 99,
  format = formatQty,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  const canDec = !disabled && value - step >= min - 1e-9;
  const canInc = !disabled && value + step <= max + 1e-9;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        disabled={!canDec}
        hitSlop={4}
        onPress={() => onChange(round2(Math.max(min, value - step)))}
        style={styles.stepperButton}>
        <Icon name="remove" size={18} color={canDec ? colors.text : colors.textFaint} />
      </Pressable>
      <Text style={styles.stepperValue}>{format(value)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        disabled={!canInc}
        hitSlop={4}
        onPress={() => onChange(round2(Math.min(max, value + step)))}
        style={styles.stepperButton}>
        <Icon name="add" size={18} color={canInc ? colors.text : colors.textFaint} />
      </Pressable>
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}>
            <T variant="label" color={active ? colors.text : colors.textMuted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  onPress,
  selected,
  icon,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={15} color={selected ? '#FFFFFF' : colors.text} /> : null}
      <T variant="label" color={selected ? '#FFFFFF' : colors.text} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

export function Skeleton({ width = '100%', height = 12, style }: { width?: DimensionValue; height?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width, height, borderRadius: height / 2, backgroundColor: '#ECECF0' }, style]} />;
}

export function ProgressBar({
  value,
  color = colors.text,
  height = 6,
  track = colors.track,
}: {
  value: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const pct = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` as DimensionValue;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: pct, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
      ))}
    </View>
  );
}

export function ScreenHeader({
  title,
  onBack,
  backIcon = 'chevron-back',
  right,
}: {
  title: string;
  onBack?: () => void;
  backIcon?: IconName;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {onBack ? <IconButton icon={backIcon} label="Back" onPress={onBack} /> : <View style={styles.headerSpacer} />}
      <T variant="label" numberOfLines={1} style={styles.headerTitle}>
        {title}
      </T>
      {right ?? <View style={styles.headerSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  primaryDisabled: { backgroundColor: '#D3D3DA' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  buttonText: { fontSize: 16.5, fontWeight: '700', letterSpacing: -0.2 },
  buttonTextSm: { fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    boxShadow: shadow.card,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  stepperButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { minWidth: 34, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  segmented: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surface, boxShadow: shadow.card },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D5D5DC' },
  dotActive: { width: 18, backgroundColor: colors.text },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16.5, fontWeight: '700' },
  headerSpacer: { width: 40 },
});
