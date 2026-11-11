// Texts and small rules for gym onboarding (CF02 design: docs/design/CF02-gym-onboarding-ui.md).
import { gymRequestSchema, type GymRequest } from '@fitsphere-coach/shared';

export const GYM_TEXTS = {
  formSub: 'Tell us about your gym. FitSphere checks every gym before you become its Head Coach.',
  phoneHint: 'FitSphere may call this number to check your gym.',
  emailFailed: "Couldn't send your request. Check your connection and try again. This didn't use up one of your requests today.",
  limit: "You have sent the most requests allowed today. Try again tomorrow.",
  alreadyHeadCoach: 'This email is already registered as a Head Coach.',
  alreadyCoach: 'This email is already registered as a Coach.',
  invalid: 'Some details are not valid. Check them and try again.',
  codeSub: (length: number) =>
    `FitSphere is checking your gym. When it is approved, they will give you a ${length}-digit code. Enter it here.`,
  codeWrong: (left: number) => `That code didn't match. You have ${left} ${left === 1 ? 'try' : 'tries'} left. Check the code FitSphere gave you.`,
  codeFormat: 'The code is made of digits only.',
} as const;

export type GymFormValues = {
  gymName: string;
  address: string;
  city: string;
  pincode: string;
  ownerPhone: string;
  totalTrainees: string;
  websiteOrInstagram: string;
};

export const EMPTY_GYM_FORM: GymFormValues = {
  gymName: '',
  address: '',
  city: '',
  pincode: '',
  ownerPhone: '',
  totalTrainees: '',
  websiteOrInstagram: '',
};

/** The form as the server expects it, or null while something is missing or not valid. */
export function gymFormRequest(values: GymFormValues): GymRequest | null {
  const trainees = values.totalTrainees.trim();
  const request: GymRequest = {
    gymName: values.gymName,
    address: values.address,
    city: values.city,
    pincode: values.pincode.trim(),
    ownerPhone: values.ownerPhone,
    totalTrainees: /^[0-9]+$/.test(trainees) ? Number(trainees) : Number.NaN,
    ...(values.websiteOrInstagram.trim() ? { websiteOrInstagram: values.websiteOrInstagram } : {}),
  };
  return gymRequestSchema.safeParse(request).success ? request : null;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "18 Nov, 14:20" in India time (invariant 4); worked out by hand so it needs no Intl support. */
export function indiaDateTime(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]}, ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** "This request expires in 6 days, on 18 Nov, 14:20." */
export function expiryText(expiresAtIso: string, now: Date = new Date()): string {
  const days = Math.ceil((new Date(expiresAtIso).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const when = indiaDateTime(expiresAtIso);
  if (days <= 1) return `This request expires today or tomorrow, on ${when}.`;
  return `This request expires in ${days} days, on ${when}.`;
}

export function requestsLeftText(left: number): string {
  if (left <= 0) return "You have used today's requests. You can send a new one tomorrow.";
  return `You can send ${left} more ${left === 1 ? 'request' : 'requests'} today.`;
}
