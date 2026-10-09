import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * getPublicEnv memoises, so each case re-imports the module with a fresh registry.
 * The point of these tests is the failure path: a misconfigured deployment must
 * fail with an actionable message rather than surfacing as an opaque auth error
 * several layers downstream (§12, no silent failures).
 */

const ORIGINAL = { ...process.env };

async function freshEnvModule() {
  vi.resetModules();
  return import('./env');
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('getPublicEnv', () => {
  it('returns the parsed config when both values are present and valid', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-anon-key';

    const { getPublicEnv } = await freshEnvModule();

    expect(getPublicEnv()).toStrictEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefgh.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
    });
  });

  it('accepts a local Supabase URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-anon-key';

    const { getPublicEnv } = await freshEnvModule();

    expect(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
  });

  it('throws when configuration is missing entirely', async () => {
    const { getPublicEnv } = await freshEnvModule();
    expect(() => getPublicEnv()).toThrow(/Invalid public environment configuration/);
  });

  it('names the offending variable so the message is actionable', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-anon-key';

    const { getPublicEnv } = await freshEnvModule();
    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('rejects an empty anon key rather than passing it to the client', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

    const { getPublicEnv } = await freshEnvModule();
    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('points the developer at the env template', async () => {
    const { getPublicEnv } = await freshEnvModule();
    expect(() => getPublicEnv()).toThrow(/\.env\.example/);
  });

  it('memoises so repeated reads do not re-parse', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefgh.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'local-anon-key';

    const { getPublicEnv } = await freshEnvModule();
    expect(getPublicEnv()).toBe(getPublicEnv());
  });
});
