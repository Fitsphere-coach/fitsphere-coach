import pg from 'pg';
import { buildApp } from './app.ts';
import { createSupabaseAuth } from './auth.ts';

// Settings from apps/api/.env (runbook, "Configuration names").
const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing in apps/api/.env: ${missing.join(', ')}`);
  process.exit(1);
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
// An idle connection that drops (e.g. the Supabase project pauses) must not stop the API.
db.on('error', () => {});

const app = buildApp({
  db,
  auth: createSupabaseAuth({
    supabaseUrl: process.env.SUPABASE_URL!,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY!,
  }),
  log: { level: process.env.LOG_LEVEL ?? 'info' },
});

// Port 3100 by default, so the trainee API (3000) and this one can run on one PC. Loopback only,
// unless HOST is set for testing on a phone on the same Wi-Fi (runbook §4).
const port = Number(process.env.PORT ?? '3100');
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port });
