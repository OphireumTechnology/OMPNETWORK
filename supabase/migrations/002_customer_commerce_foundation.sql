-- Customer commerce foundation. No payment provider or live charging is enabled.
BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('OPM-ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('PHP','USD')),
  preferred_method TEXT NOT NULL CHECK (preferred_method IN ('xendit','paypal','maya','gotyme','paymongo')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_payment','paid','cancelled','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_profiles_auth_user
  ON public.client_profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer manages own profile" ON public.client_profiles;
CREATE POLICY "Customer manages own profile" ON public.client_profiles
  FOR ALL USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Customer reads own orders" ON public.customer_orders;
CREATE POLICY "Customer reads own orders" ON public.customer_orders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customer creates own draft orders" ON public.customer_orders;
CREATE POLICY "Customer creates own draft orders" ON public.customer_orders
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND status = 'draft'
  );

DROP POLICY IF EXISTS "Admin manages customer orders" ON public.customer_orders;
CREATE POLICY "Admin manages customer orders" ON public.customer_orders
  FOR ALL USING (public.is_ophireum_admin())
  WITH CHECK (public.is_ophireum_admin());

CREATE INDEX IF NOT EXISTS idx_customer_orders_user_created
  ON public.customer_orders(user_id, created_at DESC);

COMMIT;
