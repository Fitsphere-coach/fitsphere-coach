import { describe, expect, it } from 'vitest';
import { EXERCISES, planContentSchema, planIsReady, templateRequestSchema } from './workouts.ts';

const exercise = { exerciseId: 'plank', group: null, sets: 3, repsMin: 30, repsMax: 45, weightG: null, rpe: null, restS: 60, note: '' };
const day = (over: object = {}) => ({ name: 'Core', weekday: 1, rest: false, exercises: [exercise], ...over });
const content = (over: object = {}) => ({ weeks: null, scheduleMode: 'weekdays', weeklyTarget: null, dailyTarget: false, days: [day()], ...over });

describe('exercises', () => {
  it('has the ten fixed exercises with unique ids', () => {
    expect(EXERCISES).toHaveLength(10);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(10);
  });
});

describe('plan content', () => {
  it('accepts weekday and rotating schedules', () => {
    expect(planContentSchema.safeParse(content()).success).toBe(true);
    expect(planContentSchema.safeParse(content({ scheduleMode: 'rotating', days: [day({ weekday: null })] })).success).toBe(true);
  });
  it.each([
    ['a rest day with exercises', content({ days: [day({ rest: true })] })],
    ['a repeated weekday', content({ days: [day(), day()] })],
    ['a weekday when rotating', content({ scheduleMode: 'rotating' })],
    ['no weekday when pinned', content({ days: [day({ weekday: null })] })],
    ['no days', content({ days: [] })],
    ['reps range reversed', content({ days: [day({ exercises: [{ ...exercise, repsMin: 9, repsMax: 5 }] })] })],
    ['rest under 15 seconds', content({ days: [day({ exercises: [{ ...exercise, restS: 5 }] })] })],
    ['an unknown field', content({ extra: 1 })],
  ])('refuses %s', (_name, input) => {
    expect(planContentSchema.safeParse(input).success).toBe(false);
  });
  it('is ready only with a training day that has exercises', () => {
    expect(planIsReady(planContentSchema.parse(content()))).toBe(true);
    expect(planIsReady(planContentSchema.parse(content({ days: [day({ exercises: [] })] })))).toBe(false);
    expect(planIsReady(planContentSchema.parse(content({ days: [day({ rest: true, exercises: [] })] })))).toBe(false);
  });
  it('trims and requires a template name', () => {
    const base = { goal: 'strength', difficulty: 'beginner', visibility: 'gym', content: content() };
    expect(templateRequestSchema.parse({ ...base, name: '  Starter ' }).name).toBe('Starter');
    expect(templateRequestSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
  });
});
