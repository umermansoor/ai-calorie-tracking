import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { JournalProvider, useStore } from "../lib/store";
import { C, T, Tabs, Notice } from "../components/ui";
import { AmbientBackground } from "../components/Glass";
function Frame() {
  // The server has no viewport. Match its first render before adapting to desktop.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { width, height } = useWindowDimensions(),
    desktop = mounted && Platform.OS === "web" && width > 760;
  const store = useStore();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: "#E9EDF6" },
        desktop && {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 100,
          padding: 30,
        },
      ]}
    >
      <StatusBar style="dark" />
      {desktop && (
        <View style={{ width: 285, gap: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <Image
              source={require("../assets/icon.png")}
              style={{ width: 43, height: 43, borderRadius: 12 }}
            />
            <T style={{ fontSize: 32, fontWeight: "600", letterSpacing: -1.6 }}>
              nouri
            </T>
          </View>
          <T
            style={{
              fontFamily: "Georgia",
              fontSize: 50,
              lineHeight: 56,
              letterSpacing: -2,
            }}
          >
            A little more{"\n"}in tune with{"\n"}you.
          </T>
          <T style={{ fontSize: 15, color: C.muted, lineHeight: 25 }}>
            Less guesswork. More good days.{"\n"}Your everyday nutrition
            companion.
          </T>
          <View
            style={{
              width: 40,
              height: 1,
              backgroundColor: "#ADB79F",
              marginVertical: 14,
            }}
          />
          <T style={{ fontSize: 10, letterSpacing: 2, color: C.green }}>
            FOOD FOR A FULLER LIFE
          </T>
          <T style={{ fontSize: 11, color: C.muted, marginTop: 40 }}>
            Built with January AI{"\n"}Thoughtfully made. Personally yours.
          </T>
        </View>
      )}
      <SafeAreaView
        style={[
          { flex: 1, backgroundColor: C.bg },
          desktop && {
            flex: 0,
            flexBasis: "auto",
            minWidth: 430,
            maxWidth: 430,
            flexGrow: 0,
            flexShrink: 0,
            width: 430,
            height: Math.min(height - 60, 900),
            minHeight: 580,
            borderRadius: 40,
            borderWidth: 7,
            borderColor: "#FFFFFFCC",
            overflow: "hidden",
            boxShadow: "0 24px 70px rgba(34,43,24,0.13)",
          },
        ]}
        edges={["top", "bottom"]}
      >
        <AmbientBackground />
        <View style={{ flex: 1 }}>
          {!!store.storageError && <Notice message={store.storageError} />}
          {!store.ready ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={C.ink} />
            </View>
          ) : (
            <>
              <Slot />
              <Tabs />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <JournalProvider>
        <Frame />
      </JournalProvider>
    </SafeAreaProvider>
  );
}
