// CF02 gym onboarding: the form, the approval code and the states (docs/design/CF02-gym-onboarding-ui.md).
import { fireEvent, render, screen } from '@testing-library/react-native';
import ApprovalCode from './app/approval-code';
import GymApproved from './app/gym-approved';
import GymForm from './app/gym-form';
import RequestExpired from './app/request-expired';
import RequestLocked from './app/request-locked';
import { destinationFor } from './account/AccountProvider';
import { enterApprovalCode, sendGymRequest } from './gym/service';
import { expiryText, gymFormRequest, indiaDateTime, requestsLeftText, EMPTY_GYM_FORM } from './gym/texts';
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

const me = (roles: string[]) => ({
  user: { id: '0b6f2a52-6f4b-4c38-9d1f-2b8e4c1a7d10', email: 'coach@example.test', createdAt: '2026-11-03T08:00:00Z' },
  roles,
  coach: { fullName: 'Asha Rao' },
});
const onboarding = (status: 'none' | 'pending' | 'expired' | 'locked', extra: object = {}) => ({
  status,
  expiresAt: status === 'pending' ? '2026-11-19T08:50:00.000Z' : null,
  triesLeft: status === 'pending' ? 5 : null,
  requestsLeftToday: 2,
  codeLength: 6,
  gymName: null,
  ...extra,
});
const signedIn = () => fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) }).client;

const validForm = {
  gymName: 'Iron Gym',
  address: '12 MG Road',
  city: 'Indore',
  pincode: '452010',
  ownerPhone: '98765 43210',
  totalTrainees: '120',
  websiteOrInstagram: '',
};

describe('gym form values', () => {
  it('is ready only when every required field is valid, and tidies what it sends', () => {
    expect(gymFormRequest(EMPTY_GYM_FORM)).toBeNull();
    expect(gymFormRequest(validForm)).toMatchObject({ gymName: 'Iron Gym', pincode: '452010', totalTrainees: 120 });
    expect(gymFormRequest({ ...validForm, pincode: '4520' })).toBeNull();
    expect(gymFormRequest({ ...validForm, ownerPhone: '12345' })).toBeNull();
    expect(gymFormRequest({ ...validForm, totalTrainees: '0' })).toBeNull();
    expect(gymFormRequest({ ...validForm, totalTrainees: 'many' })).toBeNull();
    expect(gymFormRequest({ ...validForm, gymName: 'A' })).toBeNull();
  });

  it('leaves the optional link out when empty and sends it when given', () => {
    expect(gymFormRequest(validForm)).not.toHaveProperty('websiteOrInstagram');
    expect(gymFormRequest({ ...validForm, websiteOrInstagram: 'instagram.com/irongym' })).toMatchObject({ websiteOrInstagram: 'instagram.com/irongym' });
  });

  it('shows times in India time and the days left', () => {
    expect(indiaDateTime('2026-11-18T08:50:00.000Z')).toBe('18 Nov, 14:20');
    expect(indiaDateTime('2026-11-18T19:00:00.000Z')).toBe('19 Nov, 00:30');
    expect(expiryText('2026-11-18T08:50:00.000Z', new Date('2026-11-12T08:50:00.000Z'))).toBe('This request expires in 6 days, on 18 Nov, 14:20.');
    expect(requestsLeftText(0)).toBe("You have used today's requests. You can send a new one tomorrow.");
    expect(requestsLeftText(1)).toBe('You can send 1 more request today.');
  });
});

describe('routing by the server state (coach-scope §4.2a)', () => {
  it('sends each onboarding status to its screen', () => {
    const state = (status: 'none' | 'pending' | 'expired' | 'locked') => ({ kind: 'onboarding' as const, me: me(['personal']) as never, email: null, status: onboarding(status) as never });
    expect(destinationFor(state('none'))).toBe('/gym-form');
    expect(destinationFor(state('pending'))).toBe('/approval-code');
    expect(destinationFor(state('expired'))).toBe('/request-expired');
    expect(destinationFor(state('locked'))).toBe('/request-locked');
  });
});

describe('gym service answers', () => {
  it('maps the server error codes, never the message', async () => {
    const send = async (status: number, code: string) => {
      const api = fakeApi([{ status, body: errorBody(code) }]);
      return sendGymRequest(deps(signedIn(), api.fetchImpl), { ...validForm, totalTrainees: 120 });
    };
    expect(await send(503, 'APPROVAL_EMAIL_FAILED')).toBe('emailFailed');
    expect(await send(429, 'REQUEST_LIMIT_REACHED')).toBe('limit');
    expect(await send(409, 'ALREADY_HEAD_COACH')).toBe('alreadyHeadCoach');
    expect(await send(409, 'ALREADY_COACH')).toBe('alreadyCoach');
    expect(await send(400, 'VALIDATION_FAILED')).toBe('invalid');
    expect(await send(500, 'INTERNAL_ERROR')).toBe('unavailable');
    expect(await sendGymRequest(deps(fakeClient().client), { ...validForm, totalTrainees: 120 })).toBe('signedOut');
  });

  it('sends the code with the token, and treats a wrong code as an answer', async () => {
    const api = fakeApi([{ status: 200, body: { result: 'wrong', triesLeft: 3, gymName: null } }]);
    const answer = await enterApprovalCode(deps(signedIn(), api.fetchImpl), '123456');
    expect(answer).toEqual({ kind: 'answer', answer: { result: 'wrong', triesLeft: 3, gymName: null } });
    expect(api.requests[0]).toMatchObject({ method: 'POST', url: 'http://api.test/v1/gym/onboarding/code', auth: 'Bearer token-1', body: { code: '123456' } });
  });
});

describe('Gym form', () => {
  async function open(responses: { status: number; body: unknown }[]) {
    const api = fakeApi(responses);
    await render(
      <Providers authDeps={deps(signedIn(), api.fetchImpl)}>
        <GymForm />
      </Providers>,
    );
    return api;
  }
  async function fillIn() {
    await fireEvent.changeText(screen.getByLabelText('Gym name'), 'Iron Gym');
    await fireEvent.changeText(screen.getByLabelText('Address'), '12 MG Road');
    await fireEvent.changeText(screen.getByLabelText('City'), 'Indore');
    await fireEvent.changeText(screen.getByLabelText('Pincode'), '452010');
    await fireEvent.changeText(screen.getByLabelText('Owner phone'), '98765 43210');
    await fireEvent.changeText(screen.getByLabelText('Total number of trainees'), '120');
  }

  it('keeps Send request disabled until the required fields are valid; the website is optional', async () => {
    await open([]);
    const send = screen.getByRole('button', { name: 'Send request' });
    expect(send).toBeDisabled();
    expect(screen.getByText('FitSphere may call this number to check your gym.')).toBeTruthy();
    await fillIn();
    expect(send).toBeEnabled();
  });

  it('sends the form, then goes where the server says (enter the code)', async () => {
    const api = await open([
      { status: 201, body: onboarding('pending') },
      { status: 200, body: me(['personal']) },
      { status: 200, body: onboarding('pending') },
    ]);
    await fillIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    await screen.findByRole('button', { name: 'Send request' });
    expect(api.requests[0]).toMatchObject({
      method: 'POST',
      url: 'http://api.test/v1/gym/onboarding/requests',
      body: { gymName: 'Iron Gym', address: '12 MG Road', city: 'Indore', pincode: '452010', ownerPhone: '98765 43210', totalTrainees: 120 },
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/approval-code');
  });

  it('shows the not-sent banner, offers Try again and goes nowhere', async () => {
    await open([{ status: 503, body: errorBody('APPROVAL_EMAIL_FAILED') }]);
    await fillIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(
      await screen.findByText("Couldn't send your request. Check your connection and try again. This didn't use up one of your requests today."),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("shows today's limit", async () => {
    await open([{ status: 429, body: errorBody('REQUEST_LIMIT_REACHED') }]);
    await fillIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('You have sent the most requests allowed today. Try again tomorrow.')).toBeTruthy();
  });
});

describe('Approval code', () => {
  async function open(responses: { status: number; body: unknown }[]) {
    const api = fakeApi([{ status: 200, body: me(['personal']) }, { status: 200, body: onboarding('pending') }, ...responses]);
    await render(
      <Providers authDeps={deps(signedIn(), api.fetchImpl)}>
        <ApprovalCode />
      </Providers>,
    );
    // The screen asks the server where the account stands, then shows when the request expires.
    await screen.findByText('This request expires in', { exact: false });
    return api;
  }

  it('shows the days left and keeps Approve my gym disabled until every digit is entered', async () => {
    await open([]);
    expect(screen.getByText('This request expires in', { exact: false })).toBeTruthy();
    const approve = screen.getByRole('button', { name: 'Approve my gym' });
    expect(approve).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Approval code'), '48291');
    expect(approve).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Approval code'), '482915');
    expect(approve).toBeEnabled();
  });

  it('keeps digits only, whatever is typed or pasted', async () => {
    await open([]);
    await fireEvent.changeText(screen.getByLabelText('Approval code'), '48-29 15x99');
    expect(screen.getByLabelText('Approval code').props.value).toBe('482915');
  });

  it('a wrong code shows the tries left and clears the boxes', async () => {
    await open([
      { status: 200, body: { result: 'wrong', triesLeft: 3, gymName: null } },
      { status: 200, body: me(['personal']) },
      { status: 200, body: onboarding('pending', { triesLeft: 3 }) },
    ]);
    await fireEvent.changeText(screen.getByLabelText('Approval code'), '482915');
    await fireEvent.press(screen.getByRole('button', { name: 'Approve my gym' }));
    expect(await screen.findByText("That code didn't match. You have 3 tries left. Check the code FitSphere gave you.")).toBeTruthy();
    expect(screen.getByLabelText('Approval code').props.value).toBe('');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('the right code goes to the approved screen with the gym name', async () => {
    await open([{ status: 200, body: { result: 'approved', triesLeft: null, gymName: 'Iron Gym' } }]);
    await fireEvent.changeText(screen.getByLabelText('Approval code'), '482915');
    await fireEvent.press(screen.getByRole('button', { name: 'Approve my gym' }));
    await screen.findByRole('button', { name: 'Approve my gym' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/gym-approved?gym=Iron%20Gym');
  });

  it('a locked request goes to the locked screen, as the server says', async () => {
    await open([
      { status: 200, body: { result: 'locked', triesLeft: null, gymName: null } },
      { status: 200, body: me(['personal']) },
      { status: 200, body: onboarding('locked') },
    ]);
    await fireEvent.changeText(screen.getByLabelText('Approval code'), '482915');
    await fireEvent.press(screen.getByRole('button', { name: 'Approve my gym' }));
    await screen.findByRole('button', { name: 'Approve my gym' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/request-locked');
  });

  it('an expired request goes to the expired screen', async () => {
    await open([
      { status: 200, body: { result: 'expired', triesLeft: null, gymName: null } },
      { status: 200, body: me(['personal']) },
      { status: 200, body: onboarding('expired') },
    ]);
    await fireEvent.changeText(screen.getByLabelText('Approval code'), '482915');
    await fireEvent.press(screen.getByRole('button', { name: 'Approve my gym' }));
    await screen.findByRole('button', { name: 'Approve my gym' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/request-expired');
  });

  it('offers a new request', async () => {
    await open([]);
    await fireEvent.press(screen.getByRole('link', { name: 'SEND A NEW REQUEST' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/gym-form');
  });
});

describe('Locked, expired and approved screens', () => {
  async function open(element: React.ReactElement, responses: { status: number; body: unknown }[]) {
    const api = fakeApi(responses);
    await render(<Providers authDeps={deps(signedIn(), api.fetchImpl)}>{element}</Providers>);
  }

  it('locked: says why and offers a new request while requests are left today', async () => {
    await open(<RequestLocked />, [{ status: 200, body: me(['personal']) }, { status: 200, body: onboarding('locked') }]);
    await screen.findByText('You can send 2 more requests today.');
    await fireEvent.press(screen.getByRole('button', { name: 'Send a new request' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/gym-form');
  });

  it('locked: no new request when today\'s requests are used up', async () => {
    await open(<RequestLocked />, [{ status: 200, body: me(['personal']) }, { status: 200, body: onboarding('locked', { requestsLeftToday: 0 }) }]);
    await screen.findByText("You have used today's requests. You can send a new one tomorrow.");
    expect(screen.getByRole('button', { name: 'Send a new request' })).toBeDisabled();
  });

  it('expired: starts the gym form again', async () => {
    await open(<RequestExpired />, [{ status: 200, body: me(['personal']) }, { status: 200, body: onboarding('expired') }]);
    await screen.findByText('You can send 2 more requests today.');
    await fireEvent.press(screen.getByRole('button', { name: 'Start again' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/gym-form');
  });

  it('approved: names the gym, then reads the account again and goes to the start', async () => {
    mockParams = { gym: 'Iron Gym' };
    await open(<GymApproved />, [{ status: 200, body: me(['head_coach', 'personal']) }]);
    expect(screen.getByText('Iron Gym', { exact: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to home' }));
    await screen.findByRole('button', { name: 'Go to home' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
