// Account (stub for CF01; the full screen is CACC-001) with Change password and the Log out sheet
// (CAUTH-004; CF01 UI doc §4.8).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { roleLabel, useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { logOut } from '../auth/service';
import { Icon, IconTile, PrimaryButton, PushedLayout, SecondaryButton, Sheet, textStyles } from '../components/ui';
import { fonts, radius, useTheme } from '../theme';

export default function Account() {
  const { deps } = useAuth();
  const { state } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const [sheet, setSheet] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const me = state?.kind === 'coach' ? state.me : null;
  const name = me?.coach?.fullName ?? '';

  async function confirmLogOut() {
    setLeaving(true);
    await logOut(deps);
    setSheet(false);
    router.dismissAll();
    router.replace('/sign-in');
  }

  return (
    <PushedLayout backLabel="Home" onBack={() => router.back()} title="Account">
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 20, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.onPrimary }}>{(name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[textStyles.listTitle, { color: colors.ink }]}>{name}</Text>
          <Text style={[textStyles.body, { color: colors.inkMuted, fontSize: 14, lineHeight: 20 }]}>{me ? roleLabel(me.roles) : ''}</Text>
          <Text style={[textStyles.body, { color: colors.inkMuted, fontSize: 14, lineHeight: 20 }]}>{me?.user.email ?? ''}</Text>
        </View>
      </View>

      <Text style={[textStyles.label, { color: colors.inkMuted, marginTop: 24, marginBottom: 8 }]}>SECURITY</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={() => router.push('/change-password')} accessibilityRole="button" style={styles.row}>
          <Text style={[textStyles.listTitle, { color: colors.ink }]}>Change password</Text>
          <Icon name="chevron-right" color={colors.inkMuted} />
        </Pressable>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Pressable onPress={() => setSheet(true)} accessibilityRole="button" style={styles.row}>
          <Text style={[textStyles.listTitle, { color: colors.accent, fontFamily: fonts.bodySemiBold }]}>Log out</Text>
        </Pressable>
      </View>

      <Sheet visible={sheet} onClose={() => setSheet(false)} labelledBy="Log out?">
        <View style={{ marginTop: 24 }}>
          <IconTile name="log-out" size={56} />
        </View>
        <Text accessibilityRole="header" style={[textStyles.sheetTitle, { color: colors.ink, marginTop: 16 }]}>
          LOG OUT?
        </Text>
        <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 8 }]}>
          Your team and trainee data stay on your account. You'll need your email and password to log back in.
        </Text>
        <View style={{ marginTop: 24, gap: 12 }}>
          <PrimaryButton label="Log out" onPress={() => void confirmLogOut()} loading={leaving} />
          <SecondaryButton label="Stay logged in" onPress={() => setSheet(false)} disabled={leaving} />
        </View>
      </Sheet>
    </PushedLayout>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.sm },
  avatar: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
