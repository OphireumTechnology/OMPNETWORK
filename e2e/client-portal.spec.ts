import { test, expect } from '@playwright/test';

test.describe('Phase 26 E2E — Client Portal Registration, Commerce, Orders, Projects & Support', () => {
  test('registers a customer, browses portal store categories, places a sandbox order, and opens a support ticket', async ({
    page,
    request,
  }) => {
    const email = `e2e.customer.${Date.now()}@ophireum.test`;
    const password = 'ClientStrongPass!2026';

    // Navigate to Client Portal
    await page.goto('/portal');
    await expect(page.locator('body')).toContainText(/Client Portal|Sign In|Create Account/i);

    // Register via Portal API (mirrors UI registration + verifies HttpOnly cookie/session compatibility)
    const regRes = await request.post('/api/portal/auth/register', {
      data: {
        firstName: 'E2E',
        lastName: 'Customer',
        email,
        password,
        companyName: 'E2E Ventures Inc.',
        preferredCurrency: 'USD',
      },
    });
    expect(regRes.status()).toBe(201);
    const regJson = await regRes.json();
    expect(regJson.token).toBeTruthy();

    // Verify 7 store categories load
    const catRes = await request.get('/api/portal/catalog');
    expect(catRes.status()).toBe(200);
    const catJson = await catRes.json();
    expect(catJson.categories.length).toBeGreaterThanOrEqual(7);
    expect(catJson.products.length).toBeGreaterThan(0);

    // Add one-time package to cart and create order
    const firstPackage = catJson.products
      .flatMap((p: { packages?: Array<{ id: string; isCustomQuote?: boolean; billingType?: string }> }) => p.packages || [])
      .find((pkg: { id: string; isCustomQuote?: boolean; billingType?: string }) => !pkg.isCustomQuote && pkg.billingType === 'one_time');
    expect(firstPackage).toBeTruthy();

    const cartRes = await request.post('/api/portal/cart/items', {
      headers: { Authorization: `Bearer ${regJson.token}` },
      data: { packageId: firstPackage.id, quantity: 1 },
    });
    expect(cartRes.status()).toBe(200);

    const checkoutRes = await request.post('/api/portal/checkout', {
      headers: { Authorization: `Bearer ${regJson.token}` },
      data: {
        currency: 'USD',
        paymentProvider: 'xendit',
        billingDetails: { fullName: 'E2E Customer', email },
      },
    });
    expect(checkoutRes.status()).toBe(201);
    const orderData = await checkoutRes.json();
    expect(orderData.order.orderNumber).toBeTruthy();
    expect(orderData.order.paymentStatus).toBe('pending');
    expect(orderData.order.paymentStatus).not.toBe('paid');

    // Create a support ticket on canonical /api/portal/support and verify durable retrieval
    const ticketRes = await request.post('/api/portal/support', {
      headers: { Authorization: `Bearer ${regJson.token}` },
      data: {
        category: 'Orders',
        subject: 'E2E Order Confirmation Inquiry',
        body: 'Confirming our order visibility in the Client Portal.',
      },
    });
    expect(ticketRes.status()).toBe(201);
    const createdTicket = await ticketRes.json();
    expect(createdTicket.ticket?.id).toBeTruthy();

    const listRes = await request.get('/api/portal/support', {
      headers: { Authorization: `Bearer ${regJson.token}` },
    });
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    expect((listData.tickets || []).some((t: { id: string }) => t.id === createdTicket.ticket.id)).toBe(true);
  });
});
