// A client's plan (CF06, docs/design/CF06-workout-management-ui.md §2.5): the status first, then the
// days. Publish, end and discard are sheets with the exact words from the design. Publish waits for the
// FitSphere app update (TCR-003): while the server says it cannot publish, the button is hidden.
import type { PlanDetail } from '@fitsphere-coach/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, IconTile, PrimaryButton, PushedLayout, SecondaryButton, Sheet, textStyles, type IconName } from '../components/ui';
import { discardPlan, endPlan, loadPlan, publishPlan, type Failure } from '../workouts/service';
import { ActionLink, Card, SectionLabel, StatusChip } from '../workouts/parts';
import { dayMeta, dayText, exerciseName, exerciseSummary, failureText, WEEKDAY_LABELS, WORKOUT_TEXTS, whenText } from '../workouts/texts';
import { fonts, radius, useTheme } from '../theme';

type SheetKind = 'publish' | 'end' | 'discard' | null;

export default function WorkoutPlan() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [working, setWorking] = useState(false);
  const [openDay, setOpenDay] = useState<number | null>(0);

  // Bumping `tick` loads the plan again (after publish, end or discard).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!id) return;
    let current = true;
    void (async () => {
      const result = await loadPlan(deps, id);
      if (!current) return;
      if (result.kind === 'ok') {
        setPlan(result.body);
        setProblem(null);
      } else if (result.kind === 'signedOut') {
        router.replace('/sign-in?expired=1');
      } else {
        setProblem(failureText(result.kind, TEXTS));
      }
    })();
    return () => {
      current = false;
    };
  }, [deps, id, router, tick]);

  async function run(action: () => Promise<{ kind: 'ok' } | { kind: Failure }>, after: 'reload' | 'list') {
    setWorking(true);
    const result = await action();
    setWorking(false);
    setSheet(null);
    if (result.kind === 'ok') {
      if (after === 'list') router.replace('/workouts?tab=plans' as never);
      else setTick((value) => value + 1);
    } else if (result.kind === 'signedOut') {
      router.replace('/sign-in?expired=1');
    } else {
      setProblem(failureText(result.kind, TEXTS));
    }
  }

  const name = plan?.traineeName.split('@')[0] ?? 'the client';
  const unpublished = plan !== null && plan.status === 'active' && plan.liveVersion !== null && plan.version > plan.liveVersion;
  const canPublish = plan !== null && plan.canPublish && (plan.status === 'draft' || unpublished);

  return (
    <PushedLayout backLabel="Plans" onBack={() => (router.canGoBack() ? router.back() : router.replace('/workouts?tab=plans' as never))} title={plan?.name ?? 'Plan'}>
      {problem ? (
        <View style={{ marginTop: 16 }}>
          <Banner kind="error">{problem}</Banner>
        </View>
      ) : null}
      {!plan && !problem ? (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
        </View>
      ) : null}

      {plan ? (
        <>
          {/* The status comes first (owner answer 2026-11-11). */}
          <View style={styles.statusRow}>
            <StatusChip status={plan.status} />
            <Text style={[textStyles.small, { color: colors.inkMuted }]}>For {plan.traineeName}</Text>
          </View>
          <View style={{ marginTop: 12 }}>
            {plan.status === 'draft' ? <Banner kind="info">{WORKOUT_TEXTS.draftBanner(plan.version, name)}</Banner> : null}
            {plan.status === 'active' && unpublished ? <Banner kind="info">{WORKOUT_TEXTS.unpublishedBanner(plan.liveVersion ?? 1, name)}</Banner> : null}
            {plan.status === 'active' && !unpublished ? <Banner kind="success">{WORKOUT_TEXTS.liveBanner(name)}</Banner> : null}
            {plan.status === 'ended' ? <Banner kind="info">{WORKOUT_TEXTS.endedBanner}</Banner> : null}
          </View>
          {!plan.canPublish && plan.status !== 'ended' ? (
            <View style={{ marginTop: 8 }}>
              <Banner kind="info">{WORKOUT_TEXTS.publishWaits}</Banner>
            </View>
          ) : null}

          <Card style={{ marginTop: 14 }}>
            <Info label="Starts" value={dayText(plan.startDate)} />
            <Info label="Length · schedule" value={`${plan.content.weeks ? `${plan.content.weeks} weeks` : 'Ongoing'} · ${plan.content.scheduleMode === 'weekdays' ? 'Weekdays' : 'Rotating'}`} />
            <Info label="Weekly target" value={plan.content.weeklyTarget === null ? 'Not set' : `${plan.content.weeklyTarget} workouts`} />
            <Info label="Daily target" value={plan.content.dailyTarget ? 'On' : 'Off'} />
            <Info
              label="Last changed"
              value={plan.lastChange ? `${plan.lastChange.actorName ?? 'Coach'} (${plan.lastChange.actorRole === 'head_coach' ? 'HC' : 'C'}), ${whenText(plan.lastChange.at)}` : '—'}
              last
            />
          </Card>

          <SectionLabel>Days</SectionLabel>
          <View style={{ gap: 8 }}>
            {plan.content.days.map((day, index) => {
              const expanded = openDay === index;
              return (
                <Card key={index}>
                  <Pressable onPress={() => setOpenDay(expanded ? null : index)} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${day.name}, ${dayMeta(day)}`} style={styles.dayHead}>
                    <Text style={[styles.dayTag, { color: colors.accent }]}>{(day.weekday ? WEEKDAY_LABELS[day.weekday - 1] : `D${index + 1}`)?.toUpperCase()}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[textStyles.listTitle, { color: colors.ink }]}>{day.name}</Text>
                      <Text style={[textStyles.small, { color: colors.inkMuted }]}>{dayMeta(day)}</Text>
                    </View>
                  </Pressable>
                  {expanded
                    ? day.exercises.map((exercise, i) => (
                        <View key={i} style={[styles.exercise, { borderTopColor: colors.border, borderLeftColor: exercise.group !== null ? colors.accent : 'transparent' }]}>
                          <Text style={[textStyles.listTitle, { color: colors.ink }]}>{exerciseName(exercise.exerciseId)}</Text>
                          <Text style={[textStyles.small, { color: colors.inkMuted }]}>{exerciseSummary(exercise)}</Text>
                          {exercise.note ? <Text style={[textStyles.small, { color: colors.inkSubtle }]}>Note: {exercise.note}</Text> : null}
                        </View>
                      ))
                    : null}
                </Card>
              );
            })}
          </View>

          <View style={{ marginTop: 24, gap: 10 }}>
            {canPublish ? <PrimaryButton label="Publish" onPress={() => setSheet('publish')} /> : null}
            {plan.status !== 'ended' ? <SecondaryButton label="Edit plan" onPress={() => router.push(`/workout-plan-edit?id=${plan.id}` as never)} /> : null}
            <View style={styles.links}>
              <ActionLink icon="clock" label="History" onPress={() => router.push(`/workout-history?id=${plan.id}` as never)} />
              {plan.status === 'draft' || unpublished ? <ActionLink icon="trash-2" label={plan.status === 'draft' ? 'Discard draft' : 'Discard changes'} tone="danger" onPress={() => setSheet('discard')} /> : null}
              {plan.status === 'active' ? <ActionLink icon="x-circle" label="End plan" tone="danger" onPress={() => setSheet('end')} /> : null}
            </View>
          </View>

          <ConfirmSheet
            visible={sheet === 'publish'}
            icon="send"
            title={`Publish to ${name}?`}
            body={WORKOUT_TEXTS.publishBody(name)}
            action="Publish"
            cancel="Not yet"
            working={working}
            onClose={() => setSheet(null)}
            onConfirm={() => void run(() => publishPlan(deps, plan.id), 'reload')}
          />
          <ConfirmSheet
            visible={sheet === 'end'}
            icon="x-circle"
            title={`End ${plan.name}?`}
            body={WORKOUT_TEXTS.endBody(name)}
            action="End plan"
            cancel="Keep plan"
            danger
            working={working}
            onClose={() => setSheet(null)}
            onConfirm={() => void run(() => endPlan(deps, plan.id), 'reload')}
          />
          <ConfirmSheet
            visible={sheet === 'discard'}
            icon="trash-2"
            title={plan.status === 'draft' ? 'Discard this draft?' : 'Discard changes?'}
            body={plan.status === 'draft' ? 'The draft is deleted. Nothing the client sees changes.' : WORKOUT_TEXTS.discardBody}
            action="Discard"
            cancel="Keep"
            danger
            working={working}
            onClose={() => setSheet(null)}
            onConfirm={() => void run(() => discardPlan(deps, plan.id), plan.status === 'draft' ? 'list' : 'reload')}
          />
        </>
      ) : null}
    </PushedLayout>
  );
}

function ConfirmSheet({ visible, icon, title, body, action, cancel, danger, working, onClose, onConfirm }: { visible: boolean; icon: IconName; title: string; body: string; action: string; cancel: string; danger?: boolean; working: boolean; onClose: () => void; onConfirm: () => void }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} labelledBy={title}>
      <View style={{ marginTop: 22 }}>
        <IconTile name={icon} size={56} />
      </View>
      <Text accessibilityRole="header" style={[textStyles.sheetTitle, { color: colors.ink, marginTop: 16 }]}>{title.toUpperCase()}</Text>
      <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 8 }]}>{body}</Text>
      <View style={{ marginTop: 20, gap: 10 }}>
        {danger ? (
          <Pressable onPress={onConfirm} disabled={working} accessibilityRole="button" accessibilityLabel={action} accessibilityState={{ disabled: working, busy: working }} style={[styles.danger, { backgroundColor: colors.danger, opacity: working ? 0.6 : 1 }]}>
            {working ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.dangerText, { color: colors.onPrimary }]}>{action.toUpperCase()}</Text>}
          </Pressable>
        ) : (
          <PrimaryButton label={action} onPress={onConfirm} loading={working} />
        )}
        <SecondaryButton label={cancel} onPress={onClose} disabled={working} />
      </View>
    </Sheet>
  );
}

function Info({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.info, last ? null : { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[textStyles.body, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[textStyles.body, { color: colors.ink, fontFamily: fonts.bodyMedium, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  dayTag: { width: 40, fontFamily: fonts.display, fontSize: 18, letterSpacing: 1 },
  exercise: { borderTopWidth: 1, borderLeftWidth: 3, paddingVertical: 10, paddingHorizontal: 16 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  danger: { height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5 },
});
