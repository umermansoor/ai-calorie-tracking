import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Button, C, Card, Chips, Field, Icon, Notice, T, s } from "./ui";
import { getFood, request } from "../lib/api";
import { ingredient, value } from "../lib/domain";
import type { Food, FoodSuggestion } from "../lib/types";
import { Autocomplete } from "../lib/autocomplete";
export function FoodChoice({
  food,
  onSelect,
  buttonLabel = "Log this food",
}: {
  food: Food;
  onSelect: (food: Food, servingId: string, quantity: number) => void;
  buttonLabel?: string;
}) {
  const initial =
    food.servings.find((s) => s.is_primary && s.id) ??
    food.servings.find((s) => s.id);
  const [serving, setServing] = useState(initial?.id ?? ""),
    [quantity, setQuantity] = useState("1");
  let calories = 0;
  try {
    calories = value(
      ingredient(food, serving, Number(quantity)).nutrients,
      "calories",
    );
  } catch {}
  return (
    <Card style={{ gap: 16 }}>
      <T style={s.h3}>{food.name ?? "Food"}</T>
      <T style={s.caption}>
        {food.brand_name ?? "January food catalog"}
        {food.barcode ? ` · ${food.barcode}` : ""}
      </T>
      <Chips
        label="Serving size"
        options={food.servings
          .filter((s) => s.id)
          .map((s) => ({
            value: s.id!,
            label: `${s.quantity ?? 1} ${s.unit ?? "serving"}`,
          }))}
        value={serving}
        onChange={setServing}
      />
      <Field
        label="Number of servings"
        numeric
        value={quantity}
        onChangeText={setQuantity}
      />
      <T style={s.caption}>For example, 0.4 × 100 g = 40 g.</T>
      <View style={s.spread}>
        <T style={s.h3}>{Math.round(calories)} kcal</T>
        <T style={s.caption}>for your portion</T>
      </View>
      <Button
        label={buttonLabel}
        disabled={
          !serving ||
          !Number.isFinite(Number(quantity)) ||
          Number(quantity) <= 0 ||
          Number(quantity) > 10000
        }
        onPress={() => onSelect(food, serving, Number(quantity))}
      />
    </Card>
  );
}
export function FoodSearch({
  onSelect,
  buttonLabel,
}: {
  onSelect: (food: Food, servingId: string, quantity: number) => void;
  buttonLabel?: string;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<FoodSuggestion[]>([]),
    [selected, setSelected] = useState<Food | null>(null),
    [busy, setBusy] = useState(false),
    [searched, setSearched] = useState(false),
    [error, setError] = useState("");
  const autocomplete = useMemo(
    () =>
      new Autocomplete<FoodSuggestion>(async (query) => {
        const { data } = await request<{ items: FoodSuggestion[] }>(
          "/foods/autocomplete",
          { query: { query, limit: 8 } },
        );
        return data.items;
      }),
    [],
  );
  const search = async (text: string) => {
    setBusy(true);
    setError("");
    try {
      const items = await autocomplete.search(text);
      if (items !== null) {
        setResults(items);
        setSearched(true);
        setBusy(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  useEffect(() => {
    setResults([]);
    setSearched(false);
    setError("");
    setSelected(null);
    setBusy(false);
    if ((query.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 2) return;
    const timer = setTimeout(() => void search(query), 600);
    return () => {
      clearTimeout(timer);
      autocomplete.cancel();
    };
  }, [query, autocomplete]);
  return (
    <View style={{ gap: 16 }}>
      <Field
        label="Search foods"
        value={query}
        onChangeText={setQuery}
        placeholder="Try Greek yogurt or sourdough"
        maxLength={64}
      />
      <View style={s.spread}>
        <T style={s.caption}>
          {query.trim().length < 2
            ? "Type at least 2 characters"
            : selected
              ? "Choose your portion"
              : "Suggestions from January"}
        </T>
        {busy && (
          <ActivityIndicator
            size="small"
            color={C.blue}
            accessibilityLabel="Finding foods"
          />
        )}
      </View>
      {!!error && <Notice message={error} />}
      {selected ? (
        <>
          <FoodChoice
            key={selected.id}
            food={selected}
            onSelect={onSelect}
            buttonLabel={buttonLabel}
          />
          <Button
            label="Back to results"
            kind="ghost"
            onPress={() => setSelected(null)}
          />
        </>
      ) : (
        results.map((food) => (
          <Pressable
            key={food.id}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${food.name}`}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                const detail = await autocomplete.resolve(() =>
                  getFood(food.id),
                );
                if (detail) {
                  setSelected(detail);
                  setBusy(false);
                }
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
            style={({ pressed }) => [
              s.card,
              {
                padding: 14,
                gap: 12,
                flexDirection: "row",
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                backgroundColor: C.blueSoft,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {food.image_url ? (
                <Image
                  source={{ uri: food.image_url }}
                  style={{ width: 46, height: 46 }}
                />
              ) : (
                <Icon name="leaf" color={C.blue} />
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T style={{ fontWeight: "600" }}>{food.name ?? "Food"}</T>
              <View style={s.spread}>
                <T style={s.caption}>{food.brand_name ?? "Everyday food"}</T>
                <T style={{ fontWeight: "500", color: C.blue }}>
                  {food.nutrients.calories
                    ? `${Math.round(value(food.nutrients, "calories"))} kcal`
                    : "View"}
                </T>
              </View>
            </View>
          </Pressable>
        ))
      )}
      {searched && !results.length && (
        <T style={s.caption}>
          No matches yet. Try a simpler food name or photograph the label.
        </T>
      )}
    </View>
  );
}
