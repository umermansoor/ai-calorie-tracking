import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

export function GlassSurface({
  children,
  style,
  liquid = false,
  tone = "light",
  ...props
}: ViewProps & { liquid?: boolean; tone?: "light" | "dark" }) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((v) => {
      if (active) setReduceTransparency(v);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  const common = [glass, style];
  if (reduceTransparency)
    return (
      <View
        {...props}
        style={[
          common,
          { backgroundColor: tone === "dark" ? "#292C46" : "#FFFFFF" },
        ]}
      >
        {children}
      </View>
    );
  if (
    liquid &&
    Platform.OS === "ios" &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  )
    return (
      <GlassView
        {...props}
        glassEffectStyle="regular"
        colorScheme={tone}
        style={[common, { backgroundColor: "transparent" }]}
      >
        {children}
      </GlassView>
    );
  return (
    <View {...props} style={common}>
      <BlurView
        tint={tone}
        intensity={38}
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: StyleSheet.flatten(style)?.borderRadius ?? 26,
            pointerEvents: "none",
            zIndex: -1,
          },
        ]}
      />
      {children}
    </View>
  );
}
const glass = {
  isolation: "isolate" as const,
  borderRadius: 26,
  overflow: "hidden" as const,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.95)",
  backgroundColor: "rgba(255,255,255,0.70)",
  boxShadow: "0 7px 24px rgba(46,65,117,0.055)",
};

export function AmbientBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        viewBox="0 0 430 900"
      >
        <Defs>
          <LinearGradient id="canvas" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F8F9FF" />
            <Stop offset="1" stopColor="#EEF5FB" />
          </LinearGradient>
          <RadialGradient id="violet">
            <Stop offset="0" stopColor="#CCC4FF" stopOpacity="0.58" />
            <Stop offset="1" stopColor="#CCC4FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="blue">
            <Stop offset="0" stopColor="#ADD7FF" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#ADD7FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="peach">
            <Stop offset="0" stopColor="#FFDBC8" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFDBC8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="430" height="900" fill="url(#canvas)" />
        <Ellipse cx="45" cy="140" rx="265" ry="270" fill="url(#violet)" />
        <Ellipse cx="450" cy="290" rx="245" ry="270" fill="url(#peach)" />
        <Ellipse cx="270" cy="690" rx="330" ry="390" fill="url(#blue)" />
      </Svg>
    </View>
  );
}
