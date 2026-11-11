// Template editor (CF06, docs/design/CF06-workout-management-ui.md §2.2). New, or an existing template
// by `id`. Any coach may make a gym-wide template; its author and the Head Coach edit it. A template
// the viewer cannot edit opens read-only with Copy and Assign.
import { planContentSchema, DIFFICULTIES, GOALS, type PlanContent, type TemplateDetail } from '@fitsphere-coach/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { Banner, Field, PrimaryButton, PushedLayout, SecondaryButton, Sheet, IconTile, textStyles } from '../components/ui';
import { ContentEditor } from '../workouts/ContentEditor';
import { copyTemplate, loadTemplate, saveTemplate, setTemplateActive, type Failure } from '../workouts/service';
import { Chip, Segmented } from '../workouts/parts';
import { DIFFICULTY_LABELS, failureText, GOAL_LABELS, newContent, WORKOUT_TEXTS } from '../workouts/texts';
import { fonts, useTheme } from '../theme';

export default function WorkoutTemplate() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState<TemplateDetail | null>(null);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('general_fitness');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('beginner');
  const [visibility, setVisibility] = useState<'gym' | 'personal'>('gym');
  const [content, setContent] = useState<PlanContent>(newContent);
  const [problem, setProblem] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [ready, setReady] = useState(!id);

  useEffect(() => {
    if (!id) return;
    let current = true;
    void (async () => {
      const result = await loadTemplate(deps, id);
      if (!current) return;
      if (result.kind === 'ok') {
        const t = result.body;
        setLoaded(t);
        setName(t.name);
        setGoal(t.goal);
        setDifficulty(t.difficulty);
        setVisibility(t.visibility);
        setContent(t.content);
        setReady(true);
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

  const readOnly = loaded !== null && !loaded.canEdit;
  const backToList = () => router.replace('/workouts');

  function fail(kind: Failure) {
    if (kind === 'signedOut') router.replace('/sign-in?expired=1');
    else setProblem(failureText(kind, TEXTS));
  }

  async function save() {
    setProblem(null);
    setSaved(false);
    if (!name.trim()) {
      setNameError('Enter a name.');
      return;
    }
    setNameError(null);
    if (!planContentSchema.safeParse(content).success) {
      setProblem(WORKOUT_TEXTS.invalid);
      return;
    }
    setWorking(true);
    const result = await saveTemplate(deps, { name, goal, difficulty, visibility, content }, id);
    setWorking(false);
    if (result.kind !== 'ok') return fail(result.kind);
    setLoaded(result.body);
    setSaved(true);
    if (!id) router.replace(`/workout-template?id=${result.body.id}` as never);
  }

  async function copy() {
    if (!id) return;
    setWorking(true);
    const result = await copyTemplate(deps, id);
    setWorking(false);
    if (result.kind !== 'ok') return fail(result.kind);
    router.replace(`/workout-template?id=${result.body.id}` as never);
  }

  async function toggleActive() {
    if (!id || !loaded) return;
    setWorking(true);
    const result = await setTemplateActive(deps, id, !loaded.active);
    setWorking(false);
    setConfirmOff(false);
    if (result.kind !== 'ok') return fail(result.kind);
    backToList();
  }

  return (
    <PushedLayout backLabel="Workouts" onBack={() => (router.canGoBack() ? router.back() : backToList())} title={id ? 'Template' : 'New template'}>
      {problem ? (
        <View style={{ marginTop: 16 }}>
          <Banner kind="error">{problem}</Banner>
        </View>
      ) : null}
      {!ready && !problem ? (
        <View style={{ marginTop: 40 }}>
          <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
        </View>
      ) : null}

      {ready ? (
        <>
          {readOnly ? (
            <View style={{ marginTop: 16 }}>
              <Banner kind="info">This is another coach's template. You can look at it, copy it, or give it to a client.</Banner>
            </View>
          ) : null}
          {saved ? (
            <View style={{ marginTop: 16 }}>
              <Banner kind="success">Template saved.</Banner>
            </View>
          ) : null}

          <View style={{ marginTop: 18, gap: 16 }} pointerEvents={readOnly ? 'none' : 'auto'}>
            <Field label="Template name" value={name} onChangeText={setName} maxLength={80} error={nameError} editable={!readOnly} />
            <View style={{ gap: 6 }}>
              <Text style={[textStyles.label, { color: colors.inkMuted }]}>GOAL</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Goal">
                {GOALS.map((value) => (
                  <Chip key={value} label={GOAL_LABELS[value]} selected={goal === value} onPress={() => setGoal(value)} />
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[textStyles.label, { color: colors.inkMuted }]}>DIFFICULTY</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Difficulty">
                {DIFFICULTIES.map((value) => (
                  <Chip key={value} label={DIFFICULTY_LABELS[value]} selected={difficulty === value} onPress={() => setDifficulty(value)} />
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[textStyles.label, { color: colors.inkMuted }]}>WHO CAN USE IT</Text>
              <Segmented
                label="Who can use it"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: 'gym', label: 'Whole gym' },
                  { value: 'personal', label: 'Only me' },
                ]}
              />
              <Text style={[textStyles.small, { color: colors.inkMuted }]}>Gym templates can be used by every coach. Only you and the Head Coach can edit one.</Text>
            </View>
          </View>

          <ContentEditor content={content} onChange={setContent} disabled={readOnly} />

          <View style={{ gap: 10, marginTop: 24 }}>
            {!readOnly ? <PrimaryButton label="Save template" onPress={() => void save()} loading={working} /> : null}
            {id && loaded?.active ? <SecondaryButton label="Assign plan" onPress={() => router.push(`/workout-assign?templateId=${id}` as never)} disabled={working} /> : null}
            {id ? <SecondaryButton label="Copy template" onPress={() => void copy()} disabled={working} /> : null}
            {id && loaded && !readOnly ? (
              <Pressable onPress={() => (loaded.active ? setConfirmOff(true) : void toggleActive())} accessibilityRole="button" accessibilityLabel={loaded.active ? 'Deactivate template' : 'Activate template'} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 16, letterSpacing: 1, color: loaded.active ? colors.danger : colors.accent }}>
                  {loaded.active ? 'DEACTIVATE TEMPLATE' : 'ACTIVATE TEMPLATE'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Sheet visible={confirmOff} onClose={() => setConfirmOff(false)} labelledBy="Deactivate template">
            <View style={{ marginTop: 22 }}>
              <IconTile name="archive" size={56} />
            </View>
            <Text accessibilityRole="header" style={[textStyles.sheetTitle, { color: colors.ink, marginTop: 16 }]}>{`DEACTIVATE ${name.toUpperCase()}?`}</Text>
            <Text style={[textStyles.body, { color: colors.inkMuted, marginTop: 8 }]}>It stays out of the list. Plans already made from it are not changed.</Text>
            <View style={{ marginTop: 20, gap: 10 }}>
              <PrimaryButton label="Deactivate" onPress={() => void toggleActive()} loading={working} />
              <SecondaryButton label="Keep" onPress={() => setConfirmOff(false)} disabled={working} />
            </View>
          </Sheet>
        </>
      ) : null}
    </PushedLayout>
  );
}
