'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getCart, writeCartEntries } from '@/lib/cart';
import {
  nextOrderNo,
  putOrder,
  recordReview,
  type DemoOrder,
  type DemoOrderLine,
} from '@/lib/demo-store';

/** Flat Kisumu delivery fee for the demo; zones arrive with real logistics. */
const DELIVERY_FEE_MINOR = 20000;

const placeOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Please give your name').max(80),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(\+254|0)[17]\d{8}$/, 'Enter a Kenyan mobile number, e.g. 0712345678'),
  fulfilment: z.enum(['delivery', 'pickup']),
  hasPrescription: z.coerce.boolean().optional(),
});

export type PlaceOrderResult = { ok: false; error: string };

export async function placeOrder(formData: FormData): Promise<PlaceOrderResult | undefined> {
  const parsed = placeOrderSchema.safeParse({
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    fulfilment: formData.get('fulfilment'),
    hasPrescription: formData.get('hasPrescription') === 'true',
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form' };
  }

  const cart = await getCart();
  if (cart.lines.length === 0) return { ok: false, error: 'Your cart is empty' };

  /*
   * Guardrail §3.2, enforced on the server. Removing the file input in the
   * browser does not get past this: if any line needs a prescription and none
   * was attached, no order is created at all.
   */
  if (cart.requiresPrescription && !parsed.data.hasPrescription) {
    return { ok: false, error: 'A prescription is required for one or more items in your cart' };
  }

  const lines: DemoOrderLine[] = cart.lines.map(({ item, quantity }) => ({
    productId: item.product.id,
    name: item.product.name,
    strength: item.product.strength,
    quantity,
    unitPriceMinor: item.product.price.minor,
    rx: item.product.dispensing !== 'otc',
    controlled: item.product.dispensing === 'controlled',
  }));

  const subtotalMinor = lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);
  const deliveryFeeMinor = parsed.data.fulfilment === 'delivery' ? DELIVERY_FEE_MINOR : 0;

  const id = `ord_${Math.random().toString(36).slice(2, 10)}`;
  const order: DemoOrder = {
    id,
    orderNo: nextOrderNo(),
    placedAt: new Date().toISOString(),
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    fulfilment: parsed.data.fulfilment,
    lines,
    subtotalMinor,
    deliveryFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor,
    // An order with no prescription-only item skips review entirely.
    status: cart.requiresPrescription ? 'awaiting_rx_review' : 'approved',
    hasPrescription: Boolean(parsed.data.hasPrescription),
    rxStatus: cart.requiresPrescription ? 'pending' : null,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    prescriberName: null,
    prescriberRegNo: null,
  };

  await putOrder(order);
  await writeCartEntries(new Map());

  revalidatePath('/console');
  redirect(`/orders/${id}`);
}

const reviewSchema = z.object({
  orderId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  reviewer: z.string().trim().min(2).max(80),
  prescriberName: z.string().trim().max(80).optional(),
  prescriberRegNo: z.string().trim().max(40).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function reviewPrescription(formData: FormData): Promise<void> {
  const parsed = reviewSchema.safeParse({
    orderId: formData.get('orderId'),
    decision: formData.get('decision'),
    reviewer: formData.get('reviewer'),
    prescriberName: formData.get('prescriberName') || undefined,
    prescriberRegNo: formData.get('prescriberRegNo') || undefined,
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return;

  await recordReview(parsed.data);
  revalidatePath('/console');
  revalidatePath(`/orders/${parsed.data.orderId}`);
  redirect('/console');
}
