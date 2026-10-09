import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session and returns a response carrying the rotated
 * auth cookies. Server Components cannot write cookies, so without this an
 * access token would expire and sign the user out mid-session.
 *
 * Skips entirely when Supabase is not configured. No auth exists yet (Phase 1),
 * so there is no session to refresh, and attempting one would mean a failed
 * network call on every request to a public storefront that does not need it.
 * The storefront reads its catalogue from the Juleb port, not from Postgres.
 *
 * This is not a silent fallback: it warns once per process, and the moment the
 * variables are set the real refresh runs again.
 */

let warned = false;

function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export async function updateSession(request: NextRequest) {
  const config = supabaseConfig();

  if (!config) {
    if (!warned) {
      warned = true;
      console.warn(
        '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
          'Skipping session refresh. The storefront works without them; sign-in will not. ' +
          'Set both before Phase 1 (auth and RLS).',
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
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
  });

  /*
   * getUser() revalidates the token against the auth server. Do not substitute
   * getSession() here: it trusts the cookie without verification, which is
   * unsafe for anything that gates access.
   */
  await supabase.auth.getUser();

  return response;
}
