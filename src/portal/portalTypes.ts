export type PortalCurrency = 'USD' | 'PHP';

export interface PortalUser {
  id: string;
  email: string;
  emailVerified: boolean;
  pendingEmail?: string;
  accountStatus: 'active' | 'pending_closure' | 'closed';
  createdAt?: string;
}

export interface PortalProfile {
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
}

export interface PortalWallet {
  userId: string;
  availableCredits: number;
  usedCredits: number;
  pendingCredits: number;
  expiringCredits: number;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface ProductPackage {
  id: string;
  productId: string;
  name: string;
  tierCode: string;
  priceUsdMinor: number;
  pricePhpMinor: number;
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

export interface Product {
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
  packages: ProductPackage[];
}

export interface CartSummary {
  id: string;
  currency: PortalCurrency;
  fxRateReference: number;
  items: Array<{
    id: string;
    productId: string;
    packageId: string;
    productSlug: string;
    productName: string;
    packageName: string;
    billingType: 'one_time' | 'subscription_monthly' | 'credit_pack';
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    creditsIncluded: number;
    revisionLimit: number;
    isCustomQuote: boolean;
    savedForLater: boolean;
  }>;
  savedItems: CartSummary['items'];
  subtotalMinor: number;
  discountCode?: string;
  discountDescription?: string;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface PaymentProviderConfig {
  provider: string;
  displayName: string;
  category: string;
  description: string;
  supportedCurrencies: PortalCurrency[];
  paymentMethods: string[];
  mode: 'disabled' | 'sandbox' | 'live';
  isEnabled: boolean;
  integrationStatus: string;
  webhookPath: string;
  requiredEnvVars: string[];
  lastVerifiedAt: string | null;
  unavailableMessage: string;
}

export function formatMoney(amountMinor: number, currency: PortalCurrency = 'USD'): string {
  const major = amountMinor / 100;
  if (currency === 'PHP') {
    return `₱${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPortalDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatPortalDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatStatusLabel(raw?: string): string {
  if (!raw) return '—';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusToneClass(raw?: string): string {
  const v = (raw || '').toLowerCase();
  if (['paid', 'completed', 'active', 'approved', 'resolved', 'project_completed', 'confirmed'].includes(v)) {
    return 'text-[#15803D] font-semibold';
  }
  if (['failed', 'cancelled', 'refunded', 'declined', 'suspended', 'past_due', 'expired'].includes(v)) {
    return 'text-[#B91C1C] font-semibold';
  }
  return 'text-[#B45309] font-semibold';
}
