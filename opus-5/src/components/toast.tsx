import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { T } from '@/components/ui';
import { shadow } from '@/constants/theme';
import { useApp } from '@/lib/store';

export function ToastHost() {
  const toast = useApp((s) => s.toast);
  const hideToast = useApp((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hideToast, toast.tone === 'error' ? 4000 : 2400);
    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  if (!toast) return null;
  const isError = toast.tone === 'error';
  return (
    <View style={[styles.wrap, { top: insets.top + 12 }]}>
      <Animated.View
        key={toast.id}
        // No entering animation on web, where a throttled frame loop can leave it invisible.
        entering={Platform.OS === 'web' ? undefined : FadeInUp.duration(200)}
        style={[styles.toast, isError && styles.error]}
        accessibilityLiveRegion="polite">
        <Icon name={isError ? 'alert-circle-outline' : 'checkmark-circle'} size={18} color="#FFFFFF" />
        <T style={styles.text} numberOfLines={5}>
          {toast.message}
        </T>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, pointerEvents: 'none' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    backgroundColor: '#111114',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    boxShadow: shadow.raised,
  },
  error: { backgroundColor: '#B42318' },
  text: { color: '#FFFFFF', fontWeight: '600', fontSize: 14.5, flexShrink: 1 },
});
