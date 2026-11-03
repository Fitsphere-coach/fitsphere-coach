// Log in (CAUTH-001, CAUTH-004; CF01 UI doc §4.1).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signIn, type SignInResult } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { AuthLayout, Banner, Field, Heading, PrimaryButton, TextLink, textStyles, type InputRef } from '../components/ui';
import { useTheme } from '../theme';

const ERRORS: Partial<Record<SignInResult, string>> = {
  failed: TEXTS.signInFailed,
  locked: TEXTS.locked,
  offline: TEXTS.offline,
  unavailable: TEXTS.tryLater,
};

export default function SignIn() {
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { expired } = useLocalSearchParams<{ expired?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SignInResult | null>(null);
  const passwordRef = useRef<InputRef>(null);

  async function submit() {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setResult(null);
    const outcome = await signIn(deps, email, password);
    setBusy(false);
    if (outcome === 'signedIn') router.replace('/');
    else setResult(outcome);
  }

  const error = result ? ERRORS[result] : undefined;
  return (
    <AuthLayout
      footer={
        <>
          <PrimaryButton label="Log in" arrow onPress={() => void submit()} loading={busy} disabled={result === 'locked'} />
          <Text style={[textStyles.body, { color: colors.inkMuted, textAlign: 'center' }]}>
            New coach? <TextLink label="Create account" onPress={() => router.push('/sign-up')} />
          </Text>
          <Text style={[textStyles.small, { color: colors.inkMuted, textAlign: 'center' }]}>
            Invited to a team? Open the link in your invite email.
          </Text>
        </>
      }
    >
      {expired === '1' && !result ? (
        <View style={{ marginTop: 16 }}>
          <Banner kind="info">{TEXTS.sessionExpired}</Banner>
        </View>
      ) : null}
      <Heading first="Welcome back," second="Coach" sub="Log in to see your trainees and what they logged today." />
      {error ? (
        <View style={{ marginTop: 20 }}>
          <Banner kind="error">{error}</Banner>
        </View>
      ) : null}
      <View style={{ marginTop: 24, gap: 18 }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Field
          ref={passwordRef}
          label="Password"
          password
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          labelAction={<TextLink label="Forgot password?" size={14} onPress={() => router.push('/forgot-password')} />}
        />
      </View>
    </AuthLayout>
  );
}
