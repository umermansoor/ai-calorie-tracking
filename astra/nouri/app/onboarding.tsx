import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Button,
  C,
  Icon,
  IconButton,
  Notice,
  Ring,
  T,
  s,
} from "../components/ui";
import { GlassSurface } from "../components/Glass";
import { validateProfile } from "../components/ProfileForm";
import { defaultProfile, targetsFor } from "../lib/domain";
import { touchFeedback } from "../lib/haptics";
import type { Profile } from "../lib/types";
import { samples } from "../lib/photos";
import { useStore } from "../lib/store";

type Step = keyof Profile | "review";
const choices: Partial<
  Record<
    Step,
    { value: string; label: string; detail?: string; icon: string }[]
  >
> = {
  sex: [
    { value: "female", label: "Female", icon: "spark" },
    { value: "male", label: "Male", icon: "spark" },
  ],
  goal: [
    {
      value: "lose",
      label: "Lose weight",
      detail: "A little lighter, at your pace",
      icon: "leaf",
    },
    {
      value: "maintain",
      label: "Maintain weight",
      detail: "Keep a good thing going",
      icon: "spark",
    },
    {
      value: "gain",
      label: "Gain weight",
      detail: "Build strength and energy",
      icon: "chart",
    },
  ],
  pace: [
    {
      value: "gentle",
      label: "Gentle",
      detail: "About 0.25 kg per week",
      icon: "leaf",
    },
    {
      value: "steady",
      label: "Steady",
      detail: "About 0.5 kg per week",
      icon: "chart",
    },
  ],
  activity: [
    {
      value: "sedentary",
      label: "Mostly sitting",
      detail: "Little daily movement",
      icon: "text",
    },
    {
      value: "lightly_active",
      label: "Lightly active",
      detail: "Walks and light exercise",
      icon: "leaf",
    },
    {
      value: "moderately_active",
      label: "Moderately active",
      detail: "Exercise 3–5 days a week",
      icon: "flame",
    },
    {
      value: "very_active",
      label: "Very active",
      detail: "Daily training or physical work",
      icon: "chart",
    },
  ],
  diet: [
    { value: "balanced", label: "Everything", icon: "spark" },
    { value: "vegetarian", label: "Vegetarian", icon: "leaf" },
    { value: "vegan", label: "Vegan", icon: "leaf" },
    { value: "pescatarian", label: "Pescatarian", icon: "drop" },
    { value: "high_protein", label: "High protein", icon: "flame" },
    { value: "low_carbohydrate", label: "Lower carb", icon: "leaf" },
  ],
};
const copy: Record<Step, { title: string; hint: string; icon: string }> = {
  sex: {
    title: "Let’s start with you.",
    hint: "Sex helps us estimate your energy needs.",
    icon: "spark",
  },
  age: {
    title: "How old are you?",
    hint: "A starting point that fits your stage of life.",
    icon: "spark",
  },
  height: {
    title: "How tall are you?",
    hint: "One more detail for your daily targets.",
    icon: "chart",
  },
  weight: {
    title: "Your current weight?",
    hint: "Every journey has a starting point.",
    icon: "leaf",
  },
  goal: {
    title: "What’s your goal?",
    hint: "Choose what feels right for you.",
    icon: "chart",
  },
  pace: { title: "Pick your pace.", hint: "Small steps add up.", icon: "leaf" },
  activity: {
    title: "How do you move?",
    hint: "Think about a typical week.",
    icon: "flame",
  },
  diet: {
    title: "How do you eat?",
    hint: "We’ll keep your preferences in mind.",
    icon: "leaf",
  },
  review: {
    title: "Your starting point.",
    hint: "A daily plan, made around you.",
    icon: "check",
  },
};
const numbers = {
  age: { unit: "years", min: 18, max: 100, increment: 1 },
  height: { unit: "cm", min: 120, max: 230, increment: 1 },
  weight: { unit: "kg", min: 30, max: 350, increment: 0.5 },
};
export default function Onboarding() {
  const store = useStore(),
    initial = store.journal.profile ?? defaultProfile;
  const [step, setStep] = useState(0),
    [profile, setProfile] = useState<Profile>(initial),
    [error, setError] = useState("");
  const [numeric, setNumeric] = useState({
    age: String(initial.age),
    height: String(initial.height),
    weight: String(initial.weight),
  });
  const motion = useRef(new Animated.Value(0)).current;
  const steps: Step[] = [
    "sex",
    "age",
    "height",
    "weight",
    "goal",
    ...(profile.goal === "maintain" ? [] : ["pace" as const]),
    "activity",
    "diet",
    "review",
  ];
  const current = steps[step - 1],
    target = targetsFor(profile),
    isReview = current === "review";
  useEffect(() => {
    motion.setValue(12);
    Animated.timing(motion, {
      toValue: 0,
      duration: 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [step, motion]);
  const next = () => {
    Keyboard.dismiss();
    if (current && current in numbers) {
      const key = current as keyof typeof numbers,
        n = numbers[key];
      if (
        !Number.isFinite(profile[key]) ||
        profile[key] < n.min ||
        profile[key] > n.max
      ) {
        setError(`Enter ${n.min}–${n.max} ${n.unit} to continue.`);
        return;
      }
    }
    setError("");
    if (isReview) {
      if (!validateProfile(profile)) {
        setError("Go back and check your age, height and weight.");
        return;
      }
      store.saveProfile(profile, target);
      router.replace("/");
    } else setStep(step + 1);
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 12 }}
      >
        {step === 0 ? (
          <View style={[s.row, { gap: 9 }]}>
            <Image
              source={require("../assets/icon.png")}
              style={{ width: 32, height: 32, borderRadius: 10 }}
            />
            <T style={{ fontSize: 27, fontWeight: "700", letterSpacing: -1.4 }}>
              nouri
            </T>
          </View>
        ) : (
          <>
            <View style={s.spread}>
              <IconButton
                name="back"
                label="Previous step"
                onPress={() => {
                  setError("");
                  setStep(step - 1);
                }}
              />
              <T style={{ fontSize: 12, fontWeight: "600", color: C.muted }}>
                {step} of {steps.length}
              </T>
              <View style={{ width: 42, alignItems: "flex-end" }}>
                <Icon name="spark" color={C.violet} />
              </View>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Onboarding progress"
              accessibilityValue={{ min: 0, max: steps.length, now: step }}
              style={{
                height: 4,
                backgroundColor: "#DFE2F0",
                borderRadius: 4,
                marginTop: 18,
              }}
            >
              <View
                style={{
                  height: 4,
                  borderRadius: 4,
                  width: `${(step / steps.length) * 100}%`,
                  backgroundColor: C.violet,
                }}
              />
            </View>
          </>
        )}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingTop: step ? 22 : 12,
          paddingBottom: 20,
        }}
      >
        <Animated.View
          style={{ flex: 1, transform: [{ translateX: motion }], gap: 24 }}
        >
          {step === 0 ? (
            <>
              <View
                style={{
                  height: 270,
                  borderRadius: 34,
                  overflow: "hidden",
                  boxShadow: "0 15px 30px rgba(50,66,92,0.10)",
                }}
              >
                <Image
                  source={{ uri: samples[0]!.url }}
                  style={{ width: "100%", height: "100%" }}
                />
                <GlassSurface
                  style={{
                    position: "absolute",
                    bottom: 17,
                    left: 17,
                    right: 17,
                    padding: 15,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 22,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 13,
                      backgroundColor: C.violetSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="camera" color={C.violet} />
                  </View>
                  <View>
                    <T style={{ fontWeight: "600" }}>
                      One photo. More clarity.
                    </T>
                    <T style={s.caption}>Your food, understood.</T>
                  </View>
                </GlassSurface>
              </View>
              <View style={{ gap: 12 }}>
                <T
                  style={{
                    fontSize: 42,
                    lineHeight: 47,
                    fontWeight: "700",
                    letterSpacing: -1.9,
                  }}
                >
                  Eat well.{"\n"}
                  <T
                    style={{
                      fontSize: 42,
                      lineHeight: 47,
                      fontWeight: "700",
                      color: C.violet,
                    }}
                  >
                    Feel like you.
                  </T>
                </T>
                <T style={{ fontSize: 16, lineHeight: 24, color: C.muted }}>
                  Food, water, and a little everyday progress.
                </T>
              </View>
              <View style={[s.row, { gap: 9 }]}>
                {[
                  ["camera", "Photo logging"],
                  ["drop", "Daily habits"],
                ].map(([icon, label]) => (
                  <View
                    key={label}
                    style={[
                      s.row,
                      {
                        gap: 7,
                        paddingVertical: 9,
                        paddingHorizontal: 12,
                        borderRadius: 18,
                        backgroundColor: "#FFFFFF99",
                      },
                    ]}
                  >
                    <Icon name={icon!} color={C.blue} size={16} />
                    <T style={{ fontSize: 11, fontWeight: "500" }}>{label}</T>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={{ gap: 13 }}>
                <View
                  style={{
                    width: 57,
                    height: 57,
                    borderRadius: 20,
                    backgroundColor: isReview ? "#E2F3ED" : C.violetSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={copy[current!].icon}
                    color={isReview ? "#47A489" : C.violet}
                    size={27}
                  />
                </View>
                <T
                  accessibilityRole="header"
                  style={{
                    fontSize: 32,
                    lineHeight: 37,
                    fontWeight: "700",
                    letterSpacing: -1.2,
                  }}
                >
                  {copy[current!].title}
                </T>
                <T style={{ fontSize: 14, color: C.muted, lineHeight: 21 }}>
                  {copy[current!].hint}
                </T>
              </View>
              {current &&
                current in numbers &&
                (() => {
                  const key = current as keyof typeof numbers,
                    n = numbers[key];
                  const set = (text: string) => {
                    setNumeric((v) => ({ ...v, [key]: text }));
                    setProfile((p) => ({ ...p, [key]: Number(text) }));
                  };
                  return (
                    <GlassSurface
                      style={{
                        padding: 26,
                        gap: 20,
                        alignItems: "center",
                        marginTop: 15,
                      }}
                    >
                      <View style={{ alignItems: "center", width: "100%" }}>
                        <TextInput
                          accessibilityLabel={
                            key === "age"
                              ? "Age"
                              : key === "height"
                                ? "Height · cm"
                                : "Weight · kg"
                          }
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          maxLength={6}
                          value={numeric[key]}
                          onChangeText={set}
                          style={{
                            fontSize: 68,
                            lineHeight: 84,
                            fontWeight: "600",
                            letterSpacing: -3,
                            color: C.ink,
                            textAlign: "center",
                            width: "100%",
                            padding: 0,
                          }}
                        />
                        <T
                          style={{
                            fontSize: 17,
                            color: C.violet,
                            fontWeight: "500",
                          }}
                        >
                          {n.unit}
                        </T>
                      </View>
                      <View style={[s.row, { gap: 36 }]}>
                        <IconButton
                          name="minus"
                          label={`Decrease ${key}`}
                          onPress={() =>
                            set(
                              String(
                                Math.max(
                                  n.min,
                                  Number(
                                    (profile[key] - n.increment).toFixed(1),
                                  ),
                                ),
                              ),
                            )
                          }
                        />
                        <T style={s.caption}>Tap to edit</T>
                        <IconButton
                          name="plus"
                          label={`Increase ${key}`}
                          onPress={() =>
                            set(
                              String(
                                Math.min(
                                  n.max,
                                  Number(
                                    (profile[key] + n.increment).toFixed(1),
                                  ),
                                ),
                              ),
                            )
                          }
                        />
                      </View>
                    </GlassSurface>
                  );
                })()}
              {!!choices[current!] && (
                <View
                  style={{
                    flexDirection:
                      current === "sex" || current === "diet"
                        ? "row"
                        : "column",
                    flexWrap: "wrap",
                    gap: 11,
                  }}
                >
                  {choices[current!]!.map((option) => {
                    const selected =
                        profile[current as keyof Profile] === option.value,
                      grid = current === "sex" || current === "diet";
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          touchFeedback();
                          setProfile((p) => ({
                            ...p,
                            [current!]: option.value,
                          }));
                        }}
                        style={({ pressed }) => ({
                          width: grid ? "48%" : "100%",
                          minHeight:
                            current === "sex"
                              ? 133
                              : current === "diet"
                                ? 85
                                : 73,
                          borderRadius: 23,
                          borderWidth: 1.5,
                          borderColor: selected ? "#B5A9F2" : "#FFFFFF",
                          backgroundColor: selected ? "#EAE5FCB8" : "#FFFFFFA8",
                          padding: 17,
                          flexDirection: grid ? "column" : "row",
                          alignItems: grid ? "flex-start" : "center",
                          gap: 12,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Icon
                          name={option.icon}
                          color={selected ? C.violet : C.muted}
                          size={grid ? 24 : 22}
                        />
                        <View style={{ flex: 1, gap: 4 }}>
                          <T
                            style={{
                              fontSize: 15,
                              fontWeight: "600",
                              color: selected ? "#6452C6" : C.ink,
                            }}
                          >
                            {option.label}
                          </T>
                          {!!option.detail && (
                            <T style={{ fontSize: 11, color: C.muted }}>
                              {option.detail}
                            </T>
                          )}
                        </View>
                        {selected && (
                          <View
                            style={{
                              position: grid ? "absolute" : "relative",
                              right: grid ? 13 : undefined,
                              top: grid ? 13 : undefined,
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              backgroundColor: C.violet,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Icon name="check" color="white" size={13} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {isReview && (
                <>
                  <GlassSurface
                    style={{ alignItems: "center", padding: 23, gap: 15 }}
                  >
                    <Ring
                      size={166}
                      color={C.violet}
                      trackColor="#DDD6FA"
                      stroke={10}
                      progress={1}
                    >
                      <Icon name="flame" color={C.violet} size={23} />
                      <T
                        style={{
                          fontSize: 39,
                          fontWeight: "700",
                          letterSpacing: -1.5,
                          marginTop: 5,
                        }}
                      >
                        {target.calories.toLocaleString()}
                      </T>
                      <T style={s.caption}>daily calories</T>
                    </Ring>
                    <T style={{ fontSize: 12, color: C.muted }}>
                      A flexible goal. Never a perfect score.
                    </T>
                  </GlassSurface>
                  <View style={[s.row, { gap: 9 }]}>
                    {[
                      {
                        name: "Protein",
                        value: target.protein,
                        color: C.blue,
                        bg: C.blueSoft,
                      },
                      {
                        name: "Carbs",
                        value: target.carbs,
                        color: C.coral,
                        bg: "#FFF0E4",
                      },
                      {
                        name: "Fat",
                        value: target.fat,
                        color: C.pink,
                        bg: "#FBE9F2",
                      },
                    ].map((m) => (
                      <View
                        key={m.name}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 18,
                          gap: 5,
                          borderRadius: 22,
                          backgroundColor: m.bg,
                          borderWidth: 1,
                          borderColor: "#FFFFFF",
                        }}
                      >
                        <T
                          style={{
                            fontSize: 23,
                            fontWeight: "700",
                            color: m.color,
                          }}
                        >
                          {m.value}
                          <T style={{ fontSize: 12, color: m.color }}>g</T>
                        </T>
                        <T
                          style={{
                            fontSize: 12,
                            color: m.color,
                            fontWeight: "500",
                          }}
                        >
                          {m.name}
                        </T>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {!!error && <Notice message={error} />}
            </>
          )}
        </Animated.View>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: 24,
          gap: 11,
        }}
      >
        <Button
          label={
            step === 0 ? "Start" : isReview ? "Start tracking" : "Continue"
          }
          onPress={next}
          style={{
            backgroundColor: step === 0 || isReview ? C.ink : C.blue,
            minHeight: 55,
            borderRadius: 29,
          }}
        />
        <T style={{ fontSize: 10, color: C.muted, textAlign: "center" }}>
          {step === 0
            ? "About a minute · Photo: Anna Pelzer / Unsplash"
            : isReview
              ? "Estimated targets. You can change them anytime in You."
              : "Made for you. Saved on your device."}
        </T>
      </View>
    </KeyboardAvoidingView>
  );
}
