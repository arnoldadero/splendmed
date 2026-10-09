import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatMoney } from '@splendmed/domain';

import { reviewPrescription } from '@/lib/actions/orders';
import { getOrder } from '@/lib/demo-store';

export const metadata = { title: 'Review prescription' };

/**
 * Prescription review screen.
 *
 * The prescription image sits beside the ordered items, because the decision is
 * whether the one justifies the other. The reviewer records the prescriber's
 * name and registration number: a prescription without a traceable prescriber
 * is not a prescription.
 */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order?.prescription) notFound();

  const rx = order.prescription;
  const controlled = order.lines.some((l) => l.isControlled);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/console" className="text-sm font-semibold text-brand-teal hover:underline">
        Back to queue
      </Link>

      <h1 className="mt-3 text-2xl font-bold">
        {order.orderNo} · {order.customerName}
      </h1>
      <p className="text-sm text-muted-foreground">
        {order.customerPhone} · placed {new Date(order.placedAt).toLocaleString('en-KE')}
      </p>

      {controlled && (
        <p className="mt-4 rounded-lg border border-destructive p-4 text-sm font-semibold">
          This order contains a controlled medicine. Confirm the prescriber and retain the record
          for the controlled drugs register before approving.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">Prescription</h2>
          {rx.imageDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={rx.imageDataUrl}
              alt="Prescription submitted by the patient"
              className="mt-2 w-full rounded-lg border border-border object-contain"
              data-testid="rx-image"
            />
          ) : (
            <p className="mt-2 rounded-lg border border-border p-6 text-muted-foreground">
              No image attached.
            </p>
          )}
        </div>

        <div>
          <h2 className="font-semibold">Items requested</h2>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {order.lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-3 p-3 text-sm">
                <span>
                  {line.name}
                  {line.strength ? ` ${line.strength}` : ''}
                  <span className="text-muted-foreground"> × {line.quantity}</span>
                  {line.isControlled ? (
                    <span className="ml-2 text-xs font-bold text-destructive">Controlled</span>
                  ) : line.requiresPrescription ? (
                    <span className="ml-2 text-xs font-semibold text-brand-teal">Rx</span>
                  ) : null}
                </span>
                <span>
                  {formatMoney({
                    minor: line.unitPrice.minor * line.quantity,
                    currency: line.unitPrice.currency,
                  })}
                </span>
              </li>
            ))}
          </ul>

          <form action={reviewPrescription} className="mt-6 space-y-4">
            <input type="hidden" name="orderId" value={order.id} />

            <div>
              <label htmlFor="reviewer" className="block text-sm font-semibold">
                Reviewing pharmacist
              </label>
              <input
                id="reviewer"
                name="reviewer"
                required
                placeholder="Your name and PPB number"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="prescriberName" className="block text-sm font-semibold">
                  Prescriber
                </label>
                <input
                  id="prescriberName"
                  name="prescriberName"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="prescriberRegNo" className="block text-sm font-semibold">
                  Reg. number
                </label>
                <input
                  id="prescriberRegNo"
                  name="prescriberRegNo"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="note" className="block text-sm font-semibold">
                Note to the patient
              </label>
              <textarea
                id="note"
                name="note"
                rows={2}
                placeholder="Required if you reject. Explain what they should do next."
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                name="decision"
                value="approve"
                data-testid="approve"
                className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
              >
                Approve and dispense
              </button>
              <button
                type="submit"
                name="decision"
                value="reject"
                data-testid="reject"
                className="rounded-lg border border-destructive px-5 py-2.5 font-semibold text-destructive"
              >
                Reject
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
