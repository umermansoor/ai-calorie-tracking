import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Button,
  C,
  Card,
  Icon,
  IconButton,
  Notice,
  Page,
  Ring,
  T,
  s,
} from "../components/ui";
import { useStore } from "../lib/store";
import {
  calorieProgress,
  dayKey,
  daysBack,
  streak,
  sumNutrients,
  value,
} from "../lib/domain";
import { WaterCard } from "../components/WaterCard";
export default function Home() {
  const store = useStore();
  const [selected, setSelected] = useState(dayKey()),
    [error, setError] = useState(""),
    [syncing, setSyncing] = useState(false);
  const { journal } = store;
  if (!journal.profile || !journal.targets)
    return <Redirect href="/onboarding" />;
  const meals = journal.meals.filter((m) => dayKey(m.eatenAt) === selected),
    total = sumNutrients(
      meals.filter((m) => m.status === "ready").map((m) => m.nutrients),
    ),
    targets = journal.targets,
    left = targets.calories - value(total, "calories"),
    today = dayKey();
  return (
    <Page spacing={16}>
      <View style={s.spread}>
        <View style={[s.row, { gap: 8 }]}>
          <Image
            source={require("../assets/icon.png")}
            style={{ width: 27, height: 27, borderRadius: 8 }}
          />
          <T style={{ fontSize: 29, letterSpacing: -1.4, fontWeight: "600" }}>
            nouri
          </T>
        </View>
        <View
          style={{
            backgroundColor: "#FFF0E6",
            paddingHorizontal: 13,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="flame" size={17} color={C.coral} />
          <T style={{ fontWeight: "600", fontSize: 12, color: "#A45A34" }}>
            {streak(journal.meals)}-day streak
          </T>
        </View>
        <IconButton
          name="plus"
          label="Quick add meal"
          onPress={() => router.push("/add")}
        />
      </View>
      <View style={{ gap: 4 }}>
        <T style={s.caption}>
          {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </T>
        <T style={{ fontSize: 29, fontWeight: "600", letterSpacing: -1 }}>
          {selected === today ? "Make today feel good." : "A look at your day."}
        </T>
      </View>
      <View style={s.spread}>
        {daysBack(7).map((date) => {
          const d = new Date(`${date}T12:00:00`),
            active = date === selected,
            progress = calorieProgress(journal.meals, date, targets.calories);
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={`Select ${date}`}
              accessibilityState={{ selected: active }}
              accessibilityValue={{
                text: `${Math.round(progress.calories)} of ${targets.calories} calories`,
              }}
              testID={`day-ring-${date}`}
              onPress={() => setSelected(date)}
              style={{
                width: 42,
                paddingVertical: 7,
                gap: 9,
                alignItems: "center",
                borderRadius: 23,
                backgroundColor: active ? "#FFFFFFB8" : "transparent",
              }}
            >
              <T
                style={{
                  fontSize: 11,
                  color: active ? C.violet : C.muted,
                  fontWeight: active ? "700" : "400",
                }}
              >
                {d.toLocaleDateString("en", { weekday: "short" }).slice(0, 1)}
              </T>
              <Ring
                size={36}
                stroke={3}
                progress={progress.progress}
                color={progress.progress >= 1 ? "#44A38C" : C.violet}
                trackColor={active ? "#D8D0F8" : "#DDE1EB"}
              >
                <T
                  style={{
                    fontWeight: "600",
                    color: active ? C.violet : C.ink,
                  }}
                >
                  {d.getDate()}
                </T>
              </Ring>
            </Pressable>
          );
        })}
      </View>
      {meals
        .filter((m) => m.status === "analyzing")
        .map((m) => (
          <Card
            key={m.localId}
            style={{
              backgroundColor: C.sage,
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={C.green} />
            <View style={{ flex: 1, gap: 4 }}>
              <T style={{ fontWeight: "600" }}>Analyzing…</T>
              <T style={s.caption}>{m.name}</T>
            </View>
          </Card>
        ))}
      <Card style={{ padding: 18, gap: 12 }}>
        <View style={s.spread}>
          <View style={{ gap: 5 }}>
            <T style={{ fontSize: 10, letterSpacing: 1.6, color: C.muted }}>
              YOUR DAILY ENERGY
            </T>
            <T style={s.h3}>
              {left >= 0 ? "Room to nourish." : "A fuller day."}
            </T>
          </View>
          <View
            style={{
              padding: 9,
              borderRadius: 15,
              backgroundColor: C.violetSoft,
            }}
          >
            <Icon name="spark" color={C.violet} />
          </View>
        </View>
        <View style={{ alignItems: "center" }}>
          <Ring
            size={142}
            progress={value(total, "calories") / targets.calories}
            stroke={10}
            color={C.violet}
            trackColor="#E6E0FA"
          >
            <Icon name="flame" size={23} color={C.violet} />
            <T
              testID="calories-left"
              style={{
                fontSize: 39,
                fontWeight: "600",
                letterSpacing: -2,
                marginTop: 6,
              }}
            >
              {Math.round(Math.abs(left)).toLocaleString()}
            </T>
            <T style={s.caption}>calories {left >= 0 ? "left" : "over"}</T>
          </Ring>
        </View>
        <View style={[s.spread, { paddingHorizontal: 20 }]}>
          <T style={s.caption}>
            <T style={{ fontWeight: "600" }}>
              {Math.round(value(total, "calories")).toLocaleString()}
            </T>{" "}
            eaten
          </T>
          <T style={s.caption}>
            <T style={{ fontWeight: "600" }}>
              {targets.calories.toLocaleString()}
            </T>{" "}
            goal
          </T>
        </View>
        <View style={{ height: 1, backgroundColor: C.line }} />
        <View style={s.spread}>
          {(
            [
              {
                name: "Protein",
                key: "protein",
                target: targets.protein,
                color: C.blue,
              },
              {
                name: "Carbs",
                key: "carbohydrates",
                target: targets.carbs,
                color: C.coral,
              },
              {
                name: "Fat",
                key: "total_fat",
                target: targets.fat,
                color: C.pink,
              },
            ] as const
          ).map((m) => (
            <View
              key={m.name}
              style={{ alignItems: "center", gap: 7, flex: 1 }}
            >
              <Ring
                size={48}
                stroke={4}
                color={m.color}
                progress={value(total, m.key) / m.target}
              >
                <T style={{ fontSize: 15, fontWeight: "600" }}>
                  {Math.max(0, Math.round(m.target - value(total, m.key)))}
                </T>
              </Ring>
              <T style={{ fontSize: 12, fontWeight: "500" }}>{m.name}</T>
              <T style={{ fontSize: 10, color: C.muted }}>grams left</T>
            </View>
          ))}
        </View>
      </Card>
      <WaterCard key={selected} date={selected} />
      <View style={s.spread}>
        <T style={s.h3}>
          {selected === today ? "On your plate" : "Your meals"}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh diary"
          disabled={syncing}
          onPress={async () => {
            setError("");
            setSyncing(true);
            try {
              await store.sync();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSyncing(false);
            }
          }}
        >
          {syncing ? (
            <ActivityIndicator size="small" />
          ) : (
            <View style={[s.row, { gap: 5 }]}>
              <Icon name="refresh" size={13} />
              <T style={s.caption}>Refresh</T>
            </View>
          )}
        </Pressable>
      </View>
      {!!error && <Notice message={error} />}
      {!meals.length ? (
        <Card
          style={{
            backgroundColor: "#EEF2FFA8",
            borderWidth: 0,
            gap: 10,
            alignItems: "center",
            paddingVertical: 25,
          }}
        >
          <Icon name="leaf" size={29} color={C.green} />
          <T style={s.h3}>A fresh page.</T>
          <T style={[s.caption, { textAlign: "center" }]}>
            Your next meal is a good place to start.{"\n"}Snap it, search it, or
            simply describe it.
          </T>
        </Card>
      ) : (
        meals
          .sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
          .map((meal) => (
            <Pressable
              key={meal.localId}
              accessibilityRole="button"
              accessibilityLabel={`Open ${meal.name}`}
              testID={`meal-${meal.localId}`}
              onPress={() => router.push(`/meal/${meal.localId}`)}
              style={[
                s.card,
                {
                  padding: 12,
                  flexDirection: "row",
                  gap: 14,
                  alignItems: "center",
                },
              ]}
            >
              {meal.photo ? (
                <Image
                  source={{ uri: meal.photo }}
                  style={{ width: 74, height: 78, borderRadius: 16 }}
                />
              ) : (
                <View
                  style={{
                    width: 74,
                    height: 78,
                    borderRadius: 16,
                    backgroundColor: C.sage,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={meal.source === "Barcode" ? "barcode" : "leaf"}
                    size={27}
                    color={C.green}
                  />
                </View>
              )}
              <View style={{ flex: 1, gap: 6 }}>
                <T
                  numberOfLines={1}
                  style={{ fontSize: 15, fontWeight: "600" }}
                >
                  {meal.name}
                </T>
                {meal.status === "analyzing" ? (
                  <View style={[s.row, { gap: 8 }]}>
                    <ActivityIndicator size="small" />
                    <T style={s.caption}>Analyzing…</T>
                  </View>
                ) : meal.status !== "ready" ? (
                  <T style={{ fontSize: 12, color: C.error }}>
                    Needs your attention →
                  </T>
                ) : (
                  <>
                    <T style={{ fontSize: 13, fontWeight: "500" }}>
                      {Math.round(value(meal.nutrients, "calories"))}
                      <T style={s.caption}> kcal</T>
                    </T>
                    <T style={{ fontSize: 10, color: C.muted }}>
                      {Math.round(value(meal.nutrients, "protein"))} g protein ·{" "}
                      {Math.round(value(meal.nutrients, "carbohydrates"))} g
                      carbs · {Math.round(value(meal.nutrients, "total_fat"))} g
                      fat
                    </T>
                  </>
                )}
              </View>
              <T style={{ color: C.muted, fontSize: 11 }}>
                {new Date(meal.eatenAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </T>
            </Pressable>
          ))
      )}
      <Button
        label="Add a meal"
        icon="plus"
        onPress={() => {
          setSelected(today);
          router.push("/add");
        }}
      />
      <View style={[s.row, { gap: 8, justifyContent: "center" }]}>
        <Icon name="leaf" size={14} color={C.muted} />
        <T style={{ fontSize: 11, color: C.muted }}>
          Small steps count. So does enjoying your food.
        </T>
      </View>
    </Page>
  );
}
