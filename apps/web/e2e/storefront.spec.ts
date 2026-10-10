import { expect, test } from '@playwright/test';

/**
 * Storefront journeys.
 *
 * These run against the production build with the Juleb mock driver, so the
 * catalogue is the nine fixture products. Assertions lean on data-testid and
 * accessible roles rather than CSS classes, so a restyle does not break them.
 */

test.describe('browsing', () => {
  test('homepage shows the brand, the three nav axes and real products', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Trusted medicine');
    await expect(page.getByRole('link', { name: 'SplendMed Pharmacy home' })).toBeVisible();

    // The condition axis is the one generic templates omit; assert it exists.
    for (const axis of ['Shop by category', 'Shop by condition', 'Shop by brand']) {
      // The <summary> also contains the +/- disclosure marker, so match the
      // element rather than requiring its text to equal the title exactly.
      await expect(page.locator('summary', { hasText: axis })).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: 'Offers for you' })).toBeVisible();
  });

  test('condition navigation filters the catalogue', async ({ page }) => {
    await page.goto('/shop/condition/malaria');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Malaria');
    // Scope to main: the header's brand menu also contains "Coartem", hidden
    // inside a collapsed <details>.
    await expect(page.getByRole('main').getByRole('link', { name: 'Coartem' })).toBeVisible();
    // Browsing grouping must not read as a treatment recommendation.
    await expect(page.getByText('not a treatment recommendation')).toBeVisible();
  });

  test('search finds a brand product by its generic name', async ({ page }) => {
    await page.goto('/search?q=paracetamol');

    // "Panadol Extra" and "Calpol" are both paracetamol — a patient searching the
    // generic name must find the brands.
    const results = page.getByRole('main');
    await expect(results.getByRole('link', { name: 'Panadol Extra' })).toBeVisible();
    await expect(
      results.getByRole('link', { name: /Calpol/ }),
    ).toBeVisible();
  });

  test('offers are ordered deepest discount first', async ({ page }) => {
    await page.goto('/shop/offers');

    const badges = page.getByText(/% off$/);
    const discounts = (await badges.allInnerTexts()).map((t) => Number.parseInt(t, 10));

    expect(discounts.length).toBeGreaterThan(1);
    const sorted = [...discounts].sort((a, b) => b - a);
    expect(discounts).toEqual(sorted);
  });
});

test.describe('prescription safety', () => {
  test('a prescription-only product says so unmissably on its page', async ({ page }) => {
    await page.goto('/products/coartem-20mg-120mg');

    const notice = page.getByTestId('rx-notice');
    await expect(notice.getByRole('heading', { name: 'Prescription required' })).toBeVisible();
    await expect(notice).toContainText('Pharmacy and Poisons Board');
  });

  test('a controlled medicine is labelled more strictly than ordinary POM', async ({ page }) => {
    await page.goto('/products/diazepam-5mg');

    await expect(
      page.getByRole('heading', { name: /Controlled medicine/ }),
    ).toBeVisible();
  });

  test('the site never publishes dosage guidance', async ({ page }) => {
    await page.goto('/products/coartem-20mg-120mg');
    await expect(page.getByText('We do not publish dosage or treatment guidance')).toBeVisible();
  });
});

test.describe('cart', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('adding a product updates the cart and prices it correctly', async ({ page }) => {
    await page.goto('/products/panadol-extra-500mg-65mg');
    await expect(page.getByTestId('cart-count')).toHaveText('(0)');

    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('(1)');

    await page.goto('/cart');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    // Panadol Extra is KES 450.
    await expect(page.getByTestId('cart-subtotal')).toHaveText('KES 450');
  });

  test('quantity updates recalculate the subtotal', async ({ page }) => {
    await page.goto('/products/panadol-extra-500mg-65mg');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('(1)');

    await page.goto('/cart');
    await page.getByLabel('Qty').fill('3');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByTestId('cart-subtotal')).toHaveText('KES 1,350');
    await expect(page.getByTestId('cart-summary')).toContainText('3 items');
  });

  test('removing the last line empties the cart', async ({ page }) => {
    await page.goto('/products/panadol-extra-500mg-65mg');
    await page.getByTestId('add-to-cart').click();
    // Wait for the server action to settle before navigating, or the cookie
    // may not be written yet.
    await expect(page.getByTestId('cart-count')).toHaveText('(1)');
    await page.goto('/cart');

    await page.getByTestId('remove-line').click();
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  });

  test('a cart containing prescription medicine warns before checkout', async ({ page }) => {
    await page.goto('/products/coartem-20mg-120mg');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('(1)');

    await page.goto('/cart');
    await expect(page.getByText('Your cart contains prescription medicine.')).toBeVisible();
  });

  test('an out-of-stock product offers notify-me instead of add-to-cart', async ({ page }) => {
    // Found from the catalogue rather than named: which product is out of stock
    // changes whenever the fixtures regenerate.
    await page.goto('/shop');
    await expect(page.getByTestId('notify-me').first()).toBeVisible();

    // Inside that card there is no add control at all, not a disabled one.
    const card = page.locator('article').filter({ has: page.getByTestId('notify-me') }).first();
    await expect(card.getByTestId('add-to-cart')).toHaveCount(0);
  });
});

test.describe('checkout', () => {
  test('an over-the-counter order needs no prescription and totals correctly', async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto('/products/panadol-extra-500mg-65mg');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('(1)');

    await page.goto('/checkout');
    // Panadol Extra is KES 450 and Kisumu delivery is KES 200.
    await expect(page.getByTestId('checkout-total')).toHaveText('KES 650');
    // Nothing in this cart requires a prescription, so no upload is asked for.
    await expect(page.getByLabel('Upload your prescription')).toHaveCount(0);
    await expect(page.getByTestId('place-order')).toBeVisible();
  });
});

test.describe('accessibility and resilience', () => {
  test('every page has exactly one h1 and a skip link', async ({ page }) => {
    for (const path of ['/', '/cart', '/shop/offers', '/search?q=panadol']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCount(1);
    }
  });

  test('the catalogue nav works without JavaScript', async ({ browser }) => {
    // The 3G mid-range Android target (§12) means the nav must not depend on JS.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/');
    await page.getByRole('link', { name: /Malaria/ }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Malaria');

    await context.close();
  });
});
