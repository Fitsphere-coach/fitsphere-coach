// Start: decides where a signed-in coach goes (CF01-coach-auth-ui.md §2).
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { destinationFor, useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { logOut } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { AuthLayout, Banner, Heading, PrimaryButton, SecondaryButton } from '../components/ui';
import { useTheme } from '../theme';

export default function Start() {
  const { signedIn, deps } = useAuth();
  const { refresh } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const [problem, setProblem] = useState<'offline' | 'unavailable' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (signedIn !== true) return;
    let current = true;
    void refresh().then((state) => {
      if (!current) return;
      if (state.kind === 'offline' || state.kind === 'unavailable') setProblem(state.kind);
      else router.replace(destinationFor(state) as Href);
    });
    return () => {
      current = false;
    };
  }, [signedIn, attempt, refresh, router]);

  if (signedIn === false) return <Redirect href="/sign-in" />;
  if (!problem) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
      </View>
    );
  }
  return (
    <AuthLayout
      footer={
        <>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setProblem(null);
              setAttempt((n) => n + 1);
            }}
          />
          <SecondaryButton label="Log out" onPress={() => void logOut(deps)} />
        </>
      }
    >
      <Heading first="Can't load" second="your account" />
      <View style={{ marginTop: 20 }}>
        <Banner kind="error">{problem === 'offline' ? TEXTS.offline : TEXTS.tryLater}</Banner>
      </View>
    </AuthLayout>
  );
}
