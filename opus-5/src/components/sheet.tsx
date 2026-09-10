import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { APP_MAX_WIDTH, colors, radius } from '@/constants/theme';

// Browsers throttle animation frames in background or embedded views, which can leave an entering animation
// stuck on its first (invisible) frame. On web the sheet simply appears.
const isWeb = Platform.OS === 'web';
const entering = isWeb ? undefined : SlideInDown.duration(260);

/** Bottom sheet. On web the backdrop covers the page and the sheet lines up with the app column. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.backdrop} />
        <Animated.View entering={entering} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View style={styles.handle} />
          {title ? (
            <T variant="heading" align="center">
              {title}
            </T>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.backdrop },
  sheet: {
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#DADAE0' },
});
