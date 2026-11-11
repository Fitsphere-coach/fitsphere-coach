// One client (CF04, docs/design/CF04-client-management-ui.md §2.5 to §2.7): who their coach is, how
// they are doing, and, for the Head Coach, moving them to another coach. Removing ends the link and
// deletes nothing. The server decides who may open, move or remove (invariants 1, 14).
import type { ClientListResponse, ClientProfile } from '@fitsphere-coach/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, Icon, IconTile, PrimaryButton, PushedLayout, SecondaryButton, Sheet, textStyles, type IconName } from '../components/ui';
import { loadClientProfile, loadClients, moveClient, removeClient, type ChangeResult } from '../clients/service';
import { CLIENT_TEXTS, coachLabel, lastLoggedText, sinceText } from '../clients/texts';
import { fonts, radius, useTheme } from '../theme';

type SheetKind = 'move' | 'remove' | null;

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deps } = useAuth();
  const { state } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [coaches, setCoaches] = useState<ClientListResponse['coaches']>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const me = state?.kind === 'coach' ? state.me : null;
  const myId = me?.user.id ?? null;
  const isHead = me?.roles.includes('head_coach') ?? false;

  useEffect(() => {
    if (!id) return;
    let current = true;
    void (async () => {
      const result = await loadClientProfile(deps, id);
      if (!current) return;
      if (result.kind === 'ok') setProfile(result.body);
      else if (result.kind === 'signedOut') router.replace('/sign-in?expired=1');
      else setProblem(result.kind === 'notFound' ? CLIENT_TEXTS.notFound : result.kind === 'offline' ? TEXTS.offline : TEXTS.tryLater);
      if (isHead) {
        const list = await loadClients(deps);
        if (current && list.kind === 'ok') setCoaches(list.body.coaches);
      }
    })();
    return () => {
      current = false;
    };
  }, [deps, id, isHead, router]);

  // Where this client can go: the Head Coach themselves, or a Coach of the gym, but not where they are.
  const targets = [
    ...(myId && profile?.coachId !== myId ? [{ id: myId, name: 'Myself (Head coach)' }] : []),
    ...coaches.filter((coach) => coach.id !== profile?.coachId).map((coach) => ({ id: coach.id, name: coach.name ?? 'Coach' })),
  ];

  async function change(action: () => Promise<ChangeResult>, closeTo: 'refresh' | 'list') {
    setWorking(true);
    const result = await action();
    setWorking(false);
    if (result === 'done') {
      setSheet(null);
      if (closeTo === 'list') {
        router.replace('/clients');
      } else if (id) {
        const reloaded = await loadClientProfile(deps, id);
        if (reloaded.kind === 'ok') setProfile(reloaded.body);
      }
      return;
    }
    setSheet(null);
    if (result === 'signedOut') router.replace('/sign-in?expired=1');
    else setProblem(result === 'notFound' ? CLIENT_TEXTS.notFound : result === 'refused' ? CLIENT_TEXTS.refused : result === 'offline' ? TEXTS.offline : TEXTS.tryLater);
  }

  return (
    <PushedLayout backLabel="Clients" onBack={() => (router.canGoBack() ? router.back() : router.replace('/clients'))} title={profile?.name ?? 'Client'}>
      {problem ? (
        <View style={{ marginTop: 16 }}>
          <Banner kind="error">{problem}</Banner>
        </View>
      ) : null}
      {!profile && !problem ? (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
        </View>
      ) : null}

      {profile ? (
        <>
          <Card style={{ marginTop: 18 }}>
            <Row label="Coach" value={coachLabel(profile.coachId, profile.coachName, myId)} />
            <Row label="Since" value={sinceText(profile.startedAt)} last />
          </Card>

          <Text style={[textStyles.label, styles.section, { color: colors.inkMuted }]}>PROGRESS</Text>
          <Card>
            <Row label="Latest weight" value={profile.latestWeightKg === null ? 'Not logged' : `${profile.latestWeightKg} kg`} />
            <Row label="Calorie target" value={profile.targets.calories === null ? 'Not set' : `${profile.targets.calories} kcal`} />
            <Row label="Protein target" value={profile.targets.proteinG === null ? 'Not set' : `${profile.targets.proteinG} g`} />
            <Row
              label="Workouts this week"
              value={profile.targets.weeklyWorkouts === null ? `${profile.workoutsThisWeek}` : `${profile.workoutsThisWeek} of ${profile.targets.weeklyWorkouts}`}
            />
            <Row label="Last logged" value={lastLoggedText(profile.lastLoggedAt)} last />
          </Card>

          <Text style={[textStyles.label, styles.section, { color: colors.inkMuted }]}>PLANS AND SCHEDULE</Text>
          <Card>
            <LinkRow icon="activity" title="Training plan" text="Not set yet" />
            <LinkRow icon="coffee" title="Diet plan" text="Not set yet" />
            <LinkRow icon="calendar" title="Calendar" text="Not set yet" last />
          </Card>

          <View style={{ marginTop: 24, gap: 8 }}>
            {isHead && targets.length > 0 ? (
              <SecondaryButton
                label="Change coach"
                onPress={() => {
                  setPick(targets[0]?.id ?? null);
                  setSheet('move');
                }}
              />
            ) : null}
            <Pressable onPress={() => setSheet('remove')} accessibilityRole="button" accessibilityLabel="Remove client" style={styles.remove}>
              <Text style={[styles.removeText, { color: colors.danger }]}>REMOVE CLIENT</Text>
            </Pressable>
          </View>

          <Sheet visible={sheet === 'move'} onClose={() => setSheet(null)} labelledBy="Move to a coach">
            <View style={{ marginTop: 22 }}>
              <IconTile name="repeat" size={56} />
            </View>
            <Text accessibilityRole="header" style={[textStyles.sheetTitle, { color: colors.ink, marginTop: 16 }]}>
              MOVE TO A COACH
            </Text>
            <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 8 }]}>{CLIENT_TEXTS.moveBody(profile.name)}</Text>
            <View style={{ marginTop: 16, gap: 8 }} accessibilityRole="radiogroup">
              {targets.map((target) => (
                <Pressable
                  key={target.id}
                  onPress={() => setPick(target.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: pick === target.id }}
                  accessibilityLabel={target.name}
                  style={[styles.option, { backgroundColor: colors.surfaceSunken, borderColor: pick === target.id ? colors.accent : colors.border }]}
                >
                  <Text style={[textStyles.listTitle, { color: colors.ink, flex: 1 }]}>{target.name}</Text>
                  <View style={[styles.radio, { borderColor: pick === target.id ? colors.accent : colors.inkSubtle }]}>
                    {pick === target.id ? <View style={[styles.radioDot, { backgroundColor: colors.accent }]} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={{ marginTop: 20, gap: 10 }}>
              <PrimaryButton label="Move client" onPress={() => pick && id && void change(() => moveClient(deps, id, pick), 'refresh')} disabled={!pick} loading={working} />
              <SecondaryButton label="Cancel" onPress={() => setSheet(null)} disabled={working} />
            </View>
          </Sheet>

          <Sheet visible={sheet === 'remove'} onClose={() => setSheet(null)} labelledBy="Remove client">
            <View style={{ marginTop: 22 }}>
              <IconTile name="user-x" size={56} />
            </View>
            <Text accessibilityRole="header" style={[textStyles.sheetTitle, { color: colors.ink, marginTop: 16 }]}>
              {`REMOVE ${profile.name.split('@')[0]?.toUpperCase() ?? ''}?`}
            </Text>
            <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 8 }]}>{CLIENT_TEXTS.removeBody(profile.name)}</Text>
            <View style={{ marginTop: 20, gap: 10 }}>
              <Pressable
                onPress={() => id && void change(() => removeClient(deps, id), 'list')}
                disabled={working}
                accessibilityRole="button"
                accessibilityLabel="Confirm remove client"
                accessibilityState={{ disabled: working, busy: working }}
                style={[styles.confirmRemove, { backgroundColor: colors.danger, opacity: working ? 0.6 : 1 }]}
              >
                {working ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.confirmText, { color: colors.onPrimary }]}>REMOVE CLIENT</Text>}
              </Pressable>
              <SecondaryButton label="Keep client" onPress={() => setSheet(null)} disabled={working} />
            </View>
          </Sheet>
        </>
      ) : null}
    </PushedLayout>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, last ? null : { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[textStyles.body, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[textStyles.body, { color: colors.ink, fontFamily: fonts.bodyMedium }]}>{value}</Text>
    </View>
  );
}

function LinkRow({ icon, title, text, last }: { icon: IconName; title: string; text: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.linkRow, last ? null : { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Icon name={icon} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[textStyles.listTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[textStyles.small, { color: colors.inkMuted }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: radius.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  linkRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  remove: { height: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 14, minHeight: 52 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  confirmRemove: { height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5 },
});
