import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LocalPortalRepository } from './localPortalRepository';
import { PortalProfileRecord, PortalRepository, PortalSessionRecord, PortalUserRecord, ProductCategoryRecord, ProductRecord } from './types';
import { ResendEmailTransport } from '../services/emailService';
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
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly authApiKey: string;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    super({ persistDir: null });
    this.supabaseUrl = supabaseUrl;
    this.serviceRoleKey = serviceRoleKey;
    this.authApiKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || serviceRoleKey).trim();
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  private mapProfile(row: any): PortalProfileRecord {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      email: String(row.email),
      firstName: String(row.first_name || ''),
      lastName: String(row.last_name || ''),
      fullName: String(row.full_name || ''),
      phone: String(row.phone || ''),
      companyName: String(row.company_name || ''),
      taxId: String(row.tax_id || ''),
      avatarUrl: String(row.avatar_url || ''),
      timezone: String(row.timezone || 'Asia/Manila'),
      preferredCurrency: row.preferred_currency === 'PHP' ? 'PHP' : 'USD',
      notificationPreferences: row.notification_preferences || {
        emailOrders: true, emailProjects: true, emailMessages: true, emailBilling: true, inAppAll: true,
      },
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private async getAuthProfile(userId: string): Promise<PortalProfileRecord | null> {
    const { data, error } = await this.supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(`Unable to load client profile: ${error.message}`);
    return data ? this.mapProfile(data) : null;
  }

  private mapAuthUser(user: any, profile?: PortalProfileRecord | null): PortalUserRecord {
    const now = new Date().toISOString();
    return {
      id: String(user.id),
      email: String(user.email || profile?.email || ''),
      emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
      accountStatus: 'active',
      createdAt: String(user.created_at || now),
      updatedAt: String(user.updated_at || now),
    };
  }

  override async findUserByEmail(email: string): Promise<PortalUserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await this.supabase.from('profiles').select('user_id').ilike('email', cleanEmail).maybeSingle();
    if (error) throw new Error(`Unable to check registered email: ${error.message}`);
    if (!data?.user_id) return null;
    return this.findUserById(String(data.user_id));
  }

  override async findUserById(userId: string): Promise<PortalUserRecord | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);
    if (error) {
      if (/not found|user not found/i.test(error.message)) return null;
      throw new Error(`Unable to verify Supabase Auth user: ${error.message}`);
    }
    if (!data.user) return null;
    const profile = await this.getAuthProfile(userId);
    return this.mapAuthUser(data.user, profile);
  }

  async authenticateUser(email: string, password: string): Promise<PortalUserRecord | null> {
    const authClient = createClient(this.supabaseUrl, this.authApiKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return null;
    if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
      throw new Error('Please verify your email address before signing in.');
    }
    const profile = await this.getAuthProfile(data.user.id);
    if (!profile) throw new Error('Your client profile is not available. Please contact support.');
    return this.mapAuthUser(data.user, profile);
  }

  override async createUser(input: {
    email: string;
    passwordHash: string;
    password?: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
    verificationTokenHash: string;
    verificationTokenExpiresAt?: string;
  }): Promise<{ user: PortalUserRecord; profile: PortalProfileRecord }> {
    if (!input.password) throw new Error('A password is required to create a Supabase Auth account.');
    const email = input.email.trim().toLowerCase();
    const redirectTo = `${(process.env.PORTAL_PUBLIC_URL || 'https://ophireummultimedia.com').replace(/\\/$/, '')}/portal/verify-email?verified=1`;
    const { data: linkData, error: linkError } = await this.supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password: input.password,
      options: {
        redirectTo,
        data: {
          first_name: input.firstName.trim(),
          last_name: input.lastName.trim(),
          company_name: (input.companyName || '').trim(),
          phone: (input.phone || '').trim(),
        },
      },
    } as any);
    if (linkError || !linkData?.user?.id || !linkData?.properties?.action_link) {
      throw new Error(linkError?.message || 'Supabase did not return a signup confirmation link.');
    }

    const userId = String(linkData.user.id);
    const { data: profileRow, error: profileError } = await this.supabase.from('profiles').insert({
      user_id: userId,
      email,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      full_name: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      phone: (input.phone || '').trim(),
      company_name: (input.companyName || '').trim(),
      timezone: 'Asia/Manila',
      preferred_currency: 'USD',
    }).select('*').single();

    if (profileError || !profileRow) {
      await this.supabase.auth.admin.deleteUser(userId);
      throw new Error(`Unable to save client profile: ${profileError?.message || 'No profile returned'}`);
    }

    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch] || ch));
    const firstName = escapeHtml(input.firstName.trim());
    const actionLink = String(linkData.properties.action_link);
    const emailTransport = new ResendEmailTransport();
    const sendResult = await emailTransport.send({
      to: email,
      from: process.env.EMAIL_FROM || 'Ophireum Multimedia <no-reply@ophireummultimedia.com>',
      subject: 'Verify your Ophireum Multimedia Client Portal account',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10203b"><h2>Verify your email address</h2><p>Hello ${firstName},</p><p>Confirm your email address to activate your Ophireum Multimedia Client Portal account.</p><p><a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#0f4c3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Verify email address</a></p><p style="font-size:12px;color:#64748b">This one-time link expires according to your Supabase Auth email-link settings. If you did not create this account, you can ignore this message.</p></div>`,
      text: `Hello ${input.firstName.trim()},\n\nVerify your Ophireum Multimedia Client Portal account using this one-time link:\n${actionLink}\n\nIf you did not create this account, you can ignore this message.`,
      idempotencyKey: `portal-signup-${userId}`,
    });

    if (sendResult.status !== 'sent') {
      await this.supabase.from('profiles').delete().eq('user_id', userId);
      await this.supabase.auth.admin.deleteUser(userId);
      throw new Error(sendResult.error || 'Unable to deliver the verification email through Resend.');
    }

    const profile = this.mapProfile(profileRow);
    return { user: this.mapAuthUser(linkData.user, profile), profile };
  }

  override async getProfile(userId: string): Promise<PortalProfileRecord | null> {
    return this.getAuthProfile(userId);
  }

  override async updateProfile(userId: string, patch: Partial<PortalProfileRecord>): Promise<PortalProfileRecord> {
    const updates: Record<string, unknown> = {};
    if (patch.firstName !== undefined) updates.first_name = patch.firstName.trim();
    if (patch.lastName !== undefined) updates.last_name = patch.lastName.trim();
    if (patch.phone !== undefined) updates.phone = patch.phone.trim();
    if (patch.companyName !== undefined) updates.company_name = patch.companyName.trim();
    if (patch.taxId !== undefined) updates.tax_id = patch.taxId.trim();
    if (patch.avatarUrl !== undefined) updates.avatar_url = patch.avatarUrl.trim();
    if (patch.timezone !== undefined) updates.timezone = patch.timezone.trim();
    if (patch.preferredCurrency !== undefined) updates.preferred_currency = patch.preferredCurrency;
    if (patch.notificationPreferences !== undefined) updates.notification_preferences = patch.notificationPreferences;
    const { data, error } = await this.supabase.from('profiles').update(updates).eq('user_id', userId).select('*').single();
    if (error || !data) throw new Error(`Unable to update client profile: ${error?.message || 'Profile not found'}`);
    return this.mapProfile(data);
  }

  override async createSession(input: Omit<PortalSessionRecord, 'id' | 'createdAt' | 'lastSeenAt'>): Promise<PortalSessionRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.from('portal_auth_sessions').insert({
      user_id: input.userId,
      token_hash: input.tokenHash,
      user_agent: input.userAgent,
      ip_address: input.ipAddress,
      expires_at: input.expiresAt,
      revoked_at: input.revokedAt || null,
    }).select('*').single();
    if (error || !data) throw new Error(`Unable to persist client session: ${error?.message || 'No session returned'}`);
    return {
      id: String(data.id), userId: String(data.user_id), tokenHash: String(data.token_hash),
      userAgent: String(data.user_agent || ''), ipAddress: String(data.ip_address || ''),
      expiresAt: String(data.expires_at), revokedAt: data.revoked_at || undefined,
      createdAt: String(data.created_at || now), lastSeenAt: String(data.last_seen_at || now),
    };
  }

  override async findActiveSessionByTokenHash(tokenHash: string): Promise<PortalSessionRecord | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.from('portal_auth_sessions').select('*')
      .eq('token_hash', tokenHash).is('revoked_at', null).gt('expires_at', now).maybeSingle();
    if (error) throw new Error(`Unable to verify client session: ${error.message}`);
    if (!data) return null;
    const { error: updateError } = await this.supabase.from('portal_auth_sessions').update({ last_seen_at: now }).eq('id', data.id);
    if (updateError) throw new Error(`Unable to refresh client session activity: ${updateError.message}`);
    return {
      id: String(data.id), userId: String(data.user_id), tokenHash: String(data.token_hash),
      userAgent: String(data.user_agent || ''), ipAddress: String(data.ip_address || ''),
      expiresAt: String(data.expires_at), revokedAt: data.revoked_at || undefined,
      createdAt: String(data.created_at), lastSeenAt: now,
    };
  }

  override async listUserSessions(userId: string): Promise<PortalSessionRecord[]> {
    const { data, error } = await this.supabase.from('portal_auth_sessions').select('*')
      .eq('user_id', userId).is('revoked_at', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Unable to list client sessions: ${error.message}`);
    return (data || []).map((row: any) => ({
      id: String(row.id), userId: String(row.user_id), tokenHash: String(row.token_hash),
      userAgent: String(row.user_agent || ''), ipAddress: String(row.ip_address || ''),
      expiresAt: String(row.expires_at), revokedAt: row.revoked_at || undefined,
      createdAt: String(row.created_at), lastSeenAt: String(row.last_seen_at),
    }));
  }

  override async revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
    const { data, error } = await this.supabase.from('portal_auth_sessions')
      .update({ revoked_at: new Date().toISOString() }).eq('id', sessionId).eq('user_id', userId)
      .is('revoked_at', null).select('id').maybeSingle();
    if (error) throw new Error(`Unable to revoke client session: ${error.message}`);
    return Boolean(data);
  }

  override async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    const { error } = await this.supabase.from('portal_auth_sessions')
      .update({ revoked_at: new Date().toISOString() }).eq('token_hash', tokenHash).is('revoked_at', null);
    if (error) throw new Error(`Unable to revoke client session: ${error.message}`);
  }

  override async revokeOtherUserSessions(userId: string, keepTokenHash: string): Promise<void> {
    const { error } = await this.supabase.from('portal_auth_sessions')
      .update({ revoked_at: new Date().toISOString() }).eq('user_id', userId)
      .neq('token_hash', keepTokenHash).is('revoked_at', null);
    if (error) throw new Error(`Unable to revoke other client sessions: ${error.message}`);
  }

  override async revokeAllUserSessions(userId: string): Promise<void> {
    const { error } = await this.supabase.from('portal_auth_sessions')
      .update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).is('revoked_at', null);
    if (error) throw new Error(`Unable to revoke client sessions: ${error.message}`);
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
