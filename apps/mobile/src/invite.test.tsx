// CF04 inviting a client: the invite form, its answers, the invited list. The invite stays off until the
// server says canInvite (TCR-001, C-D22).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { useAccount } from './account/AccountProvider';
import ClientInviteSent from './app/client-invite-sent';
import ClientInvite from './app/client-invite';
import Clients from './app/clients';
import { cancelInvitation, inviteClient } from './clients/service';
import { deps, errorBody, fakeApi, fakeClient, Providers, session } from './testing/fakes';

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
const INVITATION = '55555555-5555-4555-8555-555555555555';
const me = (roles: string[]) => ({
  user: { id: ME, email: 'coach@example.test', createdAt: '2026-11-03T08:00:00Z' },
  roles,
  coach: { fullName: 'Asha Rao' },
});
const listBody = (extra: object = {}) => ({ status: 200, body: { clients: [], coaches: [], canInvite: true, invitations: [], ...extra } });
const invitation = { id: INVITATION, email: 'kabir@example.test', coachId: RAVI, coachName: 'Ravi Kumar', expiresAt: '2026-11-19T08:50:00.000Z' };

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
const signedIn = () => fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) }).client;

describe('invite service answers', () => {
  it('maps the server error codes, never the message', async () => {
    const send = async (status: number, code: string) => inviteClient(deps(signedIn(), fakeApi([{ status, body: errorBody(code) }]).fetchImpl), 'a@b.co');
    expect(await send(409, 'ALREADY_ADDED')).toBe('alreadyAdded');
    expect(await send(409, 'CANNOT_INVITE_EMAIL')).toBe('cannotInvite');
    expect(await send(429, 'INVITE_LIMIT_REACHED')).toBe('limit');
    expect(await send(503, 'INVITE_EMAIL_FAILED')).toBe('emailFailed');
    expect(await send(400, 'VALIDATION_FAILED')).toBe('invalid');
    expect(await send(404, 'NOT_FOUND')).toBe('refused');
    expect(await send(500, 'INTERNAL_ERROR')).toBe('unavailable');
    expect(await inviteClient(deps(fakeClient().client), 'a@b.co')).toBe('signedOut');
  });

  it('sends the email, and a coach only when one is chosen', async () => {
    const api = fakeApi([{ status: 201, body: { invitation } }, { status: 201, body: { invitation } }]);
    const authDeps = deps(signedIn(), api.fetchImpl);
    expect(await inviteClient(authDeps, 'kabir@example.test')).toBe('sent');
    expect(await inviteClient(authDeps, 'kabir@example.test', RAVI)).toBe('sent');
    expect(api.requests[0]?.body).toEqual({ email: 'kabir@example.test' });
    expect(api.requests[1]?.body).toEqual({ email: 'kabir@example.test', coachId: RAVI });
  });

  it('cancels an invitation', async () => {
    const api = fakeApi([{ status: 204, body: null }]);
    expect(await cancelInvitation(deps(signedIn(), api.fetchImpl), INVITATION)).toBe('done');
    expect(api.requests[0]).toMatchObject({ method: 'POST', url: `http://api.test/v1/clients/invitations/${INVITATION}/cancel` });
  });
});

describe('Client list: inviting', () => {
  it('offers Invite client only when the server says inviting is on', async () => {
    await open(<Clients />, ['coach'], [listBody({ canInvite: false })]);
    await screen.findByText(/Inviting clients arrives in the next update/);
    expect(screen.queryByRole('button', { name: 'Invite client' })).toBeNull();
  });

  it('opens the invite form from the button, and shows the invitations still waiting', async () => {
    await open(<Clients />, ['coach'], [listBody({ invitations: [invitation] })]);
    expect(await screen.findByText('kabir@example.test')).toBeTruthy();
    expect(screen.getByText('Invited · Ravi Kumar')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Invite client' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/client-invite');
  });

  it('cancels a waiting invitation and reloads the list', async () => {
    const api = await open(<Clients />, ['coach'], [listBody({ invitations: [invitation] }), { status: 204, body: null }, listBody()]);
    await screen.findByText('kabir@example.test');
    await fireEvent.press(screen.getByRole('link', { name: 'CANCEL' }));
    await screen.findByText('Invite a trainee by email. When they accept in the FitSphere app, they appear here and you can see what they log.');
    expect(api.requests.some((request) => request.url.endsWith(`/invitations/${INVITATION}/cancel`))).toBe(true);
  });
});

describe('Invite form', () => {
  it('keeps Send invite disabled until the email looks right, then sends it and shows the sent screen', async () => {
    const api = await open(<ClientInvite />, ['coach'], [{ status: 201, body: { invitation } }]);
    const send = screen.getByRole('button', { name: 'Send invite' });
    expect(send).toBeDisabled();
    expect(screen.queryByText('ADD UNDER')).toBeNull(); // a Coach always adds under themselves
    await fireEvent.changeText(screen.getByLabelText('Client email'), 'kabir@example.test');
    expect(send).toBeEnabled();
    await fireEvent.press(send);
    await screen.findByRole('button', { name: 'Send invite' });
    expect(api.requests.at(-1)).toMatchObject({ method: 'POST', body: { email: 'kabir@example.test' } });
    expect(mockRouter.replace).toHaveBeenCalledWith('/client-invite-sent?email=kabir%40example.test');
  });

  it('shows "This trainee is already added." under the email and goes nowhere', async () => {
    await open(<ClientInvite />, ['coach'], [{ status: 409, body: errorBody('ALREADY_ADDED') }]);
    await fireEvent.changeText(screen.getByLabelText('Client email'), 'priya@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('This trainee is already added.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('shows the limit and the not-sent answers as banners', async () => {
    await open(<ClientInvite />, ['coach'], [{ status: 429, body: errorBody('INVITE_LIMIT_REACHED') }]);
    await fireEvent.changeText(screen.getByLabelText('Client email'), 'a@b.co');
    await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('You have sent the most invites allowed today. Try again tomorrow.')).toBeTruthy();
  });

  it('lets the Head Coach choose who the client will be under, and sends that coach', async () => {
    const api = await open(<ClientInvite />, ['head_coach', 'personal'], [
      listBody({ coaches: [{ id: RAVI, name: 'Ravi Kumar' }] }),
      { status: 201, body: { invitation } },
    ]);
    await screen.findByRole('radio', { name: 'Ravi Kumar' });
    expect(screen.getByRole('radio', { name: 'Myself', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ravi Kumar' }));
    await fireEvent.changeText(screen.getByLabelText('Client email'), 'kabir@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
    await screen.findByRole('button', { name: 'Send invite' });
    expect(api.requests.at(-1)?.body).toEqual({ email: 'kabir@example.test', coachId: RAVI });
  });
});

describe('Invite sent', () => {
  it('says the same thing whether or not the email has an account, and offers the next steps', async () => {
    mockParams = { email: 'kabir@example.test' };
    await render(
      <Providers authDeps={deps(fakeClient().client)}>
        <ClientInviteSent />
      </Providers>,
    );
    expect(screen.getByText(/kabir@example.test if they have no FitSphere account yet; otherwise they will see the invite/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to clients' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/clients');
    await fireEvent.press(screen.getByRole('button', { name: 'Invite another' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/client-invite');
  });
});
