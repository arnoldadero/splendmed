'use client';

import { useState, useTransition } from 'react';

import { placeOrder } from '@/lib/actions/orders';

/**
 * Checkout form.
 *
 * Client-side because the prescription image is read into a data URL in the
 * browser. Phase 4 replaces that with a signed upload straight to Supabase
 * Storage, so the file never passes through the application server at all —
 * which is what §3.5 wants for PHI. This is the demo stand-in.
 */
export function CheckoutForm({ requiresPrescription }: { requiresPrescription: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // 6MB ceiling: a phone photo is comfortably under it, and anything larger
    // is a scan that should be compressed before upload.
    if (file.size > 6 * 1024 * 1024) {
      setError('That image is larger than 6MB. Please take a smaller photo.');
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <form
      className="mt-8 space-y-5"
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          if (preview) {
            formData.set('prescriptionImage', preview);
            formData.set('prescriptionFileName', fileName ?? 'prescription');
          }
          const result = await placeOrder(formData);
          // A successful placement redirects, so anything returned is a failure.
          if (result && !result.ok) setError(result.error);
        })
      }
    >
      <div>
        <label htmlFor="customerName" className="block text-sm font-semibold">
          Your name
        </label>
        <input
          id="customerName"
          name="customerName"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="customerPhone" className="block text-sm font-semibold">
          Mobile number
        </label>
        <input
          id="customerPhone"
          name="customerPhone"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712345678"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          We will send order updates here. M-Pesa payment arrives in Phase 5.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">How would you like it?</legend>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="fulfilment" value="delivery" defaultChecked />
            Delivery in Kisumu — KES 200
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="fulfilment" value="pickup" />
            Collect at Kisumu CBD — free
          </label>
        </div>
      </fieldset>

      {requiresPrescription && (
        <div className="rounded-lg border border-brand-teal bg-brand-teal/5 p-4">
          <label htmlFor="rx" className="block font-semibold text-brand-deep">
            Upload your prescription
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Your cart contains prescription medicine. Photograph the whole prescription, including
            the prescriber&apos;s name and stamp. A registered pharmacist will check it before
            anything is dispensed.
          </p>
          <input
            id="rx"
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={onFile}
            className="mt-3 block w-full text-sm"
          />
          {preview && (
            <div className="mt-3">
              <p className="text-xs font-medium text-brand-deep">Attached: {fileName}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview of the prescription you selected"
                className="mt-2 max-h-48 rounded border border-border object-contain"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm font-medium">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="place-order"
        className="w-full rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? 'Placing your order…' : 'Place order'}
      </button>

      <p className="text-xs text-muted-foreground">
        No payment is taken at this step. We will confirm your order and arrange payment on
        delivery or collection.
      </p>
    </form>
  );
}
