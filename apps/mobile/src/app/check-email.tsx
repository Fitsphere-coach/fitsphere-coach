// Verify, step 2 of 3 (CAUTH-006). The shared Supabase project emails a link, not a code, so this
// screen asks the coach to tap the link (decided 2026-11-03 under C-D7: the trainee app's email
// stays as it is). Verification is required before coaching starts (no "Do this later").
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { resendVerification } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { AuthLayout, Banner, Heading, IconTile, PrimaryButton, SecondaryButton, Strong, TextLink, textStyles } from '../components/ui';
import { useTheme } from '../theme';

const RESEND_SECONDS = 60;

export default function CheckEmail() {
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setOffline(false);
    const result = await resendVerification(deps, email);
    if (result === 'offline') setOffline(true);
    else setWait(RESEND_SECONDS);
  }

  const clock = `0:${String(Math.max(wait, 0)).padStart(2, '0')}`;
  return (
    <AuthLayout
      onBack={() => router.replace('/sign-up')}
      footer={
        <>
          {offline ? <Banner kind="error">{TEXTS.offline}</Banner> : null}
          <PrimaryButton label="Open email app" onPress={() => void openEmailApp()} />
          <SecondaryButton label="Resend link" onPress={() => void resend()} disabled={wait > 0} />
          <Text style={[textStyles.body, { color: colors.inkMuted, textAlign: 'center' }]}>
            Verified on another phone? <TextLink label="Log in" onPress={() => router.replace('/sign-in')} />
          </Text>
        </>
      }
    >
      <View style={{ marginTop: 32 }}>
        <IconTile name="mail" />
      </View>
      <Heading
        step="Step 2 of 3"
        first="Verify your"
        second="email"
        sub={
          <>
            Tap the link we sent to <Strong>{email}</Strong> to verify it. The link opens FitSphere Coach on this phone.{' '}
            <TextLink label="Change" onPress={() => router.replace('/sign-up')} />
          </>
        }
      />
      <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 12 }]}>
        {wait > 0 ? (
          <>
            Nothing yet? Check spam, or resend in <Strong>{clock}</Strong>
          </>
        ) : (
          'Nothing yet? Check spam, or resend the link.'
        )}
      </Text>
      <View style={{ marginTop: 20 }}>
        <Banner kind="info">Coaches see trainee data, so your email must be verified before you continue.</Banner>
      </View>
    </AuthLayout>
  );
}

async function openEmailApp() {
  const url = Platform.OS === 'ios' ? 'message://' : 'mailto:';
  try {
    await Linking.openURL(url);
  } catch {
    // No mail app: nothing to open.
  }
}
