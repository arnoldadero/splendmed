import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatMoney } from '@splendmed/domain';

import { AdoptPendingRx } from '@/components/rx-storage';
import { ORDER_STATUS_COPY, asMoney, getOrder } from '@/lib/demo-store';

export const metadata = { title: 'Your order' };

/** Order confirmation and live status, as the customer sees it. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const status = ORDER_STATUS_COPY[order.status];
  const tone =
    order.status === 'rx_rejected'
      ? 'border-destructive'
      : order.status === 'awaiting_rx_review'
        ? 'border-brand-teal'
        : 'border-brand-mint';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <AdoptPendingRx orderId={order.id} />
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-teal">
        Order {order.orderNo}
      </p>
      <h1 className="mt-2 text-3xl font-bold">Thank you, {order.customerName.split(' ')[0]}</h1>

      <div className={`mt-6 rounded-lg border bg-card p-5 ${tone}`} data-testid="order-status">
        <h2 className="font-semibold text-brand-deep">{status.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{status.detail}</p>

        {order.reviewNote && (
          <p className="mt-3 rounded border border-border bg-background p-3 text-sm">
            <strong className="font-semibold">Pharmacist note:</strong>{' '}
            {order.reviewNote}
          </p>
        )}
        {order.reviewedBy && (
          <p className="mt-2 text-xs text-muted-foreground">
            Reviewed by {order.reviewedBy}
            {order.prescriberRegNo ? ` · prescriber reg. ${order.prescriberRegNo}` : ''}
          </p>
        )}
      </div>

      <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
        {order.lines.map((line) => (
          <li key={line.productId} className="flex justify-between gap-4 p-4 text-sm">
            <span>
              {line.name}
              {line.strength ? ` ${line.strength}` : ''}
              <span className="text-muted-foreground"> × {line.quantity}</span>
              {line.rx && (
                <span className="ml-2 text-xs font-semibold text-brand-teal">Rx</span>
              )}
            </span>
            <span className="font-semibold">
              {formatMoney(asMoney(line.unitPriceMinor * line.quantity))}
            </span>
          </li>
        ))}
        <li className="flex justify-between bg-secondary p-4 font-bold">
          <span>Total</span>
          <span>{formatMoney(asMoney(order.totalMinor))}</span>
        </li>
      </ul>

      <p className="mt-6 text-sm text-muted-foreground">
        {order.fulfilment === 'delivery'
          ? 'We will call you on ' + order.customerPhone + ' to arrange delivery in Kisumu.'
          : 'Collect at SplendMed Kisumu CBD. We will text you when it is ready.'}
      </p>

      <Link href="/" className="mt-8 inline-block font-semibold text-brand-teal hover:underline">
        Continue shopping
      </Link>
    </div>
  );
}
