import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_800ExtraBold_Italic,
} from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountProvider } from '../account/AccountProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { createAuthDeps } from '../auth/supabase';
import { fonts, ThemeProvider, useTheme } from '../theme';

function ThemedStack() {
  const { colors, scheme } = useTheme();
  // Created once per app start; null until apps/mobile/.env has the Supabase values.
  const [deps] = useState(createAuthDeps);
  if (!deps) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink }}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/mobile/.env, then restart Expo.
        </Text>
      </View>
    );
  }
  return (
    <AuthProvider deps={deps}>
      <AccountProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </AccountProvider>
    </AuthProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_800ExtraBold_Italic,
  });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
