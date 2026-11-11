// Gym onboarding: the request expired after 7 days without approval (CF02 design §4.5).
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { logOut } from '../auth/service';
import { AuthLayout, Banner, Heading, IconTile, PrimaryButton, SecondaryButton } from '../components/ui';
import { requestsLeftText } from '../gym/texts';

export default function RequestExpired() {
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
          <PrimaryButton label="Start again" arrow onPress={() => router.replace('/gym-form')} disabled={left === 0} />
          <SecondaryButton label="Log out" onPress={() => void logOut(deps).then(() => router.replace('/sign-in'))} />
        </>
      }
    >
      <View style={{ marginTop: 32 }}>
        <IconTile name="clock" />
      </View>
      <Heading
        first="Request"
        second="expired"
        sub="Requests work for 7 days. Fill in your gym details again to send a new one. FitSphere will give you a new code, and your earlier code no longer works."
      />
      {left !== null ? (
        <View style={{ marginTop: 20 }}>
          <Banner kind="info">{requestsLeftText(left)}</Banner>
        </View>
      ) : null}
    </AuthLayout>
  );
}
