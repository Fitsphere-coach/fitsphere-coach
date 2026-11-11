// A diet plan's history (CF07, docs/design/CF07-nutrition-management-ui.md §2.8): who changed what and when,
// and an earlier published version can be restored as a new draft of the working copy.
import type { PlanHistoryResponse } from '@fitsphere-coach/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, Icon, PushedLayout, textStyles } from '../components/ui';
import { loadDietHistory, restoreDietPlan } from '../nutrition/service';
import { ActionLink, Card } from '../workouts/parts';
import { changeText, failureText, roleText, whenText } from '../workouts/texts';
import { useTheme } from '../theme';

export default function DietHistory() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [history, setHistory] = useState<PlanHistoryResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!id) return;
    let current = true;
    void (async () => {
      const result = await loadDietHistory(deps, id);
      if (!current) return;
      if (result.kind === 'ok') setHistory(result.body);
      else if (result.kind === 'signedOut') router.replace('/sign-in?expired=1');
      else setProblem(failureText(result.kind, TEXTS));
    })();
    return () => {
      current = false;
    };
  }, [deps, id, router]);

  async function restore(version: number) {
    if (!id) return;
    setWorking(true);
    const result = await restoreDietPlan(deps, id, version);
    setWorking(false);
    if (result.kind === 'ok') router.replace(`/diet-plan?id=${id}` as never);
    else if (result.kind === 'signedOut') router.replace('/sign-in?expired=1');
    else setProblem(failureText(result.kind, TEXTS));
  }

  return (
    <PushedLayout backLabel="Plan" onBack={() => (router.canGoBack() ? router.back() : router.replace(`/diet-plan?id=${id}` as never))} title="History">
      <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 6 }]}>Every change shows who and when.</Text>
      {problem ? (
        <View style={{ marginTop: 16 }}>
          <Banner kind="error">{problem}</Banner>
        </View>
      ) : null}
      {!history && !problem ? (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
        </View>
      ) : null}
      {history ? (
        <>
          <Card style={{ marginTop: 16 }}>
            {history.changes.map((change, index) => (
              <View key={change.id} style={[styles.item, index === 0 ? null : { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Icon name="clock" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[textStyles.listTitle, { color: colors.ink }]}>{changeText(change)}</Text>
                  <Text style={[textStyles.small, { color: colors.inkMuted }]}>{change.actorName ?? 'Coach'} ({roleText(change.actorRole)})</Text>
                  <Text style={[textStyles.small, { color: colors.inkSubtle }]}>{whenText(change.at)}</Text>
                  {change.action === 'published' && history.publishedVersions.includes(change.version) ? (
                    <ActionLink icon="rotate-ccw" label="Restore as draft" disabled={working} onPress={() => void restore(change.version)} />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
          <View style={{ marginTop: 16 }}>
            <Banner kind="info">A restored version opens as a new draft. The client keeps seeing the live version until you publish.</Banner>
          </View>
        </>
      ) : null}
    </PushedLayout>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
});
