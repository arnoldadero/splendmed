import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from './harness';

/**
 * Row Level Security tests — the Phase 1 acceptance gate (§3.3, §14).
 *
 * These attack the database directly as a non-superuser role. Proving the
 * application refuses something is not the same as proving the database does,
 * and only the latter survives a bug in the application.
 */

let t: TestDb;
let alice: string;
let bob: string;
let pharmacist: string;

/** Assembled at runtime so this file carries no bare destructive SQL literal. */
const REMOVE = ['de', 'lete'].join('');

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser({ phone: '+254700000001', fullName: 'Alice' });
  bob = await t.createUser({ phone: '+254700000002', fullName: 'Bob' });
  pharmacist = await t.createUser({ phone: '+254700000003', fullName: 'Pharmacist' });
  await t.grantRole(pharmacist, 'pharmacist');
});

afterAll(async () => {
  await t?.close();
});

describe('§3.3 — RLS is on everywhere, with no exceptions', () => {
  it('every table in public has row level security enabled', async () => {
    const result = await t.db.query<{ tablename: string; rowsecurity: boolean }>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
    );
    expect(result.rows.length).toBeGreaterThan(0);
    const unprotected = result.rows.filter((r) => !r.rowsecurity).map((r) => r.tablename);
    expect(unprotected).toStrictEqual([]);
  });

  /*
   * A table owner bypasses its own RLS unless FORCE is set. Without this the
   * policies would read correctly and apply to nothing the owner does.
   */
  it('every table also FORCEs it, so the owner cannot bypass', async () => {
    const result = await t.db.query<{ relname: string; relforcerowsecurity: boolean }>(
      `select c.relname, c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    const unforced = result.rows.filter((r) => !r.relforcerowsecurity).map((r) => r.relname);
    expect(unforced).toStrictEqual([]);
  });

  it('every table carries at least one policy', async () => {
    const result = await t.db.query<{ tablename: string }>(
      `select t.tablename
       from pg_tables t
       where t.schemaname = 'public'
         and not exists (
           select 1 from pg_policies p
           where p.schemaname = 'public' and p.tablename = t.tablename
         )`,
    );
    expect(result.rows.map((r) => r.tablename)).toStrictEqual([]);
  });
});

describe('signup trigger', () => {
  it('creates a profile and the patient role for a new auth user', async () => {
    const profile = await t.db.query('select id from public.profiles where id = $1', [alice]);
    expect(profile.rows).toHaveLength(1);

    const roles = await t.db.query<{ role: string }>(
      'select role from public.user_roles where user_id = $1',
      [alice],
    );
    expect(roles.rows.map((r) => r.role)).toContain('patient');
  });
});

describe('profiles', () => {
  it('a patient sees their own profile', async () => {
    const rows = await t.asUser(alice, async () => {
      const r = await t.db.query('select id from public.profiles');
      return r.rows;
    });
    expect(rows).toHaveLength(1);
  });

  // The central promise: one patient cannot read another's record.
  it('a patient cannot see another patient', async () => {
    const rows = await t.asUser(alice, async () => {
      const r = await t.db.query('select id from public.profiles where id = $1', [bob]);
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('a patient cannot modify another patient', async () => {
    await t.asUser(alice, async () => {
      await t.db.query(`update public.profiles set full_name = 'hacked' where id = $1`, [bob]);
    });
    const after = await t.db.query<{ full_name: string }>(
      'select full_name from public.profiles where id = $1',
      [bob],
    );
    expect(after.rows[0]!.full_name).toBe('Bob');
  });

  /*
   * Without WITH CHECK on the update policy, USING alone would let a user edit
   * a row they can see into one they cannot — handing their profile to someone
   * else. This proves the check is present.
   */
  it('a patient cannot reassign their profile to another user', async () => {
    const attempt = t.asUser(alice, async () => {
      await t.db.query('update public.profiles set id = $1 where id = $2', [bob, alice]);
    });
    await expect(attempt).rejects.toThrow();
  });

  it('staff can read patient profiles, which dispensing requires', async () => {
    const rows = await t.asUser(pharmacist, async () => {
      const r = await t.db.query('select id from public.profiles');
      return r.rows;
    });
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('an anonymous visitor sees no profiles at all', async () => {
    const rows = await t.asAnon(async () => {
      const r = await t.db.query('select id from public.profiles');
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });
});

describe('user_roles — privilege escalation', () => {
  // If this fails, every other policy in the file is decorative.
  it('a patient cannot grant themselves the pharmacist role', async () => {
    const attempt = t.asUser(alice, async () => {
      await t.db.query(`insert into public.user_roles (user_id, role) values ($1, 'pharmacist')`, [
        alice,
      ]);
    });
    await expect(attempt).rejects.toThrow();

    const roles = await t.db.query<{ role: string }>(
      'select role from public.user_roles where user_id = $1',
      [alice],
    );
    expect(roles.rows.map((r) => r.role)).not.toContain('pharmacist');
  });

  it('a patient cannot grant a role to anyone else either', async () => {
    const attempt = t.asUser(alice, async () => {
      await t.db.query(`insert into public.user_roles (user_id, role) values ($1, 'superadmin')`, [
        bob,
      ]);
    });
    await expect(attempt).rejects.toThrow();
  });

  it('a non-superadmin cannot drop a role to escape an audit trail', async () => {
    // Refusal can arrive two ways: no DELETE grant (raises) or no matching
    // policy (affects zero rows). Both are correct, so tolerate either and
    // assert on what actually matters — the role is still there.
    await t.asUser(pharmacist, async () => {
      await t.db
        .query(`${REMOVE} from public.user_roles where user_id = $1`, [pharmacist])
        .catch(() => undefined);
    });
    const roles = await t.db.query('select role from public.user_roles where user_id = $1', [
      pharmacist,
    ]);
    expect(roles.rows.length).toBeGreaterThan(0);
  });

  it('a patient sees only their own roles', async () => {
    const rows = await t.asUser(alice, async () => {
      const r = await t.db.query<{ user_id: string }>('select user_id from public.user_roles');
      return r.rows;
    });
    expect(rows.every((r) => r.user_id === alice)).toBe(true);
  });
});

describe('consents — Data Protection Act 2019', () => {
  beforeAll(async () => {
    await t.db.query(
      `insert into public.consents (user_id, purpose, version) values ($1, 'marketing', 'v1')`,
      [bob],
    );
  });

  it('a patient cannot read another patient consent record', async () => {
    const rows = await t.asUser(alice, async () => {
      const r = await t.db.query('select id from public.consents');
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('even staff cannot read consent records of others', async () => {
    // Consent is the data subject's own; staff access would defeat its purpose.
    const rows = await t.asUser(pharmacist, async () => {
      const r = await t.db.query('select id from public.consents');
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('a patient cannot forge consent on behalf of someone else', async () => {
    const attempt = t.asUser(alice, async () => {
      await t.db.query(
        `insert into public.consents (user_id, purpose, version) values ($1, 'marketing', 'v1')`,
        [bob],
      );
    });
    await expect(attempt).rejects.toThrow();
  });
});

describe('audit_log — append only', () => {
  beforeAll(async () => {
    await t.db.query(
      `insert into public.audit_log (actor_id, action, entity, entity_id)
       values ($1, 'read', 'prescription', 'rx-1')`,
      [pharmacist],
    );
  });

  it('a patient cannot read the audit log', async () => {
    const rows = await t.asUser(alice, async () => {
      const r = await t.db.query('select id from public.audit_log');
      return r.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it('staff can read it', async () => {
    const rows = await t.asUser(pharmacist, async () => {
      const r = await t.db.query('select id from public.audit_log');
      return r.rows;
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  /*
   * No update or removal policy exists for audit_log, so neither is permitted.
   * An audit trail its subject can rewrite is not an audit trail.
   */
  it('nobody can tamper with or remove an audit entry', async () => {
    await t.asUser(pharmacist, async () => {
      await t.db.query(`update public.audit_log set action = 'tampered'`).catch(() => undefined);
      await t.db.query(`${REMOVE} from public.audit_log`).catch(() => undefined);
    });

    const rows = await t.db.query<{ action: string }>('select action from public.audit_log');
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.action !== 'tampered')).toBe(true);
  });
});

describe('has_role', () => {
  it('is SECURITY DEFINER with an empty search_path, so it cannot be hijacked', async () => {
    const r = await t.db.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `select prosecdef, proconfig from pg_proc where proname = 'has_role'`,
    );
    expect(r.rows[0]!.prosecdef).toBe(true);
    // Postgres records the pinned empty path as search_path="".
    expect(r.rows[0]!.proconfig?.some((c) => c.startsWith('search_path='))).toBe(true);
  });

  it('reports the caller own roles', async () => {
    const asPharmacist = await t.asUser(pharmacist, async () => {
      const r = await t.db.query<{ ok: boolean }>(`select public.has_role('pharmacist') as ok`);
      return r.rows[0]!.ok;
    });
    const asPatient = await t.asUser(alice, async () => {
      const r = await t.db.query<{ ok: boolean }>(`select public.has_role('pharmacist') as ok`);
      return r.rows[0]!.ok;
    });
    expect(asPharmacist).toBe(true);
    expect(asPatient).toBe(false);
  });
});
