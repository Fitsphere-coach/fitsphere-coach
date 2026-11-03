// Sign up, step 1 of 3 (CAUTH-006; CF01 UI doc §4.3 with the 2026-11-03 changes).
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signUp } from '../auth/service';
import { emailProblem, nameOk, passwordOk, passwordRules, TEXTS } from '../auth/texts';
import { AuthLayout, Banner, CheckBox, Field, Heading, PasswordStrength, PrimaryButton, TextLink, textStyles, type InputRef } from '../components/ui';
import { useTheme } from '../theme';

export default function SignUp() {
  const { deps } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const emailRef = useRef<InputRef>(null);
  const passwordRef = useRef<InputRef>(null);

  const emailError = emailTouched && email !== '' ? emailProblem(email) : null;
  const ready = nameOk(fullName) && emailProblem(email) === null && passwordOk(password) && adult && terms;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    const result = await signUp(deps, { fullName, email, password });
    setBusy(false);
    if (result === 'sent') router.replace(`/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    else setProblem(result === 'offline' ? TEXTS.offline : TEXTS.tryLater);
  }

  return (
    <AuthLayout
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
      footer={
        <>
          {problem ? <Banner kind="error">{problem}</Banner> : null}
          <PrimaryButton label="Create account" arrow onPress={() => void submit()} disabled={!ready} loading={busy} />
          <Text style={[textStyles.body, { color: colors.inkMuted, textAlign: 'center' }]}>
            Already have an account? <TextLink label="Log in" onPress={() => router.replace('/sign-in')} />
          </Text>
        </>
      }
    >
      <Heading
        step="Step 1 of 3"
        first="Start"
        second="coaching"
        sub="Create your coach account. Next you'll verify your email, then choose Coach or Head Coach."
      />
      <View style={{ marginTop: 24, gap: 18 }}>
        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          editable={!busy}
          placeholder="Asha Rao"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          hint={TEXTS.nameHint}
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <Field
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          error={emailError}
          editable={!busy}
          placeholder="you@yourgym.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View style={{ gap: 8 }}>
          <Field
            ref={passwordRef}
            label="Password"
            password
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
          />
          <PasswordStrength rules={passwordRules(password)} />
        </View>
        <View style={{ gap: 2 }}>
          <CheckBox checked={adult} onChange={setAdult} label={TEXTS.ageConfirmation}>
            <Text style={[textStyles.body, { color: colors.ink, fontSize: 14, lineHeight: 20, marginTop: 1 }]}>{TEXTS.ageConfirmation}</Text>
          </CheckBox>
          {!adult ? <Text style={[textStyles.small, { color: colors.inkMuted, marginLeft: 34 }]}>{TEXTS.ageHint}</Text> : null}
        </View>
        <CheckBox checked={terms} onChange={setTerms} label="I agree to the Terms, Privacy Policy and Coach data terms">
          <Text style={[textStyles.body, { color: colors.ink, fontSize: 14, lineHeight: 20 }]}>
            I agree to the <Text style={{ color: colors.accent }}>Terms</Text>, <Text style={{ color: colors.accent }}>Privacy Policy</Text> and{' '}
            <Text style={{ color: colors.accent }}>Coach data terms</Text>
          </Text>
        </CheckBox>
      </View>
    </AuthLayout>
  );
}
