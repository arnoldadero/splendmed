import { describe, expect, it } from 'vitest';

import {
  FULFILMENT_STATUSES,
  ORDER_STATUSES,
  allowedTransitionsFrom,
  canTransition,
  isFulfilmentStatus,
  isTerminal,
  type OrderStatus,
} from './orders';

describe('order status set', () => {
  it('declares a transition rule for every status, so none is unreachable by accident', () => {
    for (const status of ORDER_STATUSES) {
      expect(allowedTransitionsFrom(status)).toBeDefined();
    }
  });

  it('only ever transitions to a known status', () => {
    const known = new Set<string>(ORDER_STATUSES);
    for (const status of ORDER_STATUSES) {
      for (const next of allowedTransitionsFrom(status)) {
        expect(known.has(next)).toBe(true);
      }
    }
  });

  it('never allows a self-transition', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});

describe('fulfilment states', () => {
  it('is the set the §3.2 prescription gate keys off', () => {
    expect([...FULFILMENT_STATUSES]).toStrictEqual([
      'approved',
      'pushed_to_juleb',
      'fulfilling',
      'out_for_delivery',
      'delivered',
    ]);
  });

  it('classifies pre-fulfilment states as outside the gate', () => {
    for (const status of ['draft', 'awaiting_payment', 'paid', 'awaiting_rx_review'] as const) {
      expect(isFulfilmentStatus(status)).toBe(false);
    }
  });

  // The invariant that makes the gate meaningful: a prescription order cannot
  // slip into fulfilment without passing through review.
  it('cannot reach any fulfilment state directly from awaiting_rx_review except approved', () => {
    const reachable = allowedTransitionsFrom('awaiting_rx_review').filter(isFulfilmentStatus);
    expect(reachable).toStrictEqual(['approved']);
  });

  it('cannot reach fulfilment from draft or awaiting_payment at all', () => {
    for (const status of ['draft', 'awaiting_payment'] as const) {
      expect(allowedTransitionsFrom(status).filter(isFulfilmentStatus)).toHaveLength(0);
    }
  });
});

describe('specific transitions', () => {
  it('takes payment before review, so a pharmacist never assesses an uncommitted order', () => {
    expect(canTransition('awaiting_payment', 'paid')).toBe(true);
    expect(canTransition('paid', 'awaiting_rx_review')).toBe(true);
    expect(canTransition('awaiting_payment', 'awaiting_rx_review')).toBe(false);
  });

  it('lets a rejected prescription be resubmitted', () => {
    expect(canTransition('rx_rejected', 'awaiting_rx_review')).toBe(true);
  });

  it('lets a Juleb stock rejection fall back to approved for retry', () => {
    expect(canTransition('pushed_to_juleb', 'approved')).toBe(true);
  });

  it('allows cancellation at every stage up to delivery', () => {
    const cancellable: OrderStatus[] = [
      'draft',
      'awaiting_payment',
      'paid',
      'awaiting_rx_review',
      'rx_rejected',
      'approved',
      'pushed_to_juleb',
      'fulfilling',
      'out_for_delivery',
    ];
    for (const status of cancellable) {
      expect(canTransition(status, 'cancelled')).toBe(true);
    }
  });

  it('does not allow cancelling an already delivered order — that is a refund', () => {
    expect(canTransition('delivered', 'cancelled')).toBe(false);
    expect(canTransition('delivered', 'refunded')).toBe(true);
  });
});

describe('terminal states', () => {
  it('treats cancelled and refunded as final', () => {
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('refunded')).toBe(true);
  });

  it('treats delivered as non-final, because a refund can still follow', () => {
    expect(isTerminal('delivered')).toBe(false);
  });

  it('has no unreachable non-terminal state', () => {
    const reachable = new Set<string>(['draft']);
    for (const status of ORDER_STATUSES) {
      for (const next of allowedTransitionsFrom(status)) reachable.add(next);
    }
    for (const status of ORDER_STATUSES) {
      expect(reachable.has(status)).toBe(true);
    }
  });
});
