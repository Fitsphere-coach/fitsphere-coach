// Gym onboarding: the request is locked after too many wrong codes (CF02 design §4.4).
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { logOut } from '../auth/service';
import { AuthLayout, Banner, Heading, IconTile, PrimaryButton, SecondaryButton } from '../components/ui';
import { requestsLeftText } from '../gym/texts';
import { View } from 'react-native';

export default function RequestLocked() {
  const { deps } = useAuth();
  const { state, refresh } = useAccount();
  const router = useRouter();
  useEffect(() => {
    if (!state) void refresh();
  }, [state, refresh]);
  const left = state?.kind === 'onboarding' ? state.status.requestsLeftToday : null;

  return (
    <AuthLayout
      footer={
        <>
          <PrimaryButton label="Send a new request" arrow onPress={() => router.replace('/gym-form')} disabled={left === 0} />
          <SecondaryButton label="Log out" onPress={() => void logOut(deps).then(() => router.replace('/sign-in'))} />
        </>
      }
    >
      <View style={{ marginTop: 32 }}>
        <IconTile name="lock" />
      </View>
      <Heading
        first="Too many"
        second="wrong tries"
        sub="This request is locked after too many wrong codes. Send a new request and FitSphere will give you a new code. The old code will stop working."
      />
      {left !== null ? (
        <View style={{ marginTop: 20 }}>
          <Banner kind="info">{requestsLeftText(left)}</Banner>
        </View>
      ) : null}
    </AuthLayout>
  );
}
