import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Nouri",
  slug: "nouri",
  scheme: "nouri",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  extra: { apiOrigin: process.env.NOURI_API_ORIGIN ?? null },
  web: { output: "server", bundler: "metro", favicon: "./assets/icon.png" },
  ios: { supportsTablet: true, bundleIdentifier: "com.nouri.journal" },
  android: {
    package: "com.nouri.journal",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#F7F7F2",
    },
  },
  plugins: [
    [
      "expo-router",
      {
        ...(process.env.NOURI_API_ORIGIN
          ? { origin: process.env.NOURI_API_ORIGIN }
          : {}),
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Allow Nouri to photograph your meals and scan barcodes.",
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Choose a meal or nutrition label to analyze.",
        microphonePermission: false,
      },
    ],
  ],
};
export default config;
