// Gym onboarding, step 1: the gym form (CF02, docs/design/CF02-gym-onboarding-ui.md §4.1). Sending
// it saves the request and emails the approval code to FitSphere's team, not to this phone.
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { destinationFor, useAccount } from '../account/AccountProvider';
import { useAuth } from '../auth/AuthProvider';
import { logOut } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { AuthLayout, Banner, Field, Heading, PrimaryButton, TextLink, type InputRef } from '../components/ui';
import { sendGymRequest, type SendRequestResult } from '../gym/service';
import { EMPTY_GYM_FORM, GYM_TEXTS, gymFormRequest, type GymFormValues } from '../gym/texts';

const BANNERS: Partial<Record<SendRequestResult, string>> = {
  emailFailed: GYM_TEXTS.emailFailed,
  limit: GYM_TEXTS.limit,
  alreadyHeadCoach: GYM_TEXTS.alreadyHeadCoach,
  alreadyCoach: GYM_TEXTS.alreadyCoach,
  invalid: GYM_TEXTS.invalid,
  offline: TEXTS.offline,
  unavailable: TEXTS.tryLater,
};

export default function GymForm() {
  const { deps } = useAuth();
  const { refresh } = useAccount();
  const router = useRouter();
  const [values, setValues] = useState<GymFormValues>(EMPTY_GYM_FORM);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<SendRequestResult | null>(null);
  const address = useRef<InputRef>(null);
  const city = useRef<InputRef>(null);
  const pincode = useRef<InputRef>(null);
  const phone = useRef<InputRef>(null);
  const trainees = useRef<InputRef>(null);
  const website = useRef<InputRef>(null);

  const request = gymFormRequest(values);
  const set = (key: keyof GymFormValues) => (text: string) => setValues((current) => ({ ...current, [key]: text }));

  async function submit() {
    if (!request || sending) return;
    setSending(true);
    setProblem(null);
    const result = await sendGymRequest(deps, request);
    if (result === 'signedOut') {
      setSending(false);
      router.replace('/sign-in?expired=1');
      return;
    }
    if (result === 'sent' || result === 'alreadyHeadCoach' || result === 'alreadyCoach') {
      // Ask the server where the account stands now; it decides the next screen.
      const state = await refresh();
      if (result === 'sent') {
        setSending(false);
        router.replace(destinationFor(state) as never);
        return;
      }
      setProblem(result);
      setSending(false);
      router.replace(destinationFor(state) as never);
      return;
    }
    setProblem(result);
    setSending(false);
  }

  const banner = problem ? BANNERS[problem] : undefined;

  return (
    <AuthLayout
      footer={
        <>
          {banner ? <Banner kind="error">{banner}</Banner> : null}
          <PrimaryButton label={problem === 'emailFailed' ? 'Try again' : 'Send request'} arrow onPress={() => void submit()} disabled={!request} loading={sending} />
          <View style={{ alignItems: 'center' }}>
            <TextLink label="Log out" onPress={() => void logOut(deps).then(() => router.replace('/sign-in'))} />
          </View>
        </>
      }
    >
      <Heading step="Gym onboarding" first="Register" second="your gym" sub={GYM_TEXTS.formSub} />
      <View style={{ gap: 18, marginTop: 24 }}>
        <Field label="Gym name" value={values.gymName} onChangeText={set('gymName')} editable={!sending} autoCapitalize="words" placeholder="Iron Gym" returnKeyType="next" onSubmitEditing={() => address.current?.focus()} />
        <Field ref={address} label="Address" value={values.address} onChangeText={set('address')} editable={!sending} autoCapitalize="words" placeholder="Street and area" returnKeyType="next" onSubmitEditing={() => city.current?.focus()} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field ref={city} label="City" value={values.city} onChangeText={set('city')} editable={!sending} autoCapitalize="words" placeholder="City" returnKeyType="next" onSubmitEditing={() => pincode.current?.focus()} />
          </View>
          <View style={{ width: 130 }}>
            <Field ref={pincode} label="Pincode" value={values.pincode} onChangeText={set('pincode')} editable={!sending} keyboardType="number-pad" maxLength={6} placeholder="6 digits" />
          </View>
        </View>
        <Field ref={phone} label="Owner phone" value={values.ownerPhone} onChangeText={set('ownerPhone')} editable={!sending} keyboardType="phone-pad" textContentType="telephoneNumber" placeholder="+91" hint={GYM_TEXTS.phoneHint} />
        <Field ref={trainees} label="Total number of trainees" value={values.totalTrainees} onChangeText={set('totalTrainees')} editable={!sending} keyboardType="number-pad" placeholder="e.g. 120" />
        <Field ref={website} label="Website or Instagram (optional)" value={values.websiteOrInstagram} onChangeText={set('websiteOrInstagram')} editable={!sending} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Link to your gym online" returnKeyType="done" onSubmitEditing={() => void submit()} />
      </View>
    </AuthLayout>
  );
}
