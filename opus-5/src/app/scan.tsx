import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons';
import { ScanFrame } from '@/components/scan-frame';
import { Sheet } from '@/components/sheet';
import { Button, IconButton, T } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { analyzePhoto, pickPhoto, startAnalysis } from '@/lib/analyze';
import { errorMessage } from '@/lib/january/client';
import { goBack } from '@/lib/nav';
import { showToast } from '@/lib/store';

type Mode = 'food' | 'barcode' | 'label';

const MODES: { value: Mode; label: string; icon: IconName; hint: string }[] = [
  { value: 'food', label: 'Scan food', icon: 'scan-outline', hint: 'Center your meal in the frame' },
  { value: 'barcode', label: 'Barcode', icon: 'barcode-outline', hint: 'Line up the barcode inside the frame' },
  { value: 'label', label: 'Food label', icon: 'document-text-outline', hint: 'Fit the nutrition label in the frame' },
];

// The example photo from January's API reference, for trying the app without food or a camera.
const SAMPLE_PHOTO = 'https://i.imgur.com/bTQIGxf.png';

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'barcode' || params.mode === 'label' ? params.mode : 'food');
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const camera = useRef<CameraView>(null);
  const asked = useRef(false);
  const scanned = useRef(false);

  // Phones ask for the camera as soon as the scanner opens; in browsers the user turns it on.
  useEffect(() => {
    if (Platform.OS === 'web' || !permission || permission.granted || !permission.canAskAgain || asked.current) return;
    asked.current = true;
    void requestPermission();
  }, [permission, requestPermission]);

  const cameraOn = !!permission?.granted && !cameraFailed;
  const current = MODES.find((m) => m.value === mode) ?? MODES[0];

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const analyze = async (uri: string, width?: number, height?: number) => {
    await analyzePhoto(uri, mode === 'label' ? 'label' : 'photo', width, height);
    goBack();
  };

  const pick = async (from: 'camera' | 'library') => {
    const asset = await pickPhoto(from);
    if (asset) await analyze(asset.uri, asset.width, asset.height);
  };

  const capture = () =>
    run(async () => {
      if (cameraOn && cameraReady && camera.current) {
        const photo = await camera.current.takePictureAsync({ quality: 0.85 });
        await analyze(photo.uri, photo.width, photo.height);
      } else {
        await pick('camera'); // system camera on phones, a file picker on desktop browsers
      }
    });

  const trySample = () =>
    run(async () => {
      await startAnalysis({ kind: 'image', image: SAMPLE_PHOTO }, { source: 'photo', thumb: SAMPLE_PHOTO });
      goBack();
    });

  const lookUp = (raw: string) => {
    const code = raw.replace(/\D/g, '');
    if (code.length < 6 || code.length > 14) {
      showToast('Barcodes have 6 to 14 digits.', 'error');
      return;
    }
    router.replace({ pathname: '/food/[id]', params: { id: 'barcode', barcode: code } });
  };

  const onBarcode = (result: BarcodeScanningResult) => {
    const code = result.data.replace(/\D/g, '');
    if (scanned.current || code.length < 6 || code.length > 14) return;
    scanned.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    lookUp(code);
  };

  const frame = mode === 'barcode' ? { width: 290, height: 170 } : { width: 280, height: 320 };

  return (
    <View style={styles.screen}>
      {cameraOn ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => setCameraFailed(true)}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={mode === 'barcode' ? onBarcode : undefined}
        />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <IconButton icon="close" label="Close scanner" color="#FFFFFF" background="rgba(255,255,255,0.16)" onPress={goBack} />
        <T style={styles.title}>{current.label}</T>
        {cameraOn && Platform.OS !== 'web' ? (
          <IconButton
            icon={torch ? 'flash' : 'flash-outline'}
            label="Toggle flash"
            color="#FFFFFF"
            background="rgba(255,255,255,0.16)"
            onPress={() => setTorch((t) => !t)}
          />
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <View style={styles.middle}>
        <View style={[styles.frameArea, frame]}>
          <ScanFrame width={frame.width} height={frame.height} />
          {!cameraOn && permission ? (
            <View style={styles.fallback}>
              {mode !== 'barcode' ? <Icon name="camera-outline" size={34} color="rgba(255,255,255,0.55)" /> : null}
              <T style={styles.fallbackTitle}>
                {cameraFailed ? 'Camera not available' : permission.canAskAgain ? 'Camera is off' : 'Camera access is blocked'}
              </T>
              <T style={styles.fallbackText}>
                {mode === 'barcode' ? 'Turn it on to scan, or type the number.' : 'Turn it on, or upload a photo instead.'}
              </T>
              {!cameraFailed && permission.canAskAgain ? (
                <Button size="sm" variant="inverse" icon="camera-outline" title="Use camera" onPress={() => void requestPermission()} />
              ) : null}
            </View>
          ) : null}
        </View>
        <T style={styles.hint}>{current.hint}</T>
        {!cameraOn && permission && mode !== 'barcode' ? (
          <View style={styles.fallbackActions}>
            <Button size="md" variant="inverse" icon="images-outline" title="Upload photo" onPress={() => run(() => pick('library'))} />
            <Button size="md" variant="onDark" icon="sparkles-outline" title="Try a sample photo" onPress={trySample} />
          </View>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.modes}>
          {MODES.map((m) => (
            <ModeButton
              key={m.value}
              label={m.label}
              icon={m.icon}
              active={mode === m.value}
              onPress={() => {
                scanned.current = false;
                setMode(m.value);
              }}
            />
          ))}
          <ModeButton label="Library" icon="images-outline" active={false} onPress={() => run(() => pick('library'))} />
        </View>
        {mode === 'barcode' ? (
          <Button variant="inverse" icon="create-outline" title="Enter barcode manually" onPress={() => setManualOpen(true)} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            disabled={busy}
            onPress={capture}
            style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}>
            {busy ? <ActivityIndicator color={colors.text} /> : <View style={styles.shutterInner} />}
          </Pressable>
        )}
      </View>

      <ManualBarcode
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={(code) => {
          setManualOpen(false);
          lookUp(code);
        }}
      />
    </View>
  );
}

function ModeButton({ label, icon, active, onPress }: { label: string; icon: IconName; active: boolean; onPress: () => void }) {
  const color = active ? colors.text : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.mode, active && styles.modeActive]}>
      <Icon name={icon} size={20} color={color} />
      <T style={[styles.modeLabel, { color }]} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

function ManualBarcode({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose} title="Enter barcode">
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 14))}
        placeholder="e.g. 049000006346"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        inputMode="numeric"
        autoFocus
        onSubmitEditing={() => code.length >= 6 && onSubmit(code)}
        style={styles.codeInput}
      />
      <Button title="Look up" disabled={code.length < 6} onPress={() => onSubmit(code)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  spacer: { width: 40 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24 },
  frameArea: { alignItems: 'center', justifyContent: 'center' },
  fallback: { position: 'absolute', alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  fallbackTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  fallbackText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center' },
  hint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fallbackActions: { alignItems: 'center', gap: 10 },
  bottom: { paddingHorizontal: 16, gap: 18, alignItems: 'center' },
  modes: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  mode: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  modeActive: { backgroundColor: '#FFFFFF' },
  modeLabel: { fontSize: 11.5, fontWeight: '600' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  codeInput: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    textAlign: 'center',
  },
});
