// CF06 workout management: the list, the template editor, assigning, a plan and its history.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useAccount } from './account/AccountProvider';
import WorkoutAssign from './app/workout-assign';
import WorkoutHistory from './app/workout-history';
import WorkoutPlan from './app/workout-plan';
import WorkoutTemplate from './app/workout-template';
import Workouts from './app/workouts';
import { deps, errorBody, fakeApi, fakeClient, Providers, session } from './testing/fakes';
import { addDays, dayText, exerciseSummary, newDay, restText, todayIst, whenText, withScheduleMode } from './workouts/texts';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false, dismissAll: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

const ME = '0b6f2a52-6f4b-4c38-9d1f-2b8e4c1a7d10';
const ARJUN = '33333333-3333-4333-8333-333333333333';
const PRIYA = '44444444-4444-4444-8444-444444444444';
const TEMPLATE = '55555555-5555-4555-8555-555555555555';
const PLAN = '66666666-6666-4666-8666-666666666666';
const me = (roles: string[]) => ({ user: { id: ME, email: 'coach@example.test', createdAt: '2026-11-03T08:00:00Z' }, roles, coach: { fullName: 'Asha Rao' } });

const exercise = (over: object = {}) => ({ exerciseId: 'bench-press', group: null, sets: 4, repsMin: 8, repsMax: 10, weightG: 60_000, rpe: 8, restS: 120, note: 'Pause on chest', ...over });
const content = (over: object = {}) => ({
  weeks: 8,
  scheduleMode: 'weekdays',
  weeklyTarget: 4,
  dailyTarget: false,
  days: [
    { name: 'Push', weekday: 1, rest: false, exercises: [exercise()] },
    { name: 'Rest', weekday: 2, rest: true, exercises: [] },
  ],
  ...over,
});
const summary = (over: object = {}) => ({
  id: TEMPLATE,
  name: 'Push / Pull / Legs',
  goal: 'muscle_gain',
  difficulty: 'intermediate',
  visibility: 'gym',
  active: true,
  days: 2,
  exercises: 1,
  canEdit: true,
  updatedAt: '2026-11-09T10:00:00.000Z',
  ...over,
});
const planSummary = (over: object = {}) => ({
  id: PLAN,
  traineeId: ARJUN,
  traineeName: 'arjun@example.test',
  coachId: ME,
  coachName: 'Asha Rao',
  name: 'Push / Pull / Legs',
  status: 'draft',
  startDate: '2026-11-17',
  weeks: 8,
  liveVersion: null,
  version: 3,
  updatedAt: '2026-11-11T10:12:00.000Z',
  ...over,
});
const planDetail = (over: object = {}) => ({
  ...planSummary(),
  content: content(),
  lastChange: { id: 'c1', action: 'edited', version: 3, actorId: ME, actorName: 'Ravi Kumar', actorRole: 'coach', summary: null, at: '2026-11-11T10:42:00.000Z' },
  canPublish: true,
  ...over,
});

function Prime({ children }: { children: ReactNode }) {
  const { refresh } = useAccount();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void refresh().then(() => setReady(true));
  }, [refresh]);
  return ready ? <>{children}</> : null;
}

async function open(element: React.ReactElement, roles: string[], responses: { status: number; body: unknown }[]) {
  const api = fakeApi([{ status: 200, body: me(roles) }, ...responses]);
  const authClient = fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) }).client;
  await render(
    <Providers authDeps={deps(authClient, api.fetchImpl)}>
      <Prime>{element}</Prime>
    </Providers>,
  );
  return api;
}

describe('workout texts', () => {
  it('writes rest, sets and reps the way coaches read them', () => {
    expect(restText(120)).toBe('2:00');
    expect(restText(75)).toBe('1:15');
    expect(exerciseSummary(exercise() as never)).toBe('4 × 8–10 · 60 kg · RPE 8 · Rest 2:00');
    expect(exerciseSummary(exercise({ repsMax: 8, weightG: null, rpe: null }) as never)).toBe('4 × 8 · Rest 2:00');
  });

  it('pins days to weekdays or frees them when the schedule changes', () => {
    const base = content() as never;
    const rotating = withScheduleMode(base, 'rotating');
    expect(rotating.days.map((d) => d.weekday)).toEqual([null, null]);
    expect(withScheduleMode(rotating, 'weekdays').days.map((d) => d.weekday)).toEqual([1, 2]);
    expect(newDay(base).weekday).toBe(3);
    expect(newDay(rotating).name).toBe('Day 3');
  });

  it('shows India dates and times', () => {
    expect(dayText('2026-11-17')).toBe('Tue, 17 Nov 2026');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(whenText('2026-11-11T10:42:00.000Z')).toBe('11 Nov, 4:12 pm');
    expect(todayIst(new Date('2026-11-11T20:00:00Z'))).toBe('2026-11-12');
  });
});

describe('Workouts home', () => {
  it('lists templates with who can use them, and opens one', async () => {
    await open(<Workouts />, ['coach'], [{ status: 200, body: { templates: [summary(), summary({ id: 'x', name: 'Fat loss circuit', visibility: 'personal', goal: 'weight_loss', difficulty: 'beginner' })] } }]);
    expect(await screen.findByText('Muscle gain · Intermediate')).toBeTruthy();
    expect(screen.getByText('GYM')).toBeTruthy();
    expect(screen.getByText('MINE')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Push / Pull / Legs' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/workout-template?id=${TEMPLATE}`);
  });

  it('filters templates by goal and asks the server', async () => {
    const api = await open(<Workouts />, ['coach'], [{ status: 200, body: { templates: [summary()] } }, { status: 200, body: { templates: [] } }]);
    await screen.findByText('Muscle gain · Intermediate');
    await fireEvent.press(screen.getByRole('radio', { name: 'Strength' }));
    expect(await screen.findByText('Nothing matches.')).toBeTruthy();
    expect(api.requests.at(-1)?.url).toBe('http://api.test/v1/workout-templates?goal=strength');
  });

  it('says there are no templates yet', async () => {
    await open(<Workouts />, ['coach'], [{ status: 200, body: { templates: [] } }]);
    expect(await screen.findByText(/Make a template once/)).toBeTruthy();
  });

  it("shows clients' plans with their status on the Plans tab", async () => {
    mockParams = { tab: 'plans' };
    const api = await open(<Workouts />, ['head_coach', 'personal'], [
      { status: 200, body: { plans: [planSummary(), planSummary({ id: 'p2', traineeName: 'priya@example.test', status: 'active', coachId: 'c9', coachName: 'Meera Joshi' })], coaches: [{ id: 'c9', name: 'Meera Joshi' }] } },
    ]);
    expect(await screen.findByLabelText('Status: Draft')).toBeTruthy();
    expect(screen.getByLabelText('Status: Active')).toBeTruthy();
    expect(api.requests.at(-1)?.url).toBe('http://api.test/v1/training-plans');
    expect(screen.getByRole('radio', { name: 'Meera Joshi' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'arjun@example.test, Push / Pull / Legs' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/workout-plan?id=${PLAN}`);
  });

  it('gives a Coach no coach filter on Plans', async () => {
    mockParams = { tab: 'plans' };
    await open(<Workouts />, ['coach'], [{ status: 200, body: { plans: [planSummary()], coaches: [] } }]);
    await screen.findByLabelText('Status: Draft');
    expect(screen.queryByRole('radio', { name: 'All coaches' })).toBeNull();
  });

  it('shows a calm message when the server is unavailable', async () => {
    await open(<Workouts />, ['coach'], [{ status: 500, body: null }]);
    expect(await screen.findByText('Something went wrong. Try again later.')).toBeTruthy();
  });
});

describe('Template editor', () => {
  it('asks for a name before saving, and sends nothing', async () => {
    const api = await open(<WorkoutTemplate />, ['coach'], []);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save template' }));
    expect(await screen.findByText('Enter a name.')).toBeTruthy();
    expect(api.requests).toHaveLength(1); // only the account read
  });

  it('adds an exercise from the list and saves the template', async () => {
    const created = { ...summary(), content: content() };
    const api = await open(<WorkoutTemplate />, ['coach'], [{ status: 201, body: { template: created } }]);
    await fireEvent.changeText(await screen.findByLabelText('Template name'), 'Starter');
    await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Plank' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add 1 exercise' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save template' }));
    await screen.findByText('Template saved.');
    const post = api.requests.at(-1);
    expect(post).toMatchObject({ method: 'POST', url: 'http://api.test/v1/workout-templates' });
    expect(post?.body).toMatchObject({ name: 'Starter', visibility: 'gym', goal: 'general_fitness', difficulty: 'beginner' });
    const sent = (post?.body as { content: { days: { exercises: { exerciseId: string; sets: number; restS: number; weightG: null }[] }[] } }).content;
    expect(sent.days[0]?.exercises).toEqual([{ exerciseId: 'plank', group: null, sets: 3, repsMin: 8, repsMax: 10, weightG: null, rpe: null, restS: 120, note: '' }]);
    expect(mockRouter.replace).toHaveBeenCalledWith(`/workout-template?id=${TEMPLATE}`);
  });

  it('does not save a reversed rep range, and says what to fix', async () => {
    const api = await open(<WorkoutTemplate />, ['coach'], []);
    await fireEvent.changeText(await screen.findByLabelText('Template name'), 'Starter');
    await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Plank' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add 1 exercise' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Plank,/ }));
    await fireEvent.changeText(screen.getByLabelText('Reps from'), '12');
    await fireEvent.press(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText(/Some values are not valid/)).toBeTruthy();
    expect(api.requests).toHaveLength(1);
  });

  it("opens another coach's gym template read-only, with Copy and Assign but no Save", async () => {
    mockParams = { id: TEMPLATE };
    await open(<WorkoutTemplate />, ['coach'], [{ status: 200, body: { template: { ...summary({ canEdit: false }), content: content() } } }]);
    expect(await screen.findByText(/another coach's template/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save template' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy template' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Assign plan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deactivate template' })).toBeNull();
  });

  it('copies a template and opens the copy', async () => {
    mockParams = { id: TEMPLATE };
    const api = await open(<WorkoutTemplate />, ['coach'], [
      { status: 200, body: { template: { ...summary(), content: content() } } },
      { status: 201, body: { template: { ...summary({ id: 'copy-id', visibility: 'personal' }), content: content() } } },
    ]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Copy template' }));
    await screen.findByRole('button', { name: 'Copy template' });
    expect(api.requests.at(-1)).toMatchObject({ method: 'POST', url: `http://api.test/v1/workout-templates/${TEMPLATE}/copy` });
    expect(mockRouter.replace).toHaveBeenCalledWith('/workout-template?id=copy-id');
  });

  it('deactivates only after confirming', async () => {
    mockParams = { id: TEMPLATE };
    const api = await open(<WorkoutTemplate />, ['coach'], [{ status: 200, body: { template: { ...summary(), content: content() } } }, { status: 204, body: null }]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Deactivate template' }));
    expect(await screen.findByText(/Plans already made from it are not changed/)).toBeTruthy();
    expect(api.requests.some((r) => r.url.endsWith('/deactivate'))).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Deactivate' }));
    await screen.findByRole('button', { name: 'Deactivate template' });
    expect(api.requests.at(-1)).toMatchObject({ method: 'POST', url: `http://api.test/v1/workout-templates/${TEMPLATE}/deactivate` });
    expect(mockRouter.replace).toHaveBeenCalledWith('/workouts');
  });
});

describe('Assign plan', () => {
  const clients = {
    clients: [
      { id: ARJUN, name: 'arjun@example.test', coachId: ME, coachName: 'Asha Rao', startedAt: '2026-11-03T08:00:00.000Z', lastLoggedAt: null },
      { id: PRIYA, name: 'priya@example.test', coachId: ME, coachName: 'Asha Rao', startedAt: '2026-11-03T08:00:00.000Z', lastLoggedAt: null },
    ],
    coaches: [],
    canInvite: false,
    invitations: [],
  };

  it('makes a draft for each chosen client, warns about an active plan, and blocks a client with a draft', async () => {
    mockParams = { templateId: TEMPLATE };
    const api = await open(<WorkoutAssign />, ['coach'], [
      { status: 200, body: { template: { ...summary(), content: content() } } },
      { status: 200, body: clients },
      { status: 200, body: { plans: [planSummary({ traineeId: ARJUN, status: 'active', liveVersion: 1 }), planSummary({ id: 'd', traineeId: PRIYA, status: 'draft' })], coaches: [] } },
      { status: 201, body: { plans: [planSummary()] } },
    ]);
    await screen.findByText('Push / Pull / Legs');
    expect(screen.getByRole('checkbox', { name: 'priya@example.test', disabled: true })).toBeTruthy();
    expect(screen.getByText(/Draft already exists/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'arjun@example.test' }));
    expect(screen.getByText(/arjun@example.test already has an active plan/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create 1 draft' }));
    await screen.findByText('Push / Pull / Legs');
    const post = api.requests.at(-1);
    expect(post).toMatchObject({ method: 'POST', url: 'http://api.test/v1/training-plans' });
    expect(post?.body).toMatchObject({ templateId: TEMPLATE, traineeIds: [ARJUN] });
    expect((post?.body as { startDate: string }).startDate).toBe(addDays(todayIst(), 1));
    expect(mockRouter.replace).toHaveBeenCalledWith('/workouts?tab=plans');
  });

  it('shows the server answer when a client already has a draft', async () => {
    mockParams = { templateId: TEMPLATE };
    await open(<WorkoutAssign />, ['coach'], [
      { status: 200, body: { template: { ...summary(), content: content() } } },
      { status: 200, body: clients },
      { status: 200, body: { plans: [], coaches: [] } },
      { status: 409, body: errorBody('PLAN_DRAFT_EXISTS') },
    ]);
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'arjun@example.test' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create 1 draft' }));
    expect(await screen.findByText(/already has a draft plan/)).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('asks for at least one client', async () => {
    mockParams = { templateId: TEMPLATE };
    await open(<WorkoutAssign />, ['coach'], [
      { status: 200, body: { template: { ...summary(), content: content() } } },
      { status: 200, body: clients },
      { status: 200, body: { plans: [], coaches: [] } },
    ]);
    await screen.findByText('Push / Pull / Legs');
    expect(screen.getByRole('button', { name: 'Pick clients', disabled: true })).toBeTruthy();
  });
});

describe('Plan', () => {
  beforeEach(() => {
    mockParams = { id: PLAN };
  });

  it('shows the status first, with the draft words, the days and the last change', async () => {
    await open(<WorkoutPlan />, ['coach'], [{ status: 200, body: { plan: planDetail() } }]);
    expect(await screen.findByLabelText('Status: Draft')).toBeTruthy();
    expect(screen.getByText("Draft, version 3. arjun can't see this yet.")).toBeTruthy();
    expect(screen.getByText('Ravi Kumar (C), 11 Nov, 4:12 pm')).toBeTruthy();
    expect(screen.getByText('4 × 8–10 · 60 kg · RPE 8 · Rest 2:00')).toBeTruthy();
  });

  it('hides Publish and says why while the trainee app cannot show plans yet', async () => {
    await open(<WorkoutPlan />, ['coach'], [{ status: 200, body: { plan: planDetail({ canPublish: false }) } }]);
    expect(await screen.findByText(/Publishing waits for the FitSphere app update/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
  });

  it('publishes only after confirming, then reloads', async () => {
    const api = await open(<WorkoutPlan />, ['coach'], [
      { status: 200, body: { plan: planDetail() } },
      { status: 204, body: null },
      { status: 200, body: { plan: planDetail({ status: 'active', liveVersion: 3 }) } },
    ]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Publish' }));
    expect(await screen.findByText(/sees this plan in their Training tab straight away/)).toBeTruthy();
    expect(api.requests.some((r) => r.url.endsWith('/publish'))).toBe(false);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Publish' }).at(-1) as never);
    expect(await screen.findByLabelText('Status: Active')).toBeTruthy();
    expect(api.requests.find((r) => r.url.endsWith('/publish'))).toMatchObject({ method: 'POST', url: `http://api.test/v1/training-plans/${PLAN}/publish` });
  });

  it('tells the coach when the plan is not ready to publish', async () => {
    await open(<WorkoutPlan />, ['coach'], [{ status: 200, body: { plan: planDetail() } }, { status: 409, body: errorBody('PLAN_NOT_READY') }]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Publish' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Publish' }).at(-1) as never);
    expect(await screen.findByText(/Add at least one training day, with an exercise on every training day/)).toBeTruthy();
  });

  it('says unpublished changes are not live for a live plan, and offers to discard them', async () => {
    await open(<WorkoutPlan />, ['coach'], [{ status: 200, body: { plan: planDetail({ status: 'active', liveVersion: 2, version: 3 }) } }]);
    expect(await screen.findByText(/changes that are not published. arjun still sees version 2/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeTruthy();
  });

  it('has no Publish, Edit or End for an ended plan', async () => {
    await open(<WorkoutPlan />, ['coach'], [{ status: 200, body: { plan: planDetail({ status: 'ended', liveVersion: 2 }) } }]);
    expect(await screen.findByText(/This plan has ended/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End plan' })).toBeNull();
  });

  it('says the plan is no longer available when it is not this coach’s', async () => {
    await open(<WorkoutPlan />, ['coach'], [{ status: 404, body: errorBody('NOT_FOUND') }]);
    expect(await screen.findByText('This is no longer available.')).toBeTruthy();
  });

  it('discards a draft after confirming and returns to the plans', async () => {
    const api = await open(<WorkoutPlan />, ['coach'], [{ status: 200, body: { plan: planDetail() } }, { status: 204, body: null }]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Discard draft' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Discard' }));
    await screen.findByLabelText('Status: Draft');
    expect(api.requests.at(-1)).toMatchObject({ method: 'POST', url: `http://api.test/v1/training-plans/${PLAN}/discard` });
    expect(mockRouter.replace).toHaveBeenCalledWith('/workouts?tab=plans');
  });
});

describe('Plan history', () => {
  beforeEach(() => {
    mockParams = { id: PLAN };
  });
  const history = {
    changes: [
      { id: 'c3', action: 'published', version: 2, actorId: ME, actorName: 'Ravi Kumar', actorRole: 'coach', summary: null, at: '2026-11-09T13:10:00.000Z' },
      { id: 'c2', action: 'edited', version: 2, actorId: ME, actorName: 'Asha Rao', actorRole: 'head_coach', summary: null, at: '2026-11-09T13:01:00.000Z' },
      { id: 'c1', action: 'created', version: 1, actorId: ME, actorName: 'Ravi Kumar', actorRole: 'coach', summary: null, at: '2026-11-03T05:22:00.000Z' },
    ],
    publishedVersions: [2],
  };

  it('lists who changed what and when', async () => {
    await open(<WorkoutHistory />, ['coach'], [{ status: 200, body: history }]);
    expect(await screen.findByText('Published version 2')).toBeTruthy();
    expect(screen.getByText('Asha Rao (Head coach)')).toBeTruthy();
    expect(screen.getByText('9 Nov, 6:40 pm')).toBeTruthy();
    expect(screen.getByText('Plan created')).toBeTruthy();
  });

  it('restores a published version as a new draft and opens the plan', async () => {
    const api = await open(<WorkoutHistory />, ['coach'], [{ status: 200, body: history }, { status: 200, body: { plan: planDetail() } }]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Restore as draft' }));
    await screen.findByText('Published version 2');
    expect(api.requests.at(-1)).toMatchObject({ method: 'POST', url: `http://api.test/v1/training-plans/${PLAN}/restore`, body: { version: 2 } });
    expect(mockRouter.replace).toHaveBeenCalledWith(`/workout-plan?id=${PLAN}`);
  });
});
