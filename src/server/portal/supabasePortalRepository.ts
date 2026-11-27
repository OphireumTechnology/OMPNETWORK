import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LocalPortalRepository } from './localPortalRepository';
import {
  ClientAddressRecord,
  CreditTransactionRecord,
  CreditTransactionType,
  CreditWalletRecord,
  CustomerOrganizationRecord,
  DigitalDownloadLogRecord,
  DigitalEntitlementRecord,
  DiscountCodeRecord,
  InvoiceRecord,
  NotificationRecord,
  OrderRecord,
  OrderStatus,
  PaymentProviderId,
  PaymentRecord,
  PaymentRefundRecord,
  PortalConsentRecord,
  PortalCurrency,
  PortalProfileRecord,
  PortalRepository,
  PortalUserRecord,
  ProductCategoryRecord,
  ProductRecord,
  ProjectDeliverableRecord,
  ProjectMessageRecord,
  ProjectMilestoneRecord,
  ProjectRecord,
  ProjectStage,
  RevisionRequestRecord,
  ShoppingCartRecord,
  SubscriptionRecord,
  SupportTicketCategory,
  SupportTicketRecord,
  SupportTicketStatus,
  UserMfaState,
} from './types';
import { PORTAL_INITIAL_PRODUCTS, PORTAL_PRODUCT_CATEGORIES } from './catalogSeed';

export interface SupabasePortalRepositoryOptions {
  /**
   * When true (default in NODE_ENV=production), database write errors throw
   * instead of silently falling back to in-memory state.
   */
  strictPersistence?: boolean;
  /** Optional injected SupabaseClient for deterministic integration tests. */
  client?: SupabaseClient;
}

/**
 * Production Supabase PostgreSQL + Supabase Auth + Supabase Storage adapter.
 *
 * Uses the server-only SUPABASE_SERVICE_ROLE_KEY after Express verifies the client identity
 * and enforces explicit client ownership (user_id === authenticatedUser.id) on every operation,
 * complementing the database-level Row Level Security policies in migrations 000–004.
 *
 * Reconciliation repairs:
 * - Fixed invalid `portal_profiles` table reference -> authoritative `public.profiles` table.
 * - Eliminated silent error swallowing on write paths: `assertOk()` throws on persistence failure
 *   when `strictPersistence` is enabled (always enabled in production).
 * - Implemented durable PostgreSQL persistence across profiles, addresses, organizations, carts,
 *   orders, order_items, invoices, payments, payment_webhook_events, payment_refunds, credit_wallets,
 *   credit_transactions, subscriptions, projects, milestones, messages, deliverables, revisions,
 *   support_tickets, notifications, digital_entitlements, digital_download_logs, consents, MFA, and promotions.
 */
export class SupabasePortalRepository extends LocalPortalRepository implements PortalRepository {
  public override readonly mode = 'supabase' as const;
  public override readonly supabaseWritePersistenceImplemented = true;
  public readonly supabase: SupabaseClient;
  public readonly strictPersistence: boolean;
  public readonly storageBucket = 'customer-uploads';

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    options?: SupabasePortalRepositoryOptions
  ) {
    super({ persistDir: null });
    this.strictPersistence =
      options?.strictPersistence ?? process.env.NODE_ENV === 'production';
    this.supabase =
      options?.client ??
      createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
  }

  private assertOk(operation: string, result: { error?: { message?: string } | null }): void {
    if (result?.error) {
      const msg = `[SupabasePortalRepository] ${operation} failed: ${result.error.message || 'database error'}`;
      if (this.strictPersistence) {
        throw new Error(msg);
      }
      console.error(msg);
    }
  }

  override async allocatePaymentReference(date?: Date): Promise<string> {
    const { data, error } = await this.supabase.rpc('allocate_ophireum_payment_ref', {
      p_ts: (date || new Date()).toISOString(),
    });
    if (!error && typeof data === 'string' && data.length >= 17) {
      return data;
    }
    if (this.strictPersistence) {
      throw new Error(
        `[SupabasePortalRepository] allocate_ophireum_payment_ref RPC failed: ${error?.message || 'invalid response'}`
      );
    }
    return super.allocatePaymentReference(date);
  }

  // ---- Users, Profiles, Organizations & Addresses ----

  override async createUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
    verificationTokenHash: string;
    verificationTokenExpiresAt?: string;
  }): Promise<{ user: PortalUserRecord; profile: PortalProfileRecord }> {
    const created = await super.createUser(input);
    const res = await this.supabase.from('profiles').upsert(
      {
        id: created.user.id,
        email: created.profile.email,
        first_name: created.profile.firstName,
        last_name: created.profile.lastName,
        full_name: created.profile.fullName,
        phone: created.profile.phone,
        company_name: created.profile.companyName,
        tax_id: created.profile.taxId,
        avatar_url: created.profile.avatarUrl,
        timezone: created.profile.timezone,
        preferred_currency: created.profile.preferredCurrency,
        notification_preferences: created.profile.notificationPreferences,
        account_status: created.user.accountStatus,
        email_verified: created.user.emailVerified,
        updated_at: created.profile.updatedAt,
      },
      { onConflict: 'id' }
    );
    this.assertOk('createUser:profiles.upsert', res);

    const walletRes = await this.supabase.from('credit_wallets').upsert(
      {
        user_id: created.user.id,
        available_credits: 0,
        used_credits: 0,
        pending_credits: 0,
        expiring_credits: 0,
        updated_at: created.user.updatedAt,
      },
      { onConflict: 'user_id' }
    );
    this.assertOk('createUser:credit_wallets.upsert', walletRes);
    return created;
  }

  override async getProfile(userId: string): Promise<PortalProfileRecord | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(
        'id, email, first_name, last_name, full_name, phone, company_name, tax_id, avatar_url, timezone, preferred_currency, notification_preferences, created_at, updated_at'
      )
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      return {
        id: String(data.id),
        userId: String(data.id),
        email: String(data.email || ''),
        firstName: String(data.first_name || ''),
        lastName: String(data.last_name || ''),
        fullName: String(data.full_name || ''),
        phone: String(data.phone || ''),
        companyName: String(data.company_name || ''),
        taxId: String(data.tax_id || ''),
        avatarUrl: String(data.avatar_url || ''),
        timezone: String(data.timezone || 'Asia/Manila'),
        preferredCurrency: data.preferred_currency === 'PHP' ? 'PHP' : 'USD',
        notificationPreferences: (data.notification_preferences as PortalProfileRecord['notificationPreferences']) || {
          emailOrders: true,
          emailProjects: true,
          emailMessages: true,
          emailBilling: true,
          inAppAll: true,
        },
        createdAt: String(data.created_at || new Date().toISOString()),
        updatedAt: String(data.updated_at || new Date().toISOString()),
      };
    }
    if (error && this.strictPersistence) {
      this.assertOk('getProfile:profiles.select', { error });
    }
    return super.getProfile(userId);
  }

  override async updateProfile(
    userId: string,
    patch: Partial<PortalProfileRecord>
  ): Promise<PortalProfileRecord> {
    const updated = await super.updateProfile(userId, patch);
    // Uses authoritative public.profiles table from 002_client_portal_commerce.sql
    const res = await this.supabase.from('profiles').upsert(
      {
        id: userId,
        email: updated.email,
        first_name: updated.firstName,
        last_name: updated.lastName,
        full_name: updated.fullName,
        phone: updated.phone,
        company_name: updated.companyName,
        tax_id: updated.taxId,
        avatar_url: updated.avatarUrl,
        timezone: updated.timezone,
        preferred_currency: updated.preferredCurrency,
        notification_preferences: updated.notificationPreferences,
        updated_at: updated.updatedAt,
      },
      { onConflict: 'id' }
    );
    this.assertOk('updateProfile:profiles.upsert', res);
    return updated;
  }

  override async suspendUser(userId: string, reason: string, actor: string): Promise<PortalUserRecord | null> {
    const updated = await super.suspendUser(userId, reason, actor);
    if (!updated) return null;
    const res = await this.supabase
      .from('profiles')
      .update({
        account_status: 'suspended',
        suspended_at: updated.suspendedAt,
        suspension_reason: updated.suspensionReason,
        updated_at: updated.updatedAt,
      })
      .eq('id', userId);
    this.assertOk('suspendUser:profiles.update', res);
    return updated;
  }

  override async reactivateUser(userId: string, actor: string): Promise<PortalUserRecord | null> {
    const updated = await super.reactivateUser(userId, actor);
    if (!updated) return null;
    const res = await this.supabase
      .from('profiles')
      .update({
        account_status: 'active',
        suspended_at: null,
        suspension_reason: null,
        updated_at: updated.updatedAt,
      })
      .eq('id', userId);
    this.assertOk('reactivateUser:profiles.update', res);
    return updated;
  }

  override async setUserMfaState(userId: string, state: UserMfaState): Promise<void> {
    await super.setUserMfaState(userId, state);
    const res = await this.supabase.from('mfa_credentials').upsert(
      {
        principal_type: 'customer',
        principal_id: userId,
        encrypted_secret: state.encryptedSecret || state.secret || '',
        enabled: state.enabled,
        last_used_step: state.lastUsedStep ?? null,
        failed_attempts: state.failedAttempts ?? 0,
        locked_until: state.lockedUntil ?? null,
        enrolled_at: state.enrolledAt ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'principal_type,principal_id' }
    );
    this.assertOk('setUserMfaState:mfa_credentials.upsert', res);
  }

  override async upsertAddress(
    userId: string,
    address: Omit<ClientAddressRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<ClientAddressRecord> {
    const saved = await super.upsertAddress(userId, address);
    const res = await this.supabase.from('client_addresses').upsert(
      {
        id: saved.id,
        user_id: userId,
        label: saved.label,
        line1: saved.line1,
        line2: saved.line2,
        city: saved.city,
        state_province: saved.stateProvince,
        postal_code: saved.postalCode,
        country: saved.country,
        is_default: saved.isDefault,
        updated_at: saved.updatedAt,
      },
      { onConflict: 'id' }
    );
    this.assertOk('upsertAddress:client_addresses.upsert', res);
    return saved;
  }

  override async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const deleted = await super.deleteAddress(userId, addressId);
    if (deleted) {
      const res = await this.supabase
        .from('client_addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', userId);
      this.assertOk('deleteAddress:client_addresses.delete', res);
    }
    return deleted;
  }

  override async upsertOrganization(
    userId: string,
    input: Partial<Omit<CustomerOrganizationRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerOrganizationRecord> {
    const org = await super.upsertOrganization(userId, input);
    const res = await this.supabase.from('customer_organizations').upsert(
      {
        id: org.id,
        owner_user_id: userId,
        legal_name: org.legalName,
        trade_name: org.tradeName,
        tax_id: org.taxId,
        industry: org.industry,
        billing_email: org.billingEmail,
        billing_address: org.billingAddress,
        country: org.country,
        updated_at: org.updatedAt,
      },
      { onConflict: 'id' }
    );
    this.assertOk('upsertOrganization:customer_organizations.upsert', res);
    return org;
  }

  // ---- Catalog & Cart ----

  override async listCategories(): Promise<ProductCategoryRecord[]> {
    const { data, error } = await this.supabase
      .from('product_categories')
      .select('id, slug, name, description, sort_order')
      .order('sort_order', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: String(row.id),
        slug: String(row.slug),
        name: String(row.name),
        description: String(row.description || ''),
        sortOrder: Number(row.sort_order || 0),
      }));
    }
    if (error && this.strictPersistence) {
      this.assertOk('listCategories:product_categories.select', { error });
    }
    return PORTAL_PRODUCT_CATEGORIES;
  }

  override async listProducts(filters?: { categorySlug?: string; search?: string }): Promise<ProductRecord[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select(
        'id, category_id, category_slug, slug, name, short_description, full_description, sample_deliverables, required_client_materials, terms_summary, faqs, is_active, is_featured, created_at, updated_at, product_packages(*)'
      )
      .eq('is_active', true);

    if (!error && data && data.length > 0) {
      let mapped: ProductRecord[] = data.map((row: any) => ({
        id: String(row.id),
        categoryId: String(row.category_id),
        categorySlug: String(row.category_slug),
        slug: String(row.slug),
        name: String(row.name),
        shortDescription: String(row.short_description || ''),
        fullDescription: String(row.full_description || ''),
        sampleDeliverables: Array.isArray(row.sample_deliverables) ? row.sample_deliverables : [],
        requiredClientMaterials: Array.isArray(row.required_client_materials) ? row.required_client_materials : [],
        termsSummary: String(row.terms_summary || ''),
        faqs: Array.isArray(row.faqs) ? row.faqs : [],
        isActive: Boolean(row.is_active),
        isFeatured: Boolean(row.is_featured),
        packages: Array.isArray(row.product_packages)
          ? row.product_packages.map((pkg: any) => ({
              id: String(pkg.id),
              productId: String(pkg.product_id),
              name: String(pkg.name),
              tierCode: String(pkg.tier_code),
              priceUsdMinor: Number(pkg.price_usd_minor || 0),
              pricePhpMinor: Number(pkg.price_php_minor || 0),
              isCustomQuote: Boolean(pkg.is_custom_quote),
              billingType: pkg.billing_type || 'one_time',
              creditsIncluded: Number(pkg.credits_included || 0),
              turnaroundLabel: String(pkg.turnaround_label || ''),
              validityDays: pkg.validity_days ? Number(pkg.validity_days) : undefined,
              revisionLimit: Number(pkg.revision_limit || 1),
              usageLimits: String(pkg.usage_limits || ''),
              deliveryConditions: String(pkg.delivery_conditions || ''),
              supportLevel: String(pkg.support_level || ''),
              features: Array.isArray(pkg.features) ? pkg.features : [],
              isPopular: Boolean(pkg.is_popular),
              isIllustrativePricing: Boolean(pkg.is_illustrative_pricing ?? true),
            }))
          : [],
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }));

      if (filters?.categorySlug && filters.categorySlug !== 'all') {
        mapped = mapped.filter((p) => p.categorySlug === filters.categorySlug);
      }
      if (filters?.search?.trim()) {
        const q = filters.search.trim().toLowerCase();
        mapped = mapped.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.shortDescription.toLowerCase().includes(q) ||
            p.categorySlug.toLowerCase().includes(q)
        );
      }
      return mapped;
    }
    if (error && this.strictPersistence) {
      this.assertOk('listProducts:products.select', { error });
    }
    return super.listProducts(filters);
  }

  override async getProductBySlug(slug: string): Promise<ProductRecord | null> {
    const list = await this.listProducts();
    return list.find((p) => p.slug === slug) || PORTAL_INITIAL_PRODUCTS.find((p) => p.slug === slug) || null;
  }

  override async saveCart(cart: ShoppingCartRecord): Promise<ShoppingCartRecord> {
    const saved = await super.saveCart(cart);
    const res = await this.supabase.from('shopping_carts').upsert(
      {
        id: saved.id,
        user_id: saved.userId,
        currency: saved.currency,
        discount_code: saved.discountCode || null,
        updated_at: saved.updatedAt,
      },
      { onConflict: 'user_id' }
    );
    this.assertOk('saveCart:shopping_carts.upsert', res);
    return saved;
  }

  // ---- Orders, Payments, Webhooks, Invoices, Refunds & Digital Entitlements ----

  override async createOrder(
    input: Omit<OrderRecord, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<{ order: OrderRecord; invoice: InvoiceRecord; payment: PaymentRecord }> {
    const created = await super.createOrder(input);

    const orderRes = await this.supabase.from('orders').insert({
      id: created.order.id,
      order_number: created.order.orderNumber,
      user_id: created.order.userId,
      currency: created.order.currency,
      fx_rate_snapshot: created.order.fxRateSnapshot,
      subtotal_minor: created.order.subtotalMinor,
      discount_code: created.order.discountCode || null,
      discount_minor: created.order.discountMinor,
      tax_minor: created.order.taxMinor,
      total_minor: created.order.totalMinor,
      payment_provider: created.order.paymentProvider,
      payment_status: created.order.paymentStatus,
      fulfillment_status: created.order.fulfillmentStatus,
      billing_details: created.order.billingDetails,
      project_requirements: created.order.projectRequirements || null,
      idempotency_key: created.order.idempotencyKey || null,
      expires_at: created.order.expiresAt || null,
      timeline: created.order.timeline,
    });
    this.assertOk('createOrder:orders.insert', orderRes);

    if (created.order.items.length > 0) {
      const itemsRes = await this.supabase.from('order_items').insert(
        created.order.items.map((item) => ({
          id: item.id,
          order_id: created.order.id,
          product_id: item.productId,
          package_id: item.packageId,
          product_name: item.productName,
          package_name: item.packageName,
          billing_type: item.billingType,
          quantity: item.quantity,
          unit_price_minor: item.unitPriceMinor,
          line_total_minor: item.lineTotalMinor,
          credits_allocated: item.creditsAllocated,
          revision_limit: item.revisionLimit,
        }))
      );
      this.assertOk('createOrder:order_items.insert', itemsRes);
    }

    const invoiceRes = await this.supabase.from('invoices').insert({
      id: created.invoice.id,
      invoice_number: created.invoice.invoiceNumber,
      order_id: created.order.id,
      user_id: created.order.userId,
      currency: created.invoice.currency,
      subtotal_minor: created.invoice.subtotalMinor,
      discount_minor: created.invoice.discountMinor,
      tax_minor: created.invoice.taxMinor,
      total_minor: created.invoice.totalMinor,
      payment_status: created.invoice.paymentStatus,
      client_billing: created.invoice.clientBilling,
      line_items: created.invoice.lineItems,
      issued_at: created.invoice.issuedAt,
      due_at: created.invoice.dueAt,
    });
    this.assertOk('createOrder:invoices.insert', invoiceRes);

    const paymentRes = await this.supabase.from('payments').insert({
      id: created.payment.id,
      order_id: created.order.id,
      user_id: created.order.userId,
      provider: created.payment.provider,
      environment: created.payment.environment,
      amount_minor: created.payment.amountMinor,
      currency: created.payment.currency,
      status: created.payment.status,
      idempotency_key: created.payment.idempotencyKey,
    });
    this.assertOk('createOrder:payments.insert', paymentRes);

    return created;
  }

  override async recordWebhookAndConfirmPayment(input: {
    provider: PaymentProviderId;
    providerEventId: string;
    orderId: string;
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    eventStatus: 'paid' | 'failed' | 'refunded';
    payloadSummary: Record<string, unknown>;
  }) {
    const outcome = await super.recordWebhookAndConfirmPayment(input);

    const whRes = await this.supabase.from('payment_webhook_events').upsert(
      {
        provider: input.provider,
        provider_event_id: input.providerEventId,
        signature_verified: true,
        processing_status: outcome.deduplicated ? 'ignored_duplicate' : 'processed',
        payload_summary: input.payloadSummary,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'provider,provider_event_id' }
    );
    this.assertOk('recordWebhookAndConfirmPayment:payment_webhook_events.upsert', whRes);

    if (outcome.order) {
      const ordRes = await this.supabase
        .from('orders')
        .update({
          payment_status: outcome.order.paymentStatus,
          fulfillment_status: outcome.order.fulfillmentStatus,
          payment_reference: outcome.order.paymentReference || null,
          timeline: outcome.order.timeline,
          updated_at: outcome.order.updatedAt,
        })
        .eq('id', outcome.order.id);
      this.assertOk('recordWebhookAndConfirmPayment:orders.update', ordRes);

      const invRes = await this.supabase
        .from('invoices')
        .update({ payment_status: outcome.order.paymentStatus })
        .eq('order_id', outcome.order.id);
      this.assertOk('recordWebhookAndConfirmPayment:invoices.update', invRes);

      const payRes = await this.supabase
        .from('payments')
        .update({
          status: outcome.order.paymentStatus,
          provider_transaction_id: input.providerTransactionId,
          updated_at: outcome.order.updatedAt,
        })
        .eq('order_id', outcome.order.id);
      this.assertOk('recordWebhookAndConfirmPayment:payments.update', payRes);
    }

    if (outcome.entitlementsCreated && outcome.entitlementsCreated.length > 0) {
      const entRes = await this.supabase.from('digital_entitlements').insert(
        outcome.entitlementsCreated.map((ent) => ({
          id: ent.id,
          user_id: ent.userId,
          order_id: ent.orderId,
          product_id: ent.productId,
          license_key: ent.licenseKey,
          version_label: ent.versionLabel,
          max_downloads: ent.maxDownloads,
          download_count: ent.downloadCount,
          status: ent.status,
          expires_at: ent.expiresAt || null,
        }))
      );
      this.assertOk('recordWebhookAndConfirmPayment:digital_entitlements.insert', entRes);
    }

    return outcome;
  }

  override async applyCreditLedgerEntry(input: {
    userId: string;
    transactionType: CreditTransactionType;
    amount: number;
    description: string;
    relatedOrderId?: string;
    relatedProjectId?: string;
    idempotencyKey?: string;
  }): Promise<{ wallet: CreditWalletRecord; transaction: CreditTransactionRecord }> {
    const result = await super.applyCreditLedgerEntry(input);
    const walletRes = await this.supabase.from('credit_wallets').upsert(
      {
        user_id: result.wallet.userId,
        available_credits: result.wallet.availableCredits,
        used_credits: result.wallet.usedCredits,
        pending_credits: result.wallet.pendingCredits,
        expiring_credits: result.wallet.expiringCredits,
        updated_at: result.wallet.updatedAt,
      },
      { onConflict: 'user_id' }
    );
    this.assertOk('applyCreditLedgerEntry:credit_wallets.upsert', walletRes);

    const txRes = await this.supabase.from('credit_transactions').upsert(
      {
        id: result.transaction.id,
        user_id: result.transaction.userId,
        transaction_type: result.transaction.transactionType,
        amount: result.transaction.amount,
        balance_after: result.transaction.balanceAfter,
        related_order_id: result.transaction.relatedOrderId || null,
        related_project_id: result.transaction.relatedProjectId || null,
        description: result.transaction.description,
        idempotency_key: result.transaction.idempotencyKey || null,
      },
      { onConflict: 'id' }
    );
    this.assertOk('applyCreditLedgerEntry:credit_transactions.upsert', txRes);
    return result;
  }

  override async recordDigitalDownload(input: {
    userId: string;
    entitlementId: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<{ entitlement?: DigitalEntitlementRecord; log?: DigitalDownloadLogRecord; error?: string }> {
    const outcome = await super.recordDigitalDownload(input);
    if (outcome.entitlement && outcome.log) {
      const entRes = await this.supabase
        .from('digital_entitlements')
        .update({ download_count: outcome.entitlement.downloadCount, status: outcome.entitlement.status })
        .eq('id', outcome.entitlement.id);
      this.assertOk('recordDigitalDownload:digital_entitlements.update', entRes);

      const logRes = await this.supabase.from('digital_download_logs').insert({
        id: outcome.log.id,
        entitlement_id: outcome.log.entitlementId,
        user_id: outcome.log.userId,
        ip_address: outcome.log.ipAddress,
        user_agent: outcome.log.userAgent,
      });
      this.assertOk('recordDigitalDownload:digital_download_logs.insert', logRes);
    }
    return outcome;
  }

  override async revokeDigitalEntitlement(
    entitlementId: string,
    reason: string,
    actor: string
  ): Promise<DigitalEntitlementRecord | null> {
    const ent = await super.revokeDigitalEntitlement(entitlementId, reason, actor);
    if (!ent) return null;
    const res = await this.supabase
      .from('digital_entitlements')
      .update({ status: 'revoked' })
      .eq('id', entitlementId);
    this.assertOk('revokeDigitalEntitlement:digital_entitlements.update', res);
    return ent;
  }

  // ---- Subscriptions ----

  override async requestSubscriptionCancel(userId: string, subscriptionId: string): Promise<SubscriptionRecord | null> {
    const sub = await super.requestSubscriptionCancel(userId, subscriptionId);
    if (!sub) return null;
    const res = await this.supabase
      .from('subscriptions')
      .update({
        status: sub.status,
        cancel_requested_at: sub.cancelRequestedAt,
        updated_at: sub.updatedAt,
      })
      .eq('id', sub.id)
      .eq('user_id', userId);
    this.assertOk('requestSubscriptionCancel:subscriptions.update', res);
    return sub;
  }

  override async renewSubscription(subscriptionId: string, providerTransactionId?: string) {
    const outcome = await super.renewSubscription(subscriptionId, providerTransactionId);
    if (!outcome) return null;
    const res = await this.supabase
      .from('subscriptions')
      .update({
        status: outcome.subscription.status,
        current_period_start: outcome.subscription.currentPeriodStart,
        current_period_end: outcome.subscription.currentPeriodEnd,
        grace_period_ends_at: null,
        failed_renewal_count: 0,
        updated_at: outcome.subscription.updatedAt,
      })
      .eq('id', outcome.subscription.id);
    this.assertOk('renewSubscription:subscriptions.update', res);
    return outcome;
  }

  override async recordSubscriptionRenewalFailure(subscriptionId: string, reason: string, graceDays = 7) {
    const sub = await super.recordSubscriptionRenewalFailure(subscriptionId, reason, graceDays);
    if (!sub) return null;
    const res = await this.supabase
      .from('subscriptions')
      .update({
        status: sub.status,
        grace_period_ends_at: sub.gracePeriodEndsAt || null,
        failed_renewal_count: sub.failedRenewalCount || 0,
        updated_at: sub.updatedAt,
      })
      .eq('id', sub.id);
    this.assertOk('recordSubscriptionRenewalFailure:subscriptions.update', res);
    return sub;
  }

  // ---- Projects, Messages, Deliverables, Revisions & Support ----

  override async createProject(
    input: Parameters<LocalPortalRepository['createProject']>[0]
  ): Promise<{ project: ProjectRecord; milestones: ProjectMilestoneRecord[] }> {
    const created = await super.createProject(input);
    const prjRes = await this.supabase.from('projects').insert({
      id: created.project.id,
      reference_number: created.project.referenceNumber,
      user_id: created.project.userId,
      order_id: created.project.orderId || null,
      service_name: created.project.serviceName,
      title: created.project.title,
      description: created.project.description,
      objectives: created.project.objectives,
      preferred_style: created.project.preferredStyle,
      brand_requirements: created.project.brandRequirements,
      target_audience: created.project.targetAudience,
      deliverable_requirements: created.project.deliverableRequirements,
      requested_deadline: created.project.requestedDeadline,
      assigned_coordinator: created.project.assignedCoordinator,
      assigned_team: created.project.assignedTeam,
      current_stage: created.project.currentStage,
      progress_percent: created.project.progressPercent,
      revision_limit: created.project.revisionLimit,
      revisions_used: created.project.revisionsUsed,
      approval_history: created.project.approvalHistory,
    });
    this.assertOk('createProject:projects.insert', prjRes);

    const msRes = await this.supabase.from('project_milestones').insert(
      created.milestones.map((m) => ({
        id: m.id,
        project_id: m.projectId,
        stage_key: m.stageKey,
        title: m.title,
        status: m.status,
        completed_at: m.completedAt || null,
        sort_order: m.sortOrder,
      }))
    );
    this.assertOk('createProject:project_milestones.insert', msRes);
    return created;
  }

  override async addProjectMessage(input: {
    userId: string;
    projectId: string;
    senderName: string;
    body: string;
    attachmentIds: string[];
  }): Promise<ProjectMessageRecord | null> {
    const msg = await super.addProjectMessage(input);
    if (!msg) return null;
    const res = await this.supabase.from('project_messages').insert({
      id: msg.id,
      project_id: msg.projectId,
      user_id: msg.userId,
      sender_role: msg.senderRole,
      sender_name: msg.senderName,
      body: msg.body,
      attachment_ids: msg.attachmentIds,
      is_read: msg.isRead,
    });
    this.assertOk('addProjectMessage:project_messages.insert', res);
    return msg;
  }

  override async createRevisionRequest(input: {
    userId: string;
    projectId: string;
    deliverableId?: string;
    description: string;
    attachmentIds: string[];
  }): Promise<{ revision?: RevisionRequestRecord; error?: string }> {
    const result = await super.createRevisionRequest(input);
    if (result.revision) {
      const res = await this.supabase.from('revision_requests').insert({
        id: result.revision.id,
        revision_number: result.revision.revisionNumber,
        project_id: result.revision.projectId,
        user_id: result.revision.userId,
        deliverable_id: result.revision.deliverableId || null,
        description: result.revision.description,
        attachment_ids: result.revision.attachmentIds,
        status: result.revision.status,
      });
      this.assertOk('createRevisionRequest:revision_requests.insert', res);
    }
    return result;
  }

  override async approveDeliverable(
    userId: string,
    projectId: string,
    deliverableId: string,
    note?: string
  ): Promise<ProjectDeliverableRecord | null> {
    const deliv = await super.approveDeliverable(userId, projectId, deliverableId, note);
    if (!deliv) return null;
    const res = await this.supabase
      .from('project_deliverables')
      .update({ status: deliv.status, approved_at: deliv.approvedAt })
      .eq('id', deliv.id)
      .eq('user_id', userId);
    this.assertOk('approveDeliverable:project_deliverables.update', res);
    return deliv;
  }

  override async createSupportTicket(input: {
    userId: string;
    senderName: string;
    category: SupportTicketCategory;
    subject: string;
    body: string;
    attachmentIds: string[];
    relatedOrderId?: string;
    relatedProjectId?: string;
  }): Promise<SupportTicketRecord> {
    const ticket = await super.createSupportTicket(input);
    const res = await this.supabase.from('support_tickets').insert({
      id: ticket.id,
      ticket_number: ticket.ticketNumber,
      user_id: ticket.userId,
      category: ticket.category,
      subject: ticket.subject,
      status: ticket.status,
      related_order_id: ticket.relatedOrderId || null,
      related_project_id: ticket.relatedProjectId || null,
    });
    this.assertOk('createSupportTicket:support_tickets.insert', res);
    return ticket;
  }

  override async addNotification(
    input: Omit<NotificationRecord, 'id' | 'isRead' | 'createdAt'>
  ): Promise<NotificationRecord> {
    const notif = await super.addNotification(input);
    const res = await this.supabase.from('notifications').insert({
      id: notif.id,
      user_id: notif.userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      link_path: notif.linkPath,
      is_read: false,
    });
    this.assertOk('addNotification:notifications.insert', res);
    return notif;
  }

  override async recordConsent(input: Omit<PortalConsentRecord, 'id' | 'recordedAt'>): Promise<PortalConsentRecord> {
    const consent = await super.recordConsent(input);
    const res = await this.supabase.from('legal_consents').insert({
      id: consent.id,
      user_id: consent.userId || null,
      email: consent.email,
      policy_slug: consent.policySlug,
      policy_version: consent.policyVersion,
      accepted: consent.accepted,
      ip_address: consent.ipAddress,
      user_agent: consent.userAgent,
      recorded_at: consent.recordedAt,
    });
    this.assertOk('recordConsent:legal_consents.insert', res);
    return consent;
  }

  override async upsertDiscountCode(record: DiscountCodeRecord): Promise<DiscountCodeRecord> {
    const saved = await super.upsertDiscountCode(record);
    const res = await this.supabase.from('promotions').upsert(
      {
        code: saved.code,
        title: saved.code,
        description: saved.description,
        discount_type: saved.discountType,
        discount_value: saved.value,
        min_subtotal_usd_minor: saved.minSubtotalUsdMinor,
        is_active: saved.isActive,
        expires_at: saved.expiresAt || null,
      },
      { onConflict: 'code' }
    );
    this.assertOk('upsertDiscountCode:promotions.upsert', res);
    return saved;
  }

  override async adminUpdateOrderStatus(
    orderId: string,
    status: OrderStatus,
    actor: string,
    note: string
  ): Promise<OrderRecord | null> {
    const order = await super.adminUpdateOrderStatus(orderId, status, actor, note);
    if (!order) return null;
    const res = await this.supabase
      .from('orders')
      .update({
        fulfillment_status: order.fulfillmentStatus,
        timeline: order.timeline,
        updated_at: order.updatedAt,
      })
      .eq('id', orderId);
    this.assertOk('adminUpdateOrderStatus:orders.update', res);
    return order;
  }

  override async adminUpdateProjectStage(
    projectId: string,
    stage: ProjectStage,
    actor: string,
    note: string
  ): Promise<ProjectRecord | null> {
    const project = await super.adminUpdateProjectStage(projectId, stage, actor, note);
    if (!project) return null;
    const res = await this.supabase
      .from('projects')
      .update({
        current_stage: project.currentStage,
        progress_percent: project.progressPercent,
        approval_history: project.approvalHistory,
        updated_at: project.updatedAt,
      })
      .eq('id', projectId);
    this.assertOk('adminUpdateProjectStage:projects.update', res);
    return project;
  }

  override async adminReplySupportTicket(
    ticketId: string,
    senderName: string,
    body: string,
    nextStatus: SupportTicketStatus = 'waiting_for_client'
  ): Promise<SupportTicketRecord | null> {
    const ticket = await super.adminReplySupportTicket(ticketId, senderName, body, nextStatus);
    if (!ticket) return null;
    const res = await this.supabase
      .from('support_tickets')
      .update({ status: ticket.status, updated_at: ticket.updatedAt })
      .eq('id', ticketId);
    this.assertOk('adminReplySupportTicket:support_tickets.update', res);
    return ticket;
  }

  override async adminRequestRefund(input: {
    paymentId: string;
    amountMinor: number;
    reason: string;
    requestedBy: string;
  }): Promise<PaymentRefundRecord | null> {
    const refund = await super.adminRequestRefund(input);
    if (!refund) return null;
    const res = await this.supabase.from('payment_refunds').insert({
      id: refund.id,
      payment_id: refund.paymentId,
      order_id: refund.orderId,
      amount_minor: refund.amountMinor,
      currency: refund.currency,
      reason: refund.reason,
      status: refund.status,
      requested_by: refund.requestedBy,
    });
    this.assertOk('adminRequestRefund:payment_refunds.insert', res);
    return refund;
  }

  override async adminDecideRefund(
    refundId: string,
    decision: 'approved' | 'rejected' | 'processed',
    actor: string
  ): Promise<PaymentRefundRecord | null> {
    const refund = await super.adminDecideRefund(refundId, decision, actor);
    if (!refund) return null;
    const res = await this.supabase
      .from('payment_refunds')
      .update({
        status: refund.status,
        approved_by: refund.approvedBy || null,
        updated_at: refund.updatedAt,
      })
      .eq('id', refundId);
    this.assertOk('adminDecideRefund:payment_refunds.update', res);
    return refund;
  }
}
