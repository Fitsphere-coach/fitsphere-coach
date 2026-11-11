// The coach's home. The dashboard (MON-001) arrives later; for CF01 it shows who is signed in and
// opens Account.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roleLabel, useAccount } from '../account/AccountProvider';
import { Banner, SecondaryButton, Stripes, textStyles } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { fonts, radius, useTheme } from '../theme';

export default function Home() {
  const { state } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = state?.kind === 'coach' ? state.me : null;
  const name = me?.coach?.fullName ?? '';
  const initial = (name || me?.user.email || '?').charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
      <Stripes />
      <View style={styles.header}>
        <View style={{ alignItems: 'flex-start' }}>
          <Wordmark />
        </View>
        <Pressable
          onPress={() => router.push('/account')}
          accessibilityRole="button"
          accessibilityLabel="Account"
          style={[styles.avatar, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.initial, { color: colors.onPrimary }]}>{initial}</Text>
        </Pressable>
      </View>
      <Text style={[textStyles.label, { color: colors.inkMuted, marginTop: 20 }]}>{me ? roleLabel(me.roles).toUpperCase() : ''}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
        <Text style={{ color: colors.inkMuted }}>LET'S GO,{'\n'}</Text>
        {(name.split(' ')[0] || 'COACH').toUpperCase()}
      </Text>
      <View style={{ marginTop: 24, gap: 12 }}>
        <SecondaryButton label="Clients" onPress={() => router.push('/clients')} />
        <SecondaryButton label="Workouts" onPress={() => router.push('/workouts')} />
        <SecondaryButton label="Nutrition" onPress={() => router.push('/nutrition')} />
        <Banner kind="info">Your dashboard arrives in a later feature. Open Account to change your password or log out.</Banner>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44 },
  avatar: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display, fontSize: 20 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 40, marginTop: 4 },
});
