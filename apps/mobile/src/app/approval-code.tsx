// Gym onboarding, step 2: enter the approval code FitSphere gave the gym owner (CF02 design §4.2).
// The server counts wrong tries, locks the request, and expires it; the app shows what it answers.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { destinationFor, useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { logOut } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { AuthLayout, Banner, CodeInput, Heading, PrimaryButton, TextLink } from '../components/ui';
import { enterApprovalCode } from '../gym/service';
import { expiryText, GYM_TEXTS } from '../gym/texts';

type Problem = { kind: 'wrong'; left: number } | { kind: 'format' } | { kind: 'offline' } | { kind: 'unavailable' };

export default function ApprovalCode() {
  const { deps } = useAuth();
  const { state, refresh } = useAccount();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // Opened from the start screen the state is known; opened any other way, ask the server.
  useEffect(() => {
    if (!state) void refresh();
  }, [state, refresh]);

  const status = state?.kind === 'onboarding' ? state.status : null;
  const length = status?.codeLength ?? 6;
  const ready = code.length === length;

  async function submit() {
    if (!ready || checking) return;
    setChecking(true);
    setProblem(null);
    const response = await enterApprovalCode(deps, code);
    if (response.kind === 'signedOut') {
      setChecking(false);
      router.replace('/sign-in?expired=1');
      return;
    }
    if (response.kind === 'offline' || response.kind === 'unavailable' || response.kind === 'invalid') {
      setProblem({ kind: response.kind === 'invalid' ? 'format' : response.kind });
      setChecking(false);
      return;
    }
    if (response.kind !== 'answer') {
      // Already a Head Coach or Coach: the server knows; go where it says.
      router.replace(destinationFor(await refresh()) as never);
      return;
    }
    const { answer } = response;
    if (answer.result === 'approved') {
      router.replace(`/gym-approved?gym=${encodeURIComponent(answer.gymName ?? '')}` as never);
      return;
    }
    if (answer.result === 'wrong') {
      setProblem({ kind: 'wrong', left: answer.triesLeft ?? 0 });
      setCode('');
      setChecking(false);
      void refresh();
      return;
    }
    // Locked, expired or no request: the server's state decides the screen.
    router.replace(destinationFor(await refresh()) as never);
  }

  const error =
    problem?.kind === 'wrong'
      ? GYM_TEXTS.codeWrong(problem.left)
      : problem?.kind === 'format'
        ? GYM_TEXTS.codeFormat
        : problem?.kind === 'offline'
          ? TEXTS.offline
          : problem?.kind === 'unavailable'
            ? TEXTS.tryLater
            : null;

  return (
    <AuthLayout
      footer={
        <>
          <PrimaryButton label="Approve my gym" arrow onPress={() => void submit()} disabled={!ready} loading={checking} />
          <View style={{ alignItems: 'center', gap: 16 }}>
            <TextLink label="Send a new request" onPress={() => router.push('/gym-form')} />
            <TextLink label="Log out" onPress={() => void logOut(deps).then(() => router.replace('/sign-in'))} />
          </View>
        </>
      }
    >
      <Heading step="Request sent" first="Enter your" second="approval code" sub={GYM_TEXTS.codeSub(length)} />
      <View style={{ marginTop: 24, gap: 18 }}>
        <CodeInput label="Approval code" value={code} onChange={setCode} length={length} error={problem?.kind === 'wrong' || problem?.kind === 'format'} editable={!checking} />
        {error ? <Banner kind="error">{error}</Banner> : null}
        {status?.expiresAt ? <Banner kind="info">{expiryText(status.expiresAt)}</Banner> : null}
      </View>
    </AuthLayout>
  );
}
