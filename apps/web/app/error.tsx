'use client';

import { useEffect } from 'react';

/**
 * Error boundary.
 *
 * Shows a calm, branded page instead of Next's default. The message is
 * deliberately generic: §3.5 forbids leaking anything from a failure into the
 * UI, and an error on a page listing a patient's medicine could otherwise
 * disclose more than intended.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging already captured this; the digest is the join key.
    console.error('Unhandled error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-4 text-muted-foreground">
        That is on us, not you. Try again, and if it keeps happening call the Kisumu CBD branch
        and we will sort it out directly.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-muted-foreground">
          Reference: <code>{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
