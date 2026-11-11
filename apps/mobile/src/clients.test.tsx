// CF04 client management: the list, the profile, moving and removing a client.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useAccount } from './account/AccountProvider';
import ClientProfileScreen from './app/client-profile';
import Clients from './app/clients';
import { coachLabel, lastLoggedText, sinceText } from './clients/texts';
import { deps, fakeApi, fakeClient, Providers, session } from './testing/fakes';

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
const RAVI = '11111111-1111-4111-8111-111111111111';
const MEERA = '22222222-2222-4222-8222-222222222222';
const ARJUN = '33333333-3333-4333-8333-333333333333';
const me = (roles: string[]) => ({
  user: { id: ME, email: 'coach@example.test', createdAt: '2026-11-03T08:00:00Z' },
  roles,
  coach: { fullName: 'Asha Rao' },
});
const client = (id: string, name: string, coachId = RAVI, coachName: string | null = 'Ravi Kumar') => ({
  id,
  name,
  coachId,
  coachName,
  startedAt: '2026-11-03T08:00:00.000Z',
  lastLoggedAt: new Date().toISOString(),
});
const list = (clients: object[], coaches: object[] = [], extra: object = {}) => ({ status: 200, body: { clients, coaches, canInvite: false, invitations: [], ...extra } });
const profile = (extra: object = {}) => ({
  status: 200,
  body: {
    ...client(ARJUN, 'arjun@example.test'),
    latestWeightKg: 82.4,
    targets: { calories: 2100, proteinG: 140, weeklyWorkouts: 4 },
    workoutsThisWeek: 2,
    ...extra,
  },
});

/** Reads the account first (as the start screen does), then shows the screen. */
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

describe('client texts', () => {
  it('says when a client last logged, in India days', () => {
    const now = new Date('2026-11-12T08:00:00Z');
    expect(lastLoggedText(null, now)).toBe('Nothing logged yet');
    expect(lastLoggedText('2026-11-12T01:00:00Z', now)).toBe('Logged today');
    expect(lastLoggedText('2026-11-11T08:00:00Z', now)).toBe('Logged yesterday');
    expect(lastLoggedText('2026-11-03T08:00:00Z', now)).toBe('Last log 3 Nov');
    // 20:00 India time the evening before is "yesterday" even though it is the same UTC day.
    expect(lastLoggedText('2026-11-11T20:00:00Z', new Date('2026-11-12T03:00:00Z'))).toBe('Logged today');
    expect(sinceText('2026-11-03T08:00:00.000Z')).toBe('3 Nov 2026');
    expect(coachLabel(ME, null, ME)).toBe('You');
    expect(coachLabel(RAVI, 'Ravi Kumar', ME)).toBe('Ravi Kumar');
  });
});

describe('Client list', () => {
  it("shows each client with their last log and coach, and opens the profile", async () => {
    await open(<Clients />, ['head_coach', 'personal'], [list([client(ARJUN, 'arjun@example.test'), client('44444444-4444-4444-8444-444444444444', 'priya@example.test', ME, 'Asha Rao')])]);
    expect(await screen.findByText('Logged today · Ravi Kumar')).toBeTruthy();
    expect(screen.getByText('Logged today · You')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'arjun@example.test' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/client-profile?id=${ARJUN}`);
  });

  it("gives the Head Coach a coach filter that asks the server for that coach's clients", async () => {
    const api = await open(<Clients />, ['head_coach', 'personal'], [
      list([client(ARJUN, 'arjun@example.test')], [{ id: RAVI, name: 'Ravi Kumar' }, { id: MEERA, name: 'Meera Joshi' }]),
      list([client(ARJUN, 'arjun@example.test')], [{ id: RAVI, name: 'Ravi Kumar' }, { id: MEERA, name: 'Meera Joshi' }]),
    ]);
    await screen.findByRole('radio', { name: 'Meera Joshi' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Meera Joshi' }));
    await screen.findByRole('radio', { name: 'Meera Joshi', selected: true });
    expect(api.requests.at(-1)?.url).toBe(`http://api.test/v1/clients?coachId=${MEERA}`);
  });

  it('gives a Coach no coach filter', async () => {
    await open(<Clients />, ['coach', 'personal'], [list([client(ARJUN, 'arjun@example.test')])]);
    await screen.findByText('arjun@example.test');
    expect(screen.queryByRole('radio', { name: 'All coaches' })).toBeNull();
  });

  it('searches by what is typed', async () => {
    const api = await open(<Clients />, ['coach'], [list([client(ARJUN, 'arjun@example.test')]), list([])]);
    await screen.findByText('arjun@example.test');
    await fireEvent.changeText(screen.getByLabelText('Search clients'), 'zzz');
    expect(await screen.findByText('No clients match.')).toBeTruthy();
    expect(api.requests.at(-1)?.url).toBe('http://api.test/v1/clients?q=zzz');
  });

  it('says there are no clients yet, and that inviting arrives later', async () => {
    await open(<Clients />, ['coach'], [list([])]);
    expect(await screen.findByText(/Inviting clients arrives in the next update/)).toBeTruthy();
  });

  it('shows the offline text when the server cannot be reached', async () => {
    await open(<Clients />, ['coach'], [{ status: 500, body: null }]);
    expect(await screen.findByText('Something went wrong. Try again later.')).toBeTruthy();
  });
});

describe('Client profile', () => {
  beforeEach(() => {
    mockParams = { id: ARJUN };
  });

  it('shows the coach, the progress and the plans', async () => {
    await open(<ClientProfileScreen />, ['coach'], [profile()]);
    expect(await screen.findByText('82.4 kg')).toBeTruthy();
    expect(screen.getByText('2100 kcal')).toBeTruthy();
    expect(screen.getByText('140 g')).toBeTruthy();
    expect(screen.getByText('2 of 4')).toBeTruthy();
    expect(screen.getByText('Ravi Kumar')).toBeTruthy();
    expect(screen.getAllByText('Not set yet')).toHaveLength(1);
    expect(screen.getByText('Open nutrition')).toBeTruthy();
    expect(screen.getByText('Open workouts')).toBeTruthy();
  });

  it('shows "Not logged" and "Not set" for a client who has done nothing', async () => {
    await open(<ClientProfileScreen />, ['coach'], [profile({ latestWeightKg: null, targets: { calories: null, proteinG: null, weeklyWorkouts: null }, workoutsThisWeek: 0, lastLoggedAt: null })]);
    expect(await screen.findByText('Not logged')).toBeTruthy();
    expect(screen.getAllByText('Not set')).toHaveLength(2);
    expect(screen.getByText('Nothing logged yet')).toBeTruthy();
  });

  it('says so when the client is not available to this person', async () => {
    await open(<ClientProfileScreen />, ['coach'], [{ status: 404, body: { error: { code: 'NOT_FOUND', message: 'x', retryable: false, requestId: 'r', details: null } } }]);
    expect(await screen.findByText('This client is no longer available.')).toBeTruthy();
  });

  it('removes a client after confirming, then returns to the list', async () => {
    const api = await open(<ClientProfileScreen />, ['coach'], [profile(), { status: 204, body: null }]);
    await screen.findByText('82.4 kg');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove client' }));
    expect(await screen.findByText(/History up to today stays in your gym, read-only/)).toBeTruthy();
    expect(api.requests.some((request) => request.url.endsWith('/remove'))).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm remove client' }));
    await screen.findByText('82.4 kg');
    expect(api.requests.at(-1)).toMatchObject({ method: 'POST', url: `http://api.test/v1/clients/${ARJUN}/remove` });
    expect(mockRouter.replace).toHaveBeenCalledWith('/clients');
  });

  it('keeps the client when the person chooses Keep client', async () => {
    const api = await open(<ClientProfileScreen />, ['coach'], [profile()]);
    await screen.findByText('82.4 kg');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove client' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Keep client' }));
    expect(api.requests.some((request) => request.url.endsWith('/remove'))).toBe(false);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('offers Change coach only to the Head Coach', async () => {
    await open(<ClientProfileScreen />, ['coach'], [profile()]);
    await screen.findByText('82.4 kg');
    expect(screen.queryByRole('button', { name: 'Change coach' })).toBeNull();
  });

  it('lets the Head Coach move a client to another coach, and reloads the profile', async () => {
    const api = await open(<ClientProfileScreen />, ['head_coach', 'personal'], [
      profile(),
      list([], [{ id: RAVI, name: 'Ravi Kumar' }, { id: MEERA, name: 'Meera Joshi' }]),
      { status: 204, body: null },
      profile({ coachId: MEERA, coachName: 'Meera Joshi' }),
    ]);
    await screen.findByText('82.4 kg');
    await screen.findByRole('button', { name: 'Change coach' });
    await fireEvent.press(screen.getByRole('button', { name: 'Change coach' }));
    // The current coach (Ravi) is not offered; the Head Coach themselves and Meera are.
    expect(screen.queryByRole('radio', { name: 'Ravi Kumar' })).toBeNull();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Meera Joshi' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Move client' }));
    await screen.findByText('Meera Joshi');
    expect(api.requests.find((request) => request.url.endsWith('/move'))).toMatchObject({ method: 'POST', body: { coachId: MEERA } });
  });
});
