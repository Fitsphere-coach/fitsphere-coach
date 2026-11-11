// Client list (CF04, docs/design/CF04-client-management-ui.md §2.1). A Coach sees their own clients;
// the Head Coach sees the whole gym and can filter by Coach. The server decides who is listed.
import type { ClientListResponse } from '@fitsphere-coach/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, Field, Heading, IconTile, PrimaryButton, PushedLayout, TextLink } from '../components/ui';
import { cancelInvitation, inviteClient, loadClients } from '../clients/service';
import { CLIENT_TEXTS, coachLabel, lastLoggedText } from '../clients/texts';
import { fonts, radius, useTheme } from '../theme';

export default function Clients() {
  const { deps } = useAuth();
  const { state } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [coachId, setCoachId] = useState<string | undefined>(undefined);
  const [list, setList] = useState<ClientListResponse | null>(null);
  const [problem, setProblem] = useState<'offline' | 'unavailable' | null>(null);
  const [loading, setLoading] = useState(true);
  const myId = state?.kind === 'coach' ? state.me.user.id : null;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await loadClients(deps, { q: search, ...(coachId ? { coachId } : {}) });
    setLoading(false);
    if (result.kind === 'signedOut') {
      router.replace('/sign-in?expired=1');
    } else if (result.kind === 'ok') {
      setList(result.body);
      setProblem(null);
    } else {
      setProblem(result.kind === 'offline' ? 'offline' : 'unavailable');
    }
  }, [deps, search, coachId, router]);

  // Search as the person types, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Resend is inviting the same email again; cancel ends the pending invitation.
  async function resend(email: string, coachId: string) {
    const outcome = await inviteClient(deps, email, coachId === myId ? undefined : coachId);
    if (outcome === 'sent') void load();
    else setProblem(outcome === 'offline' ? 'offline' : 'unavailable');
  }
  async function cancel(id: string) {
    const outcome = await cancelInvitation(deps, id);
    if (outcome === 'done' || outcome === 'notFound') void load();
    else setProblem(outcome === 'offline' ? 'offline' : 'unavailable');
  }

  const clients = list?.clients ?? [];
  const invitations = list?.invitations ?? [];
  const coaches = list?.coaches ?? [];

  return (
    <PushedLayout backLabel="Home" onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} title="Clients">
      <View style={{ marginTop: 18, gap: 12 }}>
        <Field label="Search clients" value={search} onChangeText={setSearch} placeholder="Search by email" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        {coaches.length > 0 ? (
          <View style={styles.chips} accessibilityRole="radiogroup">
            <Chip label="All coaches" selected={!coachId} onPress={() => setCoachId(undefined)} />
            <Chip label="Me" selected={coachId === myId} onPress={() => myId && setCoachId(myId)} />
            {coaches.map((coach) => (
              <Chip key={coach.id} label={coach.name ?? 'Coach'} selected={coachId === coach.id} onPress={() => setCoachId(coach.id)} />
            ))}
          </View>
        ) : null}
      </View>

      {problem ? (
        <View style={{ marginTop: 16 }}>
          <Banner kind="error">{problem === 'offline' ? TEXTS.offline : TEXTS.tryLater}</Banner>
        </View>
      ) : null}

      {loading && !list ? (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
        </View>
      ) : null}

      {list && clients.length === 0 ? (
        search || coachId ? (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>{CLIENT_TEXTS.noMatch}</Text>
        ) : (
          <View style={{ marginTop: 40 }}>
            <IconTile name="users" />
            <Heading first="No clients" second="yet" sub={list.canInvite ? CLIENT_TEXTS.emptyInviteSub : CLIENT_TEXTS.emptySub} />
          </View>
        )
      ) : null}

      <View style={{ marginTop: 16, gap: 8 }}>
        {clients.map((client) => (
          <Pressable
            key={client.id}
            onPress={() => router.push(`/client-profile?id=${client.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={client.name}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.initial, { color: colors.onPrimary }]}>{client.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.ink }]}>{client.name}</Text>
              <Text numberOfLines={1} style={[styles.sub, { color: colors.inkMuted }]}>
                {lastLoggedText(client.lastLoggedAt)} · {coachLabel(client.coachId, client.coachName, myId)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {invitations.length > 0 ? (
        <View style={{ marginTop: 24, gap: 8 }}>
          <Text style={[styles.section, { color: colors.inkMuted }]}>INVITED</Text>
          {invitations.map((invitation) => (
            <View key={invitation.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.ink }]}>{invitation.email}</Text>
                <Text numberOfLines={1} style={[styles.sub, { color: colors.inkMuted }]}>
                  Invited · {coachLabel(invitation.coachId, invitation.coachName, myId)}
                </Text>
              </View>
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                <TextLink label="Resend" onPress={() => void resend(invitation.email, invitation.coachId)} />
                <TextLink label="Cancel" onPress={() => void cancel(invitation.id)} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {list?.canInvite ? (
        <View style={{ marginTop: 24 }}>
          <PrimaryButton label="Invite client" arrow onPress={() => router.push('/client-invite')} />
        </View>
      ) : null}
    </PushedLayout>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, { backgroundColor: selected ? colors.surfaceRaised : 'transparent', borderColor: selected ? colors.accent : colors.border }]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.ink : colors.inkMuted }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1.5, borderRadius: radius.sm, justifyContent: 'center' },
  chipText: { fontFamily: fonts.displayBold, fontSize: 14, letterSpacing: 1 },
  section: { fontFamily: fonts.displayBold, fontSize: 13, letterSpacing: 1.5 },
  empty: { marginTop: 32, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 14, minHeight: 68 },
  avatar: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display, fontSize: 20 },
  name: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
