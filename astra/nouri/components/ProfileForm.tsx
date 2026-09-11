import React from "react";
import { View } from "react-native";
import type { Profile } from "../lib/types";
import { Chips, Field, s } from "./ui";
export function ProfileForm({
  profile: p,
  onChange,
  section = "all",
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  section?: "body" | "goal" | "all";
}) {
  const set = (key: keyof Profile, value: string | number) =>
    onChange({ ...p, [key]: value });
  return (
    <View style={{ gap: 22 }}>
      {section !== "goal" && (
        <>
          <Chips
            label="Sex used for energy estimates"
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
            value={p.sex}
            onChange={(v) => set("sex", v)}
          />
          <View style={[s.row, { gap: 12 }]}>
            <Field
              label="Age"
              value={String(p.age || "")}
              numeric
              onChangeText={(v) => set("age", Number(v))}
            />
            <Field
              label="Height · cm"
              value={String(p.height || "")}
              numeric
              onChangeText={(v) => set("height", Number(v))}
            />
            <Field
              label="Weight · kg"
              value={String(p.weight || "")}
              numeric
              onChangeText={(v) => set("weight", Number(v))}
            />
          </View>
        </>
      )}
      {section !== "body" && (
        <>
          <Chips
            label="Your intention"
            options={[
              { value: "lose", label: "Lose weight" },
              { value: "maintain", label: "Feel balanced" },
              { value: "gain", label: "Gain weight" },
            ]}
            value={p.goal}
            onChange={(v) => set("goal", v)}
          />
          {p.goal !== "maintain" && (
            <Chips
              label="Your pace"
              options={[
                { value: "gentle", label: "Gentle · 0.25 kg / week" },
                { value: "steady", label: "Steady · 0.5 kg / week" },
              ]}
              value={p.pace}
              onChange={(v) => set("pace", v)}
            />
          )}
          <Chips
            label="A typical week"
            options={[
              { value: "sedentary", label: "Mostly sitting" },
              { value: "lightly_active", label: "A little movement" },
              { value: "moderately_active", label: "Regularly active" },
              { value: "very_active", label: "Very active" },
            ]}
            value={p.activity}
            onChange={(v) => set("activity", v)}
          />
          <Chips
            label="The way you eat"
            options={[
              { value: "balanced", label: "Everything" },
              { value: "vegetarian", label: "Vegetarian" },
              { value: "vegan", label: "Vegan" },
              { value: "pescatarian", label: "Pescatarian" },
              { value: "high_protein", label: "High protein" },
              { value: "low_carbohydrate", label: "Lower carb" },
            ]}
            value={p.diet}
            onChange={(v) => set("diet", v)}
          />
        </>
      )}
    </View>
  );
}
export function validateProfile(p: Profile) {
  return (
    p.age >= 18 &&
    p.age <= 100 &&
    p.height >= 120 &&
    p.height <= 230 &&
    p.weight >= 30 &&
    p.weight <= 350
  );
}
