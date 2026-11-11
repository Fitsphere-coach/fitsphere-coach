// Invite a client (CF04, docs/design/CF04-client-management-ui.md §2.3). The trainee accepts in the
// FitSphere app; nothing is shared until they do (C-D23). The Head Coach chooses who the client will be
// under (C-D21); a Coach always adds under themselves. The server decides every refusal.
import type { ClientListResponse } from '@fitsphere-coach/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS, emailProblem } from '../auth/texts';
import { Banner, Field, Heading, PrimaryButton, PushedLayout, textStyles } from '../components/ui';
import { inviteClient, loadClients, type InviteResult } from '../clients/service';
import { CLIENT_TEXTS } from '../clients/texts';
import { radius, useTheme } from '../theme';

const FIELD_ERRORS: Partial<Record<InviteResult, string>> = {
  alreadyAdded: CLIENT_TEXTS.alreadyAdded,
  cannotInvite: CLIENT_TEXTS.cannotInvite,
  invalid: CLIENT_TEXTS.inviteInvalid,
};
const BANNERS: Partial<Record<InviteResult, string>> = {
  limit: CLIENT_TEXTS.inviteLimit,
  emailFailed: CLIENT_TEXTS.inviteEmailFailed,
  refused: CLIENT_TEXTS.refused,
  offline: TEXTS.offline,
  unavailable: TEXTS.tryLater,
};

export default function ClientInvite() {
  const { deps } = useAuth();
  const { state } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const me = state?.kind === 'coach' ? state.me : null;
  const isHead = me?.roles.includes('head_coach') ?? false;
  const [email, setEmail] = useState('');
  const [coaches, setCoaches] = useState<ClientListResponse['coaches']>([]);
  const [under, setUnder] = useState<string | null>(null); // null = myself
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  useEffect(() => {
    if (!isHead) return;
    let current = true;
    void loadClients(deps).then((list) => {
      if (current && list.kind === 'ok') setCoaches(list.body.coaches);
    });
    return () => {
      current = false;
    };
  }, [deps, isHead]);

  const formatProblem = email.trim() === '' ? null : emailProblem(email);
  const ready = email.trim() !== '' && !formatProblem;

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    setResult(null);
    const outcome = await inviteClient(deps, email.trim().toLowerCase(), isHead && under ? under : undefined);
    setSending(false);
    if (outcome === 'signedOut') router.replace('/sign-in?expired=1');
    else if (outcome === 'sent') router.replace(`/client-invite-sent?email=${encodeURIComponent(email.trim().toLowerCase())}` as never);
    else setResult(outcome);
  }

  const fieldError = (result ? FIELD_ERRORS[result] : undefined) ?? (formatProblem && email.length > 3 ? formatProblem : undefined);
  const banner = result ? BANNERS[result] : undefined;

  return (
    <PushedLayout backLabel="Clients" onBack={() => (router.canGoBack() ? router.back() : router.replace('/clients'))} title="Invite a client">
      <Heading first="Invite a" second="client" sub={CLIENT_TEXTS.inviteSub} />
      <View style={{ marginTop: 24, gap: 18 }}>
        <Field
          label="Client email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setResult(null);
          }}
          error={fieldError ?? null}
          editable={!sending}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="name@example.com"
          returnKeyType="send"
          onSubmitEditing={() => void send()}
        />
        {isHead ? (
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            <Text style={[textStyles.label, { color: colors.inkMuted }]}>ADD UNDER</Text>
            <Choice label="Myself" sub="They become your client" selected={under === null} onPress={() => setUnder(null)} />
            {coaches.map((coach) => (
              <Choice key={coach.id} label={coach.name ?? 'Coach'} sub="They become this coach's client" selected={under === coach.id} onPress={() => setUnder(coach.id)} />
            ))}
          </View>
        ) : null}
        <Banner kind="info">{CLIENT_TEXTS.inviteInfo}</Banner>
        {banner ? <Banner kind="error">{banner}</Banner> : null}
        <PrimaryButton label={result === 'emailFailed' ? 'Try again' : 'Send invite'} arrow onPress={() => void send()} disabled={!ready} loading={sending} />
      </View>
    </PushedLayout>
  );
}

function Choice({ label, sub, selected, onPress }: { label: string; sub: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.choice, { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border }]}
    >
      <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.inkSubtle }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[textStyles.listTitle, { color: colors.ink }]}>{label}</Text>
        <Text style={[textStyles.small, { color: colors.inkMuted }]}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 14, minHeight: 56 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
