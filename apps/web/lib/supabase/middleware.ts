import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getPublicEnv } from '@/lib/env';

/**
 * Refreshes the Supabase session on every matched request and returns a response
 * carrying the rotated auth cookies.
 *
 * Server Components cannot write cookies, so without this the access token would
 * expire and users would be silently signed out mid-session.
 */
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  /*
   * getUser() revalidates the token against the auth server. Do not substitute
   * getSession() here: it trusts the cookie without verification, which is unsafe
   * for anything that gates access.
   */
  await supabase.auth.getUser();

  return response;
}
