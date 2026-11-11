// Gym onboarding with FitSphere's approval code (CF02, coach-scope §4, ADR-0004, ADR-0005).
//
// A person without a Coach or Head Coach role sends a gym request; the server emails a one-time
// code to FitSphere's approval inbox; the person enters the code FitSphere gives them and becomes
// the Head Coach of that gym for good. Everything is decided here, on the server (invariant 1).
//
// Rules kept here:
// - one gym per email: a Head Coach or a Coach cannot send a request (C-D25);
// - at most one Pending request per person; a new one replaces it;
// - the code is stored only as a keyed hash, never returned and never logged (invariant 11);
// - wrong tries are counted on the server and lock the request at the limit;
// - expiry is worked out when the request is read, so no background job is needed;
// - requests per person per day are counted by the India date (invariant 4); a request whose email
//   could not be sent does not count;
// - approving is one transaction: the request, the gym and the head_coach role succeed together.
import { randomUUID } from 'node:crypto';
import type { CodeResult, GymRequestParsed, OnboardingStatus } from '@fitsphere-coach/shared';
import type pg from 'pg';
import type { Account } from './accounts.ts';
import { codeMatches, generateCode, hashCode } from './approvalCode.ts';
import { ApiError } from './errors.ts';
import { approvalEmail, type Mailer } from './mailer.ts';
import type { Settings } from './settings.ts';

export type OnboardingDeps = { settings: Settings; mailer: Mailer; now?: () => Date };

type Queryable = Pick<pg.Pool, 'query'>;
const DAY_MS = 24 * 60 * 60 * 1000;

function nowOf(deps: OnboardingDeps): Date {
  return deps.now ? deps.now() : new Date();
}

/** The server refuses a gym request from a Head Coach or a Coach, whatever the app shows (C-D25). */
function assertMayOnboard(account: Account): void {
  if (account.roles.includes('head_coach')) throw new ApiError('ALREADY_HEAD_COACH');
  if (account.roles.includes('coach')) throw new ApiError('ALREADY_COACH');
}

async function requestsSentToday(db: Queryable, userId: string, now: Date): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n
     from coach.gym_onboarding_requests
     where applicant_id = $1
       and status <> 'not_sent'
       and (created_at at time zone 'Asia/Kolkata')::date = ($2::timestamptz at time zone 'Asia/Kolkata')::date`,
    [userId, now],
  );
  return rows[0]?.n ?? 0;
}

/** Where this account is in onboarding (`GET /v1/gym/onboarding`, coach-scope §4.2a). */
export async function readOnboarding(db: Queryable, account: Account, deps: OnboardingDeps): Promise<OnboardingStatus> {
  const now = nowOf(deps);
  const codeLength = deps.settings.approvalCodeLength;
  if (account.roles.includes('head_coach')) {
    const { rows } = await db.query<{ name: string }>('select name from coach.gyms where head_coach_id = $1', [account.id]);
    return { status: 'approved', expiresAt: null, triesLeft: null, requestsLeftToday: 0, codeLength, gymName: rows[0]?.name ?? null };
  }
  if (account.roles.includes('coach')) {
    return { status: 'approved', expiresAt: null, triesLeft: null, requestsLeftToday: 0, codeLength, gymName: null };
  }

  const { rows } = await db.query<{ status: string; expires_at: Date; wrong_tries: number }>(
    `select status, expires_at, wrong_tries
     from coach.gym_onboarding_requests
     where applicant_id = $1 and status in ('pending', 'locked', 'expired')
     order by created_at desc limit 1`,
    [account.id],
  );
  const latest = rows[0];
  const left = Math.max(0, deps.settings.gymRequestsPerDay - (await requestsSentToday(db, account.id, now)));
  const idle = { expiresAt: null, triesLeft: null, requestsLeftToday: left, codeLength, gymName: null };
  if (!latest) return { status: 'none', ...idle };
  if (latest.status === 'locked') return { status: 'locked', ...idle };
  if (latest.status === 'expired' || latest.expires_at.getTime() <= now.getTime()) return { status: 'expired', ...idle };
  return {
    status: 'pending',
    expiresAt: latest.expires_at.toISOString(),
    triesLeft: Math.max(0, deps.settings.approvalWrongTries - latest.wrong_tries),
    requestsLeftToday: left,
    codeLength,
    gymName: null,
  };
}

/**
 * Saves the request, emails the code to the approval inbox and returns the new status.
 * The email is sent before the request is committed: if the send fails, nothing changes for the
 * person (their earlier Pending request stays valid), a "Not sent" record is kept, and the
 * attempt does not count toward the daily limit (ADR-0004).
 */
export async function submitGymRequest(
  db: pg.Pool,
  account: Account,
  input: GymRequestParsed,
  deps: OnboardingDeps,
  log: { warn(fields: object, message: string): void },
): Promise<OnboardingStatus> {
  assertMayOnboard(account);
  const { settings } = deps;
  const now = nowOf(deps);
  const id = randomUUID();
  const code = generateCode(settings.approvalCodeLength);
  const codeHash = hashCode(settings.approvalCodeSecret, id, code);
  const expiresAt = new Date(now.getTime() + settings.gymRequestValidDays * DAY_MS);
  const extraFields = input.websiteOrInstagram ? { website_or_instagram: input.websiteOrInstagram } : {};

  const insert = (client: pg.PoolClient, status: 'pending' | 'not_sent') =>
    client.query(
      `insert into coach.gym_onboarding_requests
         (id, applicant_id, gym_name, address, city, pincode, owner_phone, total_trainees, extra_fields,
          status, code_hash, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        account.id,
        input.gymName,
        input.address,
        input.city,
        input.pincode,
        input.ownerPhone,
        input.totalTrainees,
        JSON.stringify(extraFields),
        status,
        codeHash,
        now,
        expiresAt,
      ],
    );

  const client = await db.connect();
  let open = false;
  try {
    await client.query('begin');
    open = true;
    // One request at a time per person, so the daily limit and "one Pending" cannot be raced.
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`gym-onboarding:${account.id}`]);
    if ((await requestsSentToday(client, account.id, now)) >= settings.gymRequestsPerDay) {
      throw new ApiError('REQUEST_LIMIT_REACHED');
    }
    await client.query(`update coach.gym_onboarding_requests set status = 'replaced' where applicant_id = $1 and status = 'pending'`, [
      account.id,
    ]);
    await insert(client, 'pending');
    try {
      await deps.mailer.send(
        approvalEmail(settings, {
          code,
          gymName: input.gymName,
          address: input.address,
          city: input.city,
          pincode: input.pincode,
          ownerPhone: input.ownerPhone,
          totalTrainees: input.totalTrainees,
          websiteOrInstagram: input.websiteOrInstagram ?? null,
          applicantName: account.fullName,
          applicantEmail: account.email,
          requestedAt: now,
          expiresAt,
        }),
      );
    } catch {
      // Not sent: keep the earlier request, keep a record, do not count it (never log the error:
      // its text can hold the sender's details).
      await client.query('rollback');
      open = false;
      await insert(client, 'not_sent').catch(() => undefined);
      log.warn({ event: 'gym_request_not_sent', userId: account.id }, 'approval email not sent');
      throw new ApiError('APPROVAL_EMAIL_FAILED');
    }
    await client.query('commit');
    open = false;
  } catch (error) {
    if (open) await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return readOnboarding(db, account, deps);
}

/**
 * Checks the code the person typed. A wrong code is counted; the request locks when the limit is
 * reached. A correct code within the validity approves the gym and makes the person Head Coach, in
 * one transaction.
 */
export async function verifyApprovalCode(db: pg.Pool, account: Account, code: string, deps: OnboardingDeps): Promise<CodeResult> {
  assertMayOnboard(account);
  const { settings } = deps;
  if (code.length !== settings.approvalCodeLength) {
    throw new ApiError('VALIDATION_FAILED', [{ field: 'code', issue: 'invalid_format' }]);
  }
  const now = nowOf(deps);
  const outcome = (result: CodeResult['result'], triesLeft: number | null = null, gymName: string | null = null): CodeResult => ({
    result,
    triesLeft,
    gymName,
  });

  const client = await db.connect();
  let open = false;
  try {
    await client.query('begin');
    open = true;
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`gym-onboarding:${account.id}`]);

    const { rows } = await client.query<{
      id: string;
      gym_name: string;
      address: string;
      city: string;
      pincode: string;
      owner_phone: string;
      total_trainees: number;
      extra_fields: object;
      code_hash: string;
      wrong_tries: number;
      expires_at: Date;
    }>(
      `select id, gym_name, address, city, pincode, owner_phone, total_trainees, extra_fields, code_hash, wrong_tries, expires_at
       from coach.gym_onboarding_requests
       where applicant_id = $1 and status = 'pending'
       order by created_at desc limit 1
       for update`,
      [account.id],
    );
    const request = rows[0];
    if (!request) {
      const { rows: earlier } = await client.query<{ status: string }>(
        `select status from coach.gym_onboarding_requests
         where applicant_id = $1 and status in ('locked', 'expired')
         order by created_at desc limit 1`,
        [account.id],
      );
      await client.query('commit');
      open = false;
      const status = earlier[0]?.status;
      return outcome(status === 'locked' ? 'locked' : status === 'expired' ? 'expired' : 'none');
    }

    const setStatus = (status: 'expired' | 'locked') =>
      client.query('update coach.gym_onboarding_requests set status = $2 where id = $1', [request.id, status]);

    if (request.expires_at.getTime() <= now.getTime()) {
      await setStatus('expired');
      await client.query('commit');
      open = false;
      return outcome('expired');
    }
    if (request.wrong_tries >= settings.approvalWrongTries) {
      await setStatus('locked');
      await client.query('commit');
      open = false;
      return outcome('locked');
    }

    if (!codeMatches(settings.approvalCodeSecret, request.id, code, request.code_hash)) {
      const tries = request.wrong_tries + 1;
      await client.query('update coach.gym_onboarding_requests set wrong_tries = $2 where id = $1', [request.id, tries]);
      if (tries >= settings.approvalWrongTries) await setStatus('locked');
      await client.query('commit');
      open = false;
      return tries >= settings.approvalWrongTries ? outcome('locked') : outcome('wrong', settings.approvalWrongTries - tries);
    }

    // The right code: the request, the gym and the role succeed together or not at all.
    await client.query(`update coach.gym_onboarding_requests set status = 'approved', approved_at = $2 where id = $1`, [request.id, now]);
    await client.query(
      `insert into coach.gyms (head_coach_id, request_id, name, address, city, pincode, owner_phone, total_trainees, extra_fields, approved_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        account.id,
        request.id,
        request.gym_name,
        request.address,
        request.city,
        request.pincode,
        request.owner_phone,
        request.total_trainees,
        JSON.stringify(request.extra_fields),
        now,
      ],
    );
    await client.query(`insert into app.user_roles (user_id, role) values ($1, 'head_coach') on conflict do nothing`, [account.id]);
    await client.query('commit');
    open = false;
    return outcome('approved', null, request.gym_name);
  } catch (error) {
    if (open) await client.query('rollback').catch(() => undefined);
    // A second gym for the same person (unique head_coach_id): one gym per email (C-D25).
    if ((error as { code?: unknown }).code === '23505') throw new ApiError('ALREADY_HEAD_COACH');
    throw error;
  } finally {
    client.release();
  }
}
