import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
export function touchFeedback() {
  if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
}
