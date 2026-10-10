import { expect, test } from '@playwright/test';

/**
 * The demo journey, end to end: order a prescription medicine, upload a
 * prescription, have a pharmacist approve it, see the outcome as the patient.
 *
 * Run against production with E2E_BASE_URL to confirm the story actually holds
 * on the deployment — the order store is in-process, so this is also the check
 * that consecutive requests reach the same instance.
 */

// A 1x1 PNG is enough to stand in for a photographed prescription.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('a prescription order reaches the pharmacist and comes back approved', async ({
  page,
  context,
}) => {
  await context.clearCookies();

  // 1. Patient adds a prescription-only medicine.
  await page.goto('/products/coartem-20mg-120mg');
  await expect(page.getByTestId('rx-notice')).toContainText('Prescription required');
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-count')).toHaveText('(1)');

  // 2. The cart warns before checkout.
  await page.goto('/cart');
  await expect(page.getByText('Your cart contains prescription medicine.')).toBeVisible();

  // 3. Checkout demands a prescription.
  await page.goto('/checkout');
  await page.getByLabel('Your name').fill('Demo Patient');
  await page.getByLabel('Mobile number').fill('0712345678');
  await page.getByLabel('Upload your prescription').setInputFiles({
    name: 'prescription.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });
  await page.getByTestId('place-order').click();

  // 4. Order exists and is waiting on a pharmacist.
  await page.waitForURL(/\/orders\//, { timeout: 30_000 });
  await expect(page.getByTestId('order-status')).toContainText('Awaiting pharmacist review');
  const orderUrl = page.url();

  // 5. The pharmacist sees it in the queue.
  await page.goto('/console');
  const queued = page.getByTestId('queue-item').first();
  await expect(queued).toBeVisible();
  await queued.click();

  // 6. Review screen shows the prescription beside the items, then approve.
  await expect(page.getByTestId('rx-image')).toBeVisible();
  await page.getByLabel('Reviewing pharmacist').fill('A. Pharmacist, PPB/12345');
  await page.getByLabel('Prescriber').fill('Dr J. Otieno');
  await page.getByLabel('Reg. number').fill('KMPDC/9876');
  await page.getByTestId('approve').click();
  await page.waitForURL(/\/console$/, { timeout: 30_000 });

  // 7. The patient sees the decision and who made it.
  await page.goto(orderUrl);
  await expect(page.getByTestId('order-status')).toContainText('Approved');
  await expect(page.getByTestId('order-status')).toContainText('A. Pharmacist, PPB/12345');
});

test('an order with a prescription item is refused without a prescription', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto('/products/coartem-20mg-120mg');
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-count')).toHaveText('(1)');

  await page.goto('/checkout');
  await page.getByLabel('Your name').fill('Demo Patient');
  await page.getByLabel('Mobile number').fill('0712345678');

  // The upload input is `required`, so the browser blocks submission — the
  // server check in placeOrder is the real guard, this is the courtesy one.
  await page.getByTestId('place-order').click();
  await expect(page).toHaveURL(/\/checkout/);
});
