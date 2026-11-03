// Coaching is off (CAUTH-001 AC4, CAUTH-005): a FitSphere account that has not switched on Coach
// or Head Coach. Switching on is CF02; invites shown here arrive with CF03 (D-11: in the app).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { logOut } from '../auth/service';
import { AuthLayout, Heading, Icon, IconTile, PrimaryButton, SecondaryButton, Strong, textStyles, type IconName } from '../components/ui';
import { radius, useTheme } from '../theme';

export default function CoachingOff() {
  const { deps, email } = useAuth();
  const { state } = useAccount();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const shownEmail = (state?.kind === 'coachingOff' ? state.email : null) ?? email ?? '';

  async function leave() {
    setLeaving(true);
    await logOut(deps);
    router.replace('/sign-in');
  }

  return (
    <AuthLayout
      footer={
        <>
          <PrimaryButton label="Switch on coaching" arrow onPress={() => router.push('/choose-role')} disabled={leaving} />
          <SecondaryButton label="Log out" onPress={() => void leave()} disabled={leaving} />
        </>
      }
    >
      <View style={{ marginTop: 40 }}>
        <IconTile name="users" />
      </View>
      <Heading
        first="Coaching is"
        second="off"
        sub={
          <>
            You're logged in as <Strong>{shownEmail}</Strong>. This account uses the FitSphere app. Switch on coaching to use
            FitSphere Coach with the same login.
          </>
        }
      />
      <InfoCard
        rows={[
          {
            icon: 'award',
            title: 'Coach or lead a team',
            text: 'Switch on Coach to coach trainees, or Head Coach to lead coaches. Your own logs stay private.',
          },
          {
            icon: 'mail',
            title: "Joining someone's team?",
            text: 'Ask your head coach to invite this email. Their invite will show here.',
          },
        ]}
      />
    </AuthLayout>
  );
}

function InfoCard({ rows }: { rows: { icon: IconName; title: string; text: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rows.map((row, index) => (
        <View key={row.title} style={[styles.row, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}>
          <View style={{ marginTop: 2 }}>
            <Icon name={row.icon} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[textStyles.listTitle, { color: colors.ink }]}>{row.title}</Text>
            <Text style={[textStyles.body, { color: colors.inkMuted, fontSize: 14, lineHeight: 20 }]}>{row.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 24, borderWidth: 1, borderRadius: radius.sm },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
});
