export type PortalCurrency = 'USD' | 'PHP';

export type OrderStatus =
  | 'pending_payment'
  | 'payment_verification'
  | 'confirmed'
  | 'awaiting_project_brief'
  | 'in_production'
  | 'quality_review'
  | 'awaiting_client_review'
  | 'revision_requested'
  | 'final_approval'
  | 'completed'
  | 'cancelled';

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded';

export type PaymentProviderId =
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'xendit'
  | 'maya'
  | 'paymongo'
  | 'gotyme';

export type ProjectStage =
  | 'order_confirmed'
  | 'project_brief_received'
  | 'requirements_review'
  | 'production_started'
  | 'initial_output_submitted'
  | 'client_review'
  | 'revisions_in_progress'
  | 'final_quality_review'
  | 'final_delivery'
  | 'project_completed';

export type SubscriptionStatus =
  | 'active'
  | 'pending'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'expired';

export type CreditTransactionType =
  | 'package_purchase'
  | 'subscription_allocation'
  | 'service_usage'
  | 'credit_adjustment'
  | 'refund'
  | 'promotional_credit'
  | 'expiration';

export type SupportTicketCategory =
  | 'Account Access'
  | 'Orders'
  | 'Payments'
  | 'Billing'
  | 'Project Status'
  | 'Technical Support'
  | 'Service Inquiry'
  | 'Refund Request'
  | 'Other';

export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_for_client'
  | 'resolved'
  | 'closed';

export interface PortalUserRecord {
  id: string;
  email: string;
  passwordHash?: string;
  emailVerified: boolean;
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: string;
  resetTokenHash?: string;
  resetTokenExpiresAt?: string;
  pendingEmail?: string;
  pendingEmailTokenHash?: string;
  pendingEmailTokenExpiresAt?: string;
  accountStatus: 'active' | 'suspended' | 'pending_closure' | 'closed';
  suspendedAt?: string;
  suspensionReason?: string;
  closureRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortalProfileRecord {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  companyName: string;
  taxId: string;
  avatarUrl: string;
  timezone: string;
  preferredCurrency: PortalCurrency;
  notificationPreferences: {
    emailOrders: boolean;
    emailProjects: boolean;
    emailMessages: boolean;
    emailBilling: boolean;
    inAppAll: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ClientAddressRecord {
  id: string;
  userId: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortalSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string;
  ipAddress: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface ProductCategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface ProductPackageRecord {
  id: string;
  productId: string;
  name: string;
  tierCode: string;
  priceUsdMinor: number; // integer cents; 0 when custom quotation
  pricePhpMinor: number; // integer centavos; 0 when custom quotation
  isCustomQuote: boolean;
  billingType: 'one_time' | 'subscription_monthly' | 'credit_pack';
  creditsIncluded: number;
  turnaroundLabel: string;
  validityDays?: number;
  revisionLimit: number;
  usageLimits: string;
  deliveryConditions: string;
  supportLevel: string;
  features: string[];
  isPopular?: boolean;
  isIllustrativePricing: boolean;
}

export interface ProductRecord {
  id: string;
  categoryId: string;
  categorySlug: string;
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  sampleDeliverables: string[];
  requiredClientMaterials: string[];
  termsSummary: string;
  faqs: Array<{ question: string; answer: string }>;
  isActive: boolean;
  isFeatured: boolean;
  packages: ProductPackageRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscountCodeRecord {
  code: string;
  description: string;
  discountType: 'percent' | 'fixed_usd_minor';
  value: number;
  minSubtotalUsdMinor: number;
  isActive: boolean;
  expiresAt?: string;
}

export interface CartItemRecord {
  id: string;
  cartId: string;
  productId: string;
  packageId: string;
  quantity: number;
  savedForLater: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingCartRecord {
  id: string;
  userId: string;
  currency: PortalCurrency;
  discountCode?: string;
  items: CartItemRecord[];
  updatedAt: string;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  productId: string;
  packageId: string;
  productSlug: string;
  productName: string;
  packageName: string;
  billingType: 'one_time' | 'subscription_monthly' | 'credit_pack';
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  creditsAllocated: number;
  revisionLimit: number;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  label: string;
  note: string;
  timestamp: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  currency: PortalCurrency;
  fxRateSnapshot: number;
  subtotalMinor: number;
  discountCode?: string;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paymentProvider: PaymentProviderId;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: OrderStatus;
  paymentReference?: string;
  billingDetails: {
    fullName: string;
    email: string;
    phone: string;
    companyName: string;
    taxId: string;
    address: string;
  };
  projectRequirements?: {
    title: string;
    instructions: string;
    deliveryExpectation: string;
    creativeBrief: string;
    specialInstructions: string;
    referenceFileIds: string[];
  };
  cancellationRequested?: boolean;
  cancellationReason?: string;
  expiresAt?: string;
  idempotencyKey?: string;
  items: OrderItemRecord[];
  timeline: OrderTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  provider: PaymentProviderId;
  environment: 'disabled' | 'sandbox' | 'live';
  providerTransactionId?: string;
  checkoutUrl?: string;
  amountMinor: number;
  currency: PortalCurrency;
  status: PaymentStatus;
  failureReason?: string;
  refundedMinor: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentWebhookEventRecord {
  id: string;
  provider: PaymentProviderId;
  providerEventId: string;
  signatureVerified: boolean;
  processingStatus: 'received' | 'processed' | 'ignored_duplicate' | 'failed';
  payloadSummary: Record<string, unknown>;
  errorMessage?: string;
  receivedAt: string;
  processedAt?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  currency: PortalCurrency;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paymentStatus: PaymentStatus;
  issuingCompany: {
    name: string;
    registrationNo: string;
    address: string;
    email: string;
  };
  clientBilling: OrderRecord['billingDetails'];
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
  issuedAt: string;
  dueAt: string;
}

export interface CreditWalletRecord {
  userId: string;
  availableCredits: number;
  usedCredits: number;
  pendingCredits: number;
  expiringCredits: number;
  updatedAt: string;
}

export interface CreditTransactionRecord {
  id: string;
  userId: string;
  transactionType: CreditTransactionType;
  amount: number; // positive credit, negative debit
  balanceAfter: number;
  relatedOrderId?: string;
  relatedProjectId?: string;
  description: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  orderId?: string;
  productId: string;
  packageId: string;
  planName: string;
  status: SubscriptionStatus;
  currency: PortalCurrency;
  amountMinor: number;
  creditsPerCycle: number;
  inclusions: string[];
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  gracePeriodEndsAt?: string;
  failedRenewalCount?: number;
  lastRenewalAt?: string;
  cancelRequestedAt?: string;
  provider?: PaymentProviderId;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestoneRecord {
  id: string;
  projectId: string;
  stageKey: ProjectStage;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
  sortOrder: number;
}

export interface ProjectAttachmentRecord {
  id: string;
  userId: string;
  projectId?: string;
  orderId?: string;
  ticketId?: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  category: 'brief' | 'reference' | 'message_attachment' | 'deliverable' | 'support_attachment';
  version: number;
  uploadedByRole: 'client' | 'team';
  uploadedAt: string;
}

export interface ProjectMessageRecord {
  id: string;
  projectId: string;
  userId: string;
  senderRole: 'client' | 'coordinator';
  senderName: string;
  body: string;
  attachmentIds: string[];
  isInternal?: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface ProjectDeliverableRecord {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  fileId: string;
  version: number;
  status: 'awaiting_review' | 'revision_requested' | 'approved';
  approvedAt?: string;
  createdAt: string;
}

export interface RevisionRequestRecord {
  id: string;
  revisionNumber: string;
  projectId: string;
  userId: string;
  deliverableId?: string;
  description: string;
  attachmentIds: string[];
  status: 'submitted' | 'in_review' | 'in_progress' | 'completed' | 'declined';
  teamResponse?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  referenceNumber: string;
  userId: string;
  orderId?: string;
  orderNumber?: string;
  serviceName: string;
  title: string;
  description: string;
  objectives: string;
  preferredStyle: string;
  brandRequirements: string;
  targetAudience: string;
  deliverableRequirements: string;
  requestedDeadline: string;
  assignedCoordinator: string;
  assignedTeam: string;
  currentStage: ProjectStage;
  progressPercent: number;
  revisionLimit: number;
  revisionsUsed: number;
  approvalHistory: Array<{ action: string; actor: string; note: string; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessageRecord {
  id: string;
  ticketId: string;
  senderRole: 'client' | 'support';
  senderName: string;
  body: string;
  attachmentIds: string[];
  createdAt: string;
}

export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  userId: string;
  category: SupportTicketCategory;
  subject: string;
  status: SupportTicketStatus;
  relatedOrderId?: string;
  relatedProjectId?: string;
  messages: SupportMessageRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type:
    | 'account_verification'
    | 'order_created'
    | 'payment_confirmed'
    | 'payment_failed'
    | 'credits_allocated'
    | 'subscription_update'
    | 'project_update'
    | 'new_message'
    | 'revision_update'
    | 'deliverable_uploaded'
    | 'support_reply'
    | 'invoice_generated';
  title: string;
  body: string;
  linkPath: string;
  isRead: boolean;
  createdAt: string;
}

export interface ClientActivityLogRecord {
  id: string;
  userId: string;
  eventType: string;
  title: string;
  detail: string;
  relatedPath?: string;
  createdAt: string;
}

export interface CustomPackageInquiryRecord {
  id: string;
  referenceNumber: string;
  userId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  requiredServices: string[];
  estimatedMonthlyVolume: string;
  projectDescription: string;
  budgetRange: string;
  expectedSchedule: string;
  supportingFileIds: string[];
  status: 'received' | 'under_review' | 'quoted';
  createdAt: string;
}

export interface CustomerOrganizationRecord {
  id: string;
  ownerUserId: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  industry: string;
  billingEmail: string;
  billingAddress: string;
  country: string;
  members: Array<{
    id: string;
    email: string;
    role: 'owner' | 'billing_admin' | 'project_manager' | 'member';
    status: 'invited' | 'active' | 'revoked';
    addedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalEntitlementRecord {
  id: string;
  userId: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  packageName: string;
  licenseKey: string;
  versionLabel: string;
  maxDownloads: number;
  downloadCount: number;
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: string;
  createdAt: string;
}

export interface DigitalDownloadLogRecord {
  id: string;
  entitlementId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  downloadedAt: string;
}

export interface PaymentRefundRecord {
  id: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: PortalCurrency;
  reason: string;
  status: 'pending_approval' | 'approved' | 'processed' | 'rejected' | 'failed';
  requestedBy: string;
  approvedBy?: string;
  providerRefundId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortalConsentRecord {
  id: string;
  userId?: string;
  email: string;
  policySlug: string;
  policyVersion: string;
  accepted: boolean;
  ipAddress: string;
  userAgent: string;
  recordedAt: string;
}

export interface UserMfaState {
  enabled: boolean;
  secret?: string;
  encryptedSecret?: string;
  enrolledAt?: string;
  lastUsedStep?: number;
  recoveryCodeHashes?: string[];
  failedAttempts?: number;
  lockedUntil?: string;
}

export interface PortalRepository {
  readonly mode: 'supabase' | 'local_dev';
  readonly supabaseWritePersistenceImplemented?: boolean;
  // Auth & Users
  findUserByEmail(email: string): Promise<PortalUserRecord | null>;
  findUserById(userId: string): Promise<PortalUserRecord | null>;
  createUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
    verificationTokenHash: string;
    verificationTokenExpiresAt?: string;
  }): Promise<{ user: PortalUserRecord; profile: PortalProfileRecord }>;
  verifyEmailByTokenHash(tokenHash: string): Promise<PortalUserRecord | null>;
  setVerificationToken(userId: string, tokenHash: string, expiresAt?: string): Promise<void>;
  setResetToken(userId: string, tokenHash: string, expiresAt: string): Promise<void>;
  resetPasswordByTokenHash(tokenHash: string, newPasswordHash: string): Promise<PortalUserRecord | null>;
  updatePassword(userId: string, newPasswordHash: string): Promise<void>;
  requestEmailChange(userId: string, newEmail: string, tokenHash: string, expiresAt?: string): Promise<void>;
  confirmEmailChange(userId: string, tokenHash: string): Promise<PortalUserRecord | null>;
  requestAccountClosure(userId: string, reason: string): Promise<PortalUserRecord>;
  suspendUser?(userId: string, reason: string, actor: string): Promise<PortalUserRecord | null>;
  reactivateUser?(userId: string, actor: string): Promise<PortalUserRecord | null>;
  getUserMfaState?(userId: string): Promise<UserMfaState>;
  setUserMfaState?(userId: string, state: UserMfaState): Promise<void>;

  // Sessions
  createSession(input: Omit<PortalSessionRecord, 'id' | 'createdAt' | 'lastSeenAt'>): Promise<PortalSessionRecord>;
  findActiveSessionByTokenHash(tokenHash: string): Promise<PortalSessionRecord | null>;
  listUserSessions(userId: string): Promise<PortalSessionRecord[]>;
  revokeSessionById(userId: string, sessionId: string): Promise<boolean>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;
  revokeOtherUserSessions(userId: string, keepTokenHash: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;

  // Profile, Organization & Addresses
  getProfile(userId: string): Promise<PortalProfileRecord | null>;
  updateProfile(userId: string, patch: Partial<PortalProfileRecord>): Promise<PortalProfileRecord>;
  getOrganization?(userId: string): Promise<CustomerOrganizationRecord | null>;
  upsertOrganization?(
    userId: string,
    input: Partial<Omit<CustomerOrganizationRecord, 'id' | 'ownerUserId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomerOrganizationRecord>;
  listAddresses(userId: string): Promise<ClientAddressRecord[]>;
  upsertAddress(userId: string, address: Omit<ClientAddressRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ClientAddressRecord>;
  deleteAddress(userId: string, addressId: string): Promise<boolean>;

  // Catalog & Promotions
  listCategories(): Promise<ProductCategoryRecord[]>;
  listProducts(filters?: { categorySlug?: string; search?: string }): Promise<ProductRecord[]>;
  getProductBySlug(slug: string): Promise<ProductRecord | null>;
  getPackageById(packageId: string): Promise<{ product: ProductRecord; pkg: ProductPackageRecord } | null>;
  getDiscountCode(code: string): Promise<DiscountCodeRecord | null>;
  listDiscountCodes?(includeInactive?: boolean): Promise<DiscountCodeRecord[]>;
  upsertDiscountCode?(record: DiscountCodeRecord): Promise<DiscountCodeRecord>;

  // Custom Enterprise Inquiry
  createCustomInquiry(input: Omit<CustomPackageInquiryRecord, 'id' | 'referenceNumber' | 'status' | 'createdAt'>): Promise<CustomPackageInquiryRecord>;
  listCustomInquiries(userId: string): Promise<CustomPackageInquiryRecord[]>;

  // Cart
  getCart(userId: string): Promise<ShoppingCartRecord>;
  saveCart(cart: ShoppingCartRecord): Promise<ShoppingCartRecord>;

  // Orders, Payments, Invoices, Refunds & Digital Entitlements
  allocatePaymentReference?(date?: Date): Promise<string>;
  findOrderByIdempotencyKey(userId: string, key: string): Promise<OrderRecord | null>;
  createOrder(input: Omit<OrderRecord, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<{ order: OrderRecord; invoice: InvoiceRecord; payment: PaymentRecord }>;
  listOrders(userId: string): Promise<OrderRecord[]>;
  getOrderById(userId: string, orderId: string): Promise<OrderRecord | null>;
  getOrderByIdInternal(orderId: string): Promise<OrderRecord | null>;
  requestOrderCancellation(userId: string, orderId: string, reason: string): Promise<OrderRecord | null>;
  listPayments(userId: string): Promise<PaymentRecord[]>;
  listInvoices(userId: string): Promise<InvoiceRecord[]>;
  getInvoiceById(userId: string, invoiceId: string): Promise<InvoiceRecord | null>;
  recordWebhookAndConfirmPayment(input: {
    provider: PaymentProviderId;
    providerEventId: string;
    orderId: string;
    providerTransactionId: string;
    amountMinor: number;
    currency: PortalCurrency;
    eventStatus: 'paid' | 'failed' | 'refunded';
    payloadSummary: Record<string, unknown>;
  }): Promise<{
    deduplicated: boolean;
    order?: OrderRecord;
    creditsAllocated: number;
    projectCreated?: ProjectRecord;
    ophireumPaymentReference?: string;
    entitlementsCreated?: DigitalEntitlementRecord[];
  }>;
  listDigitalEntitlements?(userId: string): Promise<DigitalEntitlementRecord[]>;
  getDigitalEntitlementById?(userId: string, entitlementId: string): Promise<DigitalEntitlementRecord | null>;
  revokeDigitalEntitlement?(entitlementId: string, reason: string, actor: string): Promise<DigitalEntitlementRecord | null>;
  recordDigitalDownload?(input: {
    userId: string;
    entitlementId: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<{ entitlement?: DigitalEntitlementRecord; log?: DigitalDownloadLogRecord; error?: string }>;
  listDigitalDownloadLogs?(userId: string): Promise<DigitalDownloadLogRecord[]>;
  expireStaleOrders?(now?: Date): Promise<OrderRecord[]>;

  // Credits
  getWallet(userId: string): Promise<CreditWalletRecord>;
  listCreditTransactions(userId: string): Promise<CreditTransactionRecord[]>;
  applyCreditLedgerEntry(input: {
    userId: string;
    transactionType: CreditTransactionType;
    amount: number;
    description: string;
    relatedOrderId?: string;
    relatedProjectId?: string;
    idempotencyKey?: string;
  }): Promise<{ wallet: CreditWalletRecord; transaction: CreditTransactionRecord }>;

  // Subscriptions
  listSubscriptions(userId: string): Promise<SubscriptionRecord[]>;
  requestSubscriptionCancel(userId: string, subscriptionId: string): Promise<SubscriptionRecord | null>;
  renewSubscription?(subscriptionId: string, providerTransactionId?: string): Promise<{ subscription: SubscriptionRecord; creditsAllocated: number } | null>;
  recordSubscriptionRenewalFailure?(subscriptionId: string, reason: string, graceDays?: number): Promise<SubscriptionRecord | null>;
  changeSubscriptionPlan?(userId: string, subscriptionId: string, newPackageId: string): Promise<{ subscription?: SubscriptionRecord; error?: string }>;

  // Projects, Milestones, Messages, Deliverables, Revisions
  createProject(input: Omit<ProjectRecord, 'id' | 'referenceNumber' | 'assignedCoordinator' | 'assignedTeam' | 'currentStage' | 'progressPercent' | 'revisionsUsed' | 'approvalHistory' | 'createdAt' | 'updatedAt'>): Promise<{ project: ProjectRecord; milestones: ProjectMilestoneRecord[] }>;
  listProjects(userId: string): Promise<ProjectRecord[]>;
  getProjectDetail(userId: string, projectId: string): Promise<{
    project: ProjectRecord;
    milestones: ProjectMilestoneRecord[];
    messages: ProjectMessageRecord[];
    attachments: ProjectAttachmentRecord[];
    deliverables: ProjectDeliverableRecord[];
    revisions: RevisionRequestRecord[];
  } | null>;
  addProjectMessage(input: { userId: string; projectId: string; senderName: string; body: string; attachmentIds: string[] }): Promise<ProjectMessageRecord | null>;
  markProjectMessagesRead(userId: string, projectId: string): Promise<void>;
  listAllUserMessages(userId: string): Promise<Array<ProjectMessageRecord & { projectTitle: string; projectReference: string }>>;
  createRevisionRequest(input: { userId: string; projectId: string; deliverableId?: string; description: string; attachmentIds: string[] }): Promise<{ revision?: RevisionRequestRecord; error?: string }>;
  approveDeliverable(userId: string, projectId: string, deliverableId: string, note?: string): Promise<ProjectDeliverableRecord | null>;

  // Files
  saveAttachment(record: Omit<ProjectAttachmentRecord, 'id' | 'uploadedAt'>, buffer: Buffer): Promise<ProjectAttachmentRecord>;
  listAttachments(userId: string, projectId?: string): Promise<ProjectAttachmentRecord[]>;
  getAttachmentById(userId: string, fileId: string): Promise<{ record: ProjectAttachmentRecord; buffer: Buffer } | null>;

  // Support
  createSupportTicket(input: {
    userId: string;
    senderName: string;
    category: SupportTicketCategory;
    subject: string;
    body: string;
    attachmentIds: string[];
    relatedOrderId?: string;
    relatedProjectId?: string;
  }): Promise<SupportTicketRecord>;
  listSupportTickets(userId: string): Promise<SupportTicketRecord[]>;
  replySupportTicket(userId: string, ticketId: string, senderName: string, body: string, attachmentIds: string[]): Promise<SupportTicketRecord | null>;

  // Notifications, Activities, Consents & Privacy
  listNotifications(userId: string): Promise<NotificationRecord[]>;
  markNotificationRead(userId: string, notificationId: string): Promise<boolean>;
  markAllNotificationsRead(userId: string): Promise<void>;
  addNotification(input: Omit<NotificationRecord, 'id' | 'isRead' | 'createdAt'>): Promise<NotificationRecord>;
  listActivities(userId: string, limit?: number): Promise<ClientActivityLogRecord[]>;
  addActivity(input: Omit<ClientActivityLogRecord, 'id' | 'createdAt'>): Promise<ClientActivityLogRecord>;
  recordConsent?(input: Omit<PortalConsentRecord, 'id' | 'recordedAt'>): Promise<PortalConsentRecord>;
  listConsents?(userId: string): Promise<PortalConsentRecord[]>;
  exportUserPersonalData?(userId: string): Promise<Record<string, unknown>>;

  // Admin Command Center & BI Operations
  adminListUsers?(): Promise<Array<{ user: Omit<PortalUserRecord, 'passwordHash'>; profile: PortalProfileRecord | null }>>;
  adminListOrders?(): Promise<OrderRecord[]>;
  adminListPayments?(): Promise<PaymentRecord[]>;
  adminListInvoices?(): Promise<InvoiceRecord[]>;
  adminListSubscriptions?(): Promise<SubscriptionRecord[]>;
  adminListProjects?(): Promise<ProjectRecord[]>;
  adminListSupportTickets?(): Promise<SupportTicketRecord[]>;
  adminListRefunds?(): Promise<PaymentRefundRecord[]>;
  adminUpdateOrderStatus?(orderId: string, status: OrderStatus, actor: string, note: string): Promise<OrderRecord | null>;
  adminUpdateProjectStage?(projectId: string, stage: ProjectStage, actor: string, note: string): Promise<ProjectRecord | null>;
  adminReplySupportTicket?(ticketId: string, senderName: string, body: string, nextStatus?: SupportTicketStatus): Promise<SupportTicketRecord | null>;
  adminRequestRefund?(input: { paymentId: string; amountMinor: number; reason: string; requestedBy: string }): Promise<PaymentRefundRecord | null>;
  adminDecideRefund?(refundId: string, decision: 'approved' | 'rejected' | 'processed', actor: string): Promise<PaymentRefundRecord | null>;
  adminCreateDeliverable?(input: {
    projectId: string;
    title: string;
    description: string;
    fileId: string;
    actor: string;
  }): Promise<ProjectDeliverableRecord | null>;
}

export const USD_TO_PHP_REFERENCE_RATE = 58;

export function usdToPhpMinor(usdMinor: number): number {
  return Math.round(usdMinor * USD_TO_PHP_REFERENCE_RATE);
}

export function formatMinorMoney(amountMinor: number, currency: PortalCurrency): string {
  const major = amountMinor / 100;
  if (currency === 'PHP') {
    return `₱${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
