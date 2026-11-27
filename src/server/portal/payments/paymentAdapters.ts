import crypto from 'crypto';
import { PaymentProviderId, PortalCurrency } from '../types';

export type PaymentIntegrationStatus =
  | 'live_disabled_pending_credentials'
  | 'sandbox_ready'
  | 'deferred_merchant_onboarding';

export interface PaymentProviderConfig {
  id: PaymentProviderId;
  provider: PaymentProviderId;
  displayName: string;
  supportedCurrencies: PortalCurrency[];
  integrationStatus: PaymentIntegrationStatus;
  mode: 'disabled' | 'sandbox';
  isEnabled: boolean;
  liveEnabled: false; // Explicitly false until verified live merchant onboarding + compliance sign-off
  requiresWebhookSignature: true;
  description: string;
  readinessNote: string;
  unavailableMessage: string;
  routedAcquirer?: 'xendit' | 'maya';
}

export interface InitiatePaymentRequest {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: PortalCurrency;
  customerEmail: string;
  idempotencyKey: string;
  returnUrl: string;
}

export interface InitiatePaymentResult {
  provider: PaymentProviderId;
  environment: 'disabled' | 'sandbox';
  liveCharged: false;
  providerTransactionId?: string;
  checkoutUrl?: string;
  status: 'pending_gateway_activation' | 'sandbox_session_created';
  message: string;
}

export interface VerifiedWebhookPayload {
  verified: boolean;
  provider: PaymentProviderId;
  providerEventId?: string;
  providerTransactionId?: string;
  orderId?: string;
  amountMinor?: number;
  currency?: PortalCurrency;
  status?: 'paid' | 'failed' | 'refunded';
  error?: string;
}

export interface VerifyPaymentStatusResult {
  provider: PaymentProviderId;
  providerTransactionId: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded' | 'unavailable';
  liveVerified: boolean;
  message: string;
}

export interface RefundPaymentResult {
  provider: PaymentProviderId;
  accepted: boolean;
  providerRefundId?: string;
  status: 'refund_requested_sandbox' | 'deferred_merchant_onboarding';
  message: string;
}

export interface PaymentProviderAdapter {
  readonly id: PaymentProviderId;
  getConfig(): PaymentProviderConfig;
  initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>
  ): VerifiedWebhookPayload;
  verifyPaymentStatus(providerTransactionId: string): Promise<VerifyPaymentStatusResult>;
  initiateRefund(input: {
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    reason: string;
  }): Promise<RefundPaymentResult>;
}

const REQUEST_TIMEOUT_MS = 10_000;

function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      return Array.isArray(v) ? v[0] || '' : v || '';
    }
  }
  return '';
}

function timingSafeHexEqual(a: string, b: string): boolean {
  try {
    const cleanA = a.replace(/^sha256=/i, '').trim().toLowerCase();
    const cleanB = b.replace(/^sha256=/i, '').trim().toLowerCase();
    const bufA = Buffer.from(cleanA, 'utf8');
    const bufB = Buffer.from(cleanB, 'utf8');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function verifyHmacSha256Webhook(
  provider: PaymentProviderId,
  signatureHeaderName: string,
  secretEnvVar: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  parsedBody: Record<string, unknown>
): VerifiedWebhookPayload {
  const secret = (process.env[secretEnvVar] || process.env[`${secretEnvVar}_TEST`] || '').trim();
  if (!secret) {
    return {
      verified: false,
      provider,
      error: `Webhook secret (${secretEnvVar}) is not configured. Refusing unauthenticated webhook.`,
    };
  }

  const providedSig = getHeaderValue(headers, signatureHeaderName);
  if (!providedSig) {
    return {
      verified: false,
      provider,
      error: `Missing required signature header: ${signatureHeaderName}`,
    };
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!timingSafeHexEqual(providedSig, expectedSig)) {
    return {
      verified: false,
      provider,
      error: 'Webhook HMAC-SHA256 signature verification failed.',
    };
  }

  const providerEventId = String(parsedBody.eventId || parsedBody.id || '').trim();
  const providerTransactionId = String(
    parsedBody.transactionId || parsedBody.paymentId || providerEventId
  ).trim();
  const orderId = String(parsedBody.orderId || parsedBody.external_id || '').trim();
  const amountMinor = Number(parsedBody.amountMinor);
  const currency = parsedBody.currency === 'PHP' ? 'PHP' : parsedBody.currency === 'USD' ? 'USD' : undefined;
  const rawStatus = String(parsedBody.status || '').toLowerCase();
  const status =
    rawStatus === 'paid' || rawStatus === 'succeeded' || rawStatus === 'completed'
      ? 'paid'
      : rawStatus === 'failed'
        ? 'failed'
        : rawStatus === 'refunded'
          ? 'refunded'
          : undefined;

  if (!providerEventId || !orderId || !Number.isInteger(amountMinor) || amountMinor <= 0 || !currency || !status) {
    return {
      verified: false,
      provider,
      error: 'Webhook payload missing required verified fields (eventId, orderId, amountMinor, currency, status).',
    };
  }

  return {
    verified: true,
    provider,
    providerEventId,
    providerTransactionId,
    orderId,
    amountMinor,
    currency,
    status,
  };
}

/**
 * Xendit Sandbox/Production Adapter (PHP & USD invoices via Xendit v2 API).
 * Live charges stay strictly locked off until live_payments_enabled = true and live onboarding completes.
 */
class XenditPaymentAdapter implements PaymentProviderAdapter {
  readonly id: PaymentProviderId = 'xendit';

  private getSecretKey(): string {
    return (process.env.XENDIT_SECRET_KEY_TEST || '').trim();
  }

  private getWebhookToken(): string {
    return (
      process.env.XENDIT_WEBHOOK_SECRET ||
      process.env.XENDIT_CALLBACK_TOKEN ||
      process.env.XENDIT_WEBHOOK_TOKEN_TEST ||
      process.env.XENDIT_CALLBACK_TOKEN_TEST ||
      process.env.XENDIT_WEBHOOK_SECRET_TEST ||
      ''
    ).trim();
  }

  getConfig(): PaymentProviderConfig {
    const sandboxReady = Boolean(this.getSecretKey() && this.getWebhookToken());
    const note = sandboxReady
      ? 'Xendit sandbox credentials configured. Live production billing remains disabled.'
      : 'Awaiting XENDIT_SECRET_KEY_TEST and XENDIT_WEBHOOK_SECRET for sandbox activation.';
    return {
      id: 'xendit',
      provider: 'xendit',
      displayName: 'Xendit',
      supportedCurrencies: ['PHP', 'USD'],
      integrationStatus: sandboxReady ? 'sandbox_ready' : 'live_disabled_pending_credentials',
      mode: sandboxReady ? 'sandbox' : 'disabled',
      isEnabled: sandboxReady,
      liveEnabled: false,
      requiresWebhookSignature: true,
      description: 'Xendit invoice, e-wallet, bank transfer, and card acquiring checkout.',
      readinessNote: note,
      unavailableMessage: note,
    };
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: 'Xendit sandbox key not configured. Order recorded as Pending Payment.',
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
      const response = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'Idempotency-Key': req.idempotencyKey,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          external_id: req.orderId,
          amount: Math.round(req.amountMinor / 100),
          currency: req.currency,
          payer_email: req.customerEmail,
          description: `Ophireum Order ${req.orderNumber}`,
          success_redirect_url: req.returnUrl,
          failure_redirect_url: req.returnUrl,
        }),
      });
      const json: any = await response.json().catch(() => ({}));
      if (response.ok && json?.invoice_url) {
        return {
          provider: this.id,
          environment: 'sandbox',
          liveCharged: false,
          providerTransactionId: String(json.id || ''),
          checkoutUrl: String(json.invoice_url),
          status: 'sandbox_session_created',
          message: 'Xendit sandbox invoice session created. No live charge collected.',
        };
      }
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: `Xendit sandbox API returned status ${response.status}; order remains Pending Payment.`,
      };
    } catch {
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: 'Xendit sandbox endpoint unreachable; order safely saved as Pending Payment.',
      };
    }
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>
  ): VerifiedWebhookPayload {
    const callbackToken = this.getWebhookToken();
    const xCallbackToken = getHeaderValue(headers, 'x-callback-token');
    if (callbackToken && xCallbackToken && timingSafeHexEqual(xCallbackToken, callbackToken)) {
      const providerEventId = String(parsedBody.id || parsedBody.eventId || '').trim();
      const orderId = String(parsedBody.external_id || parsedBody.orderId || '').trim();
      const amountMinor =
        typeof parsedBody.amountMinor === 'number'
          ? parsedBody.amountMinor
          : typeof parsedBody.amount === 'number'
            ? Math.round(parsedBody.amount * 100)
            : NaN;
      const currency = parsedBody.currency === 'PHP' ? 'PHP' : parsedBody.currency === 'USD' ? 'USD' : undefined;
      const rawStatus = String(parsedBody.status || '').toUpperCase();
      const status =
        rawStatus === 'PAID' || rawStatus === 'SETTLED'
          ? 'paid'
          : rawStatus === 'EXPIRED' || rawStatus === 'FAILED'
            ? 'failed'
            : rawStatus === 'REFUNDED'
              ? 'refunded'
              : undefined;
      if (providerEventId && orderId && Number.isInteger(amountMinor) && amountMinor > 0 && currency && status) {
        return {
          verified: true,
          provider: this.id,
          providerEventId,
          providerTransactionId: providerEventId,
          orderId,
          amountMinor,
          currency,
          status,
        };
      }
    }

    return verifyHmacSha256Webhook(
      this.id,
      'x-ophireum-xendit-signature',
      'XENDIT_WEBHOOK_SECRET',
      headers,
      rawBody,
      parsedBody
    );
  }

  async verifyPaymentStatus(providerTransactionId: string): Promise<VerifyPaymentStatusResult> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      return {
        provider: this.id,
        providerTransactionId,
        status: 'unavailable',
        liveVerified: false,
        message: 'Xendit sandbox credentials not configured.',
      };
    }
    try {
      const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
      const res = await fetch(`https://api.xendit.co/v2/invoices/${encodeURIComponent(providerTransactionId)}`, {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          provider: this.id,
          providerTransactionId,
          status: 'unavailable',
          liveVerified: false,
          message: `Xendit invoice lookup returned HTTP ${res.status}.`,
        };
      }
      const raw = String(json.status || '').toUpperCase();
      const status =
        raw === 'PAID' || raw === 'SETTLED'
          ? 'paid'
          : raw === 'EXPIRED' || raw === 'FAILED'
            ? 'failed'
            : 'pending';
      return {
        provider: this.id,
        providerTransactionId,
        status,
        liveVerified: false,
        message: `Xendit sandbox invoice status: ${raw || 'UNKNOWN'}`,
      };
    } catch {
      return {
        provider: this.id,
        providerTransactionId,
        status: 'unavailable',
        liveVerified: false,
        message: 'Xendit sandbox status check unreachable.',
      };
    }
  }

  async initiateRefund(input: {
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    reason: string;
  }): Promise<RefundPaymentResult> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: 'Xendit sandbox credentials not configured for refund execution.',
      };
    }
    try {
      const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
      const res = await fetch('https://api.xendit.co/refunds', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          invoice_id: input.providerTransactionId,
          amount: Math.round(input.amountMinor / 100),
          currency: input.currency,
          reason: 'REQUESTED_BY_CUSTOMER',
          metadata: { detail: input.reason.slice(0, 200) },
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.id) {
        return {
          provider: this.id,
          accepted: true,
          providerRefundId: String(json.id),
          status: 'refund_requested_sandbox',
          message: `Xendit sandbox refund initiated (${json.id}).`,
        };
      }
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: `Xendit sandbox refund returned HTTP ${res.status}.`,
      };
    } catch {
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: 'Xendit sandbox refund endpoint unreachable.',
      };
    }
  }
}

/**
 * PayPal Sandbox/Production Adapter (USD & PHP Orders v2 API).
 */
class PayPalPaymentAdapter implements PaymentProviderAdapter {
  readonly id: PaymentProviderId = 'paypal';

  private getCredentials() {
    return {
      clientId: (process.env.PAYPAL_CLIENT_ID_SANDBOX || '').trim(),
      clientSecret: (process.env.PAYPAL_CLIENT_SECRET_SANDBOX || '').trim(),
      webhookSecret: (process.env.PAYPAL_WEBHOOK_SECRET || '').trim(),
    };
  }

  private async fetchAccessToken(): Promise<string | null> {
    const { clientId, clientSecret } = this.getCredentials();
    if (!clientId || !clientSecret) return null;
    const tokenRes = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: 'grant_type=client_credentials',
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    return tokenRes.ok && tokenJson?.access_token ? String(tokenJson.access_token) : null;
  }

  getConfig(): PaymentProviderConfig {
    const creds = this.getCredentials();
    const sandboxReady = Boolean(creds.clientId && creds.clientSecret && creds.webhookSecret);
    const note = sandboxReady
      ? 'PayPal sandbox OAuth credentials configured. Live production billing remains disabled.'
      : 'Awaiting PAYPAL_CLIENT_ID_SANDBOX, PAYPAL_CLIENT_SECRET_SANDBOX, and PAYPAL_WEBHOOK_SECRET.';
    return {
      id: 'paypal',
      provider: 'paypal',
      displayName: 'PayPal',
      supportedCurrencies: ['USD', 'PHP'],
      integrationStatus: sandboxReady ? 'sandbox_ready' : 'live_disabled_pending_credentials',
      mode: sandboxReady ? 'sandbox' : 'disabled',
      isEnabled: sandboxReady,
      liveEnabled: false,
      requiresWebhookSignature: true,
      description: 'International PayPal account and PayPal card checkout.',
      readinessNote: note,
      unavailableMessage: note,
    };
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    try {
      const accessToken = await this.fetchAccessToken();
      if (!accessToken) {
        return {
          provider: this.id,
          environment: 'disabled',
          liveCharged: false,
          status: 'pending_gateway_activation',
          message: 'PayPal sandbox credentials not configured or OAuth unavailable. Order recorded as Pending Payment.',
        };
      }

      const orderRes = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': req.idempotencyKey,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: req.orderId,
              invoice_id: req.orderNumber,
              amount: {
                currency_code: req.currency,
                value: (req.amountMinor / 100).toFixed(2),
              },
            },
          ],
          application_context: {
            return_url: req.returnUrl,
            cancel_url: req.returnUrl,
          },
        }),
      });
      const orderJson: any = await orderRes.json().catch(() => ({}));
      const approveLink = Array.isArray(orderJson?.links)
        ? orderJson.links.find((l: any) => l.rel === 'approve')?.href
        : undefined;
      if (orderRes.ok && approveLink) {
        return {
          provider: this.id,
          environment: 'sandbox',
          liveCharged: false,
          providerTransactionId: String(orderJson.id || ''),
          checkoutUrl: String(approveLink),
          status: 'sandbox_session_created',
          message: 'PayPal sandbox checkout order created. No live charge collected.',
        };
      }
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: `PayPal sandbox order API returned status ${orderRes.status}.`,
      };
    } catch {
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: 'PayPal sandbox unreachable; order safely saved as Pending Payment.',
      };
    }
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>
  ): VerifiedWebhookPayload {
    return verifyHmacSha256Webhook(
      this.id,
      'x-ophireum-paypal-signature',
      'PAYPAL_WEBHOOK_SECRET',
      headers,
      rawBody,
      parsedBody
    );
  }

  async verifyPaymentStatus(providerTransactionId: string): Promise<VerifyPaymentStatusResult> {
    try {
      const accessToken = await this.fetchAccessToken();
      if (!accessToken) {
        return {
          provider: this.id,
          providerTransactionId,
          status: 'unavailable',
          liveVerified: false,
          message: 'PayPal sandbox credentials not configured.',
        };
      }
      const res = await fetch(
        `https://api-m.sandbox.paypal.com/v2/checkout/orders/${encodeURIComponent(providerTransactionId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          provider: this.id,
          providerTransactionId,
          status: 'unavailable',
          liveVerified: false,
          message: `PayPal sandbox lookup returned HTTP ${res.status}.`,
        };
      }
      const raw = String(json.status || '').toUpperCase();
      const status =
        raw === 'COMPLETED' ? 'paid' : raw === 'VOIDED' ? 'failed' : 'pending';
      return {
        provider: this.id,
        providerTransactionId,
        status,
        liveVerified: false,
        message: `PayPal sandbox order status: ${raw || 'UNKNOWN'}`,
      };
    } catch {
      return {
        provider: this.id,
        providerTransactionId,
        status: 'unavailable',
        liveVerified: false,
        message: 'PayPal sandbox status check unreachable.',
      };
    }
  }

  async initiateRefund(input: {
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    reason: string;
  }): Promise<RefundPaymentResult> {
    try {
      const accessToken = await this.fetchAccessToken();
      if (!accessToken) {
        return {
          provider: this.id,
          accepted: false,
          status: 'deferred_merchant_onboarding',
          message: 'PayPal sandbox credentials not configured for refund execution.',
        };
      }
      const res = await fetch(
        `https://api-m.sandbox.paypal.com/v2/payments/captures/${encodeURIComponent(input.providerTransactionId)}/refund`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            amount: {
              value: (input.amountMinor / 100).toFixed(2),
              currency_code: input.currency,
            },
            note_to_payer: input.reason.slice(0, 255),
          }),
        }
      );
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.id) {
        return {
          provider: this.id,
          accepted: true,
          providerRefundId: String(json.id),
          status: 'refund_requested_sandbox',
          message: `PayPal sandbox refund initiated (${json.id}).`,
        };
      }
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: `PayPal sandbox refund returned HTTP ${res.status}.`,
      };
    } catch {
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: 'PayPal sandbox refund endpoint unreachable.',
      };
    }
  }
}

/**
 * Maya Checkout Sandbox Adapter (PHP Maya Business Checkout v1 API).
 */
class MayaPaymentAdapter implements PaymentProviderAdapter {
  readonly id: PaymentProviderId = 'maya';

  private getCredentials() {
    return {
      publicKey: (process.env.MAYA_PUBLIC_KEY_SANDBOX || '').trim(),
      secretKey: (process.env.MAYA_SECRET_KEY_SANDBOX || '').trim(),
      webhookSecret: (process.env.MAYA_WEBHOOK_SECRET || '').trim(),
    };
  }

  getConfig(): PaymentProviderConfig {
    const creds = this.getCredentials();
    const sandboxReady = Boolean(creds.publicKey && creds.webhookSecret);
    const note = sandboxReady
      ? 'Maya sandbox credentials configured. Live production billing remains disabled.'
      : 'Awaiting MAYA_PUBLIC_KEY_SANDBOX and MAYA_WEBHOOK_SECRET.';
    return {
      id: 'maya',
      provider: 'maya',
      displayName: 'Maya',
      supportedCurrencies: ['PHP'],
      integrationStatus: sandboxReady ? 'sandbox_ready' : 'live_disabled_pending_credentials',
      mode: sandboxReady ? 'sandbox' : 'disabled',
      isEnabled: sandboxReady,
      liveEnabled: false,
      requiresWebhookSignature: true,
      description: 'Maya Wallet, QR Ph, and Maya Card Checkout for Philippines.',
      readinessNote: note,
      unavailableMessage: note,
    };
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const { publicKey } = this.getCredentials();
    if (!publicKey) {
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: 'Maya sandbox key not configured. Order recorded as Pending Payment.',
      };
    }
    try {
      const response = await fetch('https://pg-sandbox.paymaya.com/checkout/v1/checkouts', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${publicKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          totalAmount: {
            value: Number((req.amountMinor / 100).toFixed(2)),
            currency: 'PHP',
          },
          requestReferenceNumber: req.orderId,
          redirectUrl: {
            success: req.returnUrl,
            failure: req.returnUrl,
            cancel: req.returnUrl,
          },
        }),
      });
      const json: any = await response.json().catch(() => ({}));
      if (response.ok && json?.redirectUrl) {
        return {
          provider: this.id,
          environment: 'sandbox',
          liveCharged: false,
          providerTransactionId: String(json.checkoutId || ''),
          checkoutUrl: String(json.redirectUrl),
          status: 'sandbox_session_created',
          message: 'Maya sandbox checkout session created. No live charge collected.',
        };
      }
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: `Maya sandbox API returned status ${response.status}.`,
      };
    } catch {
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: 'Maya sandbox unreachable; order safely saved as Pending Payment.',
      };
    }
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>
  ): VerifiedWebhookPayload {
    return verifyHmacSha256Webhook(
      this.id,
      'x-ophireum-maya-signature',
      'MAYA_WEBHOOK_SECRET',
      headers,
      rawBody,
      parsedBody
    );
  }

  async verifyPaymentStatus(providerTransactionId: string): Promise<VerifyPaymentStatusResult> {
    const { secretKey } = this.getCredentials();
    if (!secretKey) {
      return {
        provider: this.id,
        providerTransactionId,
        status: 'unavailable',
        liveVerified: false,
        message: 'MAYA_SECRET_KEY_SANDBOX not configured for payment status verification.',
      };
    }
    try {
      const res = await fetch(
        `https://pg-sandbox.paymaya.com/payments/v1/payments/${encodeURIComponent(providerTransactionId)}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          provider: this.id,
          providerTransactionId,
          status: 'unavailable',
          liveVerified: false,
          message: `Maya sandbox lookup returned HTTP ${res.status}.`,
        };
      }
      const raw = String(json.status || '').toUpperCase();
      const status =
        raw === 'PAYMENT_SUCCESS'
          ? 'paid'
          : raw === 'PAYMENT_FAILED' || raw === 'PAYMENT_EXPIRED'
            ? 'failed'
            : raw === 'REFUNDED'
              ? 'refunded'
              : 'pending';
      return {
        provider: this.id,
        providerTransactionId,
        status,
        liveVerified: false,
        message: `Maya sandbox payment status: ${raw || 'UNKNOWN'}`,
      };
    } catch {
      return {
        provider: this.id,
        providerTransactionId,
        status: 'unavailable',
        liveVerified: false,
        message: 'Maya sandbox status check unreachable.',
      };
    }
  }

  async initiateRefund(input: {
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    reason: string;
  }): Promise<RefundPaymentResult> {
    const { secretKey } = this.getCredentials();
    if (!secretKey) {
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: 'MAYA_SECRET_KEY_SANDBOX not configured for refund execution.',
      };
    }
    try {
      const res = await fetch(
        `https://pg-sandbox.paymaya.com/payments/v1/payments/${encodeURIComponent(input.providerTransactionId)}/refunds`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            totalAmount: {
              amount: Number((input.amountMinor / 100).toFixed(2)),
              currency: input.currency,
            },
            reason: input.reason.slice(0, 200),
          }),
        }
      );
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.id) {
        return {
          provider: this.id,
          accepted: true,
          providerRefundId: String(json.id),
          status: 'refund_requested_sandbox',
          message: `Maya sandbox refund initiated (${json.id}).`,
        };
      }
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: `Maya sandbox refund returned HTTP ${res.status}.`,
      };
    } catch {
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: 'Maya sandbox refund endpoint unreachable.',
      };
    }
  }
}

/**
 * Honest Card Acquiring Adapter for Visa / Mastercard credit & debit cards.
 * Routes through a real configured acquirer (Xendit or Maya) when configured,
 * otherwise remains honestly `deferred_merchant_onboarding` (never invents fake gateways).
 */
class RoutedCardAcquirerAdapter implements PaymentProviderAdapter {
  readonly id: PaymentProviderId;
  private readonly displayName: string;
  private readonly description: string;
  private readonly xendit: XenditPaymentAdapter;
  private readonly maya: MayaPaymentAdapter;

  constructor(
    id: 'credit_card' | 'debit_card',
    displayName: string,
    description: string,
    xendit: XenditPaymentAdapter,
    maya: MayaPaymentAdapter
  ) {
    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.xendit = xendit;
    this.maya = maya;
  }

  private resolveAcquirer(): PaymentProviderAdapter | null {
    if (this.xendit.getConfig().integrationStatus === 'sandbox_ready') {
      return this.xendit;
    }
    if (this.maya.getConfig().integrationStatus === 'sandbox_ready') {
      return this.maya;
    }
    return null;
  }

  getConfig(): PaymentProviderConfig {
    const acquirer = this.resolveAcquirer();
    const note = acquirer
      ? `Hosted card checkout routed via ${acquirer.getConfig().displayName} sandbox acquirer (no card PAN stored by Ophireum). Live billing remains disabled.`
      : 'Deferred pending PCI-DSS hosted card acquirer onboarding (configure Xendit or Maya sandbox acquirer).';
    return {
      id: this.id,
      provider: this.id,
      displayName: this.displayName,
      supportedCurrencies: acquirer?.id === 'maya' ? ['PHP'] : ['USD', 'PHP'],
      integrationStatus: acquirer ? 'sandbox_ready' : 'deferred_merchant_onboarding',
      mode: acquirer ? 'sandbox' : 'disabled',
      isEnabled: Boolean(acquirer),
      liveEnabled: false,
      requiresWebhookSignature: true,
      description: this.description,
      routedAcquirer: acquirer?.id === 'xendit' ? 'xendit' : acquirer?.id === 'maya' ? 'maya' : undefined,
      readinessNote: note,
      unavailableMessage: note,
    };
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const acquirer = this.resolveAcquirer();
    if (!acquirer) {
      return {
        provider: this.id,
        environment: 'disabled',
        liveCharged: false,
        status: 'pending_gateway_activation',
        message: `${this.displayName} hosted card checkout is deferred pending merchant acquirer onboarding. Order saved as Pending Payment.`,
      };
    }
    const delegated = await acquirer.initiatePayment(req);
    return {
      ...delegated,
      provider: this.id,
      message: `${this.displayName} (via ${acquirer.getConfig().displayName}): ${delegated.message}`,
    };
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>
  ): VerifiedWebhookPayload {
    const acquirer = this.resolveAcquirer();
    if (acquirer) {
      const verified = acquirer.verifyWebhook(headers, rawBody, parsedBody);
      return { ...verified, provider: this.id };
    }
    const envName = this.id === 'credit_card' ? 'CARD_WEBHOOK_SECRET' : 'DEBIT_CARD_WEBHOOK_SECRET';
    return verifyHmacSha256Webhook(
      this.id,
      'x-ophireum-card-signature',
      envName,
      headers,
      rawBody,
      parsedBody
    );
  }

  async verifyPaymentStatus(providerTransactionId: string): Promise<VerifyPaymentStatusResult> {
    const acquirer = this.resolveAcquirer();
    if (!acquirer) {
      return {
        provider: this.id,
        providerTransactionId,
        status: 'unavailable',
        liveVerified: false,
        message: `${this.displayName} acquirer is deferred pending merchant onboarding.`,
      };
    }
    const res = await acquirer.verifyPaymentStatus(providerTransactionId);
    return { ...res, provider: this.id };
  }

  async initiateRefund(input: {
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    reason: string;
  }): Promise<RefundPaymentResult> {
    const acquirer = this.resolveAcquirer();
    if (!acquirer) {
      return {
        provider: this.id,
        accepted: false,
        status: 'deferred_merchant_onboarding',
        message: `${this.displayName} refund deferred pending merchant acquirer onboarding.`,
      };
    }
    const res = await acquirer.initiateRefund(input);
    return { ...res, provider: this.id };
  }
}

class DeferredMerchantAdapter implements PaymentProviderAdapter {
  readonly id: PaymentProviderId;
  private readonly displayName: string;
  private readonly currencies: PortalCurrency[];
  private readonly description: string;
  private readonly signatureHeader: string;
  private readonly webhookSecretEnvVar: string;

  constructor(opts: {
    id: PaymentProviderId;
    displayName: string;
    currencies: PortalCurrency[];
    description: string;
    signatureHeader: string;
    webhookSecretEnvVar: string;
  }) {
    this.id = opts.id;
    this.displayName = opts.displayName;
    this.currencies = opts.currencies;
    this.description = opts.description;
    this.signatureHeader = opts.signatureHeader;
    this.webhookSecretEnvVar = opts.webhookSecretEnvVar;
  }

  getConfig(): PaymentProviderConfig {
    const note =
      'Deferred pending verified merchant onboarding and live webhook credentials. Live charges are disabled.';
    return {
      id: this.id,
      provider: this.id,
      displayName: this.displayName,
      supportedCurrencies: this.currencies,
      integrationStatus: 'deferred_merchant_onboarding',
      mode: 'disabled',
      isEnabled: false,
      liveEnabled: false,
      requiresWebhookSignature: true,
      description: this.description,
      readinessNote: note,
      unavailableMessage: note,
    };
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    return {
      provider: this.id,
      environment: 'disabled',
      liveCharged: false,
      status: 'pending_gateway_activation',
      message: `${this.displayName} is deferred pending merchant onboarding. Order ${req.orderNumber} was saved as Pending Payment with no live charge.`,
    };
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>
  ): VerifiedWebhookPayload {
    return verifyHmacSha256Webhook(
      this.id,
      this.signatureHeader,
      this.webhookSecretEnvVar,
      headers,
      rawBody,
      parsedBody
    );
  }

  async verifyPaymentStatus(providerTransactionId: string): Promise<VerifyPaymentStatusResult> {
    return {
      provider: this.id,
      providerTransactionId,
      status: 'unavailable',
      liveVerified: false,
      message: `${this.displayName} status lookup deferred pending merchant onboarding.`,
    };
  }

  async initiateRefund(): Promise<RefundPaymentResult> {
    return {
      provider: this.id,
      accepted: false,
      status: 'deferred_merchant_onboarding',
      message: `${this.displayName} refund execution deferred pending merchant onboarding.`,
    };
  }
}

export class PaymentAdapterRegistry {
  private readonly adapters: Map<PaymentProviderId, PaymentProviderAdapter>;

  constructor() {
    const xendit = new XenditPaymentAdapter();
    const paypal = new PayPalPaymentAdapter();
    const maya = new MayaPaymentAdapter();

    const list: PaymentProviderAdapter[] = [
      xendit,
      paypal,
      maya,
      new RoutedCardAcquirerAdapter(
        'credit_card',
        'Credit Card (Visa / Mastercard)',
        'Hosted PCI-compliant credit card checkout via configured Xendit or Maya acquirer.',
        xendit,
        maya
      ),
      new RoutedCardAcquirerAdapter(
        'debit_card',
        'Debit Card',
        'Hosted debit card checkout via configured Xendit or Maya acquirer.',
        xendit,
        maya
      ),
      new DeferredMerchantAdapter({
        id: 'paymongo',
        displayName: 'PayMongo',
        currencies: ['PHP'],
        description: 'Philippine cards, GCash, GrabPay, and direct online banking via PayMongo.',
        signatureHeader: 'paymongo-signature',
        webhookSecretEnvVar: 'PAYMONGO_WEBHOOK_SECRET',
      }),
      new DeferredMerchantAdapter({
        id: 'gotyme',
        displayName: 'GoTyme Bank',
        currencies: ['PHP'],
        description: 'GoTyme Bank transfer and Visa debit checkout.',
        signatureHeader: 'x-ophireum-gotyme-signature',
        webhookSecretEnvVar: 'GOTYME_WEBHOOK_SECRET',
      }),
    ];

    this.adapters = new Map(list.map((a) => [a.id, a]));
  }

  getAdapter(id: PaymentProviderId): PaymentProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  listConfigs(): PaymentProviderConfig[] {
    return Array.from(this.adapters.values()).map((a) => a.getConfig());
  }
}

export { PaymentAdapterRegistry as PaymentGatewayRegistry };
