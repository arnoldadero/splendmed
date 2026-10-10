import Link from 'next/link';

import { formatMoney } from '@splendmed/domain';

import { asMoney, listOrders, listPendingReview } from '@/lib/demo-store';

export const metadata = { title: 'Pharmacist console' };

/**
 * Pharmacist review queue.
 *
 * Oldest first, because waiting time is what matters to a patient waiting to be
 * told whether their medicine is coming. In Phase 6 this is role-gated and
 * realtime; here it is open so the journey can be demonstrated without auth.
 */
export default async function ConsolePage() {
  const [queue, all] = await Promise.all([listPendingReview(), listOrders()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">
        Pharmacist console
      </p>
      <h1 className="mt-2 text-3xl font-bold">Prescription review queue</h1>
      <p className="mt-2 text-muted-foreground" data-testid="queue-count">
        {queue.length} awaiting review · {all.length} orders today
      </p>

      <p className="mt-4 rounded-lg border border-border bg-secondary p-4 text-sm">
        Demo console. In Phase 6 this is restricted to the <code>pharmacist</code> role by the
        row-level security already written and tested, and the queue updates in realtime.
      </p>

      {queue.length === 0 ? (
        <p className="mt-10 rounded-xl border border-border p-10 text-center text-muted-foreground">
          Nothing waiting. Place an order containing a prescription medicine and it will appear
          here.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {queue.map((order) => {
            const controlled = order.lines.some((l) => l.controlled);
            const waited = Math.max(
              0,
              Math.round((Date.now() - new Date(order.placedAt).getTime()) / 60000),
            );
            return (
              <li key={order.id}>
                <Link
                  href={`/console/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary"
                  data-testid="queue-item"
                >
                  <div>
                    <p className="font-semibold">
                      {order.orderNo} · {order.customerName}
                      {controlled && (
                        <span className="ml-2 rounded bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                          Controlled
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {order.lines.filter((l) => l.rx).length} Rx item(s) ·
                      waiting {waited} min
                    </p>
                  </div>
                  <span className="font-semibold">{formatMoney(asMoney(order.totalMinor))}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
