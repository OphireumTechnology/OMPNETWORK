import crypto from 'crypto';
import { PaymentProviderId, PortalCurrency } from '../types';

export interface PaymentProviderConfigView {
  provider: PaymentProviderId;
  displayName: string;
  category: 'card' | 'ewallet' | 'international' | 'bank';
  description: string;
  supportedCurrencies: PortalCurrency[];
  paymentMethods: string[];
  mode: 'disabled' | 'sandbox' | 'live';
  isEnabled: boolean;
  integrationStatus: 'configured_sandbox' | 'awaiting_credentials' | 'deferred_merchant_onboarding';
  webhookPath: string;
  requiredEnvVars: string[];
  lastVerifiedAt: string | null;
  unavailableMessage: string;
}

export interface PaymentInitiationRequest {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: PortalCurrency;
  customerEmail: string;
  idempotencyKey: string;
  returnUrl: string;
}

export interface PaymentInitiationResult {
  initiated: boolean;
  provider: PaymentProviderId;
  environment: 'disabled' | 'sandbox' | 'live';
  providerTransactionId?: string;
  checkoutUrl?: string;
  message: string;
}

export interface VerifiedWebhookPayload {
  verified: boolean;
  providerEventId?: string;
  orderId?: string;
  providerTransactionId?: string;
  amountMinor?: number;
  currency?: PortalCurrency;
  status?: 'paid' | 'failed' | 'refunded';
  error?: string;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProviderId;
  getConfig(): PaymentProviderConfigView;
  initiatePayment(req: PaymentInitiationRequest): Promise<PaymentInitiationResult>;
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawBody: string, parsedBody: Record<string, unknown>): VerifiedWebhookPayload;
  verifyPaymentStatus(providerTransactionId: string): Promise<{ supported: boolean; status: string; message: string }>;
  initiateRefund(providerTransactionId: string, amountMinor: number, reason: string): Promise<{ supported: boolean; message: string }>;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      return Array.isArray(v) ? String(v[0] || '') : String(v || '');
    }
  }
  return '';
}

function buildWebhookVerifier(
  secretEnvVar: string,
  signatureHeader: string,
  scheme: 'hmac_sha256' | 'static_token'
) {
  return (
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    parsedBody: Record<string, unknown>
  ): VerifiedWebhookPayload => {
    const secret = (process.env[secretEnvVar] || '').trim();
    if (!secret) {
      return { verified: false, error: `Webhook verification secret (${secretEnvVar}) is not configured on the server.` };
    }
    const provided = getHeader(headers, signatureHeader).trim();
    if (!provided) {
      return { verified: false, error: `Missing webhook signature header: ${signatureHeader}` };
    }
    let valid = false;
    if (scheme === 'static_token') {
      // Xendit callback verification uses a constant-time static x-callback-token header
      valid = constantTimeEquals(provided, secret);
    } else {
      // Strictly require cryptographic HMAC-SHA256 digest over the exact raw request body
      const expectedHmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
      const cleanProvided = provided.replace(/^sha256=/i, '');
      valid = constantTimeEquals(cleanProvided, expectedHmac);
    }
    if (!valid) {
      return { verified: false, error: 'Webhook signature verification failed.' };
    }
    const providerEventId = String(parsedBody.eventId || parsedBody.id || '').trim();
    const orderId = String(parsedBody.orderId || parsedBody.external_id || '').trim();
    const providerTransactionId = String(parsedBody.transactionId || parsedBody.payment_id || providerEventId).trim();
    const amountMinor = Number(parsedBody.amountMinor);
    const currency = parsedBody.currency === 'PHP' ? 'PHP' : parsedBody.currency === 'USD' ? 'USD' : undefined;
    const rawStatus = String(parsedBody.status || '').toLowerCase();
    const status =
      rawStatus === 'paid' || rawStatus === 'succeeded' || rawStatus === 'completed'
        ? 'paid'
        : rawStatus === 'refunded'
        ? 'refunded'
        : rawStatus === 'failed'
        ? 'failed'
        : undefined;

    if (!providerEventId || !orderId || !Number.isInteger(amountMinor) || amountMinor <= 0 || !currency || !status) {
      return { verified: false, error: 'Webhook payload is missing required verified transaction fields.' };
    }
    return {
      verified: true,
      providerEventId,
      orderId,
      providerTransactionId,
      amountMinor,
      currency,
      status,
    };
  };
}

function createStandardAdapter(spec: {
  provider: PaymentProviderId;
  displayName: string;
  category: PaymentProviderConfigView['category'];
  description: string;
  supportedCurrencies: PortalCurrency[];
  paymentMethods: string[];
  keyEnvVar: string;
  webhookSecretEnvVar: string;
  signatureHeader: string;
  verificationScheme?: 'hmac_sha256' | 'static_token';
  deferred?: boolean;
}): PaymentProviderAdapter {
  const verifyWebhook = buildWebhookVerifier(
    spec.webhookSecretEnvVar,
    spec.signatureHeader,
    spec.verificationScheme || 'hmac_sha256'
  );

  return {
    provider: spec.provider,
    getConfig(): PaymentProviderConfigView {
      const hasKey = Boolean((process.env[spec.keyEnvVar] || '').trim());
      const hasWebhook = Boolean((process.env[spec.webhookSecretEnvVar] || '').trim());
      const isSandboxReady = !spec.deferred && hasKey && hasWebhook;
      return {
        provider: spec.provider,
        displayName: spec.displayName,
        category: spec.category,
        description: spec.description,
        supportedCurrencies: spec.supportedCurrencies,
        paymentMethods: spec.paymentMethods,
        mode: isSandboxReady ? 'sandbox' : 'disabled',
        isEnabled: isSandboxReady,
        integrationStatus: spec.deferred
          ? 'deferred_merchant_onboarding'
          : isSandboxReady
          ? 'configured_sandbox'
          : 'awaiting_credentials',
        webhookPath: `/api/portal/webhooks/${spec.provider}`,
        requiredEnvVars: [spec.keyEnvVar, spec.webhookSecretEnvVar],
        lastVerifiedAt: null,
        unavailableMessage: spec.deferred
          ? `${spec.displayName} is reserved for direct merchant onboarding and is not yet enabled for live transactions.`
          : `${spec.displayName} is currently in integration readiness mode. Live payment collection remains disabled until verified credentials and webhook tests are approved.`,
      };
    },
    async initiatePayment(req: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
      const cfg = this.getConfig();
      if (!cfg.isEnabled) {
        return {
          initiated: false,
          provider: spec.provider,
          environment: 'disabled',
          message: cfg.unavailableMessage,
        };
      }
      return {
        initiated: false,
        provider: spec.provider,
        environment: 'sandbox',
        providerTransactionId: `sbx_${spec.provider}_${req.orderNumber.toLowerCase()}`,
        message: `${spec.displayName} sandbox credentials detected. Complete hosted checkout session wiring and end-to-end webhook certification before activating charges.`,
      };
    },
    verifyWebhook,
    async verifyPaymentStatus(providerTransactionId: string) {
      return {
        supported: this.getConfig().isEnabled,
        status: 'unverified_provider_disabled',
        message: `Server-to-server status lookup for ${spec.displayName} (${providerTransactionId}) requires active merchant API credentials.`,
      };
    },
    async initiateRefund(providerTransactionId: string, amountMinor: number, reason: string) {
      return {
        supported: false,
        message: `Refund request (${amountMinor} minor units, ${reason}) for ${providerTransactionId} requires authorized operations approval and active ${spec.displayName} credentials.`,
      };
    },
  };
}

export class PaymentGatewayRegistry {
  private readonly adapters: Map<PaymentProviderId, PaymentProviderAdapter>;

  constructor() {
    const list: PaymentProviderAdapter[] = [
      createStandardAdapter({
        provider: 'xendit',
        displayName: 'Xendit (Philippines)',
        category: 'ewallet',
        description: 'Primary Philippine gateway supporting QR Ph, e-wallets, online banking, and cards upon merchant activation.',
        supportedCurrencies: ['PHP'],
        paymentMethods: ['QR Ph', 'GCash', 'Maya', 'Online Banking', 'Cards'],
        keyEnvVar: 'XENDIT_SECRET_KEY_TEST',
        webhookSecretEnvVar: 'XENDIT_WEBHOOK_TOKEN_TEST',
        signatureHeader: 'x-callback-token',
        verificationScheme: 'static_token',
      }),
      createStandardAdapter({
        provider: 'paypal',
        displayName: 'PayPal',
        category: 'international',
        description: 'International hosted checkout supporting USD and PHP commercial settlements.',
        supportedCurrencies: ['USD', 'PHP'],
        paymentMethods: ['PayPal Balance', 'International Cards'],
        keyEnvVar: 'PAYPAL_CLIENT_SECRET_SANDBOX',
        webhookSecretEnvVar: 'PAYPAL_WEBHOOK_SECRET_SANDBOX',
        signatureHeader: 'x-paypal-webhook-signature',
      }),
      createStandardAdapter({
        provider: 'credit_card',
        displayName: 'Credit Card (Hosted Checkout)',
        category: 'card',
        description: 'PCI-compliant tokenized Visa, Mastercard, and JCB checkout routed through an approved acquiring gateway.',
        supportedCurrencies: ['USD', 'PHP'],
        paymentMethods: ['Visa', 'Mastercard', 'JCB'],
        keyEnvVar: 'CARD_GATEWAY_SECRET_KEY_TEST',
        webhookSecretEnvVar: 'CARD_GATEWAY_WEBHOOK_SECRET_TEST',
        signatureHeader: 'x-gateway-signature',
      }),
      createStandardAdapter({
        provider: 'debit_card',
        displayName: 'Debit Card (Hosted Checkout)',
        category: 'card',
        description: '3DS-authenticated debit card checkout via PCI-compliant hosted fields (zero card storage on Ophireum servers).',
        supportedCurrencies: ['PHP', 'USD'],
        paymentMethods: ['Visa Debit', 'Mastercard Debit'],
        keyEnvVar: 'CARD_GATEWAY_SECRET_KEY_TEST',
        webhookSecretEnvVar: 'CARD_GATEWAY_WEBHOOK_SECRET_TEST',
        signatureHeader: 'x-gateway-signature',
      }),
      createStandardAdapter({
        provider: 'maya',
        displayName: 'Maya Checkout',
        category: 'ewallet',
        description: 'Direct Maya Wallet, QR Ph, and card checkout prepared for Phase 2 Philippine merchant onboarding.',
        supportedCurrencies: ['PHP'],
        paymentMethods: ['Maya Wallet', 'QR Ph', 'Cards'],
        keyEnvVar: 'MAYA_SECRET_KEY_TEST',
        webhookSecretEnvVar: 'MAYA_WEBHOOK_SECRET_TEST',
        signatureHeader: 'x-maya-signature',
      }),
      createStandardAdapter({
        provider: 'paymongo',
        displayName: 'PayMongo',
        category: 'ewallet',
        description: 'Philippine payment adapter slot ready for activation once merchant onboarding completes.',
        supportedCurrencies: ['PHP'],
        paymentMethods: ['GCash', 'Maya', 'GrabPay', 'Cards'],
        keyEnvVar: 'PAYMONGO_SECRET_KEY_TEST',
        webhookSecretEnvVar: 'PAYMONGO_WEBHOOK_SECRET_TEST',
        signatureHeader: 'paymongo-signature',
        deferred: true,
      }),
      createStandardAdapter({
        provider: 'gotyme',
        displayName: 'GoTyme Bank',
        category: 'bank',
        description: 'Direct GoTyme integration slot reserved pending direct merchant partnership and API credentials.',
        supportedCurrencies: ['PHP'],
        paymentMethods: ['GoTyme Direct'],
        keyEnvVar: 'GOTYME_API_SECRET_TEST',
        webhookSecretEnvVar: 'GOTYME_WEBHOOK_SECRET_TEST',
        signatureHeader: 'x-gotyme-signature',
        deferred: true,
      }),
    ];

    this.adapters = new Map(list.map((a) => [a.provider, a]));
  }

  public listConfigs(): PaymentProviderConfigView[] {
    return Array.from(this.adapters.values()).map((a) => a.getConfig());
  }

  public getAdapter(provider: PaymentProviderId): PaymentProviderAdapter | undefined {
    return this.adapters.get(provider);
  }
}
