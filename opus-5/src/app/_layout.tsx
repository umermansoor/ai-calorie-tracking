import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AddMenu } from '@/components/add-menu';
import { ToastHost } from '@/components/toast';
import { WebFrame } from '@/components/web-frame';
import { colors } from '@/constants/theme';
import { queryClient } from '@/lib/queries';
import { ensureEndUserId, useHydrated } from '@/lib/store';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Native gets real modals; on web, sheets slide up inside the phone-sized column instead.
const modal = Platform.OS === 'web' ? ('card' as const) : ('modal' as const);

export default function RootLayout() {
  const hydrated = useHydrated();
  // Render the same placeholder on the server and the first client pass, then the app once local
  // state (profile, end-user id) has loaded.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ready = mounted && hydrated;

  useEffect(() => {
    if (!ready) return;
    ensureEndUserId();
    SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <WebFrame>
          <StatusBar style="dark" />
          {ready ? (
            <>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" options={{ animation: 'fade', contentStyle: styles.white }} />
                <Stack.Screen
                  name="scan"
                  options={{ presentation: Platform.OS === 'web' ? 'card' : 'fullScreenModal', animation: 'slide_from_bottom' }}
                />
                <Stack.Screen name="describe" options={{ presentation: modal, animation: 'slide_from_bottom' }} />
                <Stack.Screen name="search" options={{ presentation: modal, animation: 'slide_from_bottom' }} />
                <Stack.Screen name="food/[id]" />
                <Stack.Screen name="meal/[id]" />
              </Stack>
              <AddMenu />
              <ToastHost />
            </>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.text} />
            </View>
          )}
        </WebFrame>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  white: { backgroundColor: '#FFFFFF' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
