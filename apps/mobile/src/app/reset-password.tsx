// Opened by the reset email's link (CAUTH-003; CF01 UI doc §4.6, steps "new password" and "link
// expired"). After saving, other sessions are signed out and this phone is logged in.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { setNewPassword, startPasswordReset, type NewPasswordResult } from '../auth/service';
import { passwordOk, passwordRules, TEXTS } from '../auth/texts';
import { AuthLayout, Banner, Field, Heading, IconTile, PasswordStrength, PrimaryButton } from '../components/ui';
import { useTheme } from '../theme';

export default function ResetPassword() {
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [stage, setStage] = useState<'opening' | 'ready' | 'expired' | 'offline'>('opening');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NewPasswordResult | null>(null);

  useEffect(() => {
    let current = true;
    void startPasswordReset(deps, code).then((opened) => {
      if (current) setStage(opened);
    });
    return () => {
      current = false;
    };
  }, [deps, code]);

  async function save() {
    if (busy || !passwordOk(password) || confirm !== password) return;
    setBusy(true);
    const outcome = await setNewPassword(deps, password);
    setBusy(false);
    if (outcome === 'changed') router.replace('/');
    else setResult(outcome);
  }

  if (stage === 'opening') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Opening link" />
      </View>
    );
  }
  if (stage === 'expired' || stage === 'offline') {
    return (
      <AuthLayout footer={<PrimaryButton label="Send a new link" onPress={() => router.replace('/forgot-password')} />}>
        <View style={{ marginTop: 40 }}>
          <IconTile name="clock" />
        </View>
        <Heading
          first="Link"
          second="expired"
          sub="Reset links work once and only for 30 minutes, on the phone that asked for them. Request a new one and use it straight away."
        />
        {stage === 'offline' ? (
          <View style={{ marginTop: 20 }}>
            <Banner kind="error">{TEXTS.offline}</Banner>
          </View>
        ) : null}
      </AuthLayout>
    );
  }
  const mismatch = confirm !== '' && confirm !== password;
  return (
    <AuthLayout
      footer={
        <>
          {result === 'offline' || result === 'failed' ? <Banner kind="error">{result === 'offline' ? TEXTS.offline : TEXTS.tryLater}</Banner> : null}
          <PrimaryButton label="Save and log in" onPress={() => void save()} loading={busy} disabled={!passwordOk(password) || confirm !== password} />
        </>
      }
    >
      <Heading
        first="Set a new"
        second="password"
        sub="This changes your password in both FitSphere apps. You'll be signed out on your other devices."
      />
      <View style={{ marginTop: 28, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Field
            label="New password"
            password
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            autoComplete="new-password"
            error={result === 'samePassword' ? TEXTS.samePassword : null}
          />
          <PasswordStrength rules={passwordRules(password)} />
        </View>
        <Field
          label="Confirm password"
          password
          value={confirm}
          onChangeText={setConfirm}
          editable={!busy}
          autoComplete="new-password"
          error={mismatch ? TEXTS.passwordMismatch : null}
        />
      </View>
    </AuthLayout>
  );
}
