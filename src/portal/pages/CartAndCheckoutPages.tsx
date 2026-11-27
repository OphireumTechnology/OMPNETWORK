import React, { useCallback, useEffect, useState } from 'react';
import {
  ShoppingCart,
  Trash2,
  Bookmark,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Upload,
  FileText,
  CreditCard,
  Lock,
  Sparkles,
} from 'lucide-react';
import { PortalLayout } from '../components/PortalLayout';
import { portalRequest, uploadPortalFile } from '../portalApi';
import { usePortalAuth } from '../PortalAuthContext';
import { usePortalRouter } from '../PortalRouter';
import {
  CartSummary,
  PaymentProviderConfig,
  PortalCurrency,
  formatMoney,
  formatPortalDate,
  formatStatusLabel,
  statusToneClass,
} from '../portalTypes';

export const PortalCartPage: React.FC = () => {
  const { refreshSession } = usePortalAuth();
  const { navigate } = usePortalRouter();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await portalRequest<{ cart: CartSummary }>('/cart');
      setCart(res.cart);
      setDiscountInput(res.cart.discountCode || '');
    } catch (err: any) {
      setError(err?.message || 'Unable to load shopping cart.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const updateQuantity = async (itemId: string, quantity: number) => {
    setBusyId(itemId);
    setError('');
    try {
      const res = await portalRequest<{ cart: CartSummary }>(`/cart/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: { quantity },
      });
      setCart(res.cart);
      await refreshSession();
    } catch (err: any) {
      setError(err?.message || 'Unable to update quantity.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleSaveForLater = async (itemId: string, savedForLater: boolean) => {
    setBusyId(itemId);
    setError('');
    try {
      const res = await portalRequest<{ cart: CartSummary }>(`/cart/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: { savedForLater },
      });
      setCart(res.cart);
      await refreshSession();
    } catch (err: any) {
      setError(err?.message || 'Unable to update item.');
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusyId(itemId);
    setError('');
    try {
      const res = await portalRequest<{ cart: CartSummary }>(`/cart/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      setCart(res.cart);
      await refreshSession();
    } catch (err: any) {
      setError(err?.message || 'Unable to remove item.');
    } finally {
      setBusyId(null);
    }
  };

  const switchCurrency = async (currency: PortalCurrency) => {
    setError('');
    try {
      const res = await portalRequest<{ cart: CartSummary }>('/cart/preferences', {
        method: 'PATCH',
        body: { currency },
      });
      setCart(res.cart);
    } catch (err: any) {
      setError(err?.message || 'Unable to switch currency.');
    }
  };

  const applyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const res = await portalRequest<{ cart: CartSummary }>('/cart/preferences', {
        method: 'PATCH',
        body: { discountCode: discountInput.trim() },
      });
      setCart(res.cart);
      setNotice(
        res.cart.discountCode
          ? `Discount code ${res.cart.discountCode} applied (${res.cart.discountDescription || 'verified'}).`
          : 'Discount code cleared.'
      );
    } catch (err: any) {
      setError(err?.message || 'Discount code could not be applied.');
    }
  };

  return (
    <PortalLayout
      title="Shopping Cart"
      subtitle="Review selected services and packages. All pricing, discounts, and totals are calculated strictly on the server."
    >
      {error && (
        <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {loading || !cart ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center text-sm text-[#64748B]">
          Loading cart items...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: Cart Items & Saved For Later */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E6E2D8] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#0F1D36]">
                    Active Cart Items ({cart.items.length})
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Reference FX rate: 1 USD = ₱{cart.fxRateReference.toFixed(2)} PHP
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-[#E6E2D8] p-0.5 bg-[#FAF8F4]">
                  {(['USD', 'PHP'] as PortalCurrency[]).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => switchCurrency(cur)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        cart.currency === cur
                          ? 'bg-[#0F1D36] text-white'
                          : 'text-[#475569] hover:text-[#0F1D36]'
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              {cart.items.length === 0 ? (
                <div className="p-10 text-center space-y-4">
                  <ShoppingCart className="w-9 h-9 text-[#94A3B8] mx-auto" />
                  <div>
                    <p className="text-sm font-semibold text-[#0F1D36]">Your shopping cart is empty</p>
                    <p className="text-xs text-[#64748B] mt-1">
                      Browse the Service Store to choose multimedia production, AI creative services, or credit packages.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/portal/store')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
                  >
                    <span>Browse Service Store</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E6E2D8]">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/portal/store/${item.productSlug}`)}
                          className="text-sm font-semibold text-[#0F1D36] hover:text-[#0F4C3A] text-left cursor-pointer"
                        >
                          {item.productName}
                        </button>
                        <p className="text-xs text-[#475569]">
                          Package: <span className="font-medium text-[#0F1D36]">{item.packageName}</span> ·{' '}
                          {formatStatusLabel(item.billingType)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                          <span>Unit: {formatMoney(item.unitPriceMinor, cart.currency)}</span>
                          {item.creditsIncluded > 0 && (
                            <span className="font-mono text-[#0F4C3A]">
                              +{(item.creditsIncluded * item.quantity).toLocaleString()} credits upon verified payment
                            </span>
                          )}
                          {item.revisionLimit > 0 && <span>{item.revisionLimit} revision rounds</span>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="inline-flex items-center border border-[#E6E2D8] rounded-lg">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="px-2.5 py-1 text-sm text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="px-3 py-1 text-xs font-mono font-semibold tabular-nums text-[#0F1D36]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={busyId === item.id || item.quantity >= 25}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="px-2.5 py-1 text-sm text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right min-w-[96px]">
                          <p className="font-mono text-sm font-semibold tabular-nums text-[#0F1D36]">
                            {formatMoney(item.lineTotalMinor, cart.currency)}
                          </p>
                          <div className="flex items-center justify-end gap-2 mt-1">
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => toggleSaveForLater(item.id, true)}
                              className="text-[11px] text-[#475569] hover:text-[#0F1D36] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Bookmark className="w-3 h-3" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => removeItem(item.id)}
                              className="text-[11px] text-[#B91C1C] hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.savedItems.length > 0 && (
              <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E6E2D8]">
                  <h3 className="text-sm font-semibold text-[#0F1D36]">
                    Saved For Later ({cart.savedItems.length})
                  </h3>
                </div>
                <div className="divide-y divide-[#E6E2D8]">
                  {cart.savedItems.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-[#0F1D36]">{item.productName}</p>
                        <p className="text-xs text-[#64748B]">
                          {item.packageName} · {formatMoney(item.unitPriceMinor, cart.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => toggleSaveForLater(item.id, false)}
                          className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
                        >
                          Move to Cart
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => removeItem(item.id)}
                          className="text-xs text-[#B91C1C] hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Order Summary & Promo */}
          <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-5 sticky top-24">
            <h2 className="text-base font-semibold text-[#0F1D36]">Order Summary</h2>

            <form onSubmit={applyDiscount} className="space-y-2">
              <label className="block text-xs font-medium text-[#475569]">
                Promo / Discount Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME10"
                  className="flex-1 px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg border border-[#0F1D36] text-xs font-semibold text-[#0F1D36] hover:bg-[#0F1D36] hover:text-white transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Discounts are validated and computed exclusively on the server.
              </p>
            </form>

            <div className="space-y-2.5 pt-3 border-t border-[#E6E2D8] text-sm">
              <div className="flex justify-between text-[#475569]">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums text-[#0F1D36]">
                  {formatMoney(cart.subtotalMinor, cart.currency)}
                </span>
              </div>
              {cart.discountMinor > 0 && (
                <div className="flex justify-between text-[#15803D]">
                  <span>Discount ({cart.discountCode})</span>
                  <span className="font-mono tabular-nums">
                    −{formatMoney(cart.discountMinor, cart.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#475569]">
                <span>Estimated Tax</span>
                <span className="font-mono tabular-nums text-[#0F1D36]">
                  {formatMoney(cart.taxMinor, cart.currency)}
                </span>
              </div>
              <div className="pt-3 border-t border-[#E6E2D8] flex justify-between items-baseline">
                <span className="font-semibold text-[#0F1D36]">Total ({cart.currency})</span>
                <span className="font-mono text-xl font-bold tabular-nums text-[#0F1D36]">
                  {formatMoney(cart.totalMinor, cart.currency)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={cart.items.length === 0}
              onClick={() => navigate('/portal/checkout')}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-3 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] text-xs text-[#475569] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0F4C3A] shrink-0 mt-0.5" />
              <span>
                Credits and project activation occur strictly after verified payment confirmation via server webhook.
              </span>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

// =========================================================================
// GUIDED 5-STEP CHECKOUT
// =========================================================================

const CHECKOUT_STEPS = [
  'Review Order',
  'Billing Info',
  'Project Requirements',
  'Payment Method',
  'Order Confirmation',
];

export const PortalCheckoutPage: React.FC = () => {
  const { user, profile, refreshSession } = usePortalAuth();
  const { navigate } = usePortalRouter();

  const [step, setStep] = useState(0);
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [providers, setProviders] = useState<PaymentProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [error, setError] = useState('');

  // Step 2: Billing
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');

  // Step 3: Project Requirements
  const [projectTitle, setProjectTitle] = useState('');
  const [instructions] = useState('');
  const [deliveryExpectation, setDeliveryExpectation] = useState('');
  const [creativeBrief, setCreativeBrief] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [uploadedRefs, setUploadedRefs] = useState<Array<{ id: string; fileName: string }>>([]);

  // Step 4: Payment provider
  const [selectedProvider, setSelectedProvider] = useState('xendit');

  // Step 5: Confirmation payload
  const [confirmation, setConfirmation] = useState<{
    order: any;
    invoice: any;
    payment: any;
    paymentInitiation: any;
  } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [cartRes, provRes, profRes] = await Promise.all([
          portalRequest<{ cart: CartSummary }>('/cart'),
          portalRequest<{ providers: PaymentProviderConfig[] }>('/payment-providers'),
          portalRequest<{ profile: any; addresses: any[] }>('/profile'),
        ]);
        if (!active) return;
        setCart(cartRes.cart);
        setProviders(provRes.providers || []);
        const p = profRes.profile || profile;
        setFullName(p?.fullName || '');
        setEmail(p?.email || user?.email || '');
        setPhone(p?.phone || '');
        setCompanyName(p?.companyName || '');
        setTaxId(p?.taxId || '');
        const defaultAddr = (profRes.addresses || []).find((a: any) => a.isDefault) || profRes.addresses?.[0];
        if (defaultAddr) {
          setAddress(
            [defaultAddr.line1, defaultAddr.line2, defaultAddr.city, defaultAddr.stateProvince, defaultAddr.postalCode, defaultAddr.country]
              .filter(Boolean)
              .join(', ')
          );
        }
      } catch (err: any) {
        if (active) setError(err?.message || 'Unable to initialize checkout.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile, user]);

  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRef(true);
    setError('');
    try {
      const res = await uploadPortalFile(file, { category: 'brief' });
      setUploadedRefs((prev) => [...prev, { id: res.file.id, fileName: res.file.fileName }]);
    } catch (err: any) {
      setError(err?.message || 'File upload failed.');
    } finally {
      setUploadingRef(false);
      e.target.value = '';
    }
  };

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await portalRequest<{
        order: any;
        invoice: any;
        payment: any;
        paymentInitiation: any;
      }>('/checkout', {
        method: 'POST',
        idempotent: true,
        body: {
          paymentProvider: selectedProvider,
          billingDetails: { fullName, email, phone, companyName, taxId, address },
          projectRequirements: {
            title: projectTitle,
            instructions,
            deliveryExpectation,
            creativeBrief,
            specialInstructions,
            referenceFileIds: uploadedRefs.map((f) => f.id),
          },
        },
      });
      setConfirmation(res);
      setStep(4);
      await refreshSession();
    } catch (err: any) {
      setError(err?.message || 'Unable to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeProviderConfig = providers.find((p) => p.provider === selectedProvider);

  return (
    <PortalLayout
      title="Guided Checkout"
      subtitle="Complete billing details, optional project brief, and payment method selection."
    >
      {/* Stepper */}
      <div className="mb-6 bg-white border border-[#E6E2D8] rounded-xl p-4">
        <ol className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {CHECKOUT_STEPS.map((label, idx) => {
            const done = idx < step;
            const current = idx === step;
            return (
              <li
                key={label}
                className={`flex items-center gap-2 text-xs ${
                  current
                    ? 'text-[#0F1D36] font-semibold'
                    : done
                    ? 'text-[#0F4C3A] font-medium'
                    : 'text-[#94A3B8]'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] shrink-0 ${
                    current
                      ? 'bg-[#0F1D36] text-white'
                      : done
                      ? 'bg-[#0F4C3A] text-white'
                      : 'bg-[#F1EFE9] text-[#64748B]'
                  }`}
                >
                  {done ? '✓' : idx + 1}
                </span>
                <span className="truncate">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center text-sm text-[#64748B]">
          Preparing checkout workspace...
        </div>
      ) : !confirmation && (!cart || cart.items.length === 0) ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center space-y-4">
          <p className="text-sm font-semibold text-[#0F1D36]">No items in cart to check out.</p>
          <button
            type="button"
            onClick={() => navigate('/portal/store')}
            className="px-4 py-2.5 rounded-lg bg-[#0F4C3A] text-white text-sm font-semibold cursor-pointer"
          >
            Return to Service Store
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Step Panel */}
          <div className="lg:col-span-2 bg-white border border-[#E6E2D8] rounded-xl p-6">
            {step === 0 && cart && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-[#0F1D36]">Step 1: Review Order Items</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Verify quantities, package inclusions, and server-calculated pricing before continuing.
                  </p>
                </div>
                <div className="divide-y divide-[#E6E2D8] border border-[#E6E2D8] rounded-lg">
                  {cart.items.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#0F1D36]">{item.productName}</p>
                        <p className="text-xs text-[#64748B]">
                          {item.packageName} × {item.quantity}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-[#0F1D36]">
                        {formatMoney(item.lineTotalMinor, cart.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/portal/cart')}
                    className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F1D36] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Edit Cart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
                  >
                    <span>Continue to Billing</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-[#0F1D36]">Step 2: Client Billing Information</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    These details will appear on your sequential Ophireum Multimedia invoice and receipt.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Billing Email *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Tax ID / TIN (Optional)</label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Billing Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, City, Country"
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                </div>
                <div className="flex justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F1D36] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!fullName.trim() || !email.includes('@')) {
                        setError('Please enter your billing full name and a valid billing email.');
                        return;
                      }
                      setError('');
                      setStep(2);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
                  >
                    <span>Continue to Project Brief</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-[#0F1D36]">
                    Step 3: Project Requirements &amp; Creative Brief
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Optional for credit packages; recommended for creative and production services.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Project Title</label>
                    <input
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="e.g. Q3 Brand Launch Video Campaign"
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1">Target Delivery Date</label>
                    <input
                      type="date"
                      value={deliveryExpectation}
                      onChange={(e) => setDeliveryExpectation(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-1">Creative Brief &amp; Objectives</label>
                  <textarea
                    rows={3}
                    value={creativeBrief}
                    onChange={(e) => setCreativeBrief(e.target.value)}
                    placeholder="Describe your brand tone, target audience, visual references, and required formats..."
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-1">Special Instructions</label>
                  <textarea
                    rows={2}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Any compliance notes, aspect ratios, or voiceover pronunciation details..."
                    className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
                  />
                </div>

                <div className="p-4 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#0F1D36]">Reference Materials (Private Upload)</p>
                      <p className="text-[11px] text-[#64748B]">
                        Allowed: JPG, PNG, WEBP, MP4, MOV, PDF, DOCX, XLSX, PPTX, ZIP (max 15 MB)
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0F1D36] text-xs font-semibold text-[#0F1D36] hover:bg-[#0F1D36] hover:text-white transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingRef ? 'Uploading...' : 'Attach File'}</span>
                      <input type="file" className="hidden" onChange={handleUploadReference} disabled={uploadingRef} />
                    </label>
                  </div>
                  {uploadedRefs.length > 0 && (
                    <ul className="space-y-1 text-xs text-[#334155]">
                      {uploadedRefs.map((ref) => (
                        <li key={ref.id} className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#0F4C3A]" />
                          <span>{ref.fileName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F1D36] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
                  >
                    <span>Continue to Payment Method</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-[#0F1D36]">Step 4: Payment Method Selection</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Select your preferred payment rail. Online gateways remain in verified readiness mode until merchant credentials and webhook tests are activated.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {providers.map((prov) => {
                    const selected = selectedProvider === prov.provider;
                    return (
                      <button
                        key={prov.provider}
                        type="button"
                        onClick={() => setSelectedProvider(prov.provider)}
                        className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#0F4C3A] bg-[#F4F9F7]'
                            : 'border-[#E6E2D8] bg-white hover:border-[#0F1D36]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#0F1D36]">{prov.displayName}</span>
                          <span className="font-mono text-[10px] uppercase text-[#64748B]">
                            {prov.mode}
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] mt-1">{prov.description}</p>
                        <p className="text-[11px] text-[#64748B] mt-2">
                          Currencies: {prov.supportedCurrencies.join(', ')}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {activeProviderConfig && !activeProviderConfig.isEnabled && (
                  <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#E7D8B1] text-xs text-[#785315] space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Payment Gateway Readiness Notice ({activeProviderConfig.displayName})</span>
                    </p>
                    <p>{activeProviderConfig.unavailableMessage}</p>
                    <p>
                      Submitting creates a verified pending order and sequential invoice. No card or wallet charge is collected automatically, and credits remain pending until verified webhook confirmation.
                    </p>
                  </div>
                )}

                <div className="flex justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F1D36] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePlaceOrder}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{submitting ? 'Creating Order...' : 'Submit Order & Generate Invoice'}</span>
                  </button>
                </div>
              </div>
            )}

            {step === 4 && confirmation && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-[#F4F9F7] border border-[#C6E1D7] flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#0F4C3A] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-base font-bold text-[#0F1D36]">
                      Order {confirmation.order.orderNumber} Recorded
                    </h2>
                    <p className="text-xs text-[#334155] mt-1">
                      Invoice <span className="font-mono font-semibold">{confirmation.invoice?.invoiceNumber}</span> has been issued. Payment status is{' '}
                      <span className={statusToneClass(confirmation.order.paymentStatus)}>
                        {formatStatusLabel(confirmation.order.paymentStatus)}
                      </span>{' '}
                      pending verified gateway settlement.
                    </p>
                  </div>
                </div>

                {confirmation.paymentInitiation?.message && (
                  <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#E7D8B1] text-xs text-[#785315]">
                    {confirmation.paymentInitiation.message}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-[#E6E2D8] rounded-xl p-4 text-xs">
                  <div>
                    <p className="text-[#64748B]">Order Reference</p>
                    <p className="font-mono font-semibold text-[#0F1D36] mt-0.5">
                      {confirmation.order.orderNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Invoice Number</p>
                    <p className="font-mono font-semibold text-[#0F1D36] mt-0.5">
                      {confirmation.invoice?.invoiceNumber || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Server-Calculated Total</p>
                    <p className="font-mono font-semibold text-[#0F1D36] mt-0.5">
                      {formatMoney(confirmation.order.totalMinor, confirmation.order.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/portal/orders/${confirmation.order.id}`)}
                    className="px-4 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
                  >
                    Track Order Details
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/portal/invoices')}
                    className="px-4 py-2.5 rounded-lg border border-[#E6E2D8] text-sm font-semibold text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer"
                  >
                    View Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/portal/dashboard')}
                    className="px-4 py-2.5 rounded-lg border border-[#E6E2D8] text-sm text-[#475569] hover:text-[#0F1D36] cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Summary Card */}
          {cart && step < 4 && (
            <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-4 sticky top-24">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#0F1D36]">Checkout Summary</h3>
                <span className="font-mono text-xs text-[#64748B]">{cart.currency}</span>
              </div>
              <div className="space-y-2 text-xs">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2 text-[#475569]">
                    <span className="truncate">
                      {item.productName} ({item.packageName}) × {item.quantity}
                    </span>
                    <span className="font-mono tabular-nums text-[#0F1D36] shrink-0">
                      {formatMoney(item.lineTotalMinor, cart.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-[#E6E2D8] space-y-1.5 text-sm">
                <div className="flex justify-between text-[#475569]">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(cart.subtotalMinor, cart.currency)}
                  </span>
                </div>
                {cart.discountMinor > 0 && (
                  <div className="flex justify-between text-[#15803D]">
                    <span>Discount</span>
                    <span className="font-mono tabular-nums">
                      −{formatMoney(cart.discountMinor, cart.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[#475569]">
                  <span>Tax</span>
                  <span className="font-mono tabular-nums">{formatMoney(cart.taxMinor, cart.currency)}</span>
                </div>
                <div className="pt-2 border-t border-[#E6E2D8] flex justify-between font-bold text-[#0F1D36]">
                  <span>Total Due</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(cart.totalMinor, cart.currency)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#64748B] flex items-start gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#B8923A] shrink-0 mt-0.5" />
                <span>Order created date: {formatPortalDate(new Date().toISOString())}.</span>
              </p>
            </div>
          )}
        </div>
      )}
    </PortalLayout>
  );
};
