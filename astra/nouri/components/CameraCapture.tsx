import React, { useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, C, Notice, T, s } from "./ui";
import { preparePhoto } from "../lib/photos";
export function CameraCapture({
  onPhoto,
  onBarcode,
  onClose,
}: {
  onPhoto: (uri: string) => void;
  onBarcode?: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const ref = useRef<CameraView>(null),
    scanned = useRef(false);
  async function allow() {
    try {
      const p = await requestPermission();
      if (!p.granted)
        setError(
          "Camera access is blocked. Allow it in your browser or phone settings, or upload a photo instead.",
        );
    } catch {
      setError("This device cannot open a camera. Use Upload photo instead.");
    }
  }
  async function capture() {
    setBusy(true);
    try {
      const photo = await ref.current?.takePictureAsync({ quality: 0.8 });
      if (!photo)
        throw new Error("No photo was captured. Try again or upload a photo.");
      onPhoto(await preparePhoto(photo.uri, photo.width, photo.height));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 14 }}>
      {permission === null ? (
        <ActivityIndicator color={C.green} />
      ) : !permission.granted ? (
        <>
          <T style={{ lineHeight: 23, color: C.muted }}>
            Allow the camera to capture your meal. You can also close this view
            and upload a photo instead.
          </T>
          <Button label="Allow camera" icon="camera" onPress={allow} />
        </>
      ) : (
        <>
          <View
            style={{
              height: 330,
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: C.ink,
            }}
          >
            <CameraView
              ref={ref}
              style={{ flex: 1 }}
              facing="back"
              onCameraReady={() => setReady(true)}
              onMountError={() =>
                setError(
                  "The camera could not start. Close this view and use Upload photo.",
                )
              }
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
              }}
              onBarcodeScanned={
                onBarcode
                  ? (event) => {
                      if (!scanned.current) {
                        scanned.current = true;
                        onBarcode(event.data);
                      }
                    }
                  : undefined
              }
            />
          </View>
          {onBarcode ? (
            <T style={s.caption}>
              {Platform.OS === "web"
                ? "If your browser cannot scan the code, enter its digits below."
                : "Point the camera at a product barcode."}
            </T>
          ) : (
            <Button
              label="Take photo"
              icon="camera"
              loading={busy}
              disabled={!ready}
              onPress={capture}
            />
          )}
        </>
      )}
      {!!error && <Notice message={error} />}
      <Button label="Close camera" kind="ghost" onPress={onClose} />
    </View>
  );
}
