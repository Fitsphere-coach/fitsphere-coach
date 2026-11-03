// CF00 placeholder: proves the app runs with the FitSphere theme and can reach the coach API.
// CF01 replaces it with the log-in flow.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkApi, type ApiStatus } from '../api/health';
import { Wordmark } from '../components/Wordmark';
import { config } from '../config';
import { fonts, radius, useTheme } from '../theme';

const STATUS_TEXT: Record<ApiStatus | 'checking', string> = {
  checking: 'Checking the coach API…',
  reachable: 'Coach API reachable.',
  unreachable: "Can't reach the coach API. Is it running on your PC?",
  'not-configured': 'Set EXPO_PUBLIC_API_URL in apps/mobile/.env to check the coach API.',
};

export default function Foundation({ apiUrl = config.apiUrl }: { apiUrl?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ApiStatus | 'checking'>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    void checkApi(apiUrl).then((result) => {
      if (current) setStatus(result);
    });
    return () => {
      current = false;
    };
  }, [apiUrl, attempt]);

  const ok = status === 'reachable';
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}>
      <Wordmark />
      <View style={styles.heading}>
        <Text style={[styles.display, { color: colors.ink }]}>Foundation</Text>
        <Text style={[styles.display, { color: colors.accent }]}>ready</Text>
        <Text style={[styles.body, { color: colors.inkMuted }]}>
          FitSphere Coach is running. Sign-in arrives with the next feature.
        </Text>
      </View>
      <View
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          { backgroundColor: ok ? colors.successTint : colors.accentTint, borderColor: ok ? colors.success : 'transparent' },
        ]}
      >
        <Text style={[styles.small, { color: colors.ink }]}>{STATUS_TEXT[status]}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setStatus('checking');
          setAttempt((n) => n + 1);
        }}
        style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>CHECK AGAIN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, gap: 24 },
  heading: { marginTop: 32, gap: 2 },
  display: { fontFamily: fonts.display, fontSize: 48, lineHeight: 46, textTransform: 'uppercase' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: 10 },
  banner: { borderRadius: radius.sm, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  button: { marginTop: 'auto', height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5 },
});
