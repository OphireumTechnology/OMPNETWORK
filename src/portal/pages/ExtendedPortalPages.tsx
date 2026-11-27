import React, { useEffect, useState } from 'react';
import {
  Building2,
  Tag,
  Download,
  Calendar,
  Bot,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  FileDown,
  Send,
  RefreshCw,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { PortalLayout } from '../components/PortalLayout';
import { portalRequest } from '../portalApi';
import { usePortalAuth } from '../PortalAuthContext';
import { navigateToAppPath, usePortalRouter } from '../PortalRouter';
import { apiUrl } from '../../lib/apiClient';

// =====================================================================
// 1. ORGANIZATION / COMPANY PROFILE PAGE
// =====================================================================
export const PortalOrganizationPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [form, setForm] = useState({
    tradeName: '',
    legalName: '',
    taxId: '',
    industry: '',
    billingEmail: '',
    billingAddress: '',
    country: 'Philippines',
  });

  useEffect(() => {
    let active = true;
    portalRequest<{ organization: any }>('/organization')
      .then((res) => {
        if (!active || !res.organization) return;
        setForm({
          tradeName: res.organization.tradeName || '',
          legalName: res.organization.legalName || '',
          taxId: res.organization.taxId || '',
          industry: res.organization.industry || '',
          billingEmail: res.organization.billingEmail || '',
          billingAddress: res.organization.billingAddress || '',
          country: res.organization.country || 'Philippines',
        });
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await portalRequest('/organization', { method: 'PATCH', body: form });
      setFeedback({ type: 'ok', text: 'Organization profile saved to your client workspace.' });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Unable to save organization details.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout
      title="Company & Organization"
      subtitle="Manage your corporate billing profile, tax identification, and organization details for invoicing."
    >
      <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 max-w-3xl">
        {loading ? (
          <p className="text-sm text-[#64748B]">Loading organization profile...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Company / Trade Name</label>
                <input
                  type="text"
                  required
                  value={form.tradeName}
                  onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                  placeholder="e.g. Acme Holdings Corp."
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Registered Legal Entity Name</label>
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="Optional legal registration name"
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">TIN / Tax ID</label>
                <input
                  type="text"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="000-000-000-000"
                  className="w-full px-3 py-2 text-sm font-mono border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Industry Sector</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder="Technology, Media, Healthcare, Retail..."
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Country</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Official Billing Email</label>
                <input
                  type="email"
                  value={form.billingEmail}
                  onChange={(e) => setForm({ ...form, billingEmail: e.target.value })}
                  placeholder="billing@company.example"
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Official Billing Address</label>
              <textarea
                rows={3}
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                placeholder="Building, street, city, postal code"
                className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
              />
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  feedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Organization Profile'}</span>
            </button>
          </form>
        )}
      </div>
    </PortalLayout>
  );
};

// =====================================================================
// 2. ACTIVE OFFERS & PROMOTIONS PAGE
// =====================================================================
export const PortalOffersPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    portalRequest<{ offers: any[] }>('/offers')
      .then((res) => setOffers(res.offers || []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, []);

  const applyCodeToCart = async (code: string) => {
    setMessage(null);
    try {
      await portalRequest('/cart/discount', { method: 'PATCH', body: { code } });
      setMessage(`Promotion code ${code} applied to your shopping cart.`);
    } catch (err: any) {
      setMessage(err?.message || `Unable to apply ${code}. Make sure your cart meets the minimum subtotal.`);
    }
  };

  return (
    <PortalLayout
      title="Offers & Promotions"
      subtitle="Verified discount codes governed by server-side checkout pricing rules."
    >
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-[#FAF8F4] border border-[#B8923A]/50 text-xs text-[#0F1D36] flex items-center justify-between gap-3">
          <span>{message}</span>
          <button
            onClick={() => navigate('/portal/cart')}
            className="font-semibold text-[#0F4C3A] underline cursor-pointer"
          >
            View Cart
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading active promotional offers...</p>
      ) : offers.length === 0 ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-8 text-center text-sm text-[#64748B]">
          No active promotional codes are published right now. Check back or request a custom enterprise quote.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.code}
              className="bg-white border border-[#E6E2D8] rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-[#0F1D36] tracking-wide">{offer.code}</span>
                  <span className="font-mono text-xs font-semibold text-[#0F4C3A]">
                    {offer.discountType === 'percent'
                      ? `${offer.value}% OFF`
                      : `$${(offer.value / 100).toLocaleString('en-US')} OFF`}
                  </span>
                </div>
                <p className="text-sm text-[#475569] mt-2">{offer.description}</p>
                {offer.minSubtotalUsdMinor > 0 && (
                  <p className="text-xs text-[#64748B] font-mono mt-2">
                    Minimum subtotal: ${(offer.minSubtotalUsdMinor / 100).toLocaleString('en-US')} USD
                  </p>
                )}
              </div>
              <button
                onClick={() => applyCodeToCart(offer.code)}
                className="w-full py-2 px-3 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Apply Code to Cart</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
};

// =====================================================================
// 3. DIGITAL DOWNLOADS & LICENSE ENTITLEMENTS PAGE
// =====================================================================
export const PortalDownloadsPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadEntitlements = () => {
    setLoading(true);
    portalRequest<{ entitlements: any[] }>('/downloads')
      .then((res) => setEntitlements(res.entitlements || []))
      .catch(() => setEntitlements([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEntitlements();
  }, []);

  const handleDownload = async (entitlementId: string) => {
    setStatusMsg(null);
    try {
      const res = await portalRequest<{ entitlement: any; downloadManifest: any }>(
        `/downloads/${encodeURIComponent(entitlementId)}/download`,
        { method: 'POST' }
      );
      const blob = new Blob([JSON.stringify(res.downloadManifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${res.entitlement.licenseKey}-entitlement.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg(`Authorized download recorded (${res.entitlement.downloadCount}/${res.entitlement.maxDownloads}).`);
      loadEntitlements();
    } catch (err: any) {
      setStatusMsg(err?.message || 'Unable to authorize download.');
    }
  };

  return (
    <PortalLayout
      title="Digital Downloads & Licenses"
      subtitle="Access verified digital products, source kits, and license keys provisioned upon payment confirmation."
    >
      {statusMsg && (
        <div className="mb-4 p-3 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] text-xs text-[#0F1D36]">
          {statusMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading digital entitlements...</p>
      ) : entitlements.length === 0 ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-8 text-center space-y-3">
          <p className="text-sm text-[#475569]">
            You do not have any digital entitlements yet. Purchased digital packages appear here automatically once payment is verified.
          </p>
          <button
            onClick={() => navigate('/portal/store')}
            className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
          >
            Browse Service &amp; Digital Store
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E6E2D8] text-xs font-mono text-[#64748B] bg-[#FAF8F4]">
                <th className="py-3 px-4">PRODUCT</th>
                <th className="py-3 px-4">LICENSE KEY</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">DOWNLOADS</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E2D8]">
              {entitlements.map((ent) => (
                <tr key={ent.id}>
                  <td className="py-3 px-4 font-medium text-[#0F1D36]">{ent.productName}</td>
                  <td className="py-3 px-4 font-mono text-xs text-[#0F4C3A]">{ent.licenseKey}</td>
                  <td className="py-3 px-4 font-mono text-xs uppercase">{ent.status}</td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">
                    {ent.downloadCount} / {ent.maxDownloads}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDownload(ent.id)}
                      disabled={ent.status !== 'active' || ent.downloadCount >= ent.maxDownloads}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F1D36] hover:bg-[#172B4D] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download License Package</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
};

// =====================================================================
// 4. CONSULTATIONS BOOKING & RESCHEDULING PAGE
// =====================================================================
export const PortalConsultationsPage: React.FC = () => {
  const { user, profile } = usePortalAuth();
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [consultationType, setConsultationType] = useState<'video' | 'phone' | 'in_person'>('video');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Manage existing appointment
  const [manageRef, setManageRef] = useState('');
  const [manageToken, setManageToken] = useState('');
  const [manageActionMsg, setManageActionMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl(`/api/appointments/availability?date=${encodeURIComponent(date)}`))
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.availableSlots) ? data.availableSlots : [];
        setSlots(list);
        setSelectedSlot(list[0] || '');
      })
      .catch(() => setSlots([]));
  }, [date]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setBookingResult(null);
    try {
      const res = await fetch(apiUrl('/api/appointments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile?.fullName || user?.email || 'Client User',
          email: user?.email || '',
          phone: profile?.phone || '+63 900 000 0000',
          companyName: profile?.companyName || 'Client Organization',
          serviceInterest: 'Client Portal Strategic Consultation',
          consultationType,
          scheduledDate: date,
          scheduledTimeSlot: selectedSlot,
          notes,
          consentAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to book consultation.');
      setBookingResult(data);
      const refCode = data.appointment?.referenceCode || data.referenceCode;
      if (refCode) setManageRef(refCode);
      if (data.managementToken) setManageToken(data.managementToken);
    } catch (err: any) {
      setError(err?.message || 'Booking request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelExisting = async () => {
    setManageActionMsg(null);
    try {
      const res = await fetch(apiUrl(`/api/appointments/${encodeURIComponent(manageRef.trim())}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managementToken: manageToken.trim(), action: 'cancel' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to cancel consultation.');
      setManageActionMsg(`Consultation ${manageRef} has been cancelled.`);
    } catch (err: any) {
      setManageActionMsg(err?.message || 'Action failed.');
    }
  };

  return (
    <PortalLayout
      title="Consultations & Scheduling"
      subtitle="Book an executive technical consultation or manage an existing appointment using your management token."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#0F1D36] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0F4C3A]" />
            <span>Schedule New Consultation</span>
          </h2>
          <form onSubmit={handleBook} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Date (Mon–Fri, Asia/Manila)</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Channel</label>
                <select
                  value={consultationType}
                  onChange={(e) => setConsultationType(e.target.value as 'video' | 'phone' | 'in_person')}
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4]"
                >
                  <option value="video">Online Video Consultation</option>
                  <option value="phone">Executive Phone Call</option>
                  <option value="in_person">In-Person (Clark Freeport Zone Studio)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Available Time Slot</label>
              {slots.length === 0 ? (
                <p className="text-xs text-amber-700">No available slots on this date (weekends are closed).</p>
              ) : (
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4]"
                >
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {s} (PHT)
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1D36] mb-1">Agenda / Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Topics, project deliverables, or timeline targets..."
                className="w-full px-3 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4]"
              />
            </div>

            {error && <p className="text-xs text-rose-700">{error}</p>}
            {bookingResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold">
                  Booking saved: {bookingResult.appointment?.referenceCode || bookingResult.referenceCode}
                </p>
                {bookingResult.managementToken && (
                  <p className="font-mono">Management Token: {bookingResult.managementToken}</p>
                )}
                <p>Calendar status: {bookingResult.appointment?.calendarSyncStatus || 'scheduled'}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || slots.length === 0}
              className="px-4 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting Booking...' : 'Request Consultation Slot'}
            </button>
          </form>
        </div>

        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#0F1D36]">Manage Existing Booking</h2>
          <p className="text-xs text-[#475569]">
            Cancel an upcoming consultation using the Reference Code and Management Token returned at booking time.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={manageRef}
              onChange={(e) => setManageRef(e.target.value)}
              placeholder="Reference Code (e.g. OPM-APT-...)"
              className="w-full px-3 py-2 text-sm font-mono border border-[#E6E2D8] rounded-lg bg-[#FAF8F4]"
            />
            <input
              type="text"
              value={manageToken}
              onChange={(e) => setManageToken(e.target.value)}
              placeholder="Management Token"
              className="w-full px-3 py-2 text-sm font-mono border border-[#E6E2D8] rounded-lg bg-[#FAF8F4]"
            />
            <button
              type="button"
              onClick={handleCancelExisting}
              disabled={!manageRef.trim() || !manageToken.trim()}
              className="px-4 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Cancel Consultation
            </button>
            {manageActionMsg && <p className="text-xs text-[#0F1D36] font-medium">{manageActionMsg}</p>}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
};

// =====================================================================
// 5. IN-PORTAL AI SOLUTIONS CONSULTANT & ESCALATION PAGE
// =====================================================================
export const PortalConsultantPage: React.FC = () => {
  const { user } = usePortalAuth();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Welcome to your authenticated OPHIREUM AI Solutions Consultant. Ask about your orders, active services, catalog benchmarks, or request a human specialist escalation.',
    },
  ]);
  const [escalationMsg, setEscalationMsg] = useState<string | null>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const res = await portalRequest<{ reply: string }>('/assistant/ask', {
        method: 'POST',
        body: { question: q },
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: err?.message || 'Unable to process consultation query right now.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    setEscalationMsg(null);
    try {
      const res = await fetch(apiUrl('/api/ai/escalations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'consultant_chat',
          email: user?.email,
          reason: messages[messages.length - 1]?.text || 'Client requested human specialist review.',
          priority: 'high',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Escalation failed');
      setEscalationMsg(`Escalation logged (${data.escalation.id}). Our human specialist team has been notified.`);
    } catch (err: any) {
      setEscalationMsg(err?.message || 'Unable to log escalation.');
    }
  };

  return (
    <PortalLayout
      title="AI Solutions Consultant"
      subtitle="Context-aware guidance grounded in your Client Portal workspace and the OPHIREUM catalog."
    >
      <div className="bg-white border border-[#E6E2D8] rounded-xl flex flex-col h-[560px] max-w-4xl">
        <div className="px-5 py-3 border-b border-[#E6E2D8] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0F1D36]">
            <Bot className="w-4 h-4 text-[#0F4C3A]" />
            <span>Authenticated Client Advisor</span>
          </div>
          <button
            type="button"
            onClick={handleEscalate}
            className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
          >
            Escalate to Human Specialist
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'ml-auto bg-[#0F1D36] text-white'
                  : 'bg-[#FAF8F4] border border-[#E6E2D8] text-[#0F1D36]'
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>

        {escalationMsg && (
          <div className="px-5 py-2 bg-emerald-50 border-t border-emerald-200 text-xs text-emerald-800">
            {escalationMsg}
          </div>
        )}

        <form onSubmit={handleAsk} className="p-4 border-t border-[#E6E2D8] flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about services, order status, billing, or architecture..."
            className="flex-1 px-3.5 py-2 text-sm border border-[#E6E2D8] rounded-lg bg-[#FAF8F4] focus:bg-white focus:border-[#0F4C3A] outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Ask</span>
          </button>
        </form>
      </div>
    </PortalLayout>
  );
};

// =====================================================================
// 6. PRIVACY, DATA EXPORT & OPTIONAL TOTP MFA PAGE
// =====================================================================
export const PortalPrivacyPage: React.FC = () => {
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; enrolledAt?: string }>({ enabled: false });
  const [enrollment, setEnrollment] = useState<{ secret: string; otpAuthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [consents, setConsents] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = () => {
    portalRequest<{ mfa: any }>('/security/mfa')
      .then((res) => setMfaStatus(res.mfa || { enabled: false }))
      .catch(() => {});
    portalRequest<{ consents: any[] }>('/privacy/consents')
      .then((res) => setConsents(res.consents || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const startMfa = async () => {
    setFeedback(null);
    const res = await portalRequest<{ secret: string; otpAuthUri: string }>('/security/mfa/enroll', {
      method: 'POST',
    });
    setEnrollment(res);
  };

  const confirmMfa = async () => {
    setFeedback(null);
    try {
      await portalRequest('/security/mfa/confirm', { method: 'POST', body: { code: totpCode.trim() } });
      setEnrollment(null);
      setTotpCode('');
      setFeedback('Two-factor TOTP authenticator enabled for your account.');
      loadData();
    } catch (err: any) {
      setFeedback(err?.message || 'Invalid 6-digit code.');
    }
  };

  const disableMfa = async () => {
    setFeedback(null);
    try {
      await portalRequest('/security/mfa/disable', {
        method: 'POST',
        body: { currentPassword: disablePassword },
      });
      setDisablePassword('');
      setFeedback('Two-factor authentication has been disabled.');
      loadData();
    } catch (err: any) {
      setFeedback(err?.message || 'Unable to disable MFA.');
    }
  };

  const recordPolicyConsent = async (policySlug: string) => {
    await portalRequest('/privacy/consents', {
      method: 'POST',
      body: { policySlug, policyVersion: '2026.1-draft', accepted: true },
    });
    setFeedback(`Recorded consent acknowledgement for ${policySlug}.`);
    loadData();
  };

  const exportPersonalData = async () => {
    const res = await portalRequest<{ exportBundle: any }>('/privacy/export');
    const blob = new Blob([JSON.stringify(res.exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ophireum-personal-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback('Your RA 10173 / GDPR personal data export JSON has been downloaded.');
  };

  return (
    <PortalLayout
      title="Privacy, Consents & MFA"
      subtitle="Exercise RA 10173 Data Privacy rights, export your account data, and configure optional TOTP two-factor security."
    >
      {feedback && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOTP MFA Card */}
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F1D36] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#0F4C3A]" />
              <span>Two-Factor Authentication (TOTP MFA)</span>
            </h2>
            <span
              className={`font-mono text-xs font-semibold ${
                mfaStatus.enabled ? 'text-emerald-700' : 'text-[#64748B]'
              }`}
            >
              {mfaStatus.enabled ? 'ENABLED' : 'OPTIONAL / OFF'}
            </span>
          </div>
          <p className="text-xs text-[#475569]">
            Protect your account with any RFC 6238 authenticator app (Google Authenticator, 1Password, Authy).
          </p>

          {!mfaStatus.enabled && !enrollment && (
            <button
              onClick={startMfa}
              className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
            >
              Enroll Authenticator App
            </button>
          )}

          {enrollment && (
            <div className="p-4 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] space-y-3 text-xs">
              <p className="font-semibold text-[#0F1D36]">Step 1: Add Secret Key to your Authenticator App</p>
              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded border border-[#E6E2D8] font-mono">
                <span className="truncate">{enrollment.secret}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(enrollment.secret)}
                  className="text-[#0F4C3A] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="font-semibold text-[#0F1D36]">Step 2: Enter 6-digit Verification Code</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-36 px-3 py-2 rounded border border-[#E6E2D8] bg-white font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={confirmMfa}
                  className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white font-semibold cursor-pointer"
                >
                  Verify &amp; Enable
                </button>
              </div>
            </div>
          )}

          {mfaStatus.enabled && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Confirm current password"
                className="px-3 py-2 rounded-lg border border-[#E6E2D8] bg-[#FAF8F4] text-xs"
              />
              <button
                onClick={disableMfa}
                disabled={!disablePassword}
                className="px-4 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-40 text-xs font-semibold cursor-pointer"
              >
                Disable TOTP MFA
              </button>
            </div>
          )}
        </div>

        {/* Data Portability & Consents */}
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#0F1D36] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0F4C3A]" />
            <span>Data Privacy &amp; Portability (RA 10173)</span>
          </h2>
          <p className="text-xs text-[#475569]">
            Download a structured JSON archive of your profile, organization, orders, projects, support tickets, and recorded consents.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportPersonalData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F1D36] hover:bg-[#172B4D] text-white text-xs font-semibold cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export Personal Data (JSON)</span>
            </button>
            <button
              onClick={() => navigateToAppPath('/legal/privacy-policy')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E6E2D8] text-[#0F1D36] hover:bg-[#FAF8F4] text-xs font-semibold cursor-pointer"
            >
              <span>Open Legal &amp; DSR Center</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-3 border-t border-[#E6E2D8] space-y-2">
            <p className="text-xs font-semibold text-[#0F1D36]">Policy Consent Ledger ({consents.length})</p>
            <div className="flex flex-wrap gap-2">
              {['privacy-policy', 'terms-of-service', 'ai-disclosure'].map((slug) => (
                <button
                  key={slug}
                  onClick={() => recordPolicyConsent(slug)}
                  className="px-2.5 py-1.5 rounded border border-[#E6E2D8] hover:border-[#0F4C3A] text-xs text-[#0F1D36] cursor-pointer"
                >
                  Acknowledge {slug}
                </button>
              ))}
            </div>
            {consents.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-[#475569] font-mono">
                {consents.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    {c.policySlug} ({c.policyVersion}) — {c.createdAt.slice(0, 19)}Z
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
};
