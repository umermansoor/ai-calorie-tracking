import { useId } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { colors } from '@/constants/theme';

type Point = { x: number; y: number };
const f = (n: number) => n.toFixed(1);

// SVG text doesn't inherit the page font in browsers (it falls back to a serif), so set it explicitly.
const font = Platform.OS === 'web' ? { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' } : {};

/** Smooth path through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(points: Point[]): string {
  if (!points.length) return '';
  let d = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)},${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)},${f(
      p2.y - (p3.y - p1.y) / 6,
    )} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

// SVG ids end up in url(#…) references, so keep them to safe characters.
const useSvgId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

export function GlucoseChart({
  points,
  low,
  high,
  width,
  height = 170,
  color,
}: {
  points: { minutes: number; value: number }[];
  low: number;
  high: number;
  width: number;
  height?: number;
  color: string;
}) {
  const gradientId = useSvgId('glucose');
  if (!width || points.length < 2) return <View style={{ height }} />;

  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const values = points.map((p) => p.value);
  const yMin = Math.floor(Math.min(low - 10, ...values) / 10) * 10;
  const yMax = Math.ceil(Math.max(high + 10, ...values) / 10) * 10;
  const xMax = Math.max(60, ...points.map((p) => p.minutes));
  const x = (m: number) => pad.l + (m / xMax) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.t - pad.b);

  const pts = points.map((p) => ({ x: x(p.minutes), y: y(p.value) }));
  const line = smoothPath(pts);
  const area = `${line} L${f(pts[pts.length - 1].x)},${f(y(yMin))} L${f(pts[0].x)},${f(y(yMin))} Z`;
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a));
  const ticks = [0, 60, 120, 180, 240, 300].filter((t) => t <= xMax);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect
        x={pad.l}
        y={y(high)}
        width={width - pad.l - pad.r}
        height={Math.max(0, y(low) - y(high))}
        fill={colors.success}
        opacity={0.08}
      />
      {[low, high].map((v) => (
        <Line
          key={v}
          x1={pad.l}
          x2={width - pad.r}
          y1={y(v)}
          y2={y(v)}
          stroke={colors.success}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.7}
        />
      ))}
      {[low, high].map((v) => (
        <SvgText {...font} key={`l${v}`} x={pad.l - 6} y={y(v) + 3.5} fontSize={10} fill={colors.textMuted} textAnchor="end">
          {v}
        </SvgText>
      ))}
      <Path d={area} fill={`url(#${gradientId})`} />
      <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Circle cx={x(peak.minutes)} cy={y(peak.value)} r={4.5} fill="#FFFFFF" stroke={color} strokeWidth={2.5} />
      {ticks.map((t) => (
        <SvgText {...font} key={t} x={x(t)} y={height - 5} fontSize={10} fill={colors.textMuted} textAnchor="middle">
          {t === 0 ? 'Meal' : `${t / 60}h`}
        </SvgText>
      ))}
    </Svg>
  );
}

export function LineChart({
  data,
  width,
  height = 150,
  color = colors.text,
  goal,
  format,
}: {
  data: { label: string; value: number }[];
  width: number;
  height?: number;
  color?: string;
  goal?: number;
  format: (value: number) => string;
}) {
  if (!width || data.length < 2) return <View style={{ height }} />;
  const pad = { l: 8, r: 8, t: 16, b: 22 };
  const values = data.map((d) => d.value).concat(goal !== undefined ? [goal] : []);
  const span = Math.max(1, Math.max(...values) - Math.min(...values));
  const yMin = Math.min(...values) - span * 0.15;
  const yMax = Math.max(...values) + span * 0.15;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.t - pad.b);
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }));

  return (
    <Svg width={width} height={height}>
      {goal !== undefined ? (
        <>
          <Line
            x1={pad.l}
            x2={width - pad.r}
            y1={y(goal)}
            y2={y(goal)}
            stroke={colors.success}
            strokeDasharray="5 5"
            strokeWidth={1.5}
          />
          <SvgText {...font} x={width - pad.r} y={y(goal) - 5} fontSize={10} fill={colors.success} textAnchor="end">
            {`Goal ${format(goal)}`}
          </SvgText>
        </>
      ) : null}
      <Path d={smoothPath(pts)} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#FFFFFF" stroke={color} strokeWidth={2} />
      ))}
      <SvgText {...font} x={pad.l} y={height - 5} fontSize={10} fill={colors.textMuted}>
        {data[0].label}
      </SvgText>
      <SvgText {...font} x={width - pad.r} y={height - 5} fontSize={10} fill={colors.textMuted} textAnchor="end">
        {data[data.length - 1].label}
      </SvgText>
    </Svg>
  );
}

export function BarChart({
  data,
  width,
  height = 150,
  target,
  color = colors.text,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  width: number;
  height?: number;
  target?: number;
  color?: string;
}) {
  if (!width || !data.length) return <View style={{ height }} />;
  const pad = { l: 4, r: 4, t: 12, b: 22 };
  const yMax = Math.max(1, ...data.map((d) => d.value), target ?? 0) * 1.1;
  const slot = (width - pad.l - pad.r) / data.length;
  const barWidth = Math.min(26, slot * 0.55);
  const y = (v: number) => pad.t + (1 - v / yMax) * (height - pad.t - pad.b);

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const cx = pad.l + slot * i + slot / 2;
        const top = y(d.value);
        return (
          <Rect
            key={i}
            x={cx - barWidth / 2}
            y={top}
            width={barWidth}
            height={Math.max(0, y(0) - top)}
            rx={Math.min(8, barWidth / 2)}
            fill={d.highlight ? color : '#D9D9E0'}
          />
        );
      })}
      {target ? (
        <Line
          x1={pad.l}
          x2={width - pad.r}
          y1={y(target)}
          y2={y(target)}
          stroke={colors.protein}
          strokeDasharray="5 5"
          strokeWidth={1.5}
        />
      ) : null}
      {data.map((d, i) => (
        <SvgText
          {...font}
          key={`t${i}`}
          x={pad.l + slot * i + slot / 2}
          y={height - 5}
          fontSize={10.5}
          fill={d.highlight ? colors.text : colors.textMuted}
          fontWeight={d.highlight ? '700' : '500'}
          textAnchor="middle">
          {d.label}
        </SvgText>
      ))}
    </Svg>
  );
}
