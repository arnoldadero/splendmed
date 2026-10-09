'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { addMoney, money, multiplyMoney } from '@splendmed/domain';

import { getCart } from '@/lib/cart';
import { writeCartEntries } from '@/lib/cart';
import {
  nextOrderNo,
  putOrder,
  recordReview,
  type DemoOrder,
  type DemoOrderLine,
} from '@/lib/demo-store';

/** Flat Kisumu delivery fee for the demo; zones arrive with real logistics. */
const DELIVERY_FEE = money(20000);

const placeOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Please give your name').max(80),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(\+254|0)[17]\d{8}$/, 'Enter a Kenyan mobile number, e.g. 0712345678'),
  fulfilment: z.enum(['delivery', 'pickup']),
  /** Data URL produced in the browser. Demo only — Phase 4 uploads to storage. */
  prescriptionImage: z.string().optional(),
  prescriptionFileName: z.string().optional(),
});

export type PlaceOrderResult = { ok: false; error: string };

export async function placeOrder(formData: FormData): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse({
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    fulfilment: formData.get('fulfilment'),
    prescriptionImage: formData.get('prescriptionImage') || undefined,
    prescriptionFileName: formData.get('prescriptionFileName') || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form' };
  }

  const cart = await getCart();
  if (cart.lines.length === 0) return { ok: false, error: 'Your cart is empty' };

  /*
   * Guardrail §3.2, enforced server-side. The client cannot talk its way past
   * this by omitting the field: if any line needs a prescription, one must be
   * attached before an order exists at all.
   */
  if (cart.requiresPrescription && !parsed.data.prescriptionImage) {
    return { ok: false, error: 'A prescription is required for one or more items in your cart' };
  }

  const lines: DemoOrderLine[] = cart.lines.map(({ item, quantity }) => ({
    productId: item.product.id,
    name: item.product.name,
    strength: item.product.strength,
    quantity,
    unitPrice: item.product.price,
    requiresPrescription: item.product.dispensing !== 'otc',
    isControlled: item.product.dispensing === 'controlled',
  }));

  const subtotal = lines.reduce(
    (sum, l) => addMoney(sum, multiplyMoney(l.unitPrice, l.quantity)),
    money(0),
  );
  const deliveryFee = parsed.data.fulfilment === 'delivery' ? DELIVERY_FEE : money(0);

  const id = `ord_${Math.random().toString(36).slice(2, 10)}`;
  const order: DemoOrder = {
    id,
    orderNo: nextOrderNo(),
    placedAt: new Date().toISOString(),
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    lines,
    subtotal,
    deliveryFee,
    total: addMoney(subtotal, deliveryFee),
    fulfilment: parsed.data.fulfilment,
    // An order with no prescription-only item skips review entirely.
    status: cart.requiresPrescription ? 'awaiting_rx_review' : 'approved',
    prescription: parsed.data.prescriptionImage
      ? {
          id: `rx_${Math.random().toString(36).slice(2, 10)}`,
          imageDataUrl: parsed.data.prescriptionImage,
          fileName: parsed.data.prescriptionFileName ?? null,
          status: 'pending',
          prescriberName: null,
          prescriberRegNo: null,
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        }
      : null,
  };

  putOrder(order);
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

  recordReview(parsed.data);
  revalidatePath('/console');
  revalidatePath(`/orders/${parsed.data.orderId}`);
  redirect('/console');
}
