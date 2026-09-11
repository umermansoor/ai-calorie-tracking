import React, { useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  C,
  Card,
  Chips,
  Field,
  Icon,
  LineChart,
  Notice,
  Page,
  T,
  s,
} from "../../components/ui";
import { FoodSearch } from "../../components/FoodSearch";
import { useStore } from "../../lib/store";
import {
  dayKey,
  healthScore,
  ingredient,
  sumNutrients,
  value,
} from "../../lib/domain";
import { getFood, request } from "../../lib/api";
import type { Alternative, Ingredient } from "../../lib/types";
export default function MealPage() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    store = useStore(),
    meal = store.journal.meals.find((m) => m.localId === id);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [items, setItems] = useState<Ingredient[]>([]),
    [name, setName] = useState(""),
    [instruction, setInstruction] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    [alternatives, setAlternatives] = useState<Alternative[] | null>(null),
    [swapIndex, setSwapIndex] = useState(0),
    [confirmDelete, setConfirmDelete] = useState(false);
  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  if (!meal)
    return (
      <Page title="Meal" back>
        <Notice message="This meal is no longer on your device. Refresh the diary from Today to load it again." />
      </Page>
    );
  const score = healthScore(meal.nutrients),
    prediction =
      meal.predictionProfile === JSON.stringify(store.journal.profile)
        ? meal.prediction
        : undefined;
  return (
    <Page
      title="Your meal"
      back
      action={
        <T style={s.caption}>
          {new Date(meal.eatenAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </T>
      }
    >
      {meal.photo ? (
        <Image
          source={{ uri: meal.photo }}
          style={{ height: 230, width: "100%", borderRadius: 26 }}
        />
      ) : (
        <Card
          style={{
            height: 115,
            backgroundColor: C.sage,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={meal.source === "Barcode" ? "barcode" : "leaf"}
            size={40}
            color={C.green}
          />
        </Card>
      )}
      <View style={{ gap: 9 }}>
        <T style={{ fontSize: 11, color: C.green, letterSpacing: 1.3 }}>
          {meal.source.toUpperCase()}
        </T>
        <T style={s.h1}>{meal.name}</T>
      </View>
      {meal.status === "analyzing" && (
        <Card>
          <ActivityIndicator />
          <T style={{ textAlign: "center", marginTop: 12 }}>
            Analyzing… checking your portions.
          </T>
        </Card>
      )}
      {!!(error || meal.error) && <Notice message={error || meal.error!} />}
      {!!meal.warning && <Notice message={meal.warning} />}
      {meal.status === "uncertain" && (
        <Button
          label="Refresh diary to confirm save"
          loading={!!busy}
          onPress={() => run("refresh", () => store.sync(dayKey(meal.eatenAt)))}
        />
      )}
      {(meal.status === "ready" || meal.ingredients.length > 0) && (
        <>
          <Card style={{ gap: 18 }}>
            <View style={s.spread}>
              <View>
                <T
                  testID="meal-calories"
                  style={{
                    fontSize: 39,
                    fontWeight: "600",
                    letterSpacing: -1.5,
                  }}
                >
                  {Math.round(value(meal.nutrients, "calories"))}
                  <T style={{ fontSize: 15, color: C.muted, letterSpacing: 0 }}>
                    {" "}
                    kcal
                  </T>
                </T>
                <T style={s.caption}>for the entire meal</T>
              </View>
              <View
                style={{
                  backgroundColor: C.sage,
                  borderRadius: 16,
                  padding: 13,
                  alignItems: "center",
                }}
              >
                <T
                  testID="health-score"
                  style={{ fontSize: 23, fontWeight: "600", color: C.green }}
                >
                  {score.score}
                  <T style={{ fontSize: 12, color: C.green }}>/10</T>
                </T>
                <T style={{ fontSize: 9, color: C.green }}>NOURI SCORE</T>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: C.line }} />
            <View style={[s.spread, { gap: 8 }]}>
              {(["protein", "carbohydrates", "total_fat"] as const).map((k) => (
                <View
                  key={k}
                  style={{
                    gap: 5,
                    flex: 1,
                    padding: 11,
                    borderRadius: 15,
                    backgroundColor:
                      k === "protein"
                        ? C.blueSoft
                        : k === "carbohydrates"
                          ? "#FFF0E5"
                          : "#F8EAF2",
                  }}
                >
                  <T style={s.h3}>{Math.round(value(meal.nutrients, k))} g</T>
                  <T style={s.caption}>
                    {k === "carbohydrates"
                      ? "Carbs"
                      : k === "total_fat"
                        ? "Fat"
                        : "Protein"}
                  </T>
                </View>
              ))}
            </View>
          </Card>
          <View style={[s.row, { gap: 9 }]}>
            <Icon name="leaf" color={C.green} />
            <T style={{ fontWeight: "600", color: C.green }}>{score.label}</T>
          </View>
          <T style={s.caption}>{score.detail}</T>
        </>
      )}
      {meal.status === "ready" && (
        <>
          <View style={s.spread}>
            <T style={s.h3}>What’s inside</T>
            <Button
              style={{ minHeight: 34, paddingHorizontal: 13, borderRadius: 10 }}
              kind="light"
              label={editing ? "Cancel edit" : "Edit meal"}
              loading={busy === "edit-load"}
              disabled={!!busy}
              onPress={() =>
                run("edit-load", async () => {
                  if (editing) {
                    setEditing(false);
                    setShowSearch(false);
                  } else {
                    setItems(await store.loadIngredients(meal));
                    setName(meal.name);
                    setEditing(true);
                  }
                })
              }
            />
          </View>
          {editing ? (
            <>
              <Field
                label="Meal name"
                value={name}
                onChangeText={setName}
                maxLength={256}
              />
              {items.map((item, index) => (
                <Card key={`${item.food.id}-${index}`} style={{ gap: 13 }}>
                  <View style={s.spread}>
                    <T style={{ fontWeight: "600", flex: 1 }}>
                      {item.food.name}
                    </T>
                    <Button
                      label="Remove"
                      kind="ghost"
                      style={{ minHeight: 32, paddingHorizontal: 10 }}
                      disabled={items.length === 1}
                      onPress={() =>
                        setItems(items.filter((_, i) => i !== index))
                      }
                    />
                  </View>
                  <Chips
                    label="Serving"
                    options={item.food.servings
                      .filter((s) => s.id)
                      .map((s) => ({
                        value: s.id!,
                        label: `${s.quantity ?? 1} ${s.unit ?? "serving"}`,
                      }))}
                    value={item.servingId}
                    onChange={(servingId) =>
                      setItems(
                        items.map((old, i) =>
                          i === index
                            ? ingredient(old.food, servingId, old.quantity)
                            : old,
                        ),
                      )
                    }
                  />
                  <Field
                    label={`Servings of ${item.food.name}`}
                    numeric
                    value={String(item.quantity)}
                    onChangeText={(text) => {
                      const q = Number(text);
                      setItems(
                        items.map((old, i) =>
                          i === index
                            ? {
                                ...old,
                                quantity: q,
                                nutrients:
                                  Number.isFinite(q) && q > 0
                                    ? ingredient(old.food, old.servingId, q)
                                        .nutrients
                                    : {},
                              }
                            : old,
                        ),
                      );
                    }}
                  />
                  <T style={s.caption}>
                    {item.quantity} ×{" "}
                    {
                      item.food.servings.find((s) => s.id === item.servingId)
                        ?.quantity
                    }{" "}
                    {
                      item.food.servings.find((s) => s.id === item.servingId)
                        ?.unit
                    }{" "}
                    · {Math.round(value(item.nutrients, "calories"))} kcal
                  </T>
                </Card>
              ))}
              {showSearch ? (
                <FoodSearch
                  buttonLabel="Add ingredient"
                  onSelect={(food, servingId, quantity) => {
                    setItems([...items, ingredient(food, servingId, quantity)]);
                    setShowSearch(false);
                  }}
                />
              ) : (
                <Button
                  label="Add or replace an ingredient"
                  kind="ghost"
                  icon="plus"
                  onPress={() => setShowSearch(true)}
                />
              )}
              <Button
                label={`Save meal · ${Math.round(value(sumNutrients(items.map((i) => i.nutrients)), "calories"))} kcal`}
                loading={busy === "save"}
                disabled={
                  !!busy ||
                  !name.trim() ||
                  items.some(
                    (i) =>
                      !Number.isFinite(i.quantity) ||
                      i.quantity <= 0 ||
                      i.quantity > 10000,
                  )
                }
                onPress={() =>
                  run("save", async () => {
                    await store.edit(meal, items, name.trim());
                    setEditing(false);
                    setShowSearch(false);
                  })
                }
              />
            </>
          ) : (
            <Card style={{ gap: 16 }}>
              {(meal.log?.foods ?? []).map((food, i) => (
                <View key={i} style={s.spread}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T style={{ fontWeight: "500" }}>{food.name}</T>
                    <T style={s.caption}>
                      {Number(
                        (
                          (food.quantity ?? 1) * (food.serving.quantity ?? 1)
                        ).toFixed(2),
                      )}{" "}
                      {food.serving.unit} ·{" "}
                      {Number((food.quantity ?? 1).toFixed(3))}{" "}
                      {(food.quantity ?? 1) === 1 ? "serving" : "servings"}
                    </T>
                  </View>
                  <T style={{ fontWeight: "500" }}>
                    {Math.round(value(food.nutrients, "calories"))}
                    <T style={s.caption}> kcal</T>
                  </T>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
      {(meal.analysis || meal.status === "ready") &&
        meal.status !== "uncertain" &&
        meal.status !== "analyzing" && (
          <Card style={{ gap: 14, backgroundColor: C.violetSoft }}>
            <View style={[s.row, { gap: 8 }]}>
              <Icon name="spark" size={19} />
              <T style={s.h3}>Something look off?</T>
            </View>
            <T style={s.caption}>
              Fix results in your own words. We’ll check the new portions before
              saving.
            </T>
            <Field
              label="Fix results"
              multiline
              value={instruction}
              onChangeText={setInstruction}
              placeholder="There was no dressing, and only 40 g of feta."
              maxLength={1000}
            />
            <Button
              label="Apply correction"
              loading={busy === "correction"}
              disabled={!!busy || !instruction.trim()}
              onPress={() =>
                run("correction", async () => {
                  await store.correct(meal, instruction.trim());
                  setInstruction("");
                })
              }
            />
          </Card>
        )}
      {meal.status === "ready" && !editing && (
        <>
          <Card style={{ gap: 17 }}>
            <View style={s.spread}>
              <T style={s.h3}>Blood sugar impact</T>
              <Icon name="chart" color={C.green} />
            </View>
            {prediction ? (
              <>
                <View style={s.spread}>
                  <T
                    style={{
                      fontSize: 22,
                      fontWeight: "600",
                      textTransform: "capitalize",
                    }}
                  >
                    {prediction.impact_score ?? "Estimated"} impact
                  </T>
                  <T style={s.caption}>January prediction</T>
                </View>
                <LineChart
                  points={prediction.points.map((p) => ({
                    x: p.minutes,
                    y: p.value,
                  }))}
                />
              </>
            ) : (
              <>
                <T style={s.caption}>
                  See how this meal may affect your glucose, using your profile
                  and the portions you logged.
                </T>
                <Button
                  label="Predict glucose curve"
                  kind="light"
                  loading={busy === "glucose"}
                  disabled={!!busy}
                  onPress={() => run("glucose", () => store.predict(meal))}
                />
              </>
            )}
            <T style={{ fontSize: 11, lineHeight: 18, color: C.muted }}>
              Prediction, not medical advice. This is an estimate, not a glucose
              measurement.
            </T>
          </Card>
          <Card style={{ gap: 15 }}>
            <T style={s.h3}>A fresh alternative.</T>
            <T style={s.caption}>
              Explore January’s suggested swaps for an ingredient.
            </T>
            <Chips
              options={(meal.log?.foods ?? []).map((f, index) => ({
                value: String(index),
                label: f.name ?? "Ingredient",
              }))}
              value={String(swapIndex)}
              onChange={(i) => {
                setSwapIndex(Number(i));
                setAlternatives(null);
              }}
            />
            <Button
              label="Find healthier swaps"
              kind="ghost"
              loading={busy === "swaps"}
              disabled={!!busy}
              onPress={() =>
                run("swaps", async () => {
                  const foodId = meal.log?.foods[swapIndex]?.food_id;
                  if (!foodId)
                    throw new Error(
                      "Choose an ingredient with a catalog match first.",
                    );
                  const diet = store.journal.profile?.diet;
                  setAlternatives(
                    (
                      await request<{ alternatives: Alternative[] }>(
                        `/foods/${foodId}/alternatives`,
                        {
                          method: "POST",
                          body: {
                            diet_preferences:
                              diet && diet !== "balanced" ? [diet] : [],
                          },
                        },
                      )
                    ).data.alternatives,
                  );
                })
              }
            />
            {alternatives?.length === 0 && (
              <T style={s.caption}>
                No alternatives match this ingredient and your diet. Try another
                ingredient.
              </T>
            )}
            {alternatives?.map((a, i) => (
              <View
                key={a.id ?? i}
                style={{
                  gap: 9,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: C.line,
                }}
              >
                <T style={{ fontWeight: "600" }}>{a.name ?? "Alternative"}</T>
                <T style={s.caption}>
                  {Math.round(value(a.nutrients, "calories"))} kcal per
                  suggested serving
                </T>
                {a.id && (
                  <Button
                    label={`Use ${a.name}`}
                    kind="light"
                    disabled={!!busy}
                    onPress={() =>
                      run("swap", async () => {
                        const all = await store.loadIngredients(meal),
                          food = await getFood(a.id!),
                          serving =
                            food.servings.find((s) => s.is_primary && s.id) ??
                            food.servings.find((s) => s.id);
                        if (!serving?.id)
                          throw new Error(
                            "This alternative has no editable serving. Choose another.",
                          );
                        setItems(
                          all.map((old, index) =>
                            index === swapIndex
                              ? ingredient(food, serving.id!, 1)
                              : old,
                          ),
                        );
                        setName(meal.name);
                        setEditing(true);
                      })
                    }
                  />
                )}
              </View>
            ))}
          </Card>
        </>
      )}
      {meal.status !== "analyzing" &&
        meal.status !== "uncertain" &&
        (confirmDelete ? (
          <Card style={{ gap: 13 }}>
            <T style={s.h3}>
              {meal.log
                ? "Delete this meal from your diary?"
                : "Discard this unsaved analysis?"}
            </T>
            <T style={s.caption}>
              This also removes its local photo and prediction.
            </T>
            <Button
              label="Yes, delete meal"
              loading={busy === "delete"}
              onPress={() =>
                run("delete", async () => {
                  await store.remove(meal);
                  router.replace("/");
                })
              }
            />
            <Button
              kind="ghost"
              label="Keep meal"
              onPress={() => setConfirmDelete(false)}
            />
          </Card>
        ) : (
          <Button
            label={meal.log ? "Delete meal" : "Discard analysis"}
            kind="ghost"
            icon="trash"
            disabled={!!busy}
            onPress={() => setConfirmDelete(true)}
          />
        ))}
    </Page>
  );
}
