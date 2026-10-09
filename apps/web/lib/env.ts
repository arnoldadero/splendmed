import { z } from 'zod';

/*
 * Env validation at the trust boundary (§4).
 *
 * Only NEXT_PUBLIC_* values belong here — this module is importable from client
 * components. Server-only secrets (the service-role key, M-Pesa credentials, PSP
 * keys) must never be read through this file; §3.4 forbids them reaching a bundle.
 *
 * Validation is deliberately lazy. Doing it at module scope would make a missing
 * variable a *build* failure, because middleware is compiled at build time — so a
 * CI build would require production Supabase credentials just to typecheck. Lazy
 * validation keeps the build hermetic while still failing loudly, with an
 * actionable message, the first time something actually tries to reach Supabase.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      'Invalid public environment configuration. Copy apps/web/.env.example to ' +
        'apps/web/.env.local and fill it in (run "pnpm supabase start" for local values).\n' +
        z.prettifyError(parsed.error),
    );
  }

  cached = parsed.data;
  return cached;
}
