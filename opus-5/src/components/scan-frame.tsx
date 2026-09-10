import { StyleSheet, View, type ViewStyle } from 'react-native';

/** The four rounded corner brackets of Cal AI's scanner viewfinder. */
export function ScanFrame({
  width,
  height,
  color = '#FFFFFF',
  thickness = 4,
  corner = 36,
}: {
  width: number;
  height: number;
  color?: string;
  thickness?: number;
  corner?: number;
}) {
  const base: ViewStyle = { position: 'absolute', width: corner, height: corner, borderColor: color };
  const r = corner / 2;
  return (
    <View style={[styles.frame, { width, height }]}>
      <View style={[base, { top: 0, left: 0, borderTopWidth: thickness, borderLeftWidth: thickness, borderTopLeftRadius: r }]} />
      <View style={[base, { top: 0, right: 0, borderTopWidth: thickness, borderRightWidth: thickness, borderTopRightRadius: r }]} />
      <View
        style={[base, { bottom: 0, left: 0, borderBottomWidth: thickness, borderLeftWidth: thickness, borderBottomLeftRadius: r }]}
      />
      <View
        style={[
          base,
          { bottom: 0, right: 0, borderBottomWidth: thickness, borderRightWidth: thickness, borderBottomRightRadius: r },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { pointerEvents: 'none' },
});
