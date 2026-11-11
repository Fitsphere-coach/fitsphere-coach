// Gym onboarding: the code was right; the person is now the gym's Head Coach for good
// (CF02 design §4.6). The server made the role; this screen only says so and goes home.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { AuthLayout, Heading, IconTile, PrimaryButton, Strong } from '../components/ui';

export default function GymApproved() {
  const { gym } = useLocalSearchParams<{ gym?: string }>();
  const { refresh } = useAccount();
  const router = useRouter();
  const [going, setGoing] = useState(false);

  async function goHome() {
    setGoing(true);
    // The start screen reads the account again and now finds the Head Coach role.
    await refresh();
    router.replace('/');
  }

  return (
    <AuthLayout footer={<PrimaryButton label="Go to home" arrow onPress={() => void goHome()} loading={going} />}>
      <View style={{ marginTop: 32 }}>
        <IconTile name="check" tone="success" />
      </View>
      <Heading
        step="Approved"
        first="You're a"
        second="head coach"
        sub={
          <>
            {gym ? <Strong>{gym}</Strong> : 'Your gym'} is approved. You can now invite Coaches and add trainees. You will not need a code again.
          </>
        }
      />
    </AuthLayout>
  );
}
