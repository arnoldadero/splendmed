import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
   * Run on everything except static assets and image files. Brand assets under
   * /brand are static and need no session work.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
