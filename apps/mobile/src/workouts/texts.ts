// Texts and small helpers for workout management (docs/design/CF06-workout-management-ui.md).
import { EXERCISES, MAX_DAYS, type PlanChange, type PlanContent, type PlanDay, type PlanExercise } from '@fitsphere-coach/shared';
import type { Failure } from './service';

export const GOAL_LABELS = {
  weight_loss: 'Weight loss',
  muscle_gain: 'Muscle gain',
  strength: 'Strength',
  general_fitness: 'General fitness',
  endurance: 'Endurance',
  mobility: 'Mobility',
} as const;
export const DIFFICULTY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;
export const STATUS_LABELS = { draft: 'Draft', active: 'Active', ended: 'Ended' } as const;
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const MUSCLE_LABELS = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', core: 'Core' } as const;
export const EQUIPMENT_LABELS = { bodyweight: 'Bodyweight', dumbbell: 'Dumbbell', barbell: 'Barbell' } as const;

export const exerciseName = (id: string): string => EXERCISES.find((exercise) => exercise.id === id)?.name ?? id;

/** 120 → "2:00". */
export const restText = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const repsText = (exercise: Pick<PlanExercise, 'repsMin' | 'repsMax'>): string =>
  exercise.repsMin === exercise.repsMax ? `${exercise.repsMin}` : `${exercise.repsMin}–${exercise.repsMax}`;

/** Weights are stored in whole grams and shown in kilograms (invariant 5). */
export const gramsToKg = (grams: number): number => grams / 1000;
export const kgToGrams = (kg: number): number => Math.round(kg * 1000);

/** "4 × 8–10 · 60 kg · RPE 8 · Rest 2:00" */
export function exerciseSummary(exercise: PlanExercise): string {
  return [
    `${exercise.sets} × ${repsText(exercise)}`,
    exercise.weightG === null ? null : `${gramsToKg(exercise.weightG)} kg`,
    exercise.rpe === null ? null : `RPE ${exercise.rpe}`,
    `Rest ${restText(exercise.restS)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export const dayMeta = (day: PlanDay): string =>
  day.rest ? 'Rest day' : `${day.exercises.length} ${day.exercises.length === 1 ? 'exercise' : 'exercises'}`;

export const countExercises = (content: PlanContent): number => content.days.reduce((total, day) => total + day.exercises.length, 0);

export function newExercise(exerciseId: string): PlanExercise {
  return { exerciseId, group: null, sets: 3, repsMin: 8, repsMax: 10, weightG: null, rpe: null, restS: 120, note: '' };
}

/** A new day: the first free weekday when pinned, none when rotating. */
export function newDay(content: PlanContent): PlanDay {
  const used = new Set(content.days.map((day) => day.weekday));
  const weekday = content.scheduleMode === 'weekdays' ? ([1, 2, 3, 4, 5, 6, 7].find((value) => !used.has(value)) ?? null) : null;
  const name = content.scheduleMode === 'weekdays' && weekday ? WEEKDAY_LABELS[weekday - 1] : `Day ${content.days.length + 1}`;
  return { name: name ?? `Day ${content.days.length + 1}`, weekday, rest: false, exercises: [] };
}
export const canAddDay = (content: PlanContent): boolean => content.days.length < MAX_DAYS;

export function newContent(): PlanContent {
  return { weeks: 8, scheduleMode: 'weekdays', weeklyTarget: null, dailyTarget: false, days: [{ name: 'Mon', weekday: 1, rest: false, exercises: [] }] };
}

/** Switching the schedule keeps the days and either pins them to weekdays in order or frees them. */
export function withScheduleMode(content: PlanContent, mode: PlanContent['scheduleMode']): PlanContent {
  return {
    ...content,
    scheduleMode: mode,
    days: content.days.map((day, index) => ({ ...day, weekday: mode === 'weekdays' ? index + 1 : null })),
  };
}

// --- India time (invariant 4) ---
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_LONG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today's India day as YYYY-MM-DD. */
export const todayIst = (now: Date = new Date()): string => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "Mon, 17 Nov 2026" */
export function dayText(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS_LONG[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "11 Nov, 4:12 pm" in India time. */
export function whenText(iso: string): string {
  const date = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}, ${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'pm' : 'am'}`;
}

export const roleText = (role: 'head_coach' | 'coach'): string => (role === 'head_coach' ? 'Head coach' : 'Coach');

export function changeText(change: PlanChange): string {
  switch (change.action) {
    case 'created':
      return 'Plan created';
    case 'edited':
      return `Edited (version ${change.version})`;
    case 'published':
      return `Published version ${change.version}`;
    case 'ended':
      return 'Plan ended';
    case 'restored':
      return change.summary ?? `Restored (version ${change.version})`;
    case 'reverted':
      return 'Unpublished changes discarded';
  }
}

export const WORKOUT_TEXTS = {
  templatesSub: 'Gym templates are shared with every coach. Your own templates are only yours.',
  plansSub: 'Plans of your clients. Coaches see only their own clients.',
  emptyTemplates: 'No templates yet',
  emptyTemplatesSub: 'Make a template once, then give a copy to each client.',
  emptyPlans: 'No plans yet',
  emptyPlansSub: 'Open a template and tap Assign plan to make a draft for a client.',
  noMatch: 'Nothing matches.',
  notFound: 'This is no longer available.',
  refused: "You can't do this.",
  invalid: 'Some values are not valid. Sets are 1 to 6, reps 1 to 100 (the second number not below the first), and rest 15 to 600 seconds.',
  needDay: 'Add at least one day with an exercise.',
  draftExists: 'A client already has a draft plan. Open it from Plans.',
  notReady: 'Add at least one training day, with an exercise on every training day, before publishing.',
  assignInfo: 'Each client gets their own draft to review. Nothing goes live until you publish. Later edits to the template never change these drafts.',
  replaceInfo: (name: string) => `${name} already has an active plan. When you publish the new one, it replaces the old one.`,
  draftBanner: (version: number, name: string) => `Draft, version ${version}. ${name} can't see this yet.`,
  unpublishedBanner: (live: number, name: string) => `You have changes that are not published. ${name} still sees version ${live}.`,
  liveBanner: (name: string) => `${name} sees this plan in their Training tab.`,
  endedBanner: 'This plan has ended. It can no longer be changed.',
  publishWaits: 'Publishing waits for the FitSphere app update. Your draft is saved.',
  publishBody: (name: string) => `${name} sees this plan in their Training tab straight away. It replaces any plan they have now. Workouts they already logged keep the plan they followed.`,
  endBody: (name: string) => `${name}'s Training tab goes back to their own logging. Their history stays.`,
  discardBody: 'Your unpublished changes will be thrown away. The client keeps the live version.',
  historySub: 'Every change shows who and when.',
  restoreInfo: 'A restored version opens as a new draft. The client keeps seeing the live version until you publish.',
} as const;

export function failureText(failure: Failure, generic: { offline: string; tryLater: string }): string {
  switch (failure) {
    case 'offline':
      return generic.offline;
    case 'notFound':
      return WORKOUT_TEXTS.notFound;
    case 'refused':
      return WORKOUT_TEXTS.refused;
    case 'invalid':
      return WORKOUT_TEXTS.invalid;
    case 'draftExists':
      return WORKOUT_TEXTS.draftExists;
    case 'notReady':
      return WORKOUT_TEXTS.notReady;
    default:
      return generic.tryLater;
  }
}
