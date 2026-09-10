import { useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, StyleSheet, View } from 'react-native';

import { colors, shadow } from '@/constants/theme';

const THUMB = 28;
const HEIGHT = 44;

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [width, setWidth] = useState(0);
  // The responder is created once, so it reads the latest props through a ref.
  const latest = useRef({ width, min, max, step, value, onChange });
  useEffect(() => {
    latest.current = { width, min, max, step, value, onChange };
  });

  const [responder] = useState(() => {
    const update = (e: GestureResponderEvent) => {
      const s = latest.current;
      if (!s.width) return;
      const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / s.width));
      const snapped = Math.round((s.min + ratio * (s.max - s.min)) / s.step) * s.step;
      const next = Math.round(Math.min(s.max, Math.max(s.min, snapped)) * 100) / 100;
      if (next !== s.value) s.onChange(next);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: update,
      onPanResponderMove: update,
    });
  });

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const nudge = (dir: 1 | -1) =>
    onChange(Math.round(Math.min(max, Math.max(min, value + dir * step)) * 100) / 100);

  return (
    <View
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.hit}>
      {/* Children ignore touches so locationX is always relative to the track. */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: ratio * width - THUMB / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: HEIGHT, justifyContent: 'center', userSelect: 'none', cursor: 'pointer' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden', pointerEvents: 'none' },
  fill: { height: 6, backgroundColor: colors.text },
  thumb: {
    position: 'absolute',
    top: (HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: shadow.raised,
    pointerEvents: 'none',
  },
});
