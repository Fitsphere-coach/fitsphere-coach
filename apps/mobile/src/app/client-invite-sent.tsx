// Invite sent (CF04 design §2.4). The same text whether or not the email has a FitSphere account
// (invariant 3).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AuthLayout, Heading, IconTile, PrimaryButton, SecondaryButton } from '../components/ui';
import { CLIENT_TEXTS } from '../clients/texts';

export default function ClientInviteSent() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  return (
    <AuthLayout
      footer={
        <>
          <PrimaryButton label="Back to clients" arrow onPress={() => router.replace('/clients')} />
          <SecondaryButton label="Invite another" onPress={() => router.replace('/client-invite')} />
        </>
      }
    >
      <View style={{ marginTop: 32 }}>
        <IconTile name="mail" tone="success" />
      </View>
      <Heading first="Invite" second="sent" sub={CLIENT_TEXTS.inviteSent(email ?? 'them')} />
    </AuthLayout>
  );
}
