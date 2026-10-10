'use client';

import { useEffect, useState } from 'react';

/**
 * Prescription image handling for the demo.
 *
 * The image is far too large for the 4KB cookie that carries the order, so it
 * stays in localStorage on the presenter's browser. Phase 4 replaces this
 * entirely: a signed upload straight to Supabase Storage, so the file never
 * passes through the application server, which is what §3.5 requires for PHI.
 *
 * Flow: checkout writes it under a pending key, the order confirmation re-keys
 * it to the order id, and the review screen reads it back.
 */

const PENDING = 'splendmed_pending_rx';
const keyFor = (orderId: string) => `splendmed_rx_${orderId}`;

/** Wrapped because localStorage throws in private mode and some embedded views. */
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Quota or blocked storage: the order still works, only the image is lost. */
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Nothing to recover from. */
  }
}

export function storePendingRx(dataUrl: string): void {
  safeSet(PENDING, dataUrl);
}

/** Moves the pending image onto the order once its id exists. */
export function AdoptPendingRx({ orderId }: { orderId: string }) {
  useEffect(() => {
    const pending = safeGet(PENDING);
    if (!pending) return;
    safeSet(keyFor(orderId), pending);
    safeRemove(PENDING);
  }, [orderId]);

  return null;
}

/** Renders the prescription on the review screen. */
export function RxImage({ orderId }: { orderId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSrc(safeGet(keyFor(orderId)));
    setChecked(true);
  }, [orderId]);

  if (!checked) {
    return <p className="mt-2 rounded-lg border border-border p-6 text-muted-foreground">Loading…</p>;
  }

  if (!src) {
    return (
      <p className="mt-2 rounded-lg border border-border p-6 text-sm text-muted-foreground">
        The image is not on this device. In the demo it is held in the browser that placed the
        order, so review it from that same browser. Phase 4 stores it server-side behind a signed
        URL, where any authorised pharmacist can open it.
      </p>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Prescription submitted by the patient"
      className="mt-2 w-full rounded-lg border border-border object-contain"
      data-testid="rx-image"
    />
  );
}
