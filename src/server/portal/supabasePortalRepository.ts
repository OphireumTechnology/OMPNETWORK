import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LocalPortalRepository } from './localPortalRepository';
import { PortalRepository, ProductCategoryRecord, ProductRecord } from './types';
import { PORTAL_INITIAL_PRODUCTS, PORTAL_PRODUCT_CATEGORIES } from './catalogSeed';

/**
 * Production Supabase PostgreSQL + Supabase Auth + Supabase Storage adapter.
 *
 * Uses the server-only SUPABASE_SERVICE_ROLE_KEY after Express verifies the client identity
 * and enforces explicit client ownership (user_id === authenticatedUser.id) on every operation,
 * complementing the database-level Row Level Security policies in
 * `supabase/migrations/002_client_portal_commerce.sql`.
 */
export class SupabasePortalRepository extends LocalPortalRepository implements PortalRepository {
  public readonly supabase: SupabaseClient;
  public readonly storageBucket = 'portal-private-files';

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    super({ persistDir: null });
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
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
}
