import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/theme';

export function Ring({
  size,
  stroke,
  progress,
  color,
  track = colors.track,
  dashed,
  children,
}: {
  size: number;
  stroke: number;
  /** 0–1; clamped. */
  progress: number;
  color: string;
  track?: string;
  dashed?: boolean;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Rotate so progress starts at 12 o'clock. */}
      <View style={[StyleSheet.absoluteFill, styles.rotated]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={track}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={dashed ? '2.5 3.5' : undefined}
          />
          {p > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - p)}
            />
          ) : null}
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rotated: { transform: [{ rotate: '-90deg' }] },
});
