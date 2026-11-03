// Opened by the verify email's link (CAUTH-006). Trades the link's code for a session, sets the
// account up, and shows "You're in". On another phone the email is still verified: log in.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { openVerifyLink } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { AuthLayout, Banner, Heading, IconTile, PrimaryButton } from '../components/ui';
import { useTheme } from '../theme';

type Stage = 'working' | 'done' | 'logIn' | 'offline';

export default function Verified() {
  const { deps } = useAuth();
  const { refresh } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [stage, setStage] = useState<Stage>('working');

  useEffect(() => {
    let current = true;
    void (async () => {
      const opened = await openVerifyLink(deps, code);
      if (!current) return;
      if (opened !== 'ready') return setStage(opened);
      const state = await refresh();
      if (current) setStage(state.kind === 'offline' ? 'offline' : 'done');
    })();
    return () => {
      current = false;
    };
  }, [deps, code, refresh]);

  if (stage === 'working') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Verifying" />
      </View>
    );
  }
  if (stage === 'done') {
    return (
      <AuthLayout footer={<PrimaryButton label="Continue" arrow onPress={() => router.replace('/')} />}>
        <View style={{ marginTop: 64 }}>
          <IconTile name="check" size={80} tone="success" />
        </View>
        <Heading
          step="Step 2 of 3 · done"
          first="You're"
          second="in"
          sub="Email verified. Last step: choose Coach or Head Coach, and name your team if you lead one."
        />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout footer={<PrimaryButton label="Log in" onPress={() => router.replace('/sign-in')} />}>
      <View style={{ marginTop: 64 }}>
        <IconTile name="mail" />
      </View>
      <Heading
        first="Log in to"
        second="continue"
        sub="If you tapped the link from your email, your email is verified. Log in on this phone to continue."
      />
      {stage === 'offline' ? (
        <View style={{ marginTop: 20 }}>
          <Banner kind="error">{TEXTS.offline}</Banner>
        </View>
      ) : null}
    </AuthLayout>
  );
}
