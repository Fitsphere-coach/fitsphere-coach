// Step 3 of 3: choose Coach or Head Coach and name your team. Built in CF02; this placeholder
// keeps the CF01 flow complete.
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AuthLayout, Banner, Heading, SecondaryButton } from '../components/ui';

export default function ChooseRole() {
  const router = useRouter();
  return (
    <AuthLayout
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      footer={<SecondaryButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
    >
      <Heading step="Step 3 of 3" first="Choose your" second="role" sub="Coach or Head Coach, and your team's name." />
      <View style={{ marginTop: 20 }}>
        <Banner kind="info">This step arrives with the next feature (CF02).</Banner>
      </View>
    </AuthLayout>
  );
}
