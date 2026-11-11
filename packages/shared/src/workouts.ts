// Workout management (CF06, SPEC-002): the exercise list, workout templates and training plans.
// Request schemas are strict; response types are plain. Weights are whole grams (invariant 5).
import { z } from 'zod';
import { idSchema } from './contracts.ts';

// --- The exercise list (ten fixed exercises for now; a bigger library comes later) ---

export const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'] as const;
export const EQUIPMENT = ['bodyweight', 'dumbbell', 'barbell'] as const;
export type Muscle = (typeof MUSCLES)[number];
export type Equipment = (typeof EQUIPMENT)[number];

export type Exercise = { id: string; name: string; muscle: Muscle; equipment: Equipment; steps: string[] };

export const EXERCISES: readonly Exercise[] = [
  { id: 'bench-press', name: 'Bench press', muscle: 'chest', equipment: 'barbell', steps: ['Lie flat, feet on the floor.', 'Lower the bar to your mid chest.', 'Press it back up until your arms are straight.'] },
  { id: 'back-squat', name: 'Back squat', muscle: 'legs', equipment: 'barbell', steps: ['Bar across your upper back, feet shoulder-width.', 'Sit down and back until your thighs are parallel.', 'Stand up, pushing through your whole foot.'] },
  { id: 'deadlift', name: 'Deadlift', muscle: 'back', equipment: 'barbell', steps: ['Bar over mid-foot, back flat.', 'Push the floor away and stand tall.', 'Lower the bar along your legs.'] },
  { id: 'overhead-press', name: 'Overhead press', muscle: 'shoulders', equipment: 'barbell', steps: ['Hold the bar at your collarbone.', 'Press it straight up past your face.', 'Lock out, then lower with control.'] },
  { id: 'pull-up', name: 'Pull-up', muscle: 'back', equipment: 'bodyweight', steps: ['Hang from the bar, hands just wider than shoulders.', 'Pull your chest toward the bar.', 'Lower until your arms are straight.'] },
  { id: 'dumbbell-row', name: 'Dumbbell row', muscle: 'back', equipment: 'dumbbell', steps: ['One hand and knee on a bench.', 'Pull the dumbbell to your hip.', 'Lower slowly, then switch sides.'] },
  { id: 'lunge', name: 'Lunge', muscle: 'legs', equipment: 'dumbbell', steps: ['Step forward, dumbbells at your sides.', 'Lower until both knees are bent at 90 degrees.', 'Push back to standing, then switch legs.'] },
  { id: 'push-up', name: 'Push-up', muscle: 'chest', equipment: 'bodyweight', steps: ['Hands under shoulders, body in a straight line.', 'Lower your chest to the floor.', 'Push back up.'] },
  { id: 'plank', name: 'Plank', muscle: 'core', equipment: 'bodyweight', steps: ['Forearms on the floor, elbows under shoulders.', 'Keep your body in one straight line.', 'Hold, breathing steadily.'] },
  { id: 'biceps-curl', name: 'Biceps curl', muscle: 'arms', equipment: 'dumbbell', steps: ['Stand tall, dumbbells at your sides.', 'Curl them up without swinging.', 'Lower slowly.'] },
];
export const EXERCISE_IDS = EXERCISES.map((exercise) => exercise.id);
export const exerciseById = (id: string): Exercise | undefined => EXERCISES.find((exercise) => exercise.id === id);

// --- Plan content (shared by templates and plans) ---

export const GOALS = ['weight_loss', 'muscle_gain', 'strength', 'general_fitness', 'endurance', 'mobility'] as const;
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export const SCHEDULE_MODES = ['weekdays', 'rotating'] as const;
export const TEMPLATE_VISIBILITIES = ['gym', 'personal'] as const;
export const PLAN_STATUSES = ['draft', 'active', 'ended'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const MAX_DAYS = 7;
export const MAX_EXERCISES_PER_DAY = 12;
export const MAX_SETS = 6;

export const planExerciseSchema = z
  .strictObject({
    exerciseId: z.enum(EXERCISE_IDS),
    /** Exercises with the same number are a superset. */
    group: z.number().int().min(1).max(MAX_EXERCISES_PER_DAY).nullable(),
    sets: z.number().int().min(1).max(MAX_SETS),
    repsMin: z.number().int().min(1).max(100),
    repsMax: z.number().int().min(1).max(100),
    /** Whole grams; null for bodyweight or "pick your own". */
    weightG: z.number().int().min(0).max(1_000_000).nullable(),
    rpe: z.number().int().min(1).max(10).nullable(),
    restS: z.number().int().min(15).max(600),
    note: z.string().max(200),
  })
  .refine((exercise) => exercise.repsMax >= exercise.repsMin, { path: ['repsMax'], message: 'repsMax' });
export type PlanExercise = z.infer<typeof planExerciseSchema>;

export const planDaySchema = z
  .strictObject({
    name: z.string().trim().min(1).max(40),
    /** 1 (Monday) to 7 (Sunday) in weekday mode; null when rotating. */
    weekday: z.number().int().min(1).max(7).nullable(),
    rest: z.boolean(),
    exercises: z.array(planExerciseSchema).max(MAX_EXERCISES_PER_DAY),
  })
  .refine((day) => !day.rest || day.exercises.length === 0, { path: ['exercises'], message: 'rest day' });
export type PlanDay = z.infer<typeof planDaySchema>;

export const planContentSchema = z
  .strictObject({
    /** Null means ongoing. */
    weeks: z.number().int().min(1).max(52).nullable(),
    scheduleMode: z.enum(SCHEDULE_MODES),
    /** Workouts a week, when the coach sets it as the trainee's weekly target; null for no target. */
    weeklyTarget: z.number().int().min(1).max(7).nullable(),
    /** Whether each training day counts as the trainee's daily workout goal. */
    dailyTarget: z.boolean(),
    days: z.array(planDaySchema).min(1).max(MAX_DAYS),
  })
  .superRefine((content, ctx) => {
    const weekdays = content.days.map((day) => day.weekday);
    if (content.scheduleMode === 'rotating' && weekdays.some((weekday) => weekday !== null)) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'weekday' });
    }
    if (content.scheduleMode === 'weekdays') {
      if (weekdays.some((weekday) => weekday === null) || new Set(weekdays).size !== weekdays.length) {
        ctx.addIssue({ code: 'custom', path: ['days'], message: 'weekday' });
      }
    }
  });
export type PlanContent = z.infer<typeof planContentSchema>;

/** A plan can go live only with at least one training day, and every training day has an exercise. */
export function planIsReady(content: PlanContent): boolean {
  const training = content.days.filter((day) => !day.rest);
  return training.length > 0 && training.every((day) => day.exercises.length > 0);
}

// --- Templates ---

const nameSchema = z.string().trim().min(1).max(80);

export const templateRequestSchema = z.strictObject({
  name: nameSchema,
  goal: z.enum(GOALS),
  difficulty: z.enum(DIFFICULTIES),
  visibility: z.enum(TEMPLATE_VISIBILITIES),
  content: planContentSchema,
});
export type TemplateRequest = z.input<typeof templateRequestSchema>;
export type TemplateInput = z.output<typeof templateRequestSchema>;

export type TemplateSummary = {
  id: string;
  name: string;
  goal: (typeof GOALS)[number];
  difficulty: (typeof DIFFICULTIES)[number];
  visibility: (typeof TEMPLATE_VISIBILITIES)[number];
  active: boolean;
  days: number;
  exercises: number;
  /** Whether the viewer may edit, copy-and-edit or deactivate it. */
  canEdit: boolean;
  updatedAt: string;
};
export type TemplateDetail = TemplateSummary & { content: PlanContent };

// --- Plans ---

/** POST /v1/training-plans: a draft copy of a template for each chosen client (nothing goes live). */
export const assignPlanRequestSchema = z.strictObject({
  templateId: idSchema,
  traineeIds: z.array(idSchema).min(1).max(50),
  /** The India day the plan starts, today or later; checked by the API. */
  startDate: z.iso.date(),
});
export type AssignPlanRequest = z.infer<typeof assignPlanRequestSchema>;

/** PUT /v1/training-plans/{id}: edit the working copy. On a live plan this makes unpublished changes. */
export const updatePlanRequestSchema = z.strictObject({
  name: nameSchema,
  startDate: z.iso.date(),
  content: planContentSchema,
});
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;

export const restorePlanRequestSchema = z.strictObject({ version: z.number().int().min(1) });
export type RestorePlanRequest = z.infer<typeof restorePlanRequestSchema>;

export type PlanSummary = {
  id: string;
  traineeId: string;
  traineeName: string;
  coachId: string;
  coachName: string | null;
  name: string;
  status: PlanStatus;
  startDate: string;
  weeks: number | null;
  /** The version the trainee sees; null for a draft. */
  liveVersion: number | null;
  /** The working copy's version; higher than liveVersion means unpublished changes. */
  version: number;
  updatedAt: string;
};
export type PlanDetail = PlanSummary & {
  content: PlanContent;
  lastChange: PlanChange | null;
  /** Whether Publish works now (it waits for the trainee app, TCR-003, C-D22). */
  canPublish: boolean;
};
export type PlanChange = {
  id: string;
  action: 'created' | 'edited' | 'published' | 'ended' | 'restored' | 'reverted';
  version: number;
  actorId: string;
  actorName: string | null;
  actorRole: 'head_coach' | 'coach';
  summary: string | null;
  at: string;
};
export type PlanListResponse = { plans: PlanSummary[]; coaches: { id: string; name: string | null }[] };
export type PlanHistoryResponse = { changes: PlanChange[]; publishedVersions: number[] };
