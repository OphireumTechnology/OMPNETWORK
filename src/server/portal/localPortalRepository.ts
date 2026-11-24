import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ClientActivityLogRecord,
  ClientAddressRecord,
  CreditTransactionRecord,
  CreditTransactionType,
  CreditWalletRecord,
  CustomPackageInquiryRecord,
  DiscountCodeRecord,
  InvoiceRecord,
  NotificationRecord,
  OrderRecord,
  PaymentProviderId,
  PaymentRecord,
  PaymentWebhookEventRecord,
  PortalCurrency,
  PortalProfileRecord,
  PortalRepository,
  PortalSessionRecord,
  PortalUserRecord,
  ProductCategoryRecord,
  ProductPackageRecord,
  ProductRecord,
  ProjectAttachmentRecord,
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
} from './types';
import {
  PORTAL_DISCOUNT_CODES,
  PORTAL_INITIAL_PRODUCTS,
  PORTAL_PRODUCT_CATEGORIES,
} from './catalogSeed';

interface PortalStoreState {
  users: PortalUserRecord[];
  profiles: PortalProfileRecord[];
  addresses: ClientAddressRecord[];
  sessions: PortalSessionRecord[];
  categories: ProductCategoryRecord[];
  products: ProductRecord[];
  discountCodes: DiscountCodeRecord[];
  customInquiries: CustomPackageInquiryRecord[];
  carts: ShoppingCartRecord[];
  orders: OrderRecord[];
  payments: PaymentRecord[];
  webhookEvents: PaymentWebhookEventRecord[];
  invoices: InvoiceRecord[];
  wallets: CreditWalletRecord[];
  creditTransactions: CreditTransactionRecord[];
  subscriptions: SubscriptionRecord[];
  projects: ProjectRecord[];
  milestones: ProjectMilestoneRecord[];
  projectMessages: ProjectMessageRecord[];
  attachments: ProjectAttachmentRecord[];
  deliverables: ProjectDeliverableRecord[];
  revisions: RevisionRequestRecord[];
  supportTickets: SupportTicketRecord[];
  notifications: NotificationRecord[];
  activities: ClientActivityLogRecord[];
  counters: {
    order: number;
    invoice: number;
    project: number;
    ticket: number;
    revision: number;
    inquiry: number;
  };
}

const DEFAULT_MILESTONE_STAGES: Array<{ stageKey: ProjectStage; title: string }> = [
  { stageKey: 'order_confirmed', title: 'Order Confirmed' },
  { stageKey: 'project_brief_received', title: 'Project Brief Received' },
  { stageKey: 'requirements_review', title: 'Requirements Review' },
  { stageKey: 'production_started', title: 'Production Started' },
  { stageKey: 'initial_output_submitted', title: 'Initial Output Submitted' },
  { stageKey: 'client_review', title: 'Client Review' },
  { stageKey: 'revisions_in_progress', title: 'Revisions, if needed' },
  { stageKey: 'final_quality_review', title: 'Final Quality Review' },
  { stageKey: 'final_delivery', title: 'Final Delivery' },
  { stageKey: 'project_completed', title: 'Project Completed' },
];

function createEmptyState(): PortalStoreState {
  return {
    users: [],
    profiles: [],
    addresses: [],
    sessions: [],
    categories: structuredClone(PORTAL_PRODUCT_CATEGORIES),
    products: structuredClone(PORTAL_INITIAL_PRODUCTS),
    discountCodes: structuredClone(PORTAL_DISCOUNT_CODES),
    customInquiries: [],
    carts: [],
    orders: [],
    payments: [],
    webhookEvents: [],
    invoices: [],
    wallets: [],
    creditTransactions: [],
    subscriptions: [],
    projects: [],
    milestones: [],
    projectMessages: [],
    attachments: [],
    deliverables: [],
    revisions: [],
    supportTickets: [],
    notifications: [],
    activities: [],
    counters: { order: 1000, invoice: 1000, project: 100, ticket: 100, revision: 1, inquiry: 100 },
  };
}

export class LocalPortalRepository implements PortalRepository {
  public readonly mode = 'local_dev' as const;
  private state: PortalStoreState;
  private readonly persistDir: string | null;
  private readonly filesDir: string | null;
  private readonly memoryFileBlobs = new Map<string, Buffer>();

  constructor(options?: { persistDir?: string | null }) {
    this.persistDir = options?.persistDir ?? null;
    this.filesDir = this.persistDir ? path.join(this.persistDir, 'files') : null;
    this.state = this.loadState();
  }

  private loadState(): PortalStoreState {
    if (!this.persistDir) return createEmptyState();
    try {
      fs.mkdirSync(this.persistDir, { recursive: true });
      if (this.filesDir) fs.mkdirSync(this.filesDir, { recursive: true });
      const filePath = path.join(this.persistDir, 'portal-store.json');
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<PortalStoreState>;
        const base = createEmptyState();
        return {
          ...base,
          ...parsed,
          categories: base.categories,
          products: base.products,
          discountCodes: base.discountCodes,
          counters: { ...base.counters, ...(parsed.counters || {}) },
        };
      }
    } catch {
      // Fall back to clean state on unreadable local store
    }
    return createEmptyState();
  }

  private persist(): void {
    if (!this.persistDir) return;
    try {
      fs.mkdirSync(this.persistDir, { recursive: true });
      const filePath = path.join(this.persistDir, 'portal-store.json');
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmpPath, filePath);
    } catch {
      // Ignore non-fatal local dev write errors
    }
  }

  private now(): string {
    return new Date().toISOString();
  }

  // ---- Auth & Users ----
  async findUserByEmail(email: string): Promise<PortalUserRecord | null> {
    const clean = email.trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === clean) || null;
  }

  async findUserById(userId: string): Promise<PortalUserRecord | null> {
    return this.state.users.find((u) => u.id === userId) || null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
    verificationTokenHash: string;
  }): Promise<{ user: PortalUserRecord; profile: PortalProfileRecord }> {
    const ts = this.now();
    const userId = crypto.randomUUID();
    const cleanEmail = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim() || cleanEmail.split('@')[0];

    const user: PortalUserRecord = {
      id: userId,
      email: cleanEmail,
      passwordHash: input.passwordHash,
      emailVerified: false,
      verificationTokenHash: input.verificationTokenHash,
      accountStatus: 'active',
      createdAt: ts,
      updatedAt: ts,
    };

    const profile: PortalProfileRecord = {
      id: crypto.randomUUID(),
      userId,
      email: cleanEmail,
      firstName,
      lastName,
      fullName,
      phone: (input.phone || '').trim(),
      companyName: (input.companyName || '').trim(),
      taxId: '',
      avatarUrl: '',
      timezone: 'Asia/Manila',
      preferredCurrency: 'USD',
      notificationPreferences: {
        emailOrders: true,
        emailProjects: true,
        emailMessages: true,
        emailBilling: true,
        inAppAll: true,
      },
      createdAt: ts,
      updatedAt: ts,
    };

    const wallet: CreditWalletRecord = {
      userId,
      availableCredits: 0,
      usedCredits: 0,
      pendingCredits: 0,
      expiringCredits: 0,
      updatedAt: ts,
    };

    this.state.users.push(user);
    this.state.profiles.push(profile);
    this.state.wallets.push(wallet);

    await this.addNotification({
      userId,
      type: 'account_verification',
      title: 'Welcome to Ophireum Multimedia Client Portal',
      body: 'Please verify your email address to protect your account and receive order and project updates.',
      linkPath: '/portal/verify-email',
    });

    await this.addActivity({
      userId,
      eventType: 'account_created',
      title: 'Client account created',
      detail: 'Registered for Ophireum Multimedia Client Portal.',
      relatedPath: '/portal/profile',
    });

    this.persist();
    return { user, profile };
  }

  async verifyEmailByTokenHash(tokenHash: string): Promise<PortalUserRecord | null> {
    const user = this.state.users.find((u) => u.verificationTokenHash === tokenHash);
    if (!user) return null;
    user.emailVerified = true;
    user.verificationTokenHash = undefined;
    user.updatedAt = this.now();
    await this.addActivity({
      userId: user.id,
      eventType: 'email_verified',
      title: 'Email address verified',
      detail: `${user.email} has been verified.`,
      relatedPath: '/portal/security',
    });
    this.persist();
    return user;
  }

  async setVerificationToken(userId: string, tokenHash: string): Promise<void> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    user.verificationTokenHash = tokenHash;
    user.updatedAt = this.now();
    this.persist();
  }

  async setResetToken(userId: string, tokenHash: string, expiresAt: string): Promise<void> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = expiresAt;
    user.updatedAt = this.now();
    this.persist();
  }

  async resetPasswordByTokenHash(tokenHash: string, newPasswordHash: string): Promise<PortalUserRecord | null> {
    const user = this.state.users.find((u) => u.resetTokenHash === tokenHash);
    if (!user) return null;
    if (user.resetTokenExpiresAt && Date.parse(user.resetTokenExpiresAt) < Date.now()) {
      return null;
    }
    user.passwordHash = newPasswordHash;
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    user.updatedAt = this.now();
    await this.revokeAllUserSessions(user.id);
    this.persist();
    return user;
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    user.passwordHash = newPasswordHash;
    user.updatedAt = this.now();
    this.persist();
  }

  async requestEmailChange(userId: string, newEmail: string, tokenHash: string): Promise<void> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    user.pendingEmail = newEmail.trim().toLowerCase();
    user.pendingEmailTokenHash = tokenHash;
    user.updatedAt = this.now();
    this.persist();
  }

  async confirmEmailChange(userId: string, tokenHash: string): Promise<PortalUserRecord | null> {
    const user = this.state.users.find((u) => u.id === userId && u.pendingEmailTokenHash === tokenHash);
    if (!user || !user.pendingEmail) return null;
    user.email = user.pendingEmail;
    user.emailVerified = true;
    user.pendingEmail = undefined;
    user.pendingEmailTokenHash = undefined;
    user.updatedAt = this.now();
    const profile = this.state.profiles.find((p) => p.userId === userId);
    if (profile) {
      profile.email = user.email;
      profile.updatedAt = user.updatedAt;
    }
    this.persist();
    return user;
  }

  async requestAccountClosure(userId: string, reason: string): Promise<PortalUserRecord> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    const ts = this.now();
    user.accountStatus = 'pending_closure';
    user.closureRequestedAt = ts;
    user.updatedAt = ts;
    await this.addActivity({
      userId,
      eventType: 'account_closure_requested',
      title: 'Account closure request submitted',
      detail: reason || 'Submitted via Security Settings. Financial records retained per statutory law.',
      relatedPath: '/portal/security',
    });
    this.persist();
    return user;
  }

  // ---- Sessions ----
  async createSession(input: Omit<PortalSessionRecord, 'id' | 'createdAt' | 'lastSeenAt'>): Promise<PortalSessionRecord> {
    const ts = this.now();
    const session: PortalSessionRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: ts,
      lastSeenAt: ts,
    };
    this.state.sessions.push(session);
    this.persist();
    return session;
  }

  async findActiveSessionByTokenHash(tokenHash: string): Promise<PortalSessionRecord | null> {
    const s = this.state.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
    if (!s) return null;
    if (Date.parse(s.expiresAt) <= Date.now()) return null;
    s.lastSeenAt = this.now();
    return s;
  }

  async listUserSessions(userId: string): Promise<PortalSessionRecord[]> {
    const now = Date.now();
    return this.state.sessions
      .filter((s) => s.userId === userId && !s.revokedAt && Date.parse(s.expiresAt) > now)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
    const s = this.state.sessions.find((item) => item.id === sessionId && item.userId === userId && !item.revokedAt);
    if (!s) return false;
    s.revokedAt = this.now();
    this.persist();
    return true;
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    const s = this.state.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
    if (s) {
      s.revokedAt = this.now();
      this.persist();
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const ts = this.now();
    for (const s of this.state.sessions) {
      if (s.userId === userId && !s.revokedAt) {
        s.revokedAt = ts;
      }
    }
    this.persist();
  }

  // ---- Profile & Addresses ----
  async getProfile(userId: string): Promise<PortalProfileRecord | null> {
    return this.state.profiles.find((p) => p.userId === userId) || null;
  }

  async updateProfile(userId: string, patch: Partial<PortalProfileRecord>): Promise<PortalProfileRecord> {
    const profile = this.state.profiles.find((p) => p.userId === userId);
    if (!profile) throw new Error('Profile not found');
    const firstName = patch.firstName !== undefined ? patch.firstName.trim() : profile.firstName;
    const lastName = patch.lastName !== undefined ? patch.lastName.trim() : profile.lastName;
    profile.firstName = firstName;
    profile.lastName = lastName;
    profile.fullName = `${firstName} ${lastName}`.trim() || profile.fullName;
    if (patch.phone !== undefined) profile.phone = patch.phone.trim();
    if (patch.companyName !== undefined) profile.companyName = patch.companyName.trim();
    if (patch.taxId !== undefined) profile.taxId = patch.taxId.trim();
    if (patch.avatarUrl !== undefined) profile.avatarUrl = patch.avatarUrl.trim();
    if (patch.timezone !== undefined) profile.timezone = patch.timezone.trim();
    if (patch.preferredCurrency === 'PHP' || patch.preferredCurrency === 'USD') {
      profile.preferredCurrency = patch.preferredCurrency;
    }
    if (patch.notificationPreferences) {
      profile.notificationPreferences = {
        ...profile.notificationPreferences,
        ...patch.notificationPreferences,
      };
    }
    profile.updatedAt = this.now();
    this.persist();
    return profile;
  }

  async listAddresses(userId: string): Promise<ClientAddressRecord[]> {
    return this.state.addresses.filter((a) => a.userId === userId);
  }

  async upsertAddress(
    userId: string,
    address: Omit<ClientAddressRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<ClientAddressRecord> {
    const ts = this.now();
    if (address.isDefault) {
      for (const existing of this.state.addresses) {
        if (existing.userId === userId) existing.isDefault = false;
      }
    }
    if (address.id) {
      const existing = this.state.addresses.find((a) => a.id === address.id && a.userId === userId);
      if (existing) {
        Object.assign(existing, {
          label: address.label,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          stateProvince: address.stateProvince,
          postalCode: address.postalCode,
          country: address.country,
          isDefault: address.isDefault,
          updatedAt: ts,
        });
        this.persist();
        return existing;
      }
    }
    const created: ClientAddressRecord = {
      id: crypto.randomUUID(),
      userId,
      label: address.label,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      stateProvince: address.stateProvince,
      postalCode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault || !this.state.addresses.some((a) => a.userId === userId),
      createdAt: ts,
      updatedAt: ts,
    };
    this.state.addresses.push(created);
    this.persist();
    return created;
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const idx = this.state.addresses.findIndex((a) => a.id === addressId && a.userId === userId);
    if (idx < 0) return false;
    this.state.addresses.splice(idx, 1);
    this.persist();
    return true;
  }

  // ---- Catalog ----
  async listCategories(): Promise<ProductCategoryRecord[]> {
    return [...this.state.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listProducts(filters?: { categorySlug?: string; search?: string }): Promise<ProductRecord[]> {
    let list = this.state.products.filter((p) => p.isActive);
    if (filters?.categorySlug && filters.categorySlug !== 'all') {
      list = list.filter((p) => p.categorySlug === filters.categorySlug);
    }
    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.categorySlug.toLowerCase().includes(q)
      );
    }
    return list;
  }

  async getProductBySlug(slug: string): Promise<ProductRecord | null> {
    return this.state.products.find((p) => p.slug === slug && p.isActive) || null;
  }

  async getPackageById(packageId: string): Promise<{ product: ProductRecord; pkg: ProductPackageRecord } | null> {
    for (const product of this.state.products) {
      const pkg = product.packages.find((item) => item.id === packageId);
      if (pkg) return { product, pkg };
    }
    return null;
  }

  async getDiscountCode(code: string): Promise<DiscountCodeRecord | null> {
    const clean = code.trim().toUpperCase();
    const found = this.state.discountCodes.find((d) => d.code === clean && d.isActive);
    if (!found) return null;
    if (found.expiresAt && Date.parse(found.expiresAt) < Date.now()) return null;
    return found;
  }

  // ---- Custom Package Inquiries ----
  async createCustomInquiry(
    input: Omit<CustomPackageInquiryRecord, 'id' | 'referenceNumber' | 'status' | 'createdAt'>
  ): Promise<CustomPackageInquiryRecord> {
    this.state.counters.inquiry += 1;
    const record: CustomPackageInquiryRecord = {
      ...input,
      id: crypto.randomUUID(),
      referenceNumber: `OPM-ENT-${new Date().getFullYear()}-${String(this.state.counters.inquiry).padStart(4, '0')}`,
      status: 'received',
      createdAt: this.now(),
    };
    this.state.customInquiries.push(record);
    await this.addNotification({
      userId: input.userId,
      type: 'order_created',
      title: `Custom Package Inquiry ${record.referenceNumber}`,
      body: 'Your enterprise package request has been logged for review by our operations team.',
      linkPath: '/portal/store',
    });
    await this.addActivity({
      userId: input.userId,
      eventType: 'custom_inquiry_submitted',
      title: `Submitted custom inquiry ${record.referenceNumber}`,
      detail: `${input.companyName} — ${input.requiredServices.join(', ')}`,
      relatedPath: '/portal/store',
    });
    this.persist();
    return record;
  }

  async listCustomInquiries(userId: string): Promise<CustomPackageInquiryRecord[]> {
    return this.state.customInquiries
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ---- Cart ----
  async getCart(userId: string): Promise<ShoppingCartRecord> {
    let cart = this.state.carts.find((c) => c.userId === userId);
    if (!cart) {
      const profile = await this.getProfile(userId);
      cart = {
        id: crypto.randomUUID(),
        userId,
        currency: profile?.preferredCurrency || 'USD',
        items: [],
        updatedAt: this.now(),
      };
      this.state.carts.push(cart);
      this.persist();
    }
    return cart;
  }

  async saveCart(cart: ShoppingCartRecord): Promise<ShoppingCartRecord> {
    cart.updatedAt = this.now();
    const idx = this.state.carts.findIndex((c) => c.userId === cart.userId);
    if (idx >= 0) this.state.carts[idx] = cart;
    else this.state.carts.push(cart);
    this.persist();
    return cart;
  }

  // ---- Orders, Payments, Invoices ----
  async findOrderByIdempotencyKey(userId: string, key: string): Promise<OrderRecord | null> {
    return this.state.orders.find((o) => o.userId === userId && o.idempotencyKey === key) || null;
  }

  async createOrder(
    input: Omit<OrderRecord, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<{ order: OrderRecord; invoice: InvoiceRecord; payment: PaymentRecord }> {
    const ts = this.now();
    const year = new Date().getFullYear();
    this.state.counters.order += 1;
    this.state.counters.invoice += 1;
    const orderId = crypto.randomUUID();
    const orderNumber = `OPM-ORD-${year}-${String(this.state.counters.order).padStart(5, '0')}`;
    const invoiceNumber = `OPM-INV-${year}-${String(this.state.counters.invoice).padStart(5, '0')}`;

    const order: OrderRecord = {
      ...input,
      id: orderId,
      orderNumber,
      items: input.items.map((item) => ({ ...item, orderId })),
      createdAt: ts,
      updatedAt: ts,
    };

    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invoice: InvoiceRecord = {
      id: crypto.randomUUID(),
      invoiceNumber,
      orderId,
      orderNumber,
      userId: input.userId,
      currency: input.currency,
      subtotalMinor: input.subtotalMinor,
      discountMinor: input.discountMinor,
      taxMinor: input.taxMinor,
      totalMinor: input.totalMinor,
      paymentStatus: input.paymentStatus,
      issuingCompany: {
        name: 'OPHIREUM MULTIMEDIA PRODUCTION',
        registrationNo: 'DTI Philippines Reg. No. 7567003',
        address: 'KMC | One West Aeropark, 5th Floor & Penthouse, Clark Freeport Zone, Pampanga 2010, PH',
        email: 'contact@ophireummultimedia.com',
      },
      clientBilling: input.billingDetails,
      lineItems: order.items.map((item) => ({
        description: `${item.productName} (${item.packageName})`,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        lineTotalMinor: item.lineTotalMinor,
      })),
      issuedAt: ts,
      dueAt,
    };

    const payment: PaymentRecord = {
      id: crypto.randomUUID(),
      orderId,
      orderNumber,
      userId: input.userId,
      provider: input.paymentProvider,
      environment: 'disabled',
      amountMinor: input.totalMinor,
      currency: input.currency,
      status: input.paymentStatus,
      refundedMinor: 0,
      idempotencyKey: input.idempotencyKey || crypto.randomUUID(),
      createdAt: ts,
      updatedAt: ts,
    };

    this.state.orders.push(order);
    this.state.invoices.push(invoice);
    this.state.payments.push(payment);

    // If order includes subscriptions, record pending subscription awaiting verified payment
    for (const item of order.items) {
      if (item.billingType === 'subscription_monthly') {
        const pkgInfo = await this.getPackageById(item.packageId);
        this.state.subscriptions.push({
          id: crypto.randomUUID(),
          userId: input.userId,
          productId: item.productId,
          packageId: item.packageId,
          planName: item.packageName,
          status: 'pending',
          currency: input.currency,
          amountMinor: item.unitPriceMinor,
          creditsPerCycle: item.creditsAllocated,
          inclusions: pkgInfo?.pkg.features || [],
          provider: input.paymentProvider,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }

    // Track pending credits honestly (NEVER add to availableCredits before verified payment!)
    const pendingCreditsTotal = order.items.reduce((sum, i) => sum + i.creditsAllocated * i.quantity, 0);
    if (pendingCreditsTotal > 0) {
      const wallet = await this.getWallet(input.userId);
      wallet.pendingCredits += pendingCreditsTotal;
      wallet.updatedAt = ts;
    }

    await this.addNotification({
      userId: input.userId,
      type: 'order_created',
      title: `Order ${orderNumber} Created`,
      body: `Invoice ${invoiceNumber} issued. Awaiting server-verified payment confirmation.`,
      linkPath: `/portal/orders/${orderId}`,
    });
    await this.addNotification({
      userId: input.userId,
      type: 'invoice_generated',
      title: `Invoice ${invoiceNumber} Ready`,
      body: `View or download your itemized invoice for order ${orderNumber}.`,
      linkPath: '/portal/invoices',
    });
    await this.addActivity({
      userId: input.userId,
      eventType: 'order_created',
      title: `Order ${orderNumber} placed`,
      detail: `${order.items.length} item(s) · Status: Pending Payment`,
      relatedPath: `/portal/orders/${orderId}`,
    });

    this.persist();
    return { order, invoice, payment };
  }

  async listOrders(userId: string): Promise<OrderRecord[]> {
    return this.state.orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getOrderById(userId: string, orderId: string): Promise<OrderRecord | null> {
    return this.state.orders.find((o) => o.id === orderId && o.userId === userId) || null;
  }

  async getOrderByIdInternal(orderId: string): Promise<OrderRecord | null> {
    return this.state.orders.find((o) => o.id === orderId) || null;
  }

  async requestOrderCancellation(userId: string, orderId: string, reason: string): Promise<OrderRecord | null> {
    const order = this.state.orders.find((o) => o.id === orderId && o.userId === userId);
    if (!order) return null;
    const ts = this.now();
    order.cancellationRequested = true;
    order.cancellationReason = reason.trim();
    if (order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending') {
      order.fulfillmentStatus = 'cancelled';
      order.paymentStatus = 'cancelled';
      const pendingCreditsTotal = order.items.reduce((sum, i) => sum + i.creditsAllocated * i.quantity, 0);
      if (pendingCreditsTotal > 0) {
        const wallet = await this.getWallet(userId);
        wallet.pendingCredits = Math.max(0, wallet.pendingCredits - pendingCreditsTotal);
        wallet.updatedAt = ts;
      }
      const inv = this.state.invoices.find((i) => i.orderId === orderId);
      if (inv) inv.paymentStatus = 'cancelled';
      const pay = this.state.payments.find((p) => p.orderId === orderId);
      if (pay) {
        pay.status = 'cancelled';
        pay.updatedAt = ts;
      }
      order.timeline.push({
        status: 'cancelled',
        label: 'Order Cancelled',
        note: reason.trim() || 'Cancelled by client prior to payment verification.',
        timestamp: ts,
      });
    } else {
      order.timeline.push({
        status: order.fulfillmentStatus,
        label: 'Cancellation Request Logged',
        note: `Submitted for operations review: ${reason.trim()}`,
        timestamp: ts,
      });
    }
    order.updatedAt = ts;
    await this.addActivity({
      userId,
      eventType: 'order_cancellation',
      title: `Cancellation submitted for ${order.orderNumber}`,
      detail: reason.trim() || 'Client cancellation request',
      relatedPath: `/portal/orders/${order.id}`,
    });
    this.persist();
    return order;
  }

  async listPayments(userId: string): Promise<PaymentRecord[]> {
    return this.state.payments
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listInvoices(userId: string): Promise<InvoiceRecord[]> {
    return this.state.invoices
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  async getInvoiceById(userId: string, invoiceId: string): Promise<InvoiceRecord | null> {
    return this.state.invoices.find((i) => i.id === invoiceId && i.userId === userId) || null;
  }

  async recordWebhookAndConfirmPayment(input: {
    provider: PaymentProviderId;
    providerEventId: string;
    orderId: string;
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    eventStatus: 'paid' | 'failed' | 'refunded';
    payloadSummary: Record<string, unknown>;
  }): Promise<{ deduplicated: boolean; order?: OrderRecord; creditsAllocated: number; projectCreated?: ProjectRecord }> {
    const existingEvent = this.state.webhookEvents.find(
      (e) => e.provider === input.provider && e.providerEventId === input.providerEventId
    );
    if (existingEvent) {
      return { deduplicated: true, creditsAllocated: 0 };
    }

    const ts = this.now();
    const webhookRecord: PaymentWebhookEventRecord = {
      id: crypto.randomUUID(),
      provider: input.provider,
      providerEventId: input.providerEventId,
      signatureVerified: true,
      processingStatus: 'received',
      payloadSummary: input.payloadSummary,
      receivedAt: ts,
    };
    this.state.webhookEvents.push(webhookRecord);

    const order = this.state.orders.find((o) => o.id === input.orderId);
    if (!order) {
      webhookRecord.processingStatus = 'failed';
      webhookRecord.errorMessage = 'Order not found';
      this.persist();
      return { deduplicated: false, creditsAllocated: 0 };
    }

    if (order.totalMinor !== input.amountMinor || order.currency !== input.currency) {
      webhookRecord.processingStatus = 'failed';
      webhookRecord.errorMessage = 'Amount or currency mismatch against server order record';
      this.persist();
      throw new Error('Payment webhook amount or currency does not match authoritative order total');
    }

    const payment = this.state.payments.find((p) => p.orderId === order.id);
    const invoice = this.state.invoices.find((i) => i.orderId === order.id);
    let creditsAllocated = 0;
    let projectCreated: ProjectRecord | undefined;

    if (input.eventStatus === 'paid' && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.paymentReference = input.providerTransactionId;
      order.fulfillmentStatus = order.projectRequirements?.instructions ? 'confirmed' : 'awaiting_project_brief';
      order.timeline.push({
        status: 'confirmed',
        label: 'Payment Verified & Order Confirmed',
        note: `Verified via ${input.provider} webhook (${input.providerTransactionId}).`,
        timestamp: ts,
      });
      order.updatedAt = ts;

      if (payment) {
        payment.status = 'paid';
        payment.providerTransactionId = input.providerTransactionId;
        payment.environment = 'sandbox';
        payment.updatedAt = ts;
      }
      if (invoice) {
        invoice.paymentStatus = 'paid';
      }

      // Allocate credits idempotently
      const totalCredits = order.items.reduce((sum, i) => sum + i.creditsAllocated * i.quantity, 0);
      if (totalCredits > 0) {
        const wallet = await this.getWallet(order.userId);
        wallet.pendingCredits = Math.max(0, wallet.pendingCredits - totalCredits);
        await this.applyCreditLedgerEntry({
          userId: order.userId,
          transactionType: order.items.some((i) => i.billingType === 'subscription_monthly')
            ? 'subscription_allocation'
            : 'package_purchase',
          amount: totalCredits,
          description: `Verified payment allocation for order ${order.orderNumber}`,
          relatedOrderId: order.id,
          idempotencyKey: `credit-alloc:${order.id}`,
        });
        creditsAllocated = totalCredits;
      }

      // Activate pending subscriptions for this order
      for (const sub of this.state.subscriptions) {
        if (sub.userId === order.userId && sub.status === 'pending') {
          sub.status = 'active';
          sub.currentPeriodStart = ts;
          sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          sub.updatedAt = ts;
        }
      }

      // Create linked project if order includes service deliverables
      const serviceItem = order.items.find((i) => i.billingType === 'one_time');
      if (serviceItem) {
        const created = await this.createProject({
          userId: order.userId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          serviceName: serviceItem.productName,
          title: order.projectRequirements?.title || `${serviceItem.productName} — ${order.orderNumber}`,
          description: order.projectRequirements?.instructions || 'Linked to confirmed order. Add your project brief details in this workspace.',
          objectives: order.projectRequirements?.creativeBrief || '',
          preferredStyle: '',
          brandRequirements: '',
          targetAudience: '',
          deliverableRequirements: order.projectRequirements?.deliveryExpectation || '',
          requestedDeadline: '',
          revisionLimit: serviceItem.revisionLimit,
        });
        projectCreated = created.project;
      }

      await this.addNotification({
        userId: order.userId,
        type: 'payment_confirmed',
        title: `Payment Confirmed for ${order.orderNumber}`,
        body: creditsAllocated > 0
          ? `Payment verified and ${creditsAllocated.toLocaleString()} credits added to your wallet.`
          : 'Your payment has been verified and production intake is now active.',
        linkPath: `/portal/orders/${order.id}`,
      });
    } else if (input.eventStatus === 'failed') {
      order.paymentStatus = 'failed';
      order.updatedAt = ts;
      if (payment) {
        payment.status = 'failed';
        payment.failureReason = 'Reported failed by provider webhook';
        payment.updatedAt = ts;
      }
      if (invoice) invoice.paymentStatus = 'failed';
      await this.addNotification({
        userId: order.userId,
        type: 'payment_failed',
        title: `Payment Failed for ${order.orderNumber}`,
        body: 'The payment provider reported an unsuccessful transaction. You may retry checkout.',
        linkPath: `/portal/orders/${order.id}`,
      });
    } else if (input.eventStatus === 'refunded') {
      order.paymentStatus = 'refunded';
      order.fulfillmentStatus = 'cancelled';
      order.updatedAt = ts;
      if (payment) {
        payment.status = 'refunded';
        payment.refundedMinor = input.amountMinor;
        payment.updatedAt = ts;
      }
      if (invoice) invoice.paymentStatus = 'refunded';
    }

    webhookRecord.processingStatus = 'processed';
    webhookRecord.processedAt = this.now();
    this.persist();
    return { deduplicated: false, order, creditsAllocated, projectCreated };
  }

  // ---- Credits ----
  async getWallet(userId: string): Promise<CreditWalletRecord> {
    let wallet = this.state.wallets.find((w) => w.userId === userId);
    if (!wallet) {
      wallet = {
        userId,
        availableCredits: 0,
        usedCredits: 0,
        pendingCredits: 0,
        expiringCredits: 0,
        updatedAt: this.now(),
      };
      this.state.wallets.push(wallet);
      this.persist();
    }
    return wallet;
  }

  async listCreditTransactions(userId: string): Promise<CreditTransactionRecord[]> {
    return this.state.creditTransactions
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async applyCreditLedgerEntry(input: {
    userId: string;
    transactionType: CreditTransactionType;
    amount: number;
    description: string;
    relatedOrderId?: string;
    relatedProjectId?: string;
    idempotencyKey?: string;
  }): Promise<{ wallet: CreditWalletRecord; transaction: CreditTransactionRecord }> {
    if (!Number.isInteger(input.amount) || input.amount === 0) {
      throw new Error('Credit ledger amount must be a non-zero integer');
    }
    if (input.idempotencyKey) {
      const existing = this.state.creditTransactions.find(
        (t) => t.userId === input.userId && t.idempotencyKey === input.idempotencyKey
      );
      if (existing) {
        const wallet = await this.getWallet(input.userId);
        return { wallet, transaction: existing };
      }
    }

    const wallet = await this.getWallet(input.userId);
    const nextBalance = wallet.availableCredits + input.amount;
    if (nextBalance < 0) {
      throw new Error('Insufficient available credits for this operation');
    }

    wallet.availableCredits = nextBalance;
    if (input.amount < 0) {
      wallet.usedCredits += Math.abs(input.amount);
    }
    wallet.updatedAt = this.now();

    const transaction: CreditTransactionRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      transactionType: input.transactionType,
      amount: input.amount,
      balanceAfter: nextBalance,
      relatedOrderId: input.relatedOrderId,
      relatedProjectId: input.relatedProjectId,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      createdAt: wallet.updatedAt,
    };

    this.state.creditTransactions.push(transaction);
    this.persist();
    return { wallet, transaction };
  }

  // ---- Subscriptions ----
  async listSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
    return this.state.subscriptions
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async requestSubscriptionCancel(userId: string, subscriptionId: string): Promise<SubscriptionRecord | null> {
    const sub = this.state.subscriptions.find((s) => s.id === subscriptionId && s.userId === userId);
    if (!sub) return null;
    const ts = this.now();
    sub.cancelRequestedAt = ts;
    sub.status = 'cancelled';
    sub.updatedAt = ts;
    await this.addNotification({
      userId,
      type: 'subscription_update',
      title: `Subscription Cancelled — ${sub.planName}`,
      body: 'Your subscription cancellation has been recorded. No recurring charge will occur.',
      linkPath: '/portal/subscriptions',
    });
    this.persist();
    return sub;
  }

  // ---- Projects ----
  async createProject(
    input: Omit<
      ProjectRecord,
      | 'id'
      | 'referenceNumber'
      | 'assignedCoordinator'
      | 'assignedTeam'
      | 'currentStage'
      | 'progressPercent'
      | 'revisionsUsed'
      | 'approvalHistory'
      | 'createdAt'
      | 'updatedAt'
    >
  ): Promise<{ project: ProjectRecord; milestones: ProjectMilestoneRecord[] }> {
    const ts = this.now();
    this.state.counters.project += 1;
    const projectId = crypto.randomUUID();
    const referenceNumber = `OPM-PRJ-${new Date().getFullYear()}-${String(this.state.counters.project).padStart(4, '0')}`;

    const project: ProjectRecord = {
      ...input,
      id: projectId,
      referenceNumber,
      assignedCoordinator: 'Ophireum Production Coordinator',
      assignedTeam: 'Ophireum Creative Production Desk',
      currentStage: input.description.trim() ? 'project_brief_received' : 'order_confirmed',
      progressPercent: input.description.trim() ? 20 : 10,
      revisionsUsed: 0,
      approvalHistory: [
        {
          action: 'Project Workspace Initialized',
          actor: 'Client Portal System',
          note: input.orderNumber ? `Linked to order ${input.orderNumber}` : 'Created via client project brief',
          timestamp: ts,
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    };

    const milestones: ProjectMilestoneRecord[] = DEFAULT_MILESTONE_STAGES.map((stage, idx) => ({
      id: crypto.randomUUID(),
      projectId,
      stageKey: stage.stageKey,
      title: stage.title,
      status: idx === 0 ? 'completed' : idx === 1 && input.description.trim() ? 'completed' : idx === 2 ? 'in_progress' : 'pending',
      completedAt: idx === 0 || (idx === 1 && input.description.trim()) ? ts : undefined,
      sortOrder: idx + 1,
    }));

    this.state.projects.push(project);
    this.state.milestones.push(...milestones);

    this.state.projectMessages.push({
      id: crypto.randomUUID(),
      projectId,
      userId: input.userId,
      senderRole: 'coordinator',
      senderName: 'Ophireum Production Desk',
      body: `Welcome to workspace ${referenceNumber}. Use this thread to share creative references, ask questions, or provide feedback on milestones.`,
      attachmentIds: [],
      isRead: false,
      createdAt: ts,
    });

    await this.addNotification({
      userId: input.userId,
      type: 'project_update',
      title: `Project Workspace ${referenceNumber} Ready`,
      body: `"${project.title}" has been created. You can now message the production desk and upload briefs.`,
      linkPath: `/portal/projects/${projectId}`,
    });

    await this.addActivity({
      userId: input.userId,
      eventType: 'project_created',
      title: `Created project ${referenceNumber}`,
      detail: project.title,
      relatedPath: `/portal/projects/${projectId}`,
    });

    this.persist();
    return { project, milestones };
  }

  async listProjects(userId: string): Promise<ProjectRecord[]> {
    return this.state.projects
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getProjectDetail(userId: string, projectId: string) {
    const project = this.state.projects.find((p) => p.id === projectId && p.userId === userId);
    if (!project) return null;
    return {
      project,
      milestones: this.state.milestones
        .filter((m) => m.projectId === projectId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      messages: this.state.projectMessages
        .filter((m) => m.projectId === projectId && m.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      attachments: this.state.attachments
        .filter((a) => a.projectId === projectId && a.userId === userId)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
      deliverables: this.state.deliverables
        .filter((d) => d.projectId === projectId && d.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      revisions: this.state.revisions
        .filter((r) => r.projectId === projectId && r.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  async addProjectMessage(input: {
    userId: string;
    projectId: string;
    senderName: string;
    body: string;
    attachmentIds: string[];
  }): Promise<ProjectMessageRecord | null> {
    const project = this.state.projects.find((p) => p.id === input.projectId && p.userId === input.userId);
    if (!project) return null;
    const ts = this.now();
    const message: ProjectMessageRecord = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      userId: input.userId,
      senderRole: 'client',
      senderName: input.senderName,
      body: input.body.trim(),
      attachmentIds: input.attachmentIds,
      isRead: true,
      createdAt: ts,
    };
    this.state.projectMessages.push(message);
    project.updatedAt = ts;
    await this.addActivity({
      userId: input.userId,
      eventType: 'project_message',
      title: `Message posted in ${project.referenceNumber}`,
      detail: input.body.trim().slice(0, 90),
      relatedPath: `/portal/projects/${project.id}`,
    });
    this.persist();
    return message;
  }

  async markProjectMessagesRead(userId: string, projectId: string): Promise<void> {
    let changed = false;
    for (const m of this.state.projectMessages) {
      if (m.projectId === projectId && m.userId === userId && !m.isRead) {
        m.isRead = true;
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  async listAllUserMessages(
    userId: string
  ): Promise<Array<ProjectMessageRecord & { projectTitle: string; projectReference: string }>> {
    const projectMap = new Map(
      this.state.projects.filter((p) => p.userId === userId).map((p) => [p.id, p])
    );
    return this.state.projectMessages
      .filter((m) => m.userId === userId && projectMap.has(m.projectId))
      .map((m) => {
        const prj = projectMap.get(m.projectId)!;
        return {
          ...m,
          projectTitle: prj.title,
          projectReference: prj.referenceNumber,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createRevisionRequest(input: {
    userId: string;
    projectId: string;
    deliverableId?: string;
    description: string;
    attachmentIds: string[];
  }): Promise<{ revision?: RevisionRequestRecord; error?: string }> {
    const project = this.state.projects.find((p) => p.id === input.projectId && p.userId === input.userId);
    if (!project) return { error: 'Project not found' };
    if (project.revisionsUsed >= project.revisionLimit) {
      return {
        error: `Package revision allowance reached (${project.revisionsUsed}/${project.revisionLimit}). No additional credits were charged. Contact support or purchase an extension if extra revisions are needed.`,
      };
    }

    const ts = this.now();
    this.state.counters.revision += 1;
    const revision: RevisionRequestRecord = {
      id: crypto.randomUUID(),
      revisionNumber: `REV-${String(this.state.counters.revision).padStart(4, '0')}`,
      projectId: project.id,
      userId: input.userId,
      deliverableId: input.deliverableId,
      description: input.description.trim(),
      attachmentIds: input.attachmentIds,
      status: 'submitted',
      createdAt: ts,
      updatedAt: ts,
    };

    this.state.revisions.push(revision);
    project.revisionsUsed += 1;
    project.updatedAt = ts;

    if (input.deliverableId) {
      const deliv = this.state.deliverables.find(
        (d) => d.id === input.deliverableId && d.projectId === project.id && d.userId === input.userId
      );
      if (deliv) deliv.status = 'revision_requested';
    }

    await this.addNotification({
      userId: input.userId,
      type: 'revision_update',
      title: `Revision ${revision.revisionNumber} Submitted`,
      body: `Logged for ${project.referenceNumber} (${project.revisionsUsed}/${project.revisionLimit} revisions used).`,
      linkPath: `/portal/projects/${project.id}`,
    });

    await this.addActivity({
      userId: input.userId,
      eventType: 'revision_requested',
      title: `Revision ${revision.revisionNumber} requested`,
      detail: `${project.referenceNumber}: ${input.description.trim().slice(0, 90)}`,
      relatedPath: `/portal/projects/${project.id}`,
    });

    this.persist();
    return { revision };
  }

  async approveDeliverable(
    userId: string,
    projectId: string,
    deliverableId: string,
    note?: string
  ): Promise<ProjectDeliverableRecord | null> {
    const project = this.state.projects.find((p) => p.id === projectId && p.userId === userId);
    const deliverable = this.state.deliverables.find(
      (d) => d.id === deliverableId && d.projectId === projectId && d.userId === userId
    );
    if (!project || !deliverable) return null;
    const ts = this.now();
    deliverable.status = 'approved';
    deliverable.approvedAt = ts;
    project.approvalHistory.push({
      action: `Approved deliverable: ${deliverable.title} (v${deliverable.version})`,
      actor: 'Client',
      note: (note || 'Approved via Client Portal').trim(),
      timestamp: ts,
    });
    project.updatedAt = ts;
    this.persist();
    return deliverable;
  }

  // ---- Files ----
  async saveAttachment(
    record: Omit<ProjectAttachmentRecord, 'id' | 'uploadedAt'>,
    buffer: Buffer
  ): Promise<ProjectAttachmentRecord> {
    const ts = this.now();
    const id = crypto.randomUUID();
    const saved: ProjectAttachmentRecord = {
      ...record,
      id,
      uploadedAt: ts,
    };

    if (this.filesDir) {
      fs.mkdirSync(this.filesDir, { recursive: true });
      fs.writeFileSync(path.join(this.filesDir, record.storedFileName), buffer);
    } else {
      this.memoryFileBlobs.set(record.storedFileName, buffer);
    }

    this.state.attachments.push(saved);
    await this.addActivity({
      userId: record.userId,
      eventType: 'file_uploaded',
      title: `Uploaded ${record.fileName}`,
      detail: `${(record.sizeBytes / 1024).toFixed(1)} KB · v${record.version}`,
      relatedPath: record.projectId ? `/portal/projects/${record.projectId}` : '/portal/files',
    });
    this.persist();
    return saved;
  }

  async listAttachments(userId: string, projectId?: string): Promise<ProjectAttachmentRecord[]> {
    return this.state.attachments
      .filter((a) => a.userId === userId && (!projectId || a.projectId === projectId))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async getAttachmentById(
    userId: string,
    fileId: string
  ): Promise<{ record: ProjectAttachmentRecord; buffer: Buffer } | null> {
    const record = this.state.attachments.find((a) => a.id === fileId && a.userId === userId);
    if (!record) return null;
    if (this.filesDir) {
      const fullPath = path.join(this.filesDir, path.basename(record.storedFileName));
      if (!fs.existsSync(fullPath)) return null;
      return { record, buffer: fs.readFileSync(fullPath) };
    }
    const buf = this.memoryFileBlobs.get(record.storedFileName);
    if (!buf) return null;
    return { record, buffer: buf };
  }

  // ---- Support ----
  async createSupportTicket(input: {
    userId: string;
    senderName: string;
    category: SupportTicketCategory;
    subject: string;
    body: string;
    attachmentIds: string[];
    relatedOrderId?: string;
    relatedProjectId?: string;
  }): Promise<SupportTicketRecord> {
    const ts = this.now();
    this.state.counters.ticket += 1;
    const id = crypto.randomUUID();
    const ticket: SupportTicketRecord = {
      id,
      ticketNumber: `OPM-SUP-${new Date().getFullYear()}-${String(this.state.counters.ticket).padStart(4, '0')}`,
      userId: input.userId,
      category: input.category,
      subject: input.subject.trim(),
      status: 'open',
      relatedOrderId: input.relatedOrderId,
      relatedProjectId: input.relatedProjectId,
      messages: [
        {
          id: crypto.randomUUID(),
          ticketId: id,
          senderRole: 'client',
          senderName: input.senderName,
          body: input.body.trim(),
          attachmentIds: input.attachmentIds,
          createdAt: ts,
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    };

    this.state.supportTickets.push(ticket);
    await this.addNotification({
      userId: input.userId,
      type: 'support_reply',
      title: `Support Ticket ${ticket.ticketNumber} Opened`,
      body: `${ticket.category} — Our client support team will review your request shortly.`,
      linkPath: '/portal/support',
    });
    await this.addActivity({
      userId: input.userId,
      eventType: 'support_ticket_created',
      title: `Opened support ticket ${ticket.ticketNumber}`,
      detail: ticket.subject,
      relatedPath: '/portal/support',
    });
    this.persist();
    return ticket;
  }

  async listSupportTickets(userId: string): Promise<SupportTicketRecord[]> {
    return this.state.supportTickets
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async replySupportTicket(
    userId: string,
    ticketId: string,
    senderName: string,
    body: string,
    attachmentIds: string[]
  ): Promise<SupportTicketRecord | null> {
    const ticket = this.state.supportTickets.find((t) => t.id === ticketId && t.userId === userId);
    if (!ticket) return null;
    const ts = this.now();
    ticket.messages.push({
      id: crypto.randomUUID(),
      ticketId,
      senderRole: 'client',
      senderName,
      body: body.trim(),
      attachmentIds,
      createdAt: ts,
    });
    if (ticket.status === 'waiting_for_client' || ticket.status === 'resolved') {
      ticket.status = 'open';
    }
    ticket.updatedAt = ts;
    this.persist();
    return ticket;
  }

  // ---- Notifications & Activities ----
  async listNotifications(userId: string): Promise<NotificationRecord[]> {
    return this.state.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    const notif = this.state.notifications.find((n) => n.id === notificationId && n.userId === userId);
    if (!notif) return false;
    notif.isRead = true;
    this.persist();
    return true;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    for (const n of this.state.notifications) {
      if (n.userId === userId) n.isRead = true;
    }
    this.persist();
  }

  async addNotification(input: Omit<NotificationRecord, 'id' | 'isRead' | 'createdAt'>): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      ...input,
      id: crypto.randomUUID(),
      isRead: false,
      createdAt: this.now(),
    };
    this.state.notifications.push(record);
    this.persist();
    return record;
  }

  async listActivities(userId: string, limit = 25): Promise<ClientActivityLogRecord[]> {
    return this.state.activities
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async addActivity(input: Omit<ClientActivityLogRecord, 'id' | 'createdAt'>): Promise<ClientActivityLogRecord> {
    const record: ClientActivityLogRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: this.now(),
    };
    this.state.activities.push(record);
    this.persist();
    return record;
  }
}
