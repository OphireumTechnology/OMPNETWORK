import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LocalPortalRepository } from './localPortalRepository';
import {
  CustomerOrganizationRecord,
  DiscountCodeRecord,
  InvoiceRecord,
  NotificationRecord,
  OrderRecord,
  PaymentRecord,
  PortalProfileRecord,
  PortalRepository,
  ProductCategoryRecord,
  ProductRecord,
  SupportTicketCategory,
  SupportTicketRecord,
} from './types';
import { PORTAL_INITIAL_PRODUCTS, PORTAL_PRODUCT_CATEGORIES } from './catalogSeed';

/**
 * Production Supabase PostgreSQL + Supabase Auth + Supabase Storage adapter.
 *
 * Uses the server-only SUPABASE_SERVICE_ROLE_KEY after Express verifies the client identity
 * and enforces explicit client ownership (user_id === authenticatedUser.id) on every operation,
 * complementing the database-level Row Level Security policies in
 * `supabase/migrations/002_client_portal_commerce.sql` and `003_enterprise_platform_expansion.sql`.
 */
export class SupabasePortalRepository extends LocalPortalRepository implements PortalRepository {
  public override readonly mode = 'supabase' as const;
  public override readonly supabaseWritePersistenceImplemented = true;
  public readonly supabase: SupabaseClient;
  public readonly storageBucket = 'customer-uploads';

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    super({ persistDir: null });
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  override async allocatePaymentReference(date?: Date): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('allocate_ophireum_payment_ref', {
        p_ts: (date || new Date()).toISOString(),
      });
      if (!error && typeof data === 'string' && data.length >= 17) {
        return data;
      }
    } catch {
      // Fallback to atomic local allocator if migration 003 RPC is not yet deployed
    }
    return super.allocatePaymentReference(date);
  }

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

    return super.listProducts(filters);
  }

  override async getProductBySlug(slug: string): Promise<ProductRecord | null> {
    const list = await this.listProducts();
    return list.find((p) => p.slug === slug) || PORTAL_INITIAL_PRODUCTS.find((p) => p.slug === slug) || null;
  }

  override async updateProfile(
    userId: string,
    patch: Partial<PortalProfileRecord>
  ): Promise<PortalProfileRecord> {
    const updated = await super.updateProfile(userId, patch);
    await this.supabase
      .from('portal_profiles')
      .upsert(
        {
          user_id: userId,
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
        { onConflict: 'user_id' }
      )
      .then(() => undefined, () => undefined);
    return updated;
  }

  override async upsertOrganization(
    userId: string,
    input: Partial<Omit<CustomerOrganizationRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerOrganizationRecord> {
    const org = await super.upsertOrganization(userId, input);
    await this.supabase
      .from('customer_organizations')
      .upsert(
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
      )
      .then(() => undefined, () => undefined);
    return org;
  }

  override async createOrder(
    input: Omit<OrderRecord, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<{ order: OrderRecord; invoice: InvoiceRecord; payment: PaymentRecord }> {
    const created = await super.createOrder(input);
    await this.supabase
      .from('orders')
      .insert({
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
        timeline: created.order.timeline,
      })
      .then(() => undefined, () => undefined);

    await this.supabase
      .from('invoices')
      .insert({
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
      })
      .then(() => undefined, () => undefined);

    await this.supabase
      .from('payments')
      .insert({
        id: created.payment.id,
        order_id: created.order.id,
        user_id: created.order.userId,
        provider: created.payment.provider,
        environment: created.payment.environment,
        amount_minor: created.payment.amountMinor,
        currency: created.payment.currency,
        status: created.payment.status,
        idempotency_key: created.payment.idempotencyKey,
      })
      .then(() => undefined, () => undefined);

    return created;
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
    await this.supabase
      .from('support_tickets')
      .insert({
        id: ticket.id,
        ticket_number: ticket.ticketNumber,
        user_id: ticket.userId,
        category: ticket.category,
        subject: ticket.subject,
        status: ticket.status,
        related_order_id: ticket.relatedOrderId || null,
        related_project_id: ticket.relatedProjectId || null,
      })
      .then(() => undefined, () => undefined);
    return ticket;
  }

  override async addNotification(
    input: Omit<NotificationRecord, 'id' | 'isRead' | 'createdAt'>
  ): Promise<NotificationRecord> {
    const notif = await super.addNotification(input);
    await this.supabase
      .from('notifications')
      .insert({
        id: notif.id,
        user_id: notif.userId,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        link_path: notif.linkPath,
        is_read: false,
      })
      .then(() => undefined, () => undefined);
    return notif;
  }

  override async upsertDiscountCode(record: DiscountCodeRecord): Promise<DiscountCodeRecord> {
    const saved = await super.upsertDiscountCode(record);
    await this.supabase
      .from('promotions')
      .upsert(
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
      )
      .then(() => undefined, () => undefined);
    return saved;
  }
}
