// Edit a diet plan (CF07, docs/design/CF07-nutrition-management-ui.md §2.7). On a live plan this makes an
// unpublished new version; the client keeps seeing the live one until the coach publishes (owner answer 8).
import { dietInputSchema, type DietContent, type DietPlanDetail } from '@fitsphere-coach/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, Field, PrimaryButton, PushedLayout } from '../components/ui';
import { DietEditor } from '../nutrition/DietEditor';
import { loadDietPlan, saveDietPlan } from '../nutrition/service';
import { DIET_TEXTS, toInput } from '../nutrition/texts';
import { DateStepper } from '../workouts/parts';
import { failureText } from '../workouts/texts';
import { useTheme } from '../theme';

export default function DietPlanEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [plan, setPlan] = useState<DietPlanDetail | null>(null);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [content, setContent] = useState<DietContent | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!id) return;
    let current = true;
    void (async () => {
      const result = await loadDietPlan(deps, id);
      if (!current) return;
      if (result.kind === 'ok') {
        setPlan(result.body);
        setName(result.body.name);
        setStartDate(result.body.startDate);
        setContent(result.body.content);
      } else if (result.kind === 'signedOut') {
        router.replace('/sign-in?expired=1');
      } else {
        setProblem(failureText(result.kind, TEXTS));
      }
    })();
    return () => {
      current = false;
    };
  }, [deps, id, router]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/diet-plan?id=${id}` as never));

  async function save() {
    if (!id || !content) return;
    setProblem(null);
    if (!name.trim()) {
      setNameError('Enter a name.');
      return;
    }
    setNameError(null);
    if (!dietInputSchema.safeParse(toInput(content)).success) {
      setProblem(DIET_TEXTS.invalid);
      return;
    }
    setWorking(true);
    const result = await saveDietPlan(deps, id, { name, startDate, content: toInput(content) });
    setWorking(false);
    if (result.kind === 'ok') router.replace(`/diet-plan?id=${id}` as never);
    else if (result.kind === 'signedOut') router.replace('/sign-in?expired=1');
    else setProblem(failureText(result.kind, TEXTS));
  }

  return (
    <PushedLayout backLabel="Plan" onBack={back} title="Edit diet plan">
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
      {plan && content ? (
        <>
          {plan.status === 'active' ? (
            <View style={{ marginTop: 16 }}>
              <Banner kind="info">{`Your changes are saved as a new version. ${plan.traineeName.split('@')[0]} keeps seeing the live version until you publish.`}</Banner>
            </View>
          ) : null}
          <View style={{ marginTop: 18, gap: 16 }}>
            <Field label="Plan name" value={name} onChangeText={setName} maxLength={80} error={nameError} />
            {plan.status === 'draft' ? <DateStepper label="Start date" value={startDate} onChange={setStartDate} /> : null}
          </View>
          <DietEditor content={content} onChange={setContent} />
          <View style={{ marginTop: 24 }}>
            <PrimaryButton label="Save changes" onPress={() => void save()} loading={working} />
          </View>
        </>
      ) : null}
    </PushedLayout>
  );
}
