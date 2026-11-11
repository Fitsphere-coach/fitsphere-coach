// Workouts home (CF06, docs/design/CF06-workout-management-ui.md §2.1): templates and clients' plans.
// The server decides what a coach sees: gym templates and their own, and the plans of their clients
// (the Head Coach: the whole gym).
import type { PlanListResponse, TemplateSummary } from '@fitsphere-coach/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, Field, Heading, Icon, IconTile, PrimaryButton, PushedLayout } from '../components/ui';
import { loadPlans, loadTemplates } from '../workouts/service';
import { Chip, Segmented, StatusChip, Tag } from '../workouts/parts';
import { DIFFICULTY_LABELS, failureText, GOAL_LABELS, WORKOUT_TEXTS } from '../workouts/texts';
import { fonts, radius, useTheme } from '../theme';

type Tab = 'templates' | 'plans';

export default function Workouts() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { deps } = useAuth();
  const { state } = useAccount();
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>(params.tab === 'plans' ? 'plans' : 'templates');
  const [search, setSearch] = useState('');
  const [goal, setGoal] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [coachId, setCoachId] = useState<string | undefined>(undefined);
  const [showInactive, setShowInactive] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [plans, setPlans] = useState<PlanListResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const me = state?.kind === 'coach' ? state.me : null;
  const myId = me?.user.id ?? null;
  const head = me?.roles.includes('head_coach') ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    const result =
      tab === 'templates'
        ? await loadTemplates(deps, { q: search, ...(goal ? { goal } : {}), includeInactive: showInactive })
        : await loadPlans(deps, { q: search, ...(status ? { status } : {}), ...(coachId ? { coachId } : {}) });
    setLoading(false);
    if (result.kind === 'signedOut') {
      router.replace('/sign-in?expired=1');
    } else if (result.kind === 'ok') {
      if (tab === 'templates') setTemplates(result.body as TemplateSummary[]);
      else setPlans(result.body as PlanListResponse);
      setProblem(null);
    } else {
      setProblem(failureText(result.kind, TEXTS));
    }
  }, [deps, tab, search, goal, status, coachId, showInactive, router]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const list = tab === 'templates' ? templates : plans?.plans;
  const filtered = Boolean(search || goal || status || coachId);

  return (
    <PushedLayout backLabel="Home" onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))} title="Workouts">
      <Text style={[styles.sub, { color: colors.inkMuted }]}>{tab === 'templates' ? WORKOUT_TEXTS.templatesSub : WORKOUT_TEXTS.plansSub}</Text>
      <View style={{ marginTop: 16 }}>
        <Segmented
          label="Workouts"
          value={tab}
          onChange={(next) => {
            setTab(next);
            setSearch('');
          }}
          options={[
            { value: 'templates', label: 'Templates' },
            { value: 'plans', label: 'Plans' },
          ]}
        />
      </View>

      <View style={{ marginTop: 14, gap: 12 }}>
        <Field label={tab === 'templates' ? 'Search templates' : 'Search plans'} value={search} onChangeText={setSearch} placeholder={tab === 'templates' ? 'Search templates' : 'Search by client or plan'} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        {tab === 'templates' ? (
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Goal">
            <Chip label="All" selected={!goal} onPress={() => setGoal(undefined)} />
            {Object.entries(GOAL_LABELS).map(([value, label]) => (
              <Chip key={value} label={label} selected={goal === value} onPress={() => setGoal(value)} />
            ))}
          </View>
        ) : (
          <>
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Status">
              <Chip label="All" selected={!status} onPress={() => setStatus(undefined)} />
              <Chip label="Active" selected={status === 'active'} onPress={() => setStatus('active')} />
              <Chip label="Draft" selected={status === 'draft'} onPress={() => setStatus('draft')} />
              <Chip label="Ended" selected={status === 'ended'} onPress={() => setStatus('ended')} />
            </View>
            {head && (plans?.coaches.length ?? 0) > 0 ? (
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Coach">
                <Chip label="All coaches" selected={!coachId} onPress={() => setCoachId(undefined)} />
                <Chip label="Me" selected={coachId === myId} onPress={() => myId && setCoachId(myId)} />
                {plans?.coaches.map((coach) => (
                  <Chip key={coach.id} label={coach.name ?? 'Coach'} selected={coachId === coach.id} onPress={() => setCoachId(coach.id)} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>

      {problem ? (
        <View style={{ marginTop: 16 }}>
          <Banner kind="error">{problem}</Banner>
        </View>
      ) : null}
      {loading && !list ? (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
        </View>
      ) : null}

      {list && list.length === 0 ? (
        filtered ? (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>{WORKOUT_TEXTS.noMatch}</Text>
        ) : (
          <View style={{ marginTop: 40 }}>
            <IconTile name="activity" />
            <Heading
              first={tab === 'templates' ? 'No templates' : 'No plans'}
              second="yet"
              sub={tab === 'templates' ? WORKOUT_TEXTS.emptyTemplatesSub : WORKOUT_TEXTS.emptyPlansSub}
            />
          </View>
        )
      ) : null}

      <View style={{ marginTop: 16, gap: 8 }}>
        {tab === 'templates'
          ? templates?.map((template) => (
              <Pressable
                key={template.id}
                onPress={() => router.push(`/workout-template?id=${template.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={template.name}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: template.active ? 1 : 0.6 }]}
              >
                <View style={[styles.tile, { backgroundColor: colors.accentTint }]}>
                  <Icon name="activity" color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.ink }]}>{template.name}</Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.inkMuted }]}>
                    {GOAL_LABELS[template.goal]} · {DIFFICULTY_LABELS[template.difficulty]}
                  </Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.inkSubtle }]}>
                    {template.days} {template.days === 1 ? 'day' : 'days'} · {template.exercises} exercises{template.active ? '' : ' · inactive'}
                  </Text>
                </View>
                <Tag label={template.visibility === 'gym' ? 'Gym' : 'Mine'} tone={template.visibility === 'gym' ? 'accent' : 'plain'} />
              </Pressable>
            ))
          : plans?.plans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => router.push(`/workout-plan?id=${plan.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`${plan.traineeName}, ${plan.name}`}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.tile, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.initial, { color: colors.onPrimary }]}>{plan.traineeName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.ink }]}>{plan.traineeName}</Text>
                  <Text numberOfLines={2} style={[styles.meta, { color: colors.inkMuted }]}>
                    {plan.name}
                    {plan.weeks ? ` · ${plan.weeks} weeks` : ''}
                    {plan.coachId === myId ? '' : ` · ${plan.coachName ?? 'Coach'}`}
                  </Text>
                </View>
                <StatusChip status={plan.status} />
              </Pressable>
            ))}
      </View>

      {tab === 'templates' ? (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Pressable onPress={() => setShowInactive(!showInactive)} accessibilityRole="switch" accessibilityState={{ checked: showInactive }} accessibilityLabel="Show inactive templates" style={styles.toggle}>
            <Text style={[styles.meta, { color: colors.inkMuted, fontSize: 15 }]}>Show inactive templates</Text>
            <Icon name={showInactive ? 'check-square' : 'square'} color={colors.accent} />
          </Pressable>
          <PrimaryButton label="New template" onPress={() => router.push('/workout-template')} />
        </View>
      ) : null}
    </PushedLayout>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 6, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { marginTop: 32, fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 14, minHeight: 68 },
  tile: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display, fontSize: 20 },
  name: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  meta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
});
