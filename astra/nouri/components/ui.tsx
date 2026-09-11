import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import { router, usePathname } from "expo-router";
import { GlassSurface } from "./Glass";
import { touchFeedback } from "../lib/haptics";
export const C = {
  ink: "#202337",
  muted: "#747A91",
  line: "#E6E9F3",
  paper: "#FFFFFF",
  bg: "#F5F7FD",
  sage: "#E7EDDF",
  green: "#526546",
  orange: "#AA7650",
  error: "#9F453B",
  blue: "#397AE9",
  blueSoft: "#E8F1FF",
  violet: "#8170EB",
  violetSoft: "#EEEAFE",
  coral: "#EF9468",
  pink: "#D77FA6",
};
export function T({
  children,
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      {...props}
      style={[
        {
          fontSize: 14,
          color: C.ink,
          fontFamily: Platform.OS === "ios" ? "System" : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <Path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
      </>
    ),
    chart: (
      <>
        <Path d="M4 3v17h17" />
        <Path d="m7 14 4-5 4 3 6-7" />
      </>
    ),
    settings: (
      <>
        <Circle cx="12" cy="8" r="4" />
        <Path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    plus: <Path d="M12 5v14M5 12h14" />,
    minus: <Path d="M5 12h14" />,
    drop: <Path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z" />,
    gear: (
      <>
        <Path d="m10 3 .5-1h3l.5 1 1 2 2-.3 1-.6 2 2-.6 1L19 10l2 1v3l-2 1 .4 2 1 .9-2 2-1-.6-2-.3-1 2h-4l-1-2-2 .3-1 .6-2-2 1-.9.4-2-2-1v-3l2-1-.4-2-1-1 2-2 1 .6L9 5Z" />
        <Circle cx="12" cy="12" r="3" />
      </>
    ),
    close: <Path d="m6 6 12 12M18 6 6 18" />,
    back: <Path d="m14 5-7 7 7 7" />,
    arrow: <Path d="M4 12h16m-6-6 6 6-6 6" />,
    camera: (
      <>
        <Path d="M3 7h4l2-3h6l2 3h4v14H3Z" />
        <Circle cx="12" cy="13" r="4" />
      </>
    ),
    image: (
      <>
        <Rect x="3" y="3" width="18" height="18" rx="3" />
        <Circle cx="8" cy="8" r="1.5" />
        <Path d="m4 18 6-6 4 4 3-3 4 5" />
      </>
    ),
    barcode: (
      <>
        <Path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4M7 7v10M10 7v10M14 7v10M17 7v10" />
      </>
    ),
    search: (
      <>
        <Circle cx="10" cy="10" r="6.5" />
        <Path d="m15 15 6 6" />
      </>
    ),
    text: (
      <>
        <Path d="M4 5h16M4 10h16M4 15h11M4 20h8" />
      </>
    ),
    leaf: (
      <>
        <Path d="M20 3C6 2 1 9 6 16c6 6 14 0 14-13Z" />
        <Path d="M4 21 15 10" />
      </>
    ),
    flame: (
      <Path d="M13 2c1 7-5 7-3 12-3-1-3-4-3-4C-2 24 25 26 19 12c-1-3-4-5-6-10Z" />
    ),
    check: <Path d="m5 12 4 4L20 5" />,
    refresh: (
      <>
        <Path d="M20 8a8 8 0 1 0 0 9M20 3v6h-6" />
      </>
    ),
    spark: (
      <>
        <Path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </>
    ),
    trash: (
      <>
        <Path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.leaf}
    </Svg>
  );
}
export function Button({
  label,
  onPress,
  kind = "dark",
  icon,
  disabled = false,
  loading = false,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "dark" | "light" | "ghost";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        touchFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        kind === "dark"
          ? {
              backgroundColor: C.ink,
              boxShadow: "0 6px 15px rgba(32,35,55,0.12)",
            }
          : kind === "light"
            ? { backgroundColor: C.blueSoft }
            : {
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: C.line,
              },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={kind === "dark" ? "white" : C.ink} />
      ) : (
        icon && (
          <Icon
            name={icon}
            color={kind === "dark" ? "white" : C.ink}
            size={19}
          />
        )
      )}
      <T
        style={{
          fontSize: 16,
          fontWeight: "600",
          color: kind === "dark" ? "white" : C.ink,
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}
export function IconButton({
  name,
  onPress,
  label,
}: {
  name: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        touchFeedback();
        onPress();
      }}
      style={s.iconButton}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Card({
  children,
  style,
  tone = "light",
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: "light" | "dark";
}) {
  return (
    <GlassSurface tone={tone} style={[{ padding: 22 }, style]}>
      {children}
    </GlassSurface>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  numeric = false,
  multiline = false,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  // Keep a trailing decimal while the parent stores the numeric value.
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft((current) =>
      numeric &&
      (Object.is(Number(current), Number(value)) ||
        (/^[+-]?\.?$/.test(current) && (value === "" || value === "NaN")))
        ? current
        : value,
    );
  }, [value, numeric]);
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <T style={s.label}>{label}</T>
      <TextInput
        accessibilityLabel={label}
        value={numeric ? draft : value}
        onChangeText={(text) => {
          setDraft(text);
          onChangeText(text);
        }}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#9B9F94"
        maxLength={maxLength}
        style={[
          s.input,
          multiline && {
            height: 112,
            textAlignVertical: "top",
            paddingTop: 16,
          },
        ]}
      />
    </View>
  );
}
export function Chips<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: TValue; label: string }[];
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {label && <T style={s.label}>{label}</T>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: value === o.value }}
            onPress={() => onChange(o.value)}
            style={[
              s.chip,
              value === o.value && {
                backgroundColor: C.ink,
                borderColor: C.ink,
              },
            ]}
          >
            <T
              style={{
                fontSize: 13,
                color: value === o.value ? "white" : C.ink,
                fontWeight: "500",
              }}
            >
              {o.label}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Notice({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={s.notice}>
      <Icon name="spark" size={18} color={C.error} />
      <T style={{ color: C.error, lineHeight: 21, flex: 1 }}>{message}</T>
    </View>
  );
}
export function Ring({
  size = 180,
  progress = 0,
  stroke = 10,
  color = C.violet,
  trackColor = C.line,
  children,
}: {
  size?: number;
  progress?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
export function LineChart({
  points,
  height = 160,
  unit = "mg/dL",
  xLabels,
}: {
  points: { x: number; y: number }[];
  height?: number;
  unit?: string;
  xLabels?: { start: string; end?: string };
}) {
  if (!points.length) return <T>No readings yet.</T>;
  const minimum = Math.min(...points.map((p) => p.y)),
    maximum = Math.max(...points.map((p) => p.y)),
    low = Math.floor(unit === "kg" ? minimum - 1 : minimum * 0.85),
    high = Math.max(
      low + (unit === "kg" ? 2 : 20),
      Math.ceil(unit === "kg" ? maximum + 1 : maximum * 1.12),
    ),
    minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(minX + 1, ...points.map((p) => p.x));
  const coords = points
    .map(
      (p) =>
        `${points.length === 1 ? 167 : 32 + ((p.x - minX) / (maxX - minX)) * 270},${12 + ((high - p.y) / (high - low)) * (height - 40)}`,
    )
    .join(" ");
  return (
    <View>
      <T style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        {unit} · {Math.round(low)}–{Math.round(high)}
      </T>
      <Svg width="100%" height={height} viewBox={`0 0 324 ${height}`}>
        <Line
          x1="32"
          x2="302"
          y1={height - 28}
          y2={height - 28}
          stroke={C.line}
        />
        <Line
          x1="32"
          x2="302"
          y1="20"
          y2="20"
          stroke={C.line}
          strokeDasharray="4 5"
        />
        <Polyline
          points={coords}
          fill="none"
          stroke={C.green}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.length === 1 && (
          <Circle
            cx="167"
            cy={12 + ((high - points[0]!.y) / (high - low)) * (height - 40)}
            r="4"
            fill={C.green}
          />
        )}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T style={s.caption}>
          {xLabels?.start ?? `${minX}${unit === "mg/dL" ? " min" : ""}`}
        </T>
        <T style={s.caption}>
          {xLabels
            ? (xLabels.end ?? "")
            : `${maxX}${unit === "mg/dL" ? " min" : ""}`}
        </T>
      </View>
    </View>
  );
}
export function Page({
  children,
  title,
  subtitle,
  back = false,
  action,
  scroll = true,
  spacing = 20,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
  scroll?: boolean;
  spacing?: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      {title && (
        <View style={s.pageHeader}>
          <View style={[s.row, { gap: 12, flex: 1 }]}>
            {back && (
              <IconButton
                name="back"
                label="Go back"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/")
                }
              />
            )}
            <View style={{ flex: 1 }}>
              <T style={s.h2}>{title}</T>
              {subtitle && <T style={s.caption}>{subtitle}</T>}
            </View>
          </View>
          {action}
        </View>
      )}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{
            padding: 24,
            paddingTop: title ? 8 : 24,
            paddingBottom: 110,
            gap: spacing,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}
export function Tabs() {
  const path = usePathname();
  if (path === "/onboarding" || path === "/add" || path.startsWith("/meal"))
    return null;
  return (
    <GlassSurface liquid style={s.tabs}>
      {[
        { name: "home", label: "Today", path: "/" },
        { name: "chart", label: "Progress", path: "/progress" },
        { name: "settings", label: "You", path: "/settings" },
      ].map((item) => (
        <Pressable
          key={item.path}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => router.replace(item.path as any)}
          style={[s.tab, path === item.path && { backgroundColor: "#E8EBFA" }]}
        >
          <Icon
            name={item.name}
            color={path === item.path ? C.blue : C.muted}
          />
          <T
            style={{
              fontSize: 10,
              fontWeight: "600",
              color: path === item.path ? C.blue : C.muted,
            }}
          >
            {item.label}
          </T>
        </Pressable>
      ))}
    </GlassSurface>
  );
}
export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { fontSize: 36, fontWeight: "600", letterSpacing: -1.5, lineHeight: 41 },
  h2: { fontSize: 23, fontWeight: "600", letterSpacing: -0.7 },
  h3: { fontSize: 17, fontWeight: "600", letterSpacing: -0.3 },
  caption: { fontSize: 12, color: C.muted, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "600", color: C.muted },
  card: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    boxShadow: "0 5px 20px rgba(46,65,117,0.04)",
  },
  button: {
    minHeight: 52,
    borderRadius: 27,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "white",
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.ink,
  },
  chip: {
    maxWidth: "100%",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "white",
  },
  notice: {
    backgroundColor: "#F9EDE9",
    borderRadius: 14,
    padding: 16,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pageHeader: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tabs: {
    position: "absolute",
    bottom: 12,
    left: 20,
    right: 20,
    height: 70,
    borderRadius: 35,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 6,
  },
  tab: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
});
