-- ============================================================================
-- OPHIREUM MULTIMEDIA CLIENT PORTAL — COMMERCE, PROJECTS & RLS MIGRATION
-- Migration: 002_client_portal_commerce.sql
-- DO NOT APPLY TO PRODUCTION WITHOUT BACKUP, BASELINE VERIFICATION & APPROVAL
-- ============================================================================

BEGIN;

-- Generic updated_at trigger helper (pinned search_path)
CREATE OR REPLACE FUNCTION public.set_portal_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Append-only ledger / audit immutability guard (pinned search_path)
CREATE OR REPLACE FUNCTION public.prevent_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only; UPDATE and DELETE are prohibited', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

-- Invoice accounting immutability guard (blocks DELETE and prevents mutating historical amounts/line items)
CREATE OR REPLACE FUNCTION public.prevent_invoice_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Issued invoices cannot be deleted';
  END IF;
  IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.subtotal_minor IS DISTINCT FROM OLD.subtotal_minor
     OR NEW.discount_minor IS DISTINCT FROM OLD.discount_minor
     OR NEW.tax_minor IS DISTINCT FROM OLD.tax_minor
     OR NEW.total_minor IS DISTINCT FROM OLD.total_minor
     OR NEW.line_items IS DISTINCT FROM OLD.line_items THEN
    RAISE EXCEPTION 'Issued invoice financial fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- Race-free PostgreSQL sequences for sequential order & invoice numbering
CREATE SEQUENCE IF NOT EXISTS public.portal_order_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.portal_invoice_seq START WITH 1001 INCREMENT BY 1;

-- 1. profiles (client portal identity linked strictly to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
  preferred_currency TEXT NOT NULL DEFAULT 'USD' CHECK (preferred_currency IN ('USD', 'PHP')),
  notification_preferences JSONB NOT NULL DEFAULT '{"emailOrders":true,"emailProjects":true,"emailMessages":true,"emailBilling":true,"inAppAll":true}'::jsonb,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'pending_closure', 'closed')),
  closure_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. client_addresses
CREATE TABLE IF NOT EXISTS public.client_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Primary Billing',
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  state_province TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Philippines',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. product_categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  category_slug TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  sample_deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_client_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  terms_summary TEXT NOT NULL DEFAULT '',
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. product_packages (ALL prices in BIGINT integer minor units: cents / centavos)
CREATE TABLE IF NOT EXISTS public.product_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier_code TEXT NOT NULL UNIQUE,
  price_usd_minor BIGINT NOT NULL DEFAULT 0 CHECK (price_usd_minor >= 0),
  price_php_minor BIGINT NOT NULL DEFAULT 0 CHECK (price_php_minor >= 0),
  is_custom_quote BOOLEAN NOT NULL DEFAULT FALSE,
  billing_type TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_type IN ('one_time', 'subscription_monthly', 'credit_pack')),
  credits_included INTEGER NOT NULL DEFAULT 0 CHECK (credits_included >= 0),
  turnaround_label TEXT NOT NULL DEFAULT '',
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days > 0),
  revision_limit INTEGER NOT NULL DEFAULT 2 CHECK (revision_limit >= 0),
  usage_limits TEXT NOT NULL DEFAULT '',
  delivery_conditions TEXT NOT NULL DEFAULT '',
  support_level TEXT NOT NULL DEFAULT 'Standard Portal Support',
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_illustrative_pricing BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. product_features
CREATE TABLE IF NOT EXISTS public.product_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.product_packages(id) ON DELETE CASCADE,
  feature_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 7. shopping_carts
CREATE TABLE IF NOT EXISTS public.shopping_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'PHP')),
  discount_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. cart_items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.shopping_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES public.product_packages(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 50),
  saved_for_later BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, package_id, saved_for_later)
);

-- 9. orders (server-authoritative only; clients may SELECT own orders, NEVER INSERT/UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  fx_rate_snapshot NUMERIC(12, 6) NOT NULL DEFAULT 58.000000,
  subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0),
  discount_code TEXT,
  discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('credit_card', 'debit_card', 'paypal', 'xendit', 'maya', 'paymongo', 'gotyme')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('unpaid', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (fulfillment_status IN ('pending_payment', 'payment_verification', 'confirmed', 'awaiting_project_brief', 'in_production', 'quality_review', 'awaiting_client_review', 'revision_requested', 'final_approval', 'completed', 'cancelled')),
  payment_reference TEXT,
  billing_details JSONB NOT NULL,
  project_requirements JSONB,
  cancellation_requested BOOLEAN NOT NULL DEFAULT FALSE,
  cancellation_reason TEXT,
  idempotency_key TEXT UNIQUE,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES public.product_packages(id) ON DELETE RESTRICT,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  billing_type TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0),
  credits_allocated INTEGER NOT NULL DEFAULT 0 CHECK (credits_allocated >= 0),
  revision_limit INTEGER NOT NULL DEFAULT 0 CHECK (revision_limit >= 0)
);

-- 11. payments (immutable transaction record managed exclusively server-side)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('credit_card', 'debit_card', 'paypal', 'xendit', 'maya', 'paymongo', 'gotyme')),
  environment TEXT NOT NULL DEFAULT 'disabled' CHECK (environment IN ('disabled', 'sandbox', 'live')),
  provider_transaction_id TEXT UNIQUE,
  checkout_url TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('unpaid', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded')),
  failure_reason TEXT,
  refunded_minor BIGINT NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. payment_webhook_events (deduplication & audit log; server-only)
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status TEXT NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'ignored_duplicate', 'failed')),
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_event_id)
);

-- 13. invoices (sequential server-controlled, read-only for clients)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
  payment_status TEXT NOT NULL,
  issuing_company JSONB NOT NULL,
  client_billing JSONB NOT NULL,
  line_items JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL
);

-- 14. credit_wallets (server-authoritative balance; non-negative check)
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  available_credits INTEGER NOT NULL DEFAULT 0 CHECK (available_credits >= 0),
  used_credits INTEGER NOT NULL DEFAULT 0 CHECK (used_credits >= 0),
  pending_credits INTEGER NOT NULL DEFAULT 0 CHECK (pending_credits >= 0),
  expiring_credits INTEGER NOT NULL DEFAULT 0 CHECK (expiring_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. credit_transactions (append-only immutable ledger)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('package_purchase', 'subscription_allocation', 'service_usage', 'credit_adjustment', 'refund', 'promotional_credit', 'expiration')),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  related_project_id UUID,
  description TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES public.product_packages(id) ON DELETE RESTRICT,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'past_due', 'suspended', 'cancelled', 'expired')),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  credits_per_cycle INTEGER NOT NULL DEFAULT 0 CHECK (credits_per_cycle >= 0),
  inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_requested_at TIMESTAMPTZ,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. subscription_transactions
CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  status TEXT NOT NULL,
  cycle_start TIMESTAMPTZ,
  cycle_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  preferred_style TEXT NOT NULL DEFAULT '',
  brand_requirements TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  deliverable_requirements TEXT NOT NULL DEFAULT '',
  requested_deadline TEXT NOT NULL DEFAULT '',
  assigned_coordinator TEXT NOT NULL DEFAULT 'Ophireum Production Coordinator',
  assigned_team TEXT NOT NULL DEFAULT 'Ophireum Creative Production Desk',
  current_stage TEXT NOT NULL DEFAULT 'order_confirmed' CHECK (current_stage IN ('order_confirmed', 'project_brief_received', 'requirements_review', 'production_started', 'initial_output_submitted', 'client_review', 'revisions_in_progress', 'final_quality_review', 'final_delivery', 'project_completed')),
  progress_percent INTEGER NOT NULL DEFAULT 10 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  revision_limit INTEGER NOT NULL DEFAULT 2 CHECK (revision_limit >= 0),
  revisions_used INTEGER NOT NULL DEFAULT 0 CHECK (revisions_used >= 0),
  approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. project_milestones
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL
);

-- 20. project_messages
CREATE TABLE IF NOT EXISTS public.project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'coordinator')),
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. project_attachments (metadata for private Supabase Storage objects)
CREATE TABLE IF NOT EXISTS public.project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ticket_id UUID,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  category TEXT NOT NULL CHECK (category IN ('brief', 'reference', 'message_attachment', 'deliverable', 'support_attachment')),
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by_role TEXT NOT NULL CHECK (uploaded_by_role IN ('client', 'team')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. project_deliverables
CREATE TABLE IF NOT EXISTS public.project_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_id UUID NOT NULL REFERENCES public.project_attachments(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'awaiting_review' CHECK (status IN ('awaiting_review', 'revision_requested', 'approved')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. revision_requests
CREATE TABLE IF NOT EXISTS public.revision_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_number TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  deliverable_id UUID REFERENCES public.project_deliverables(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  attachment_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'in_progress', 'completed', 'declined')),
  team_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('Account Access', 'Orders', 'Payments', 'Billing', 'Project Status', 'Technical Support', 'Service Inquiry', 'Refund Request', 'Other')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_for_client', 'resolved', 'closed')),
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. support_messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'support')),
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_path TEXT NOT NULL DEFAULT '/portal/dashboard',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. client_activity_logs
CREATE TABLE IF NOT EXISTS public.client_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  related_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-frequency client queries
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_created ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_user_issued ON public.invoices(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON public.projects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_messages_project ON public.project_messages(project_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_project_attachments_user ON public.project_attachments(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.client_activity_logs(user_id, created_at DESC);

-- Immutability triggers on financial ledger, webhook audit, and issued invoices
DROP TRIGGER IF EXISTS trg_credit_transactions_immutable ON public.credit_transactions;
CREATE TRIGGER trg_credit_transactions_immutable
  BEFORE UPDATE OR DELETE ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_payment_webhooks_no_delete ON public.payment_webhook_events;
CREATE TRIGGER trg_payment_webhooks_no_delete
  BEFORE DELETE ON public.payment_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_invoices_immutable ON public.invoices;
CREATE TRIGGER trg_invoices_immutable
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_invoice_tampering();

-- Updated-at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_portal_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_portal_updated_at();
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_portal_updated_at();
DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_portal_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & LEAST-PRIVILEGE GRANTS
-- Financial tables permit SELECT only for the owning client; ALL writes MUST
-- execute server-side via service_role. PUBLIC and anon receive zero privileges.
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'client_addresses', 'product_categories', 'products', 'product_packages', 'product_features',
    'shopping_carts', 'cart_items', 'orders', 'order_items', 'payments', 'payment_webhook_events',
    'invoices', 'credit_wallets', 'credit_transactions', 'subscriptions', 'subscription_transactions',
    'projects', 'project_milestones', 'project_messages', 'project_attachments', 'project_deliverables',
    'revision_requests', 'support_tickets', 'support_messages', 'notifications', 'client_activity_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated;', tbl);
    IF tbl <> 'payment_webhook_events' THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated;', tbl);
    END IF;
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', tbl);
  END LOOP;
END $$;

REVOKE ALL ON SEQUENCE public.portal_order_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.portal_invoice_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.portal_order_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.portal_invoice_seq TO service_role;

-- Catalog: authenticated read-only (idempotent policies)
DROP POLICY IF EXISTS "Authenticated read product_categories" ON public.product_categories;
CREATE POLICY "Authenticated read product_categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated read active products" ON public.products;
CREATE POLICY "Authenticated read active products" ON public.products FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Authenticated read product_packages" ON public.product_packages;
CREATE POLICY "Authenticated read product_packages" ON public.product_packages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated read product_features" ON public.product_features;
CREATE POLICY "Authenticated read product_features" ON public.product_features FOR SELECT TO authenticated USING (true);

-- Profiles & addresses: strict owner isolation (no client DELETE on profiles)
DROP POLICY IF EXISTS "Client reads own profile" ON public.profiles;
CREATE POLICY "Client reads own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own addresses" ON public.client_addresses;
CREATE POLICY "Client reads own addresses" ON public.client_addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Financial & Commerce: owner SELECT ONLY (server service_role handles ALL writes)
DROP POLICY IF EXISTS "Client reads own cart" ON public.shopping_carts;
CREATE POLICY "Client reads own cart" ON public.shopping_carts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own cart items" ON public.cart_items;
CREATE POLICY "Client reads own cart items" ON public.cart_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shopping_carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Client reads own orders" ON public.orders;
CREATE POLICY "Client reads own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own order items" ON public.order_items;
CREATE POLICY "Client reads own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "Client reads own payments" ON public.payments;
CREATE POLICY "Client reads own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own invoices" ON public.invoices;
CREATE POLICY "Client reads own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own credit wallet" ON public.credit_wallets;
CREATE POLICY "Client reads own credit wallet" ON public.credit_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own credit ledger" ON public.credit_transactions;
CREATE POLICY "Client reads own credit ledger" ON public.credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own subscriptions" ON public.subscriptions;
CREATE POLICY "Client reads own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own subscription tx" ON public.subscription_transactions;
CREATE POLICY "Client reads own subscription tx" ON public.subscription_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Projects, Files, Deliverables, Revisions, Support, Notifications, Activities: strict owner SELECT
DROP POLICY IF EXISTS "Client reads own projects" ON public.projects;
CREATE POLICY "Client reads own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own milestones" ON public.project_milestones;
CREATE POLICY "Client reads own milestones" ON public.project_milestones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Client reads own project messages" ON public.project_messages;
CREATE POLICY "Client reads own project messages" ON public.project_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND is_internal = FALSE);
DROP POLICY IF EXISTS "Client reads own attachments" ON public.project_attachments;
CREATE POLICY "Client reads own attachments" ON public.project_attachments FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own deliverables" ON public.project_deliverables;
CREATE POLICY "Client reads own deliverables" ON public.project_deliverables FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own revisions" ON public.revision_requests;
CREATE POLICY "Client reads own revisions" ON public.revision_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own support tickets" ON public.support_tickets;
CREATE POLICY "Client reads own support tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own support messages" ON public.support_messages;
CREATE POLICY "Client reads own support messages" ON public.support_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own notifications" ON public.notifications;
CREATE POLICY "Client reads own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Client reads own activities" ON public.client_activity_logs;
CREATE POLICY "Client reads own activities" ON public.client_activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- payment_webhook_events: zero access for authenticated/anon clients (server service_role only)

-- Private Supabase Storage bucket declaration (no public access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portal-private-files',
  'portal-private-files',
  FALSE,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Private Storage object isolation: authenticated clients may only read objects under their own user_id/ prefix
DROP POLICY IF EXISTS "Client reads own private portal files" ON storage.objects;
CREATE POLICY "Client reads own private portal files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'portal-private-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
