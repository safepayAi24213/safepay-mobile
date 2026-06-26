import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { SplashOverlay } from '@/components/splash-overlay';
import { Brand } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth-context';
import { BiometricsProvider } from '@/lib/biometrics';
import { DeviceProvider } from '@/lib/device-context';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 200, fade: true });

const SafepayTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Brand.primary,
    background: Brand.bg,
    card: Brand.surface,
    text: Brand.text,
    border: Brand.border,
    notification: Brand.ai,
  },
};

export default function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={SafepayTheme}>
      <AuthProvider>
      <DeviceProvider>
        <BiometricsProvider>
        <View style={{ flex: 1, backgroundColor: Brand.bg }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Brand.bg },
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          {splashVisible && <SplashOverlay onDismissed={() => setSplashVisible(false)} />}
        </View>
        </BiometricsProvider>
      </DeviceProvider>
      </AuthProvider>
      <StatusBar style="light" />
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
