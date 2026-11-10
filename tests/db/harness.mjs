// A throwaway Postgres (PGlite: Postgres compiled to WASM, running inside Node) with just
// enough of Supabase stubbed in to replay supabase/migrations/*.sql and exercise the real
// policies, triggers and functions as different users.
//
// What's stubbed: the anon/authenticated/service_role roles with Supabase's default grants,
// auth.users + auth.uid()/auth.role(), the storage schema, and the supabase_realtime
// publication. Everything else is the project's own SQL, unmodified.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { postgis } from "@electric-sql/pglite-postgis";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema if not exists extensions;
  grant usage on schema public, extensions to anon, authenticated, service_role;

  -- Supabase grants these on everything created in public; RLS is what restricts rows.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  -- Who the current request is, as PostgREST sets it from the JWT.
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
  $$;
  grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (id text primary key, name text not null, public boolean default false);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  create publication supabase_realtime;
`;

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

// Apply one migration file the way the Supabase SQL Editor does: as a single transaction.
export async function applyMigration(db, file) {
  try {
    await db.exec(`begin;\n${readFileSync(join(MIGRATIONS_DIR, file), "utf8")}\ncommit;`);
  } catch (error) {
    await db.exec("rollback;").catch(() => {});
    throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
  }
}

// A fresh database with every migration applied (or only those up to and including the one
// whose filename starts with `upTo`, e.g. "0020").
export async function createDatabase({ upTo } = {}) {
  const db = await PGlite.create({ extensions: { postgis, pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  for (const file of migrationFiles()) {
    await applyMigration(db, file);
    if (upTo && file.startsWith(upTo)) break;
  }
  return db;
}

// Create a signed-up user the way Supabase Auth does: a row in auth.users (the project's
// trigger then creates the profile). Returns the user's id.
export async function createUser(db, { name, role = "both" }) {
  const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@test.local`;
  const { rows } = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify({ full_name: name, role })]
  );
  return rows[0].id;
}

// Run `fn` as a signed-in user making API requests: the authenticated role with their JWT
// subject, so RLS, grants and the guard triggers apply exactly as they do through PostgREST.
export async function asUser(db, userId, fn) {
  await db.exec(`
    select set_config('request.jwt.claim.sub', '${userId}', false);
    select set_config('request.jwt.claim.role', 'authenticated', false);
    set role authenticated;
  `);
  try {
    return await fn(db);
  } finally {
    await db.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `);
  }
}

// Run `fn` the way an Edge Function with the service-role key does.
export async function asService(db, fn) {
  await db.exec("set role service_role;");
  try {
    return await fn(db);
  } finally {
    await db.exec("reset role;");
  }
}

// Resolves to the error message if the query is refused, or null if it succeeds.
export async function refusal(run) {
  try {
    await run();
    return null;
  } catch (error) {
    return error.message;
  }
}

// ── Scenario helpers ─────────────────────────────────────────────────────────────────────

// Johannesburg-ish default so tasks land near each other unless a test says otherwise.
export const SANDTON = { lat: -26.1076, lng: 28.0567 };

export async function postTask(db, clientId, overrides = {}) {
  const task = {
    title: "Fix a leaking tap",
    description: "Kitchen tap drips constantly.",
    category: "Handyman",
    budget: 400,
    address: "12 Private Street, Sandton, Gauteng",
    area: "Sandton, Gauteng",
    ...SANDTON,
    ...overrides,
  };
  return asUser(db, clientId, async () => {
    const { rows } = await db.query(
      `insert into public.tasks (client_id, title, description, category, budget, location, address_text, area_text)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [clientId, task.title, task.description, task.category, task.budget,
        `SRID=4326;POINT(${task.lng} ${task.lat})`, task.address, task.area]
    );
    return rows[0].id;
  });
}

export async function placeBid(db, taskerId, taskId, amount = 350, message = null) {
  return asUser(db, taskerId, async () => {
    const { rows } = await db.query(
      "insert into public.bids (task_id, tasker_id, amount, message) values ($1, $2, $3, $4) returning id",
      [taskId, taskerId, amount, message]
    );
    return rows[0].id;
  });
}

export async function acceptBid(db, clientId, bidId) {
  return asUser(db, clientId, async () => {
    const { rows } = await db.query("select * from public.accept_bid($1)", [bidId]);
    return rows[0];
  });
}

// What paystack-verify / paystack-webhook do once Paystack confirms the money arrived.
export async function payForTask(db, taskId, amount = 350) {
  return asService(db, async () => {
    await db.query(
      `insert into public.payments (task_id, reference, amount, status) values ($1, $2, $3, 'succeeded')
       on conflict (task_id) do update set status = 'succeeded'`,
      [taskId, `task-${taskId}-test`, amount]
    );
    await db.query("update public.tasks set status = 'completed' where id = $1 and status <> 'completed'", [taskId]);
  });
}

// Read as the database owner, bypassing RLS: for asserting on the real stored state.
export async function one(db, sql, params = []) {
  const { rows } = await db.query(sql, params);
  return rows[0];
}
