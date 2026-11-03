// Screen behaviour from the CF01 UI doc's state tables.
import { fireEvent, render, screen } from '@testing-library/react-native';
import SignIn from './app/sign-in';
import SignUp from './app/sign-up';
import ChangePassword from './app/change-password';
import { deps, fakeClient, Providers, session } from './testing/fakes';

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

describe('Sign up', () => {
  it('keeps Create account disabled until the name, email, password rules, 18+ and terms are all done', async () => {
    const { client, calls } = fakeClient();
    await render(
      <Providers authDeps={deps(client)}>
        <SignUp />
      </Providers>,
    );
    const create = screen.getByRole('button', { name: 'Create account' });
    expect(create).toBeDisabled();
    expect(screen.getByText('Tick "I am 18 or older" to continue.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Full name'), 'Asha Rao');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@irongym.in');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'irongym2026');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I agree to the Terms, Privacy Policy and Coach data terms' }));
    expect(create).toBeDisabled();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'I am 18 or older' }));
    expect(screen.queryByText('Tick "I am 18 or older" to continue.')).toBeNull();
    expect(create).toBeEnabled();

    await fireEvent.press(create);
    await screen.findByRole('button', { name: 'Create account' });
    expect(calls.some((call) => call.method === 'signUp')).toBe(true);
    expect(mockRouter.replace).toHaveBeenCalledWith('/check-email?email=asha%40irongym.in');
  });
});

describe('Log in', () => {
  async function logInWith(client: ReturnType<typeof fakeClient>['client']) {
    await render(
      <Providers authDeps={deps(client)}>
        <SignIn />
      </Providers>,
    );
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@irongym.in');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
  }

  it('shows one generic message for wrong details', async () => {
    await logInWith(fakeClient({ signInWithPassword: async () => ({ data: { session: null }, error: { status: 400 } }) }).client);
    expect(await screen.findByText('Email or password is incorrect. Check both and try again.')).toBeTruthy();
  });

  it('shows the lockout message and disables Log in after too many attempts', async () => {
    await logInWith(fakeClient({ signInWithPassword: async () => ({ data: { session: null }, error: { status: 429 } }) }).client);
    expect(await screen.findByText('Too many attempts. Try again in 5 minutes, or reset your password.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
  });

  it('shows the session-expired banner when sent back after a refused session', async () => {
    mockParams = { expired: '1' };
    await render(
      <Providers authDeps={deps(fakeClient().client)}>
        <SignIn />
      </Providers>,
    );
    expect(screen.getByText('You were signed out. Log in to pick up where you left off.')).toBeTruthy();
  });

  it('goes to the start screen after a successful log in', async () => {
    await logInWith(fakeClient().client);
    await screen.findByRole('button', { name: 'Log in' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});

describe('Change password', () => {
  it("shows the mismatch and keeps Update password disabled until the passwords match", async () => {
    const { client } = fakeClient({ getSession: async () => ({ data: { session: session() }, error: null }) });
    await render(
      <Providers authDeps={deps(client)}>
        <ChangePassword />
      </Providers>,
    );
    await fireEvent.changeText(screen.getByLabelText('Current password'), 'irongym2026');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'irongym2027');
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'irongym2072');
    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'irongym2027');
    expect(screen.getByRole('button', { name: 'Update password' })).toBeEnabled();
  });
});
