// Forgot password: request and "check your inbox" (CAUTH-003; CF01 UI doc §4.6). The link opens
// reset-password. The text is the same whether or not the email has an account (invariant 3).
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { requestPasswordReset } from '../auth/service';
import { emailProblem, TEXTS } from '../auth/texts';
import { AuthLayout, Banner, Field, Heading, IconTile, PrimaryButton, SecondaryButton, Strong, TextLink, textStyles } from '../components/ui';
import { useTheme } from '../theme';

const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const { deps, email: signedInEmail } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState(signedInEmail ?? '');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function send() {
    if (busy || emailProblem(email)) return;
    setBusy(true);
    setOffline(false);
    const result = await requestPasswordReset(deps, email);
    setBusy(false);
    if (result === 'offline') return setOffline(true);
    setSent(true);
    setWait(RESEND_SECONDS);
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  if (!sent) {
    return (
      <AuthLayout
        onBack={back}
        footer={
          <>
            {offline ? <Banner kind="error">{TEXTS.offline}</Banner> : null}
            <PrimaryButton label="Send reset link" arrow onPress={() => void send()} loading={busy} disabled={emailProblem(email) !== null} />
            <Text style={{ textAlign: 'center' }}>
              <TextLink label="Back to log in" onPress={() => router.replace('/sign-in')} />
            </Text>
          </>
        }
      >
        <Heading first="Reset your" second="password" sub="Enter the email you use for FitSphere Coach. We'll send a reset link." />
        <View style={{ marginTop: 28 }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => void send()}
          />
        </View>
      </AuthLayout>
    );
  }

  const clock = `0:${String(Math.max(wait, 0)).padStart(2, '0')}`;
  return (
    <AuthLayout
      onBack={back}
      footer={
        <>
          {offline ? <Banner kind="error">{TEXTS.offline}</Banner> : null}
          <PrimaryButton label="Open email app" onPress={() => void Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => undefined)} />
          <SecondaryButton label="Resend link" onPress={() => void send()} disabled={wait > 0 || busy} />
        </>
      }
    >
      <View style={{ marginTop: 40 }}>
        <IconTile name="mail" />
      </View>
      <Heading
        first="Check your"
        second="inbox"
        sub={
          <>
            If an account exists for <Strong>{email.trim().toLowerCase()}</Strong>, a reset link is on its way. It works once and expires in 30 minutes.
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
    </AuthLayout>
  );
}
