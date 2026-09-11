import React, { useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
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
import { FoodChoice, FoodSearch } from "../components/FoodSearch";
import { CameraCapture } from "../components/CameraCapture";
import { getFood, request } from "../lib/api";
import type { Food } from "../lib/types";
import { preparePhoto, samples } from "../lib/photos";
import { useStore } from "../lib/store";
export default function Add() {
  const store = useStore();
  const [mode, setMode] = useState("photo"),
    [text, setText] = useState(""),
    [barcode, setBarcode] = useState(""),
    [camera, setCamera] = useState(false),
    [food, setFood] = useState<Food | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = (input: Parameters<typeof store.add>[0]) => {
    if (busy) return;
    if (store.isUpdating()) {
      setError(
        "Your diary is already updating. Wait for it to finish, then try again.",
      );
      return;
    }
    if (store.journal.meals.some((m) => m.status === "analyzing")) {
      setError(
        "Your previous meal is still being analyzed. Wait for it to finish before adding another.",
      );
      return;
    }
    setBusy(true);
    void store
      .add(input)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
    router.replace("/");
  };
  const photo = (uri: string, name = "Your meal") =>
    submit({
      photo: uri,
      name,
      source: mode === "label" ? "Nutrition label" : "Photo",
    });
  const select = (f: Food, servingId: string, quantity: number) =>
    submit({
      food: f,
      servingId,
      quantity,
      name: f.name ?? "Food",
      source: mode === "barcode" ? "Barcode" : "Search",
    });
  const upload = async () => {
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (!result.canceled) {
        setBusy(true);
        const a = result.assets[0]!;
        const uri = await preparePhoto(a.uri, a.width, a.height);
        setBusy(false);
        photo(uri);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const lookup = async (code = barcode) => {
    if (!/^\d{6,14}$/.test(code)) {
      setError("Enter the 6–14 digits printed under the barcode.");
      return;
    }
    setCamera(false);
    setBusy(true);
    setError("");
    setFood(null);
    try {
      const { data } = await request<Food>(`/foods/barcode/${code}`);
      setFood(await getFood(data.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Add a meal"
      subtitle="Your food, however you want to log it."
      back
    >
      <View style={{ flexDirection: "row", gap: 7 }}>
        {[
          { id: "photo", label: "Photo", icon: "camera" },
          { id: "text", label: "Describe", icon: "text" },
          { id: "barcode", label: "Barcode", icon: "barcode" },
          { id: "label", label: "Label", icon: "image" },
          { id: "search", label: "Search", icon: "search" },
        ].map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`${m.label} mode`}
            accessibilityState={{ selected: mode === m.id }}
            onPress={() => {
              setMode(m.id);
              setCamera(false);
              setError("");
            }}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: mode === m.id ? C.ink : "white",
              borderWidth: 1,
              borderColor: mode === m.id ? C.ink : C.line,
            }}
          >
            <Icon
              name={m.icon}
              size={20}
              color={mode === m.id ? "white" : C.ink}
            />
            <T
              style={{ fontSize: 10, color: mode === m.id ? "white" : C.muted }}
            >
              {m.label}
            </T>
          </Pressable>
        ))}
      </View>
      {!!error && <Notice message={error} />}
      {mode === "photo" || mode === "label" ? (
        <>
          {camera ? (
            <CameraCapture onClose={() => setCamera(false)} onPhoto={photo} />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open camera"
                onPress={() => setCamera(true)}
                style={{
                  height: 190,
                  borderRadius: 25,
                  backgroundColor: "#EAE6FA",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 13,
                  borderWidth: 1,
                  borderColor: "#CEC5EC",
                  borderStyle: "dashed",
                }}
              >
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: "white",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="camera" size={27} />
                </View>
                <T style={s.h3}>
                  {mode === "label"
                    ? "Bring the label into focus."
                    : "What’s on your plate?"}
                </T>
                <T style={s.caption}>
                  {mode === "label"
                    ? "Capture the product name & nutrition facts."
                    : "Open your camera and take a photo."}
                </T>
              </Pressable>
              <Button
                label={
                  mode === "label" ? "Upload nutrition label" : "Upload photo"
                }
                icon="image"
                kind="ghost"
                onPress={upload}
                loading={busy}
              />
            </>
          )}
          {mode === "photo" && (
            <>
              <View style={{ gap: 5, marginTop: 5 }}>
                <T style={s.h3}>Try a sample meal</T>
                <T style={s.caption}>
                  No food nearby? Try a real photo analysis.
                </T>
              </View>
              {samples.map((sample) => (
                <View key={sample.name} style={{ gap: 6 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Analyze ${sample.name}`}
                    onPress={() => photo(sample.url, sample.name)}
                    style={{
                      height: 180,
                      borderRadius: 22,
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      source={{ uri: sample.url }}
                      style={{ width: "100%", height: "100%" }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        bottom: 12,
                        left: 12,
                        right: 12,
                        padding: 12,
                        backgroundColor: "#FFFFFFEB",
                        borderRadius: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View>
                        <T style={{ fontWeight: "600" }}>{sample.name}</T>
                        <T
                          style={{ fontSize: 11, color: C.muted, marginTop: 4 }}
                        >
                          {sample.caption}
                        </T>
                      </View>
                      <Icon name="arrow" size={19} />
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => Linking.openURL(sample.link)}
                  >
                    <T style={{ fontSize: 10, color: C.muted, paddingLeft: 5 }}>
                      Photo by {sample.credit} / Unsplash ↗
                    </T>
                  </Pressable>
                </View>
              ))}
            </>
          )}
          {mode === "label" && (
            <T style={s.caption}>
              January reads the label and matches the food to its catalog.
              Include the product name. Review serving sizes on the meal page
              after analysis.
            </T>
          )}
        </>
      ) : mode === "text" ? (
        <>
          <Card
            style={{ gap: 12, backgroundColor: C.blueSoft, borderWidth: 0 }}
          >
            <Icon name="text" color={C.green} />
            <T style={s.h3}>What did you eat?</T>
            <T style={s.caption}>Include amounts for a more useful estimate.</T>
          </Card>
          <Field
            label="Describe your meal"
            multiline
            value={text}
            onChangeText={setText}
            placeholder="2 scrambled eggs, a slice of sourdough and half an avocado"
            maxLength={512}
          />
          <Button
            label="Analyze description"
            icon="spark"
            disabled={!text.trim()}
            onPress={() =>
              submit({
                text: text.trim(),
                name: text.trim().slice(0, 65),
                source: "Description",
              })
            }
          />
          <Pressable
            onPress={() => setText("40 g feta cheese and 100 g cucumber")}
          >
            <T style={{ color: C.green, fontSize: 12 }}>
              Try: 40 g feta cheese and 100 g cucumber ↗
            </T>
          </Pressable>
        </>
      ) : mode === "search" ? (
        <FoodSearch onSelect={select} />
      ) : (
        <>
          <T style={s.h3}>Know what’s in the package.</T>
          {camera && (
            <CameraCapture
              onClose={() => setCamera(false)}
              onPhoto={photo}
              onBarcode={(code) => {
                setBarcode(code);
                void lookup(code);
              }}
            />
          )}
          <Button
            label="Scan barcode"
            kind="light"
            icon="barcode"
            onPress={() => setCamera(true)}
          />
          <Field
            label="Barcode number"
            numeric
            value={barcode}
            onChangeText={setBarcode}
            placeholder="049000006346"
            maxLength={14}
          />
          <Button
            label="Look up barcode"
            loading={busy}
            onPress={() => lookup()}
          />
          <Pressable onPress={() => setBarcode("049000006346")}>
            <T style={{ color: C.green, fontSize: 12 }}>
              Try a Coca-Cola can · 049000006346 ↗
            </T>
          </Pressable>
          {food && <FoodChoice key={food.id} food={food} onSelect={select} />}
        </>
      )}
      <T style={[s.caption, { textAlign: "center", fontSize: 10 }]}>
        Estimates are a starting point. You can always adjust.
      </T>
    </Page>
  );
}
