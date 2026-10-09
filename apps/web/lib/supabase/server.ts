import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { getPublicEnv } from '@/lib/env';

/**
 * Server Supabase client, scoped to the signed-in user's cookies.
 *
 * This is the default client for Server Components and Server Actions. It uses the
 * anon key, so RLS still applies — authorisation is enforced by the database, not
 * by this code (§3.3).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /*
             * Deliberate no-op, not a swallowed error.
             *
             * Server Components cannot mutate cookies; Next.js throws here by
             * design. Session refresh is handled by middleware.ts instead, so
             * there is nothing to recover from and nothing to report. If
             * middleware were removed, sessions would fail to refresh — which is
             * why the middleware matcher below is part of this contract.
             */
          }
        },
      },
    },
  );
}
