import React, { useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import {
  Button,
  C,
  Card,
  Field,
  Icon,
  LineChart,
  Notice,
  Page,
  T,
  s,
} from "../components/ui";
import { useStore } from "../lib/store";
import { daysBack, energySummary, healthScore, streak } from "../lib/domain";
export default function Progress() {
  const store = useStore(),
    j = store.journal;
  const [weight, setWeight] = useState(String(j.profile?.weight ?? "")),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  if (!j.profile || !j.targets) return <Redirect href="/onboarding" />;
  const days = daysBack(7),
    energy = energySummary(j.meals, days),
    totals = energy.days.map((day) => day.total),
    max = Math.max(j.targets.calories, ...totals),
    active = energy.days.filter((day) => day.logged),
    meals = j.meals.filter((m) => m.status === "ready"),
    streakDays = streak(meals),
    average = energy.average ?? 0;
  return (
    <Page title="Your bigger picture." subtitle="Patterns, not perfection.">
      <Card
        tone="dark"
        style={{ backgroundColor: "#393650", borderWidth: 0, gap: 16 }}
      >
        <View style={s.spread}>
          <T style={{ color: "#E1DAF4", fontSize: 11, letterSpacing: 1.5 }}>
            YOUR DAILY STREAK
          </T>
          <Icon name="flame" color="#FFC6A5" />
        </View>
        {streakDays > 0 ? (
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 9 }}
          >
            <T
              style={{
                color: "white",
                fontSize: 48,
                lineHeight: 56,
                fontWeight: "600",
                letterSpacing: -1.5,
              }}
            >
              {streakDays}
            </T>
            <T style={{ color: "white", fontSize: 21 }}>
              {streakDays === 1 ? "day" : "days"} in a row
            </T>
          </View>
        ) : (
          <T style={{ color: "white", fontSize: 27, fontWeight: "600" }}>
            Ready for day one.
          </T>
        )}
        <T style={{ color: "#E1DAF4", fontSize: 13, lineHeight: 20 }}>
          {streakDays > 0
            ? "Keep it going. Log a meal each day."
            : "Log your first meal to start your streak."}
        </T>
      </Card>
      <Card style={{ gap: 20 }}>
        <View style={{ gap: 4 }}>
          <T style={s.h3}>Energy, day by day</T>
          <T style={s.caption}>Last 7 days</T>
        </View>
        <View style={{ gap: 4 }}>
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
          >
            <T style={{ fontSize: 34, fontWeight: "600", letterSpacing: -1 }}>
              {active.length ? average.toLocaleString() : "—"}
            </T>
            <T style={{ fontSize: 14, color: C.muted, letterSpacing: 0 }}>
              kcal eaten
            </T>
          </View>
          <T style={s.caption}>
            {active.length
              ? `Daily average · ${active.length} logged ${active.length === 1 ? "day" : "days"}`
              : "Log a meal to see your daily average."}
          </T>
        </View>
        <View
          style={{
            flexDirection: "row",
            height: 178,
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          {days.map((d, index) => (
            <View key={d} style={{ flex: 1, alignItems: "center", gap: 8 }}>
              <T style={{ fontSize: 9, color: C.muted }}>
                {energy.days[index]!.logged
                  ? Math.round(totals[index]!).toLocaleString()
                  : "—"}
              </T>
              <View
                style={{
                  height: 130,
                  width: "100%",
                  justifyContent: "flex-end",
                  backgroundColor: "#EEECF7",
                  borderRadius: 9,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: totals[index]
                      ? Math.max(4, (totals[index]! / max) * 130)
                      : 0,
                    backgroundColor: index === 6 ? C.violet : "#BAB0E9",
                    borderRadius: 9,
                  }}
                />
              </View>
              <T style={{ fontSize: 10, color: C.muted }}>
                {new Date(`${d}T12:00:00`).toLocaleDateString("en", {
                  weekday: "short",
                })}
              </T>
            </View>
          ))}
        </View>
        <T style={s.caption}>
          Daily target: {j.targets.calories.toLocaleString()} kcal.{"\n"}
          Days without logged meals are excluded.
        </T>
      </Card>
      <View style={[s.row, { gap: 12 }]}>
        <Card style={{ flex: 1, gap: 7, padding: 18 }}>
          <T style={{ fontSize: 28, fontWeight: "600" }}>{meals.length}</T>
          <T style={s.caption}>
            {meals.length === 1 ? "meal logged" : "meals logged"}
          </T>
          <T style={{ fontSize: 10, color: C.muted }}>All time</T>
        </Card>
        <Card style={{ flex: 1, gap: 7, padding: 18 }}>
          <T style={{ fontSize: 28, fontWeight: "600" }}>
            {meals.length
              ? (
                  meals.reduce(
                    (a, m) => a + healthScore(m.nutrients).score,
                    0,
                  ) / meals.length
                ).toFixed(1)
              : "—"}
            <T style={{ fontSize: 13, color: C.muted }}> / 10</T>
          </T>
          <T style={s.caption}>Nouri score</T>
          <T style={{ fontSize: 10, color: C.muted }}>All-meal average</T>
        </Card>
      </View>
      <Card style={{ gap: 15 }}>
        <View style={s.spread}>
          <T style={s.h3}>Weight over time</T>
          <T style={s.caption}>kg</T>
        </View>
        <LineChart
          unit="kg"
          points={j.weights.map((w) => ({
            x: new Date(`${w.date}T12:00:00`).getTime() / 86400000,
            y: w.value,
          }))}
          xLabels={{
            start: j.weights[0]
              ? new Date(`${j.weights[0].date}T12:00:00`).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" },
                )
              : "",
            end:
              j.weights.length > 1
                ? new Date(
                    `${j.weights.at(-1)!.date}T12:00:00`,
                  ).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : undefined,
          }}
          height={135}
        />
        <T style={s.caption}>
          {j.weights.length < 2
            ? "Add your weight on another day to see a trend."
            : `${j.weights.length} weigh-ins recorded`}
        </T>
        <Field
          label="Today’s weight · kg"
          value={weight}
          numeric
          onChangeText={(v) => {
            setWeight(v);
            setSaved(false);
          }}
        />
        {!!error && <Notice message={error} />}
        <Button
          label={saved ? "Weight saved" : "Record weight"}
          kind="light"
          icon={saved ? "check" : "plus"}
          onPress={() => {
            try {
              store.recordWeight(Number(weight));
              setError("");
              setSaved(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      </Card>
      <T style={[s.caption, { textAlign: "center" }]}>Your pace is your own.</T>
    </Page>
  );
}
