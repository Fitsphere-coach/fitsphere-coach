// A client's diet plan (CF07, docs/design/CF07-nutrition-management-ui.md §2.7): the status first, then
// the client's targets against the plan, then the slots. Publish, end and discard are sheets. Publish
// waits for the FitSphere app update (TCR-004): while the server says it cannot publish, it is hidden.
import { dayTotals, DIET_DISCLAIMER, optionTotals, type DietPlanDetail } from '@fitsphere-coach/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, IconTile, PrimaryButton, PushedLayout, SecondaryButton, Sheet, textStyles, type IconName } from '../components/ui';
import { discardDietPlan, endDietPlan, loadDietPlan, publishDietPlan } from '../nutrition/service';
import { deviationText, DIET_TEXTS, ingredientSummary, MEAL_LABELS, numText, offTarget, totalsText } from '../nutrition/texts';
import type { Failure } from '../workouts/service';
import { ActionLink, Card, SectionLabel, StatusChip } from '../workouts/parts';
import { dayText, failureText, whenText } from '../workouts/texts';
import { fonts, radius, useTheme } from '../theme';

type SheetKind = 'publish' | 'end' | 'discard' | null;

export default function DietPlan() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<DietPlanDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [working, setWorking] = useState(false);
  const [openSlot, setOpenSlot] = useState<number | null>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) return;
    let current = true;
    void (async () => {
      const result = await loadDietPlan(deps, id);
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
      if (after === 'list') router.replace('/nutrition?tab=plans' as never);
      else setTick((value) => value + 1);
    } else if (result.kind === 'signedOut') {
      router.replace('/sign-in?expired=1');
    } else {
      setProblem(result.kind === 'notReady' ? DIET_TEXTS.notReady : failureText(result.kind, TEXTS));
    }
  }

  const name = plan?.traineeName.split('@')[0] ?? 'the client';
  const unpublished = plan !== null && plan.status === 'active' && plan.liveVersion !== null && plan.version > plan.liveVersion;
  const canPublish = plan !== null && plan.canPublish && (plan.status === 'draft' || unpublished);
  const total = plan ? dayTotals(plan.content) : null;
  const hasOptions = plan?.content.slots.some((slot) => slot.options.length > 0) ?? false;
  // The client's own targets are what the plan is built against; the plan's own targets fill in when they have none.
  const calorieTarget = plan ? (plan.clientTargets.calories ?? plan.content.calorieTarget) : null;
  const proteinTarget = plan ? (plan.clientTargets.proteinG ?? plan.content.proteinTarget) : null;

  return (
    <PushedLayout backLabel="Plans" onBack={() => (router.canGoBack() ? router.back() : router.replace('/nutrition?tab=plans' as never))} title={plan?.name ?? 'Diet plan'}>
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

      {plan && total ? (
        <>
          {/* The status comes first (owner answer 2026-11-11). */}
          <View style={styles.statusRow}>
            <StatusChip status={plan.status} />
            <Text style={[textStyles.small, { color: colors.inkMuted }]}>For {plan.traineeName}</Text>
          </View>
          <View style={{ marginTop: 12 }}>
            {plan.status === 'draft' ? <Banner kind="info">{DIET_TEXTS.draftBanner(plan.version, name)}</Banner> : null}
            {plan.status === 'active' && unpublished ? <Banner kind="info">{DIET_TEXTS.unpublishedBanner(plan.liveVersion ?? 1, name)}</Banner> : null}
            {plan.status === 'active' && !unpublished ? <Banner kind="success">{DIET_TEXTS.liveBanner(name)}</Banner> : null}
            {plan.status === 'ended' ? <Banner kind="info">{DIET_TEXTS.endedBanner}</Banner> : null}
          </View>
          {!plan.canPublish && plan.status !== 'ended' ? (
            <View style={{ marginTop: 8 }}>
              <Banner kind="info">{DIET_TEXTS.publishWaits}</Banner>
            </View>
          ) : null}

          {hasOptions ? (
            <>
              <SectionLabel>{`Option 1 of each slot vs ${name}'s targets`}</SectionLabel>
              <Card>
                <Row label="Calories" value={`${numText(total.kcal)} kcal`} note={calorieTarget ? `target ${calorieTarget} · ${deviationText(total.kcal, calorieTarget)}` : 'no target'} warn={offTarget(total.kcal, calorieTarget)} />
                <Row label="Protein" value={`${numText(total.proteinG)} g`} note={proteinTarget ? `target ${proteinTarget} · ${deviationText(total.proteinG, proteinTarget)}` : 'no target'} warn={offTarget(total.proteinG, proteinTarget)} last />
              </Card>
              {offTarget(total.kcal, calorieTarget) || offTarget(total.proteinG, proteinTarget) ? (
                <View style={{ marginTop: 8 }}>
                  <Banner kind="info">{DIET_TEXTS.offTargetBanner}</Banner>
                </View>
              ) : null}
            </>
          ) : null}

          <Card style={{ marginTop: 14 }}>
            <Row label="Starts" value={dayText(plan.startDate)} />
            <Row label="Last changed" value={plan.lastChange ? `${plan.lastChange.actorName ?? 'Coach'} (${plan.lastChange.actorRole === 'head_coach' ? 'HC' : 'C'}), ${whenText(plan.lastChange.at)}` : '—'} last />
          </Card>
          {plan.content.note ? <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 10 }]}>Note: {plan.content.note}</Text> : null}

          <SectionLabel>Meal slots</SectionLabel>
          <View style={{ gap: 8 }}>
            {plan.content.slots.map((slot, index) => {
              const expanded = openSlot === index;
              return (
                <Card key={index}>
                  <Pressable onPress={() => setOpenSlot(expanded ? null : index)} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${slot.name}, ${slot.options.length} options`} style={styles.slotHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={[textStyles.listTitle, { color: colors.ink }]}>{slot.name}</Text>
                      <Text style={[textStyles.small, { color: colors.inkMuted }]}>
                        Logs as {MEAL_LABELS[slot.logsAs]} · {slot.options.length} {slot.options.length === 1 ? 'option' : 'options'}
                      </Text>
                    </View>
                  </Pressable>
                  {expanded
                    ? slot.options.map((option, i) => (
                        <View key={i} style={[styles.option, { borderTopColor: colors.border }]}>
                          <Text style={[textStyles.listTitle, { color: colors.ink }]}>{`${i + 1}. ${option.name}`}</Text>
                          <Text style={[textStyles.small, { color: colors.inkMuted }]}>{totalsText(optionTotals(option))}</Text>
                          {option.ingredients.map((ingredient, j) => (
                            <Text key={j} style={[textStyles.small, { color: colors.inkSubtle }]}>
                              {ingredient.proteinSource ? 'Protein · ' : ''}
                              {ingredient.name} · {ingredientSummary(ingredient)}
                            </Text>
                          ))}
                          {option.note ? <Text style={[textStyles.small, { color: colors.inkSubtle }]}>Note: {option.note}</Text> : null}
                        </View>
                      ))
                    : null}
                </Card>
              );
            })}
          </View>
          <Text style={[textStyles.small, { color: colors.inkSubtle, marginTop: 12 }]}>{DIET_DISCLAIMER}</Text>

          <View style={{ marginTop: 24, gap: 10 }}>
            {canPublish ? <PrimaryButton label="Publish" onPress={() => setSheet('publish')} /> : null}
            {plan.status !== 'ended' ? <SecondaryButton label="Edit plan" onPress={() => router.push(`/diet-plan-edit?id=${plan.id}` as never)} /> : null}
            <View style={styles.links}>
              <ActionLink icon="clock" label="History" onPress={() => router.push(`/diet-history?id=${plan.id}` as never)} />
              {plan.status === 'draft' || unpublished ? <ActionLink icon="trash-2" label={plan.status === 'draft' ? 'Discard draft' : 'Discard changes'} tone="danger" onPress={() => setSheet('discard')} /> : null}
              {plan.status === 'active' ? <ActionLink icon="x-circle" label="End plan" tone="danger" onPress={() => setSheet('end')} /> : null}
            </View>
          </View>

          <ConfirmSheet visible={sheet === 'publish'} icon="send" title={`Publish to ${name}?`} body={DIET_TEXTS.publishBody(name)} action="Publish" cancel="Not yet" working={working} onClose={() => setSheet(null)} onConfirm={() => void run(() => publishDietPlan(deps, plan.id), 'reload')} />
          <ConfirmSheet visible={sheet === 'end'} icon="x-circle" title={`End ${plan.name}?`} body={DIET_TEXTS.endBody(name)} action="End plan" cancel="Keep plan" danger working={working} onClose={() => setSheet(null)} onConfirm={() => void run(() => endDietPlan(deps, plan.id), 'reload')} />
          <ConfirmSheet
            visible={sheet === 'discard'}
            icon="trash-2"
            title={plan.status === 'draft' ? 'Discard this draft?' : 'Discard changes?'}
            body={plan.status === 'draft' ? 'The draft is deleted. Nothing the client sees changes.' : DIET_TEXTS.discardBody}
            action="Discard"
            cancel="Keep"
            danger
            working={working}
            onClose={() => setSheet(null)}
            onConfirm={() => void run(() => discardDietPlan(deps, plan.id), plan.status === 'draft' ? 'list' : 'reload')}
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

function Row({ label, value, note, warn, last }: { label: string; value: string; note?: string; warn?: boolean; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.info, last ? null : { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[textStyles.body, { color: colors.inkMuted }]}>{label}</Text>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text style={[textStyles.body, { color: colors.ink, fontFamily: fonts.bodyMedium, textAlign: 'right' }]}>{value}</Text>
        {note ? <Text style={[textStyles.small, { color: warn ? colors.warning : colors.inkMuted, textAlign: 'right' }]}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  slotHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  option: { borderTopWidth: 1, paddingVertical: 10, paddingHorizontal: 16, gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  danger: { height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 1.5 },
});
