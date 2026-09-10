import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { APP_MAX_WIDTH, colors } from '@/constants/theme';

/** On desktop browsers the app renders as a phone-sized column instead of stretching edge to edge. */
export function WebFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <View style={styles.native}>{children}</View>;
  return (
    <View style={styles.page}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  native: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.page, alignItems: 'center' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: APP_MAX_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    boxShadow: '0px 0px 0px 1px rgba(0, 0, 0, 0.04), 0px 24px 64px rgba(0, 0, 0, 0.12)',
  },
});
