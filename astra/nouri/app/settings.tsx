import React, { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Button,
  C,
  Card,
  Field,
  Icon,
  Notice,
  Page,
  T,
  s,
} from "../components/ui";
import { ProfileForm, validateProfile } from "../components/ProfileForm";
import { useStore } from "../lib/store";
import { defaultProfile, targetsFor, timezone } from "../lib/domain";
import { request } from "../lib/api";
import type { Credits } from "../lib/types";
const goals = {
  lose: "Lose weight",
  maintain: "Maintain weight",
  gain: "Gain weight",
};
const diets = {
  balanced: "Balanced",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  high_protein: "High protein",
  low_carbohydrate: "Lower carb",
};
export default function Settings() {
  const store = useStore(),
    [profile, setProfile] = useState(store.journal.profile ?? defaultProfile),
    [targets, setTargets] = useState(
      store.journal.targets ?? targetsFor(defaultProfile),
    ),
    [editingProfile, setEditingProfile] = useState(false),
    [editingTargets, setEditingTargets] = useState(false),
    [credits, setCredits] = useState<Credits | null>(null),
    [connectionError, setConnectionError] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false);
  if (!store.journal.profile) return <Redirect href="/onboarding" />;
  const dirty =
    JSON.stringify(profile) !== JSON.stringify(store.journal.profile) ||
    JSON.stringify(targets) !== JSON.stringify(store.journal.targets);
  const editing = editingProfile || editingTargets || dirty;
  return (
    <Page title="Made around you." subtitle="Your profile, your preferences.">
      <Card style={{ gap: 18 }}>
        <View style={s.spread}>
          <T style={s.h3}>Your profile</T>
          <Button
            label={editingProfile ? "Close profile" : "Edit profile"}
            kind="light"
            style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 14 }}
            onPress={() => {
              setEditingProfile(!editingProfile);
              setMessage("");
            }}
          />
        </View>
        {editingProfile ? (
          <ProfileForm
            profile={profile}
            onChange={(p) => {
              setProfile(p);
              setMessage("");
            }}
          />
        ) : (
          <>
            <View style={[s.row, { gap: 10 }]}>
              {[
                { value: profile.age, unit: "years", label: "Age" },
                { value: profile.height, unit: "cm", label: "Height" },
                { value: profile.weight, unit: "kg", label: "Weight" },
              ].map((metric) => (
                <View key={metric.label} style={{ flex: 1, gap: 7 }}>
                  <T style={{ fontSize: 23, fontWeight: "600" }}>
                    {metric.value}
                    <T style={{ fontSize: 11, color: C.muted }}>
                      {" "}
                      {metric.unit}
                    </T>
                  </T>
                  <T style={s.caption}>{metric.label}</T>
                </View>
              ))}
            </View>
            <View style={{ height: 1, backgroundColor: C.line }} />
            <T style={s.caption}>
              {goals[profile.goal]} · {diets[profile.diet]}
            </T>
          </>
        )}
        {editingProfile && (
          <Button
            label="Recalculate my targets"
            kind="light"
            onPress={() => {
              if (!validateProfile(profile)) {
                setError(
                  "Enter an adult age of 18–100, height 120–230 cm and weight 30–350 kg.",
                );
                return;
              }
              setTargets(targetsFor(profile));
              setEditingTargets(true);
              setError("");
              setMessage("Targets recalculated. Review and save below.");
            }}
          />
        )}
      </Card>
      <Card style={{ gap: 17 }}>
        <View style={s.spread}>
          <T style={s.h3}>Daily targets</T>
          <Button
            label={editingTargets ? "Close targets" : "Adjust targets"}
            kind="light"
            style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 14 }}
            onPress={() => {
              setEditingTargets(!editingTargets);
              setMessage("");
            }}
          />
        </View>
        {editingTargets ? (
          <>
            <T style={s.caption}>Adjust these estimates to suit your plan.</T>
            <Field
              label="Calories"
              numeric
              value={String(targets.calories || "")}
              onChangeText={(v) =>
                setTargets({ ...targets, calories: Number(v) })
              }
            />
            <View style={[s.row, { gap: 9 }]}>
              {(["protein", "carbs", "fat"] as const).map((k) => (
                <Field
                  key={k}
                  label={`${k[0]!.toUpperCase() + k.slice(1)} · g`}
                  numeric
                  value={String(targets[k] || "")}
                  onChangeText={(v) =>
                    setTargets({ ...targets, [k]: Number(v) })
                  }
                />
              ))}
            </View>
            <T style={s.caption}>
              Energy from macros:{" "}
              {Math.round(
                targets.protein * 4 + targets.carbs * 4 + targets.fat * 9,
              ).toLocaleString()}{" "}
              kcal
            </T>
          </>
        ) : (
          <>
            <View
              style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
            >
              <T style={{ fontSize: 35, fontWeight: "600", letterSpacing: -1 }}>
                {targets.calories.toLocaleString()}
              </T>
              <T style={s.caption}>kcal per day</T>
            </View>
            <View style={[s.row, { gap: 8 }]}>
              {(
                [
                  { key: "protein", label: "Protein", color: C.blueSoft },
                  { key: "carbs", label: "Carbs", color: "#FFF0E5" },
                  { key: "fat", label: "Fat", color: "#F8EAF2" },
                ] as const
              ).map((m) => (
                <View
                  key={m.key}
                  style={{
                    flex: 1,
                    gap: 5,
                    padding: 12,
                    borderRadius: 15,
                    backgroundColor: m.color,
                  }}
                >
                  <T style={{ fontSize: 18, fontWeight: "600" }}>
                    {targets[m.key]}
                    <T style={s.caption}> g</T>
                  </T>
                  <T style={s.caption}>{m.label}</T>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
      {!!error && <Notice message={error} />}
      {!!message && (
        <View
          accessibilityRole="alert"
          style={{ padding: 16, borderRadius: 16, backgroundColor: C.blueSoft }}
        >
          <T style={{ color: C.ink, lineHeight: 20 }}>{message}</T>
        </View>
      )}
      {editing && (
        <>
          <Button
            label="Save profile & targets"
            onPress={() => {
              if (
                !validateProfile(profile) ||
                !Number.isFinite(targets.calories) ||
                targets.calories < 1000 ||
                targets.calories > 6000 ||
                [targets.protein, targets.carbs, targets.fat].some(
                  (n) => !Number.isFinite(n) || n < 0 || n > 1000,
                )
              ) {
                setError(
                  "Check your profile. Use 1,000–6,000 calories and macro targets between 0–1,000 g.",
                );
                return;
              }
              store.saveProfile(profile, targets);
              setError("");
              setMessage("Your profile and targets are saved.");
              setEditingProfile(false);
              setEditingTargets(false);
            }}
          />
          <Button
            label="Cancel changes"
            kind="ghost"
            onPress={() => {
              setProfile(store.journal.profile!);
              setTargets(store.journal.targets!);
              setEditingProfile(false);
              setEditingTargets(false);
              setError("");
              setMessage("");
            }}
          />
        </>
      )}
      <Card style={{ gap: 15 }}>
        <View style={s.spread}>
          <T style={s.h3}>January connection</T>
          <Icon name="spark" color={C.violet} />
        </View>
        <T style={s.caption}>
          Credits power meal analysis, food search and glucose predictions.
          Checking your balance is free.
        </T>
        {credits && (
          <>
            <T style={{ fontSize: 33, fontWeight: "600" }}>
              {credits.remaining_credits?.toLocaleString() ?? "Unlimited"}
              <T style={s.caption}> credits left</T>
            </T>
            <T style={s.caption}>
              {credits.plan} plan · resets{" "}
              {new Date(credits.resets_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </T>
          </>
        )}
        {!!connectionError && <Notice message={connectionError} />}
        <Button
          label="Check remaining credits"
          kind="light"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setConnectionError("");
            try {
              setCredits((await request<Credits>("/credits")).data);
            } catch (e) {
              setConnectionError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL("https://developer.january.ai")}
        >
          <T style={{ color: C.blue, fontSize: 13, paddingVertical: 6 }}>
            Get or manage a January API key ↗
          </T>
        </Pressable>
      </Card>
      <Card style={{ gap: 12 }}>
        <T style={s.h3}>Your data</T>
        <T style={s.caption}>
          Meals are saved in January. Photos, profile, water and weight history
          stay on this device. Clearing app or browser storage removes access to
          this diary.
        </T>
        <T style={s.caption}>Time zone: {timezone().replaceAll("_", " ")}</T>
        <T selectable style={{ fontSize: 10, color: C.muted }}>
          Diary ID: {store.deviceId}
        </T>
      </Card>
      {reset ? (
        <Card style={{ gap: 14 }}>
          <T style={s.h3}>Start fresh with your profile?</T>
          <T style={s.caption}>
            This resets your profile, targets and weight history. Your meals,
            water history and diary identity are kept.
          </T>
          <Button
            label="Reset profile and start over"
            onPress={() => {
              store.reset();
              router.replace("/onboarding");
            }}
          />
          <Button
            label="Keep my settings"
            kind="ghost"
            onPress={() => setReset(false)}
          />
        </Card>
      ) : (
        <Button
          label="Start over"
          kind="ghost"
          onPress={() => setReset(true)}
        />
      )}
      <T style={[s.caption, { textAlign: "center" }]}>nouri · 1.0</T>
    </Page>
  );
}
