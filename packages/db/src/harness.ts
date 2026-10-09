import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/**
 * A real Postgres to test RLS against, without Docker.
 *
 * PGlite is Postgres compiled to WebAssembly, so policies, triggers and
 * SECURITY DEFINER functions behave as they do in production. This exists
 * because Docker on the build machine cannot pull images, and shipping
 * *untested* row-level security would be shipping untested authorisation.
 *
 * What it is not: Supabase. GoTrue, Storage and Realtime are absent, and the
 * auth schema below is a stub covering only what the migrations touch. These
 * tests prove the policy logic, not the platform integration — run them again
 * against a real Supabase instance before trusting them with real data.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), '..', '..', 'supabase', 'migrations');

/**
 * Minimal stand-in for Supabase's auth schema.
 *
 * auth.uid() normally reads the JWT claim. Here it reads a session GUC the test
 * sets, which is the same mechanism with a simpler source — the policies under
 * test cannot tell the difference.
 */
const AUTH_STUB = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id                  uuid primary key default gen_random_uuid(),
    email               text unique,
    phone               text unique,
    raw_user_meta_data  jsonb not null default '{}'::jsonb,
    created_at          timestamptz not null default now()
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('test.current_user_id', true), '')::uuid;
  $$;
`;

/**
 * Roles mirroring Supabase's. `authenticated` is deliberately NOBYPASSRLS and
 * not the table owner: a superuser or owner silently bypasses RLS, so tests run
 * as that role would pass no matter how wrong the policies were.
 */
const ROLES = `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin nobypassrls;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin nobypassrls;
    end if;
  end $$;

  grant usage on schema public, auth to authenticated, anon;
`;

const GRANTS = `
  grant select, insert, update on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant usage, select on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated, anon;
  grant select, insert on auth.users to authenticated;
`;

export interface TestDb {
  readonly db: PGlite;
  /** Runs `fn` as the given user id, under the `authenticated` role. */
  asUser<T>(userId: string, fn: () => Promise<T>): Promise<T>;
  /** Runs `fn` as an anonymous visitor. */
  asAnon<T>(fn: () => Promise<T>): Promise<T>;
  /** Creates an auth user, returning its id. Runs with owner rights. */
  createUser(opts?: { phone?: string; fullName?: string }): Promise<string>;
  /** Grants a role, bypassing the superadmin-only policy. Owner rights. */
  grantRole(userId: string, role: string): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create();

  await db.exec(AUTH_STUB);
  await db.exec(ROLES);

  // Apply real migrations in filename order — the same order Supabase uses.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }
  for (const file of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }

  await db.exec(GRANTS);

  /*
   * Session-level, not transaction-local. PGlite autocommits each statement, so
   * `SET LOCAL` and set_config(..., is_local => true) are discarded the instant
   * they are issued — the role switch silently never happens and every policy
   * appears to pass because the superuser owner is still running the query.
   */
  async function withRole<T>(role: string, userId: string | null, fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role ${role};`);
    await db.query('select set_config($1, $2, false)', ['test.current_user_id', userId ?? '']);
    try {
      return await fn();
    } finally {
      await db.exec('reset role;');
      await db.query('select set_config($1, $2, false)', ['test.current_user_id', '']);
    }
  }

  return {
    db,
    asUser: (userId, fn) => withRole('authenticated', userId, fn),
    asAnon: (fn) => withRole('anon', null, fn),

    async createUser(opts = {}) {
      const result = await db.query<{ id: string }>(
        `insert into auth.users (phone, raw_user_meta_data)
         values ($1, jsonb_build_object('full_name', $2::text))
         returning id`,
        [opts.phone ?? null, opts.fullName ?? null],
      );
      return result.rows[0]!.id;
    },

    async grantRole(userId, role) {
      await db.query(
        `insert into public.user_roles (user_id, role) values ($1, $2::public.app_role)
         on conflict do nothing`,
        [userId, role],
      );
    },

    close: () => db.close(),
  };
}
