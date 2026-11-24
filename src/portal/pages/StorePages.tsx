import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Search, ShoppingCart, SlidersHorizontal, X } from 'lucide-react';
import { PortalLayout } from '../components/PortalLayout';
import { portalRequest } from '../portalApi';
import { usePortalRouter } from '../PortalRouter';
import { usePortalAuth } from '../PortalAuthContext';
import {
  formatMoney,
  formatPortalDate,
  formatStatusLabel,
  PortalCurrency,
  Product,
  ProductCategory,
  statusToneClass,
} from '../portalTypes';

export const PortalStorePage: React.FC = () => {
  const { navigate, query } = usePortalRouter();
  const { profile, user, refreshSession } = usePortalAuth();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(query.get('category') || 'all');
  const [search, setSearch] = useState(query.get('q') || '');
  const [currency, setCurrency] = useState<PortalCurrency>(profile?.preferredCurrency || 'USD');
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);

  // Custom enterprise inquiry state
  const [custCompany, setCustCompany] = useState(profile?.companyName || '');
  const [custContact, setCustContact] = useState(profile?.fullName || '');
  const [custEmail, setCustEmail] = useState(user?.email || '');
  const [custServices, setCustServices] = useState('AI Video Production, Corporate Branding');
  const [custVolume, setCustVolume] = useState('');
  const [custBudget, setCustBudget] = useState('');
  const [custSchedule, setCustSchedule] = useState('');
  const [custDesc, setCustDesc] = useState('');
  const [custBusy, setCustBusy] = useState(false);
  const [custSuccess, setCustSuccess] = useState('');
  const [custError, setCustError] = useState('');

  useEffect(() => {
    const qCat = query.get('category');
    const qSearch = query.get('q');
    if (qCat) setSelectedCategory(qCat);
    if (qSearch !== null) setSearch(qSearch);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (search.trim()) params.set('q', search.trim());
    portalRequest<{ categories: ProductCategory[]; products: Product[] }>(
      `/catalog?${params.toString()}`
    )
      .then((res) => {
        if (active) {
          setCategories(res.categories);
          setProducts(res.products);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCategory, search]);

  const handleAddToCart = async (packageId: string, goCheckout = false) => {
    setAddingId(packageId);
    setToast('');
    try {
      await portalRequest('/cart/preferences', { method: 'PATCH', body: { currency } });
      await portalRequest('/cart/items', { method: 'POST', body: { packageId, quantity: 1 } });
      await refreshSession();
      if (goCheckout) {
        navigate('/portal/checkout');
      } else {
        setToast('Added to your shopping cart.');
      }
    } catch (err: any) {
      setToast(err?.message || 'Unable to add package to cart.');
    } finally {
      setAddingId(null);
    }
  };

  const handleSubmitCustomInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustError('');
    setCustSuccess('');
    setCustBusy(true);
    try {
      const res = await portalRequest<{ inquiry: { referenceNumber: string } }>('/custom-inquiries', {
        method: 'POST',
        body: {
          companyName: custCompany,
          contactPerson: custContact,
          email: custEmail,
          requiredServices: custServices.split(',').map((s) => s.trim()).filter(Boolean),
          estimatedMonthlyVolume: custVolume,
          budgetRange: custBudget,
          expectedSchedule: custSchedule,
          projectDescription: custDesc,
        },
      });
      setCustSuccess(`Inquiry ${res.inquiry.referenceNumber} submitted. Our operations team will follow up with a custom quotation.`);
      setCustDesc('');
    } catch (err: any) {
      setCustError(err?.message || 'Unable to submit inquiry.');
    } finally {
      setCustBusy(false);
    }
  };

  const creditPackages = products.filter((p) => p.categorySlug === 'subscription-credit-packages');

  return (
    <PortalLayout
      title="Service Store & Credit Packages"
      subtitle="Browse database-backed multimedia services, AI creative packages, and flexible credit plans."
    >
      {/* Top Toolbar */}
      <div className="bg-white border border-[#E6E2D8] rounded-xl p-4 mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services, deliverables, or credit packages..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-[#E6E2D8] p-0.5 bg-[#FAF8F4]">
              {(['USD', 'PHP'] as PortalCurrency[]).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer ${
                    currency === curr
                      ? 'bg-[#0F1D36] text-white'
                      : 'text-[#475569] hover:text-[#0F1D36]'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCompare((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E6E2D8] bg-white hover:bg-[#FAF8F4] text-xs font-semibold text-[#0F1D36] cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showCompare ? 'Hide Comparison' : 'Compare Credit Packages'}</span>
            </button>

            <button
              onClick={() => setCustomModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F1D36] hover:bg-[#172B4D] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <span>Request Custom Package</span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#0F4C3A] text-white'
                : 'bg-[#FAF8F4] text-[#475569] hover:text-[#0F1D36]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-[#0F4C3A] text-white'
                  : 'bg-[#FAF8F4] text-[#475569] hover:text-[#0F1D36]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Illustrative Pricing Disclosure */}
      <div className="mb-6 px-4 py-3 rounded-xl bg-white border border-[#E6E2D8] text-xs text-[#475569] flex flex-wrap items-center justify-between gap-2">
        <span>
          Displayed prices are initial illustrative package configurations loaded from the backend catalog and editable by authorized product management.
        </span>
        {toast && (
          <div className="flex items-center gap-2 font-semibold text-[#0F4C3A]">
            <span>{toast}</span>
            <button onClick={() => navigate('/portal/cart')} className="underline cursor-pointer">
              View Cart
            </button>
          </div>
        )}
      </div>

      {/* Package Comparison Table */}
      {showCompare && creditPackages.length > 0 && (
        <section className="mb-8 bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E2D8]">
            <h2 className="text-base font-semibold text-[#0F1D36]">
              Subscription & Credit Package Comparison
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Compare credit allocations, turnaround windows, revision limits, and support tiers side by side.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-[#475569]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Package</th>
                  <th className="px-4 py-3 font-semibold text-right">Illustrative Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Credits</th>
                  <th className="px-4 py-3 font-semibold">Turnaround</th>
                  <th className="px-4 py-3 font-semibold text-right">Revisions</th>
                  <th className="px-4 py-3 font-semibold">Support Level</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {creditPackages.map((item) => {
                  const pkg = item.packages[0];
                  const priceMinor = currency === 'PHP' ? pkg.pricePhpMinor : pkg.priceUsdMinor;
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF8F4]/70">
                      <td className="px-4 py-3 font-semibold text-[#0F1D36]">{item.name}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#0F1D36]">
                        {pkg.isCustomQuote ? 'Custom Quotation' : formatMoney(priceMinor, currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0F4C3A] font-semibold">
                        {pkg.isCustomQuote ? 'Custom' : pkg.creditsIncluded.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{pkg.turnaroundLabel}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{pkg.revisionLimit}</td>
                      <td className="px-4 py-3 text-[#475569]">{pkg.supportLevel}</td>
                      <td className="px-4 py-3 text-right">
                        {pkg.isCustomQuote ? (
                          <button
                            onClick={() => setCustomModalOpen(true)}
                            className="font-semibold text-[#0F1D36] underline cursor-pointer"
                          >
                            Request Quote
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(pkg.id)}
                            className="px-3 py-1.5 rounded-md bg-[#0F4C3A] text-white font-semibold hover:bg-[#0B3B2D] cursor-pointer"
                          >
                            Add to Cart
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Product Grid */}
      {loading ? (
        <div className="p-8 text-sm text-[#64748B]">Loading catalog from backend...</div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center">
          <p className="text-sm font-semibold text-[#0F1D36]">No matching services found</p>
          <p className="mt-1 text-xs text-[#64748B]">Try another search term or select a different category.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {products.map((product) => {
            const pkg = product.packages[0];
            const priceMinor = currency === 'PHP' ? pkg.pricePhpMinor : pkg.priceUsdMinor;
            const catName = categories.find((c) => c.slug === product.categorySlug)?.name || product.categorySlug;

            return (
              <article
                key={product.id}
                className="bg-white border border-[#E6E2D8] rounded-xl p-5 flex flex-col justify-between hover:border-[#0F4C3A]/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                    <span>{catName}</span>
                    {pkg.isPopular && <span className="font-semibold text-[#B8923A]">Recommended</span>}
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-[#0F1D36]">{product.name}</h3>
                  <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">{product.shortDescription}</p>

                  <div className="mt-4 pt-3 border-t border-[#F2EFE8] flex items-baseline justify-between gap-2">
                    <div>
                      <span className="font-mono text-xl font-bold tabular-nums text-[#0F1D36]">
                        {pkg.isCustomQuote ? 'Custom Quote' : formatMoney(priceMinor, currency)}
                      </span>
                      {!pkg.isCustomQuote && pkg.billingType === 'subscription_monthly' && (
                        <span className="text-xs text-[#64748B] ml-1">/ cycle</span>
                      )}
                    </div>
                    {pkg.creditsIncluded > 0 && (
                      <span className="font-mono text-xs font-semibold text-[#0F4C3A] tabular-nums">
                        {pkg.creditsIncluded.toLocaleString()} credits
                      </span>
                    )}
                  </div>

                  <ul className="mt-3 space-y-1.5 text-xs text-[#334155]">
                    {pkg.features.slice(0, 4).map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#0F4C3A] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 pt-4 border-t border-[#F2EFE8] flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/portal/store/${product.slug}`)}
                    className="flex-1 py-2 px-3 rounded-lg border border-[#E6E2D8] text-xs font-semibold text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer whitespace-nowrap"
                  >
                    View Details
                  </button>
                  {pkg.isCustomQuote ? (
                    <button
                      onClick={() => {
                        setCustServices(product.name);
                        setCustomModalOpen(true);
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#0F1D36] hover:bg-[#172B4D] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Request Quote
                    </button>
                  ) : (
                    <button
                      disabled={addingId === pkg.id}
                      onClick={() => handleAddToCart(pkg.id)}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{addingId === pkg.id ? 'Adding...' : 'Add to Cart'}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Custom Enterprise Package Request Modal */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1D36]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E2D8] rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E2D8]">
              <div>
                <h2 className="text-lg font-bold text-[#0F1D36]">Request a Custom Enterprise Package</h2>
                <p className="text-xs text-[#64748B]">Logged directly for follow-up by our authorized operations team.</p>
              </div>
              <button
                onClick={() => setCustomModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F1D36] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomInquiry} className="mt-4 space-y-3.5">
              {custError && <div className="p-3 rounded-lg bg-rose-50 text-xs text-[#B91C1C]">{custError}</div>}
              {custSuccess && <div className="p-3 rounded-lg bg-emerald-50 text-xs text-[#15803D]">{custSuccess}</div>}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Business / Company Name</label>
                  <input
                    required
                    value={custCompany}
                    onChange={(e) => setCustCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Contact Person</label>
                  <input
                    required
                    value={custContact}
                    onChange={(e) => setCustContact(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Estimated Monthly Volume</label>
                  <input
                    value={custVolume}
                    onChange={(e) => setCustVolume(e.target.value)}
                    placeholder="e.g. 50 videos / 200 graphics"
                    className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">Required Services</label>
                <input
                  required
                  value={custServices}
                  onChange={(e) => setCustServices(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Budget Range</label>
                  <input
                    value={custBudget}
                    onChange={(e) => setCustBudget(e.target.value)}
                    placeholder="e.g. $1,500 – $5,000 / month"
                    className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Expected Delivery Schedule</label>
                  <input
                    value={custSchedule}
                    onChange={(e) => setCustSchedule(e.target.value)}
                    placeholder="e.g. Q1 launch / weekly sprints"
                    className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">Project Description</label>
                <textarea
                  required
                  rows={4}
                  value={custDesc}
                  onChange={(e) => setCustDesc(e.target.value)}
                  placeholder="Describe objectives, channels, brand requirements, and deliverables..."
                  className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E6E2D8] text-xs font-semibold text-[#334155] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={custBusy}
                  className="px-5 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                >
                  {custBusy ? 'Submitting...' : 'Submit Custom Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

export const PortalProductDetailPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { navigate } = usePortalRouter();
  const { profile, refreshSession } = usePortalAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [currency, setCurrency] = useState<PortalCurrency>(profile?.preferredCurrency || 'USD');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    portalRequest<{ product: Product }>(`/catalog/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (active) setProduct(res.product);
      })
      .catch(() => {
        if (active) setProduct(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const handleAction = async (buyNow: boolean) => {
    if (!product) return;
    const pkg = product.packages[0];
    if (pkg.isCustomQuote) {
      navigate('/portal/store');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await portalRequest('/cart/preferences', { method: 'PATCH', body: { currency } });
      await portalRequest('/cart/items', { method: 'POST', body: { packageId: pkg.id, quantity: 1 } });
      await refreshSession();
      if (buyNow) navigate('/portal/checkout');
      else setNotice('Package added to your shopping cart.');
    } catch (err: any) {
      setNotice(err?.message || 'Could not add item.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout title="Service Details">
        <div className="p-8 text-sm text-[#64748B]">Loading service specification...</div>
      </PortalLayout>
    );
  }

  if (!product) {
    return (
      <PortalLayout title="Service Not Found">
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-8 text-center">
          <p className="text-sm text-[#334155]">This service could not be found in the catalog.</p>
          <button
            onClick={() => navigate('/portal/store')}
            className="mt-4 px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
          >
            Back to Service Store
          </button>
        </div>
      </PortalLayout>
    );
  }

  const pkg = product.packages[0];
  const priceMinor = currency === 'PHP' ? pkg.pricePhpMinor : pkg.priceUsdMinor;

  return (
    <PortalLayout title={product.name} subtitle={product.shortDescription}>
      <button
        onClick={() => navigate('/portal/store')}
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Service Store</span>
      </button>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        <div className="space-y-6">
          <section className="bg-white border border-[#E6E2D8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#0F1D36]">Service Overview</h2>
            <p className="mt-2 text-sm text-[#334155] leading-relaxed">{product.fullDescription}</p>

            <div className="mt-6 grid sm:grid-cols-2 gap-6 pt-5 border-t border-[#EFECE4]">
              <div>
                <h3 className="text-xs font-semibold text-[#0F1D36] uppercase tracking-wider mb-2.5">
                  Package Inclusions
                </h3>
                <ul className="space-y-2 text-sm text-[#334155]">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#0F4C3A] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#0F1D36] uppercase tracking-wider mb-2.5">
                  Sample Deliverables
                </h3>
                <ul className="space-y-2 text-sm text-[#334155]">
                  {product.sampleDeliverables.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
                <h3 className="text-xs font-semibold text-[#0F1D36] uppercase tracking-wider mt-5 mb-2">
                  Required Client Materials
                </h3>
                <ul className="space-y-1.5 text-sm text-[#475569]">
                  {product.requiredClientMaterials.map((m) => (
                    <li key={m}>· {m}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#E6E2D8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#0F1D36] mb-3">Terms & Conditions</h2>
            <p className="text-sm text-[#475569] leading-relaxed">{product.termsSummary}</p>
            <h3 className="text-sm font-bold text-[#0F1D36] mt-6 mb-3">Frequently Asked Questions</h3>
            <div className="divide-y divide-[#EFECE4]">
              {product.faqs.map((faq) => (
                <div key={faq.question} className="py-3">
                  <p className="text-sm font-semibold text-[#0F1D36]">{faq.question}</p>
                  <p className="mt-1 text-xs text-[#475569] leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sticky Purchase Summary */}
        <aside className="bg-white border border-[#E6E2D8] rounded-xl p-6 sticky top-24 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Illustrative Price</span>
            <div className="inline-flex rounded-md border border-[#E6E2D8] p-0.5 bg-[#FAF8F4]">
              {(['USD', 'PHP'] as PortalCurrency[]).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded cursor-pointer ${
                    currency === curr ? 'bg-[#0F1D36] text-white' : 'text-[#475569]'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          <div className="font-mono text-3xl font-bold tabular-nums text-[#0F1D36]">
            {pkg.isCustomQuote ? 'Custom Quote' : formatMoney(priceMinor, currency)}
          </div>

          <dl className="divide-y divide-[#F2EFE8] text-xs">
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-[#64748B]">Estimated Turnaround</dt>
              <dd className="font-medium text-[#0F1D36] text-right">{pkg.turnaroundLabel}</dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-[#64748B]">Revision Allowance</dt>
              <dd className="font-mono font-semibold text-[#0F1D36]">{pkg.revisionLimit} rounds</dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-[#64748B]">Support Level</dt>
              <dd className="font-medium text-[#0F1D36] text-right">{pkg.supportLevel}</dd>
            </div>
            {pkg.creditsIncluded > 0 && (
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-[#64748B]">Credits Included</dt>
                <dd className="font-mono font-semibold text-[#0F4C3A]">
                  {pkg.creditsIncluded.toLocaleString()} credits
                </dd>
              </div>
            )}
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-[#64748B]">Usage Limits</dt>
              <dd className="font-medium text-[#0F1D36] text-right">{pkg.usageLimits}</dd>
            </div>
          </dl>

          {notice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-[#15803D]">
              {notice}
            </div>
          )}

          {pkg.isCustomQuote ? (
            <button
              onClick={() => navigate('/portal/store')}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0F1D36] hover:bg-[#172B4D] text-white text-sm font-semibold cursor-pointer"
            >
              Request Custom Quotation
            </button>
          ) : (
            <div className="space-y-2.5 pt-2">
              <button
                disabled={busy}
                onClick={() => handleAction(true)}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
              >
                Buy Now
              </button>
              <button
                disabled={busy}
                onClick={() => handleAction(false)}
                className="w-full py-2.5 px-4 rounded-lg border border-[#0F1D36] text-[#0F1D36] hover:bg-[#FAF8F4] disabled:opacity-60 text-sm font-semibold cursor-pointer"
              >
                Add to Cart
              </button>
            </div>
          )}
        </aside>
      </div>
    </PortalLayout>
  );
};

export const PortalMyServicesPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      portalRequest<{ orders: any[] }>('/orders'),
      portalRequest<{ inquiries: any[] }>('/custom-inquiries'),
    ])
      .then(([ord, inq]) => {
        setOrders(ord.orders || []);
        setInquiries(inq.inquiries || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const purchasedItems = orders.flatMap((order) =>
    (order.items || []).map((item: any) => ({
      ...item,
      orderId: order.id,
      orderNumber: order.orderNumber,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      createdAt: order.createdAt,
    }))
  );

  return (
    <PortalLayout
      title="My Services"
      subtitle="Active purchased services, packages, and custom enterprise package inquiries."
    >
      <div className="space-y-6">
        <section className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E2D8] flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F1D36]">Purchased Services & Packages</h2>
            <button
              onClick={() => navigate('/portal/store')}
              className="px-3.5 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
            >
              Browse Store
            </button>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-[#64748B]">Loading your services...</div>
          ) : purchasedItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-[#0F1D36]">No purchased services yet</p>
              <p className="mt-1 text-xs text-[#64748B]">
                Once you place an order in the Service Store, your services will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FAF8F4] text-xs text-[#64748B] border-b border-[#E6E2D8]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Fulfillment</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4]">
                  {purchasedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF8F4]/70">
                      <td className="px-4 py-3 font-medium text-[#0F1D36]">{item.productName}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/portal/orders/${item.orderId}`)}
                          className="font-mono text-xs text-[#0F4C3A] font-semibold hover:underline cursor-pointer"
                        >
                          {item.orderNumber}
                        </button>
                      </td>
                      <td className={`px-4 py-3 text-xs ${statusToneClass(item.paymentStatus)}`}>
                        {formatStatusLabel(item.paymentStatus)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#475569]">
                        {formatStatusLabel(item.fulfillmentStatus)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                        {formatMoney(item.lineTotalMinor, item.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {inquiries.length > 0 && (
          <section className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E6E2D8]">
              <h2 className="text-base font-semibold text-[#0F1D36]">Custom Enterprise Package Requests</h2>
            </div>
            <div className="divide-y divide-[#EFECE4]">
              {inquiries.map((inq) => (
                <div key={inq.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#64748B]">
                      <span className="font-mono font-semibold text-[#0F1D36]">{inq.referenceNumber}</span> ·{' '}
                      {formatPortalDate(inq.createdAt)}
                    </div>
                    <p className="text-sm font-semibold text-[#0F1D36] mt-0.5">{inq.companyName}</p>
                    <p className="text-xs text-[#475569]">{inq.projectDescription}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#B45309]">{formatStatusLabel(inq.status)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PortalLayout>
  );
};
