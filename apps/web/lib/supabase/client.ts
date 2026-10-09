import { createBrowserClient } from '@supabase/ssr';

import { getPublicEnv } from '@/lib/env';

/**
 * Browser Supabase client. Carries the anon key only, so every query it makes is
 * subject to Row Level Security (§3.3). Use it for realtime subscriptions and
 * client-side reads; all writes go through Server Actions.
 */
export function createClient() {
  const env = getPublicEnv();

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
