import React, { useId, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import { useStore } from "../lib/store";
import { defaultWater, waterAmount, type WaterUnit } from "../lib/water";
import { touchFeedback } from "../lib/haptics";
import { Button, C, Card, Chips, Field, Icon, Notice, T, s } from "./ui";
const rounded = (v: number) => Number(v.toFixed(1));
export function WaterCard({ date }: { date: string }) {
  const store = useStore(),
    water = store.journal.water ?? defaultWater(),
    ml = water.dailyMl[date] ?? 0;
  const [settings, setSettings] = useState(false),
    [unit, setUnit] = useState<WaterUnit>(water.unit),
    [cup, setCup] = useState(""),
    [goal, setGoal] = useState(""),
    [error, setError] = useState("");
  const clip = `water${useId().replace(/[^a-z0-9]/gi, "")}`,
    progress = Math.min(1, ml / water.goalMl),
    amount = rounded(waterAmount(ml, water.unit)),
    cups = rounded(ml / water.cupMl),
    suffix = water.unit === "floz" ? "fl oz" : "ml";
  const change = (direction: 1 | -1) => {
    try {
      setError("");
      store.logWater(date, direction);
      touchFeedback();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Card style={{ padding: 17, gap: 15 }}>
      <View style={[s.row, { gap: 13 }]}>
        <View
          style={{
            width: 49,
            height: 59,
            borderRadius: 18,
            backgroundColor: C.blueSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={31} height={39} viewBox="0 0 40 50">
            <Defs>
              <ClipPath id={clip}>
                <Path d="M5 4h30l-4 41H9Z" />
              </ClipPath>
            </Defs>
            <Path
              d="M5 4h30l-4 41H9Z"
              fill="#FFFFFFA8"
              stroke="#8DACE7"
              strokeWidth="1.6"
            />
            <Rect
              x="5"
              y={39 - progress * 32}
              width="30"
              height="45"
              fill="#6BA2F6"
              clipPath={`url(#${clip})`}
            />
            {ml > 0 && (
              <Path
                d={`M5 ${39 - progress * 32}q8 -3 15 0t15 0`}
                stroke="#A6C7FF"
                strokeWidth="2"
                fill="none"
                clipPath={`url(#${clip})`}
              />
            )}
          </Svg>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[s.row, { gap: 2 }]}>
            <T style={s.h3}>Water</T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Water settings"
              onPress={() => {
                setUnit(water.unit);
                setCup(String(rounded(waterAmount(water.cupMl, water.unit))));
                setGoal(String(rounded(waterAmount(water.goalMl, water.unit))));
                setSettings(!settings);
                setError("");
              }}
              style={{
                width: 36,
                height: 32,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon name="gear" size={16} color={C.muted} />
            </Pressable>
          </View>
          <T testID="water-total" style={{ fontSize: 14, fontWeight: "500" }}>
            {amount} {suffix}{" "}
            <T style={{ fontSize: 12, color: C.muted }}>
              ({cups} {cups === 1 ? "cup" : "cups"})
            </T>
          </T>
        </View>
        <View style={[s.row, { gap: 7 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove water"
            disabled={ml <= 0}
            onPress={() => change(-1)}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: ml ? "#CDD7EC" : C.line,
              alignItems: "center",
              justifyContent: "center",
              opacity: ml ? (pressed ? 0.5 : 1) : 0.3,
            })}
          >
            <Icon name="minus" size={20} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add water"
            onPress={() => change(1)}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: C.blue,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.65 : 1,
              boxShadow: "0 4px 10px rgba(57,122,233,0.23)",
            })}
          >
            <Icon name="plus" size={22} color="white" />
          </Pressable>
        </View>
      </View>
      <View style={{ gap: 7 }}>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Daily water goal"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(progress * 100),
          }}
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: "#E6EEFA",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: 5,
              borderRadius: 3,
              backgroundColor: C.blue,
            }}
          />
        </View>
        <View style={s.spread}>
          <T style={{ fontSize: 10, color: C.muted }}>
            {progress >= 1
              ? "Daily goal reached"
              : `Goal · ${rounded(waterAmount(water.goalMl, water.unit))} ${suffix}`}
          </T>
          <T style={{ fontSize: 10, color: C.muted }}>Saved on this device</T>
        </View>
      </View>
      {settings && (
        <View style={{ gap: 15, paddingTop: 8 }}>
          <Chips
            label="Water units"
            value={unit}
            options={[
              { value: "floz", label: "fl oz" },
              { value: "ml", label: "ml" },
            ]}
            onChange={(next) => {
              const factor = next === "ml" ? 29.5735295625 : 1 / 29.5735295625;
              if (next !== unit) {
                setCup(String(rounded(Number(cup) * factor)));
                setGoal(String(rounded(Number(goal) * factor)));
              }
              setUnit(next);
            }}
          />
          <View style={[s.row, { gap: 12 }]}>
            <Field
              label={`Cup size · ${unit === "floz" ? "fl oz" : "ml"}`}
              numeric
              value={cup}
              onChangeText={setCup}
            />
            <Field
              label={`Daily water goal · ${unit === "floz" ? "fl oz" : "ml"}`}
              numeric
              value={goal}
              onChangeText={setGoal}
            />
          </View>
          <Button
            label="Save water settings"
            onPress={() => {
              try {
                store.saveWaterPreferences(unit, Number(cup), Number(goal));
                setSettings(false);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </View>
      )}
      {!!error && <Notice message={error} />}
    </Card>
  );
}
