// Change password (CAUTH-004; CF01 UI doc §4.7). The password is the same in both FitSphere apps.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { changePassword, type ChangePasswordResult } from '../auth/service';
import { passwordOk, passwordRules, TEXTS } from '../auth/texts';
import { Banner, Field, PasswordStrength, PrimaryButton, PushedLayout, TextLink, textStyles } from '../components/ui';
import { useTheme } from '../theme';

export default function ChangePassword() {
  const { deps, email } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChangePasswordResult | null>(null);

  const mismatch = confirm !== '' && confirm !== next;
  const ready = current !== '' && passwordOk(next) && confirm === next;

  async function submit() {
    if (!ready || busy || !email) return;
    setBusy(true);
    setResult(null);
    const outcome = await changePassword(deps, email, current, next);
    setBusy(false);
    setResult(outcome);
    if (outcome === 'changed') {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  }

  const banner =
    result === 'changed' ? (
      <Banner kind="success">{TEXTS.passwordUpdated}</Banner>
    ) : result === 'offline' ? (
      <Banner kind="error">{TEXTS.offline}</Banner>
    ) : result === 'failed' ? (
      <Banner kind="error">{TEXTS.tryLater}</Banner>
    ) : null;

  return (
    <PushedLayout backLabel="Account" onBack={() => router.back()} title="Change password">
      <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 10 }]}>
        This is the password for both FitSphere apps. You'll stay signed in here; other devices will be signed out.
      </Text>
      {banner ? <View style={{ marginTop: 20 }}>{banner}</View> : null}
      <View style={{ marginTop: 24, gap: 18 }}>
        <Field
          label="Current password"
          password
          value={current}
          onChangeText={setCurrent}
          editable={!busy}
          autoComplete="current-password"
          error={result === 'wrongPassword' ? TEXTS.wrongCurrentPassword : null}
        />
        <View style={{ gap: 8 }}>
          <Field
            label="New password"
            password
            value={next}
            onChangeText={setNext}
            editable={!busy}
            autoComplete="new-password"
            error={result === 'samePassword' ? TEXTS.samePassword : null}
          />
          <PasswordStrength rules={passwordRules(next)} />
        </View>
        <Field
          label="Confirm new password"
          password
          value={confirm}
          onChangeText={setConfirm}
          editable={!busy}
          autoComplete="new-password"
          error={mismatch ? TEXTS.passwordMismatch : null}
        />
      </View>
      <View style={{ marginTop: 'auto', paddingTop: 24, gap: 16, alignItems: 'stretch' }}>
        <PrimaryButton label="Update password" onPress={() => void submit()} disabled={!ready} loading={busy} />
        <Text style={{ textAlign: 'center' }}>
          <TextLink label="Forgot current password?" onPress={() => router.push('/forgot-password')} />
        </Text>
      </View>
    </PushedLayout>
  );
}
