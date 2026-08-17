import { Anton_400Regular } from '@expo-google-fonts/anton';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Exo2_800ExtraBold_Italic } from '@expo-google-fonts/exo-2';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppPreload } from '@/components/ui/AppPreload';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ActiveWorkoutProvider } from '@/hooks/useActiveWorkout';
import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 600, fade: true });

const MIN_PRELOAD_MS = 7000;

export const appFonts = {
  BebasNeue_400Regular,
  Exo2_800ExtraBold_Italic,
  Anton_400Regular,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
};

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading, profile } = useAuth();
  const [showPreload, setShowPreload] = useState(true);
  const appOpacity = useState(() => new Animated.Value(0))[0];
  const appScale = useState(() => new Animated.Value(0.98))[0];

  const authReady = fontsReady && !isLoading;

  useEffect(() => {
    if (authReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [authReady]);

  useEffect(() => {
    if (showPreload) return;

    Animated.parallel([
      Animated.timing(appOpacity, {
        toValue: 1,
        duration: 720,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(appScale, {
        toValue: 1,
        friction: 9,
        tension: 52,
        useNativeDriver: true,
      }),
    ]).start();
  }, [appOpacity, appScale, showPreload]);

  if (showPreload) {
    return (
      <View style={styles.preloadHost}>
        <AppPreload
          userName={profile?.full_name}
          minDurationMs={MIN_PRELOAD_MS}
          ready={authReady}
          onExitComplete={() => setShowPreload(false)}
        />
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.appShell,
        { opacity: appOpacity, transform: [{ scale: appScale }] },
      ]}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(member)" />
        <Stack.Screen name="(coach)" />
      </Stack>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ActiveWorkoutProvider>
          <RootNavigator fontsReady={fontsReady} />
        </ActiveWorkoutProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  preloadHost: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          minHeight: '100vh',
          height: '100vh',
          margin: 0,
          padding: 0,
        } as const)
      : null),
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
