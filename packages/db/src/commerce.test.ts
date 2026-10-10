import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from './harness';

/**
 * Commerce schema tests — chiefly the §3.2 prescription gate.
 *
 * §14 is explicit: "The §3.2 trigger test must attack the database directly
 * with raw SQL as a privileged role. Proving the app refuses it is not the same
 * as proving the database refuses it."
 *
 * Unless a test says otherwise it runs as the PGlite superuser — the most
 * privileged role there is, one that bypasses every RLS policy. Triggers still
 * fire for it. If the gate holds here, no application bug can open it.
 */

let t: TestDb;
let alice: string;
let bob: string;
let pharmacist: string;
let branchId: string;
let otcId: string;
let pomId: string;

const GATE = /§3\.2/;

async function insertProduct(juleb: string, name: string, generic: string, cls: string, price: number) {
  const r = await t.db.query<{ id: string }>(
    `insert into public.products
       (juleb_product_id, slug, name, generic_name, brand_name, dispensing_class, price_minor)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [juleb, juleb.toLowerCase(), name, generic, name.split(' ')[0], cls, price],
  );
  return r.rows[0]!.id;
}

/** Creates an order as `user`, adds items, returns its id. Runs privileged. */
async function createOrder(user: string, items: { productId: string; qty: number; price: number }[]) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const order = await t.db.query<{ id: string }>(
    `insert into public.orders (user_id, branch_id, subtotal_minor, total_minor)
     values ($1, $2, $3, $3) returning id`,
    [user, branchId, subtotal],
  );
  const orderId = order.rows[0]!.id;
  for (const item of items) {
    await t.db.query(
      `insert into public.order_items (order_id, product_id, quantity, unit_price_minor)
       values ($1, $2, $3, $4)`,
      [orderId, item.productId, item.qty, item.price],
    );
  }
  return orderId;
}

const setStatus = (orderId: string, status: string) =>
  t.db.query(`update public.orders set status = $1::public.order_status where id = $2`, [status, orderId]);

const statusOf = async (orderId: string) =>
  (await t.db.query<{ status: string }>(`select status from public.orders where id = $1`, [orderId]))
    .rows[0]!.status;

/** Inserts a prescription privileged — simulating a bug or an attacker with DB access. */
async function forgeRx(orderId: string, user: string, status: string, reviewer: string | null) {
  await t.db.query(
    `insert into public.prescriptions (user_id, order_id, storage_path, status, reviewed_by, reviewed_at)
     values ($1, $2, 'rx/test/page-1.jpg', $3::public.rx_status, $4,
             case when $4::uuid is null then null else now() end)`,
    [user, orderId, status, reviewer],
  );
}

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser({ phone: '+254700000011', fullName: 'Alice' });
  bob = await t.createUser({ phone: '+254700000012', fullName: 'Bob' });
  pharmacist = await t.createUser({ phone: '+254700000013', fullName: 'Pharmacist' });
  await t.grantRole(pharmacist, 'pharmacist');

  const b = await t.db.query<{ id: string }>(
    `insert into public.branches (name, county) values ('Test Branch', 'Kisumu') returning id`,
  );
  branchId = b.rows[0]!.id;
  otcId = await insertProduct('JP-T001', 'Paracetamol 500mg', 'Paracetamol', 'otc', 45000);
  pomId = await insertProduct('JP-T002', 'Coartem', 'Artemether + Lumefantrine', 'pom', 125000);
});

afterAll(async () => {
  await t?.close();
});

describe('§3.2 — the prescription gate, attacked as a privileged role', () => {
  it('lets an over-the-counter order be approved with no prescription', async () => {
    const id = await createOrder(alice, [{ productId: otcId, qty: 1, price: 45000 }]);
    await setStatus(id, 'approved');
    expect(await statusOf(id)).toBe('approved');
  });

  it('refuses to approve a prescription-only order with no prescription', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await expect(setStatus(id, 'approved')).rejects.toThrow(GATE);
    expect(await statusOf(id)).toBe('draft');
  });

  // Jumping past 'approved' must not be a way round it.
  it.each(['pushed_to_juleb', 'fulfilling', 'out_for_delivery', 'delivered'])(
    'refuses to move a prescription-only order straight to %s',
    async (status) => {
      const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
      await expect(setStatus(id, status)).rejects.toThrow(GATE);
    },
  );

  it('does not accept a prescription that is still pending', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await forgeRx(id, alice, 'pending', null);
    await expect(setStatus(id, 'approved')).rejects.toThrow(GATE);
  });

  /*
   * The heart of it. An attacker or a bug writes a prescription marked approved
   * with a reviewer who is not a pharmacist — here, the patient herself. The
   * row looks complete, and the gate still refuses it.
   */
  it('does not accept an approval signed by someone who is not a pharmacist', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await forgeRx(id, alice, 'approved', alice);
    await expect(setStatus(id, 'approved')).rejects.toThrow(GATE);
  });

  it('accepts an approval by a user who holds the pharmacist role', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await forgeRx(id, alice, 'approved', pharmacist);
    await setStatus(id, 'approved');
    expect(await statusOf(id)).toBe('approved');
  });

  it('blocks a mixed basket if any one item needs a prescription', async () => {
    const id = await createOrder(alice, [
      { productId: otcId, qty: 2, price: 45000 },
      { productId: pomId, qty: 1, price: 125000 },
    ]);
    await expect(setStatus(id, 'approved')).rejects.toThrow(GATE);
  });
});

describe('§3.2 — closing the side doors', () => {
  /*
   * Without the freeze, an order approved holding only over-the-counter items
   * could have a prescription medicine added afterwards, and the orders trigger
   * would never fire again.
   */
  it('freezes items once an order is past payment', async () => {
    const id = await createOrder(alice, [{ productId: otcId, qty: 1, price: 45000 }]);
    await setStatus(id, 'paid');
    await expect(
      t.db.query(
        `insert into public.order_items (order_id, product_id, quantity, unit_price_minor)
         values ($1, $2, 1, 125000)`,
        [id, pomId],
      ),
    ).rejects.toThrow(/frozen/);
  });

  it('takes the classification from the product, not from the caller', async () => {
    const order = await t.db.query<{ id: string }>(
      `insert into public.orders (user_id, subtotal_minor, total_minor) values ($1, 0, 0) returning id`,
      [alice],
    );
    const id = order.rows[0]!.id;
    // The caller claims the prescription medicine needs no prescription.
    await t.db.query(
      `insert into public.order_items (order_id, product_id, quantity, unit_price_minor, requires_prescription)
       values ($1, $2, 1, 125000, false)`,
      [id, pomId],
    );
    const stored = await t.db.query<{ requires_prescription: boolean }>(
      `select requires_prescription from public.order_items where order_id = $1`,
      [id],
    );
    expect(stored.rows[0]!.requires_prescription).toBe(true);
  });

  it('cannot be relaxed by reclassifying the medicine after ordering', async () => {
    const reclass = await insertProduct('JP-T003', 'Reclassified Drug', 'Something', 'pom', 50000);
    const id = await createOrder(alice, [{ productId: reclass, qty: 1, price: 50000 }]);
    await t.db.query(`update public.products set dispensing_class = 'otc' where id = $1`, [reclass]);
    // The snapshot taken at ordering still says prescription-only.
    await expect(setStatus(id, 'approved')).rejects.toThrow(GATE);
  });

  it('makes requires_prescription impossible to set independently of the classification', async () => {
    await expect(
      t.db.query(
        `insert into public.products (juleb_product_id, slug, name, dispensing_class, price_minor, requires_prescription)
         values ('JP-T004', 'jp-t004', 'Forged', 'pom', 100, false)`,
      ),
    ).rejects.toThrow();
  });
});

describe('prescriptions — who can decide', () => {
  it('a patient cannot upload a prescription already marked approved', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    const attempt = t.asUser(alice, () =>
      t.db.query(
        `insert into public.prescriptions (user_id, order_id, storage_path, status, reviewed_by, reviewed_at)
         values ($1, $2, 'rx/test/page-1.jpg', 'approved', $1, now())`,
        [alice, id],
      ),
    );
    await expect(attempt).rejects.toThrow();
  });

  it('a patient can upload their own pending prescription', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await t.asUser(alice, () =>
      t.db.query(
        `insert into public.prescriptions (user_id, order_id, storage_path)
         values ($1, $2, 'rx/test/page-1.jpg')`,
        [alice, id],
      ),
    );
    const rows = await t.db.query(`select id from public.prescriptions where order_id = $1`, [id]);
    expect(rows.rows).toHaveLength(1);
  });

  it('a patient cannot approve their own prescription', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await forgeRx(id, alice, 'pending', null);
    await t.asUser(alice, () =>
      t.db.query(`update public.prescriptions set status = 'approved' where order_id = $1`, [id]),
    );
    const rows = await t.db.query<{ status: string }>(
      `select status from public.prescriptions where order_id = $1`,
      [id],
    );
    expect(rows.rows[0]!.status).toBe('pending');
  });

  // Nobody can sign a decision in someone else's name.
  it('stamps the decision with the reviewing pharmacist, whatever they claim', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await forgeRx(id, alice, 'pending', null);
    await t.asUser(pharmacist, () =>
      t.db.query(
        `update public.prescriptions set status = 'approved', reviewed_by = $1 where order_id = $2`,
        [bob, id],
      ),
    );
    const rows = await t.db.query<{ reviewed_by: string; reviewed_at: string | null }>(
      `select reviewed_by, reviewed_at from public.prescriptions where order_id = $1`,
      [id],
    );
    expect(rows.rows[0]!.reviewed_by).toBe(pharmacist);
    expect(rows.rows[0]!.reviewed_at).not.toBeNull();
  });

  it('refuses a public URL as the storage location: PHI is never on an open link', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await expect(
      t.db.query(
        `insert into public.prescriptions (user_id, order_id, storage_path)
         values ($1, $2, 'https://example.com/rx.jpg')`,
        [alice, id],
      ),
    ).rejects.toThrow();
  });
});

describe('orders — patients see only their own', () => {
  it("a patient cannot see another patient's orders", async () => {
    await createOrder(alice, [{ productId: otcId, qty: 1, price: 45000 }]);
    const seenByBob = await t.asUser(bob, async () => {
      const r = await t.db.query<{ user_id: string }>(`select user_id from public.orders`);
      return r.rows;
    });
    expect(seenByBob.some((o) => o.user_id === alice)).toBe(false);
  });

  it("a patient cannot see another patient's prescriptions", async () => {
    const seenByBob = await t.asUser(bob, async () => {
      const r = await t.db.query<{ user_id: string }>(`select user_id from public.prescriptions`);
      return r.rows;
    });
    expect(seenByBob.some((p) => p.user_id === alice)).toBe(false);
  });

  it('a pharmacist can see prescriptions, which review requires', async () => {
    const seen = await t.asUser(pharmacist, async () => {
      const r = await t.db.query(`select id from public.prescriptions`);
      return r.rows;
    });
    expect(seen.length).toBeGreaterThan(0);
  });

  it('a patient cannot move their own order to approved', async () => {
    const id = await createOrder(alice, [{ productId: otcId, qty: 1, price: 45000 }]);
    await t.asUser(alice, () =>
      t.db.query(`update public.orders set status = 'approved' where id = $1`, [id]),
    );
    expect(await statusOf(id)).toBe('draft');
  });

  it('enforces that the total is the subtotal plus delivery', async () => {
    await expect(
      t.db.query(
        `insert into public.orders (user_id, subtotal_minor, delivery_fee_minor, total_minor)
         values ($1, 45000, 20000, 1)`,
        [alice],
      ),
    ).rejects.toThrow();
  });
});

describe('outbox — queued in the same transaction as the approval', () => {
  it('approving an order queues exactly one push keyed by the order id', async () => {
    const id = await createOrder(alice, [{ productId: otcId, qty: 2, price: 45000 }]);
    await setStatus(id, 'approved');
    const rows = await t.db.query<{ idempotency_key: string; payload: { lines: unknown[] } }>(
      `select idempotency_key, payload from public.juleb_outbox where order_id = $1`,
      [id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.idempotency_key).toBe(id);
    expect(rows.rows[0]!.payload.lines).toHaveLength(1);
  });

  it('an approval the gate refuses queues nothing', async () => {
    const id = await createOrder(alice, [{ productId: pomId, qty: 1, price: 125000 }]);
    await expect(setStatus(id, 'approved')).rejects.toThrow(GATE);
    const rows = await t.db.query(`select id from public.juleb_outbox where order_id = $1`, [id]);
    expect(rows.rows).toHaveLength(0);
  });
});

describe('webhook events — a replayed callback is a no-op', () => {
  it('rejects a second event with the same provider id', async () => {
    const insert = () =>
      t.db.query(
        `insert into public.webhook_events (source, event_id, payload)
         values ('mpesa', 'ws_CO_TEST_0001', '{"ResultCode":0}')`,
      );
    await insert();
    await expect(insert()).rejects.toThrow();
    const rows = await t.db.query(
      `select id from public.webhook_events where event_id = 'ws_CO_TEST_0001'`,
    );
    expect(rows.rows).toHaveLength(1);
  });
});

describe('catalogue search', () => {
  const search = async (q: string) =>
    (await t.db.query<{ name: string }>(`select name from public.search_products($1)`, [q])).rows.map(
      (r) => r.name,
    );

  it('finds a product by its generic name, as patients search', async () => {
    expect(await search('paracetamol')).toContain('Paracetamol 500mg');
  });

  it('matches a prefix, so results appear while typing', async () => {
    expect(await search('parac')).toContain('Paracetamol 500mg');
    expect(await search('artem')).toContain('Coartem');
  });

  it('treats operator characters as plain text instead of erroring', async () => {
    await expect(search('para & : ! (')).resolves.toBeDefined();
    expect(await search('&&&')).toStrictEqual([]);
  });

  it('returns nothing for an empty query', async () => {
    expect(await search('   ')).toStrictEqual([]);
  });

  it('is readable by an anonymous shopper', async () => {
    const rows = await t.asAnon(async () => {
      const r = await t.db.query<{ name: string }>(`select name from public.products`);
      return r.rows;
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('cannot be written by a shopper', async () => {
    await t.asUser(alice, () =>
      t.db
        .query(`update public.products set price_minor = 1 where id = $1`, [otcId])
        .catch(() => undefined),
    );
    const price = await t.db.query<{ price_minor: string }>(
      `select price_minor from public.products where id = $1`,
      [otcId],
    );
    expect(Number(price.rows[0]!.price_minor)).toBe(45000);
  });
});
