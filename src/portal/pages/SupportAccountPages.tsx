import React, { useCallback, useEffect, useState } from 'react';
import {
  LifeBuoy,
  Plus,
  Bell,
  CheckCheck,
  UserRound,
  ShieldCheck,
  Settings,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { PortalLayout } from '../components/PortalLayout';
import { portalRequest } from '../portalApi';
import { usePortalAuth } from '../PortalAuthContext';
import { usePortalRouter } from '../PortalRouter';
import {
  formatPortalDateTime,
  formatStatusLabel,
  statusToneClass,
} from '../portalTypes';

// =========================================================================
// SUPPORT CENTER
// =========================================================================

export const PortalSupportPage: React.FC = () => {
  const { query } = usePortalRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(() => query.get('new') === '1');
  const [error, setError] = useState('');

  // Create form
  const [category, setCategory] = useState('Orders');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reply form
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalRequest<{ tickets: any[]; categories: string[] }>('/support');
      setTickets(res.tickets || []);
      setCategories(res.categories || []);
      if (res.tickets?.length && !selectedId) setSelectedId(res.tickets[0].id);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await portalRequest<{ ticket: any }>('/support', {
        method: 'POST',
        body: { category, subject, body },
      });
      setCreateOpen(false);
      setSubject('');
      setBody('');
      setSelectedId(res.ticket.id);
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || 'Unable to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setReplying(true);
    try {
      await portalRequest(`/support/${encodeURIComponent(selectedId)}/reply`, {
        method: 'POST',
        body: { body: replyText.trim() },
      });
      setReplyText('');
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || 'Unable to send reply.');
    } finally {
      setReplying(false);
    }
  };

  const activeTicket = tickets.find((t) => t.id === selectedId) || null;

  return (
    <PortalLayout
      title="Support Center"
      subtitle="Open and track inquiries for orders, payments, billing, project status, or account access."
    >
      {error && (
        <div className="mb-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>
      )}

      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Support Ticket</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center text-sm text-[#64748B]">
          Loading tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center space-y-2">
          <LifeBuoy className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="text-sm font-semibold text-[#0F1D36]">No support tickets yet</p>
          <p className="text-xs text-[#64748B]">Need assistance? Submit a ticket and our support desk will respond.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E6E2D8] rounded-xl divide-y divide-[#E6E2D8] overflow-hidden">
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full p-4 text-left transition-colors cursor-pointer ${
                  t.id === selectedId ? 'bg-[#F4F9F7]' : 'hover:bg-[#FAF8F4]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-[#64748B]">{t.ticketNumber}</span>
                  <span className={statusToneClass(t.status)}>{formatStatusLabel(t.status)}</span>
                </div>
                <p className="text-sm font-semibold text-[#0F1D36] mt-1 truncate">{t.subject}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{t.category}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 bg-white border border-[#E6E2D8] rounded-xl flex flex-col">
            {activeTicket ? (
              <>
                <div className="p-5 border-b border-[#E6E2D8]">
                  <p className="font-mono text-xs text-[#64748B]">
                    {activeTicket.ticketNumber} · {activeTicket.category}
                  </p>
                  <h2 className="text-base font-semibold text-[#0F1D36] mt-0.5">{activeTicket.subject}</h2>
                </div>
                <div className="p-5 space-y-3 flex-1 max-h-[420px] overflow-y-auto">
                  {(activeTicket.messages || []).map((m: any) => (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl border text-xs ${
                        m.senderRole === 'client'
                          ? 'bg-[#F4F9F7] border-[#C6E1D7] ml-6'
                          : 'bg-[#FAF8F4] border-[#E6E2D8] mr-6'
                      }`}
                    >
                      <div className="flex justify-between gap-2 mb-1">
                        <span className="font-semibold text-[#0F1D36]">{m.senderName}</span>
                        <span className="font-mono text-[10px] text-[#64748B]">
                          {formatPortalDateTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="text-[#334155] whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleReply} className="p-4 border-t border-[#E6E2D8] flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Add a reply to this ticket..."
                    className="flex-1 px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={replying}
                    className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1D36]/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTicket}
            className="bg-white border border-[#E6E2D8] rounded-xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0F1D36]">Create Support Ticket</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-[#64748B] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              >
                {(categories.length
                  ? categories
                  : ['Account Access', 'Orders', 'Payments', 'Billing', 'Project Status', 'Technical Support', 'Service Inquiry', 'Refund Request', 'Other']
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Subject *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Details *</label>
              <textarea
                rows={4}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E6E2D8] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PortalLayout>
  );
};

// =========================================================================
// NOTIFICATIONS
// =========================================================================

export const PortalNotificationsPage: React.FC = () => {
  const { refreshSession } = usePortalAuth();
  const { navigate } = usePortalRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalRequest<{ notifications: any[] }>('/notifications');
      setNotifications(res.notifications || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string, linkPath?: string) => {
    await portalRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
    await refreshSession();
    if (linkPath) navigate(linkPath);
    else await load();
  };

  const markAllRead = async () => {
    await portalRequest('/notifications/read-all', { method: 'POST' });
    await refreshSession();
    await load();
  };

  return (
    <PortalLayout
      title="Notifications"
      subtitle="Account updates for orders, payments, credits, project milestones, and support replies."
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6E2D8] bg-white text-xs font-semibold text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer"
        >
          <CheckCheck className="w-4 h-4 text-[#0F4C3A]" />
          <span>Mark All as Read</span>
        </button>
      </div>

      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Bell className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#0F1D36]">You are all caught up</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E6E2D8]">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  n.isRead ? 'bg-white' : 'bg-[#F4F9F7]/60'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F1D36]">{n.title}</p>
                  <p className="text-xs text-[#475569] mt-0.5">{n.body}</p>
                  <p className="text-[11px] font-mono text-[#94A3B8] mt-1">
                    {formatPortalDateTime(n.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => markRead(n.id, n.linkPath)}
                  className="text-xs font-semibold text-[#0F4C3A] hover:underline shrink-0 cursor-pointer"
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

// =========================================================================
// PROFILE & BILLING ADDRESSES
// =========================================================================

export const PortalProfilePage: React.FC = () => {
  const { refreshSession } = usePortalAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // New Address
  const [addrLabel, setAddrLabel] = useState('Head Office');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrCountry, setAddrCountry] = useState('Philippines');

  const loadProfile = useCallback(async () => {
    const res = await portalRequest<{ profile: any; addresses: any[] }>('/profile');
    const p = res.profile;
    if (p) {
      setFirstName(p.firstName || '');
      setLastName(p.lastName || '');
      setPhone(p.phone || '');
      setCompanyName(p.companyName || '');
      setTaxId(p.taxId || '');
      setTimezone(p.timezone || 'Asia/Manila');
    }
    setAddresses(res.addresses || []);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await portalRequest('/profile', {
        method: 'PATCH',
        body: { firstName, lastName, phone, companyName, taxId, timezone },
      });
      await refreshSession();
      setNotice('Profile saved successfully.');
    } catch (err: any) {
      setError(err?.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await portalRequest('/addresses', {
        method: 'POST',
        body: {
          label: addrLabel,
          line1: addrLine1,
          city: addrCity,
          country: addrCountry,
          isDefault: addresses.length === 0,
        },
      });
      setAddrLine1('');
      setAddrCity('');
      await loadProfile();
    } catch (err: any) {
      setError(err?.message || 'Unable to save address.');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    await portalRequest(`/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadProfile();
  };

  return (
    <PortalLayout
      title="Profile & Account"
      subtitle="Keep your contact details, company billing metadata, and saved addresses up to date."
    >
      {error && (
        <div className="mb-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>
      )}
      {notice && (
        <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSaveProfile} className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserRound className="w-4 h-4 text-[#0F4C3A]" />
            <h2 className="text-base font-semibold text-[#0F1D36]">Client Profile</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Tax ID / TIN</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-[#0F1D36]">Saved Billing Addresses</h2>
          {addresses.length > 0 ? (
            <div className="space-y-2.5">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#0F1D36]">
                      {a.label} {a.isDefault ? '· Default' : ''}
                    </p>
                    <p className="text-[#475569] mt-0.5">
                      {a.line1}, {a.city}, {a.country}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(a.id)}
                    className="text-[#B91C1C] hover:underline cursor-pointer"
                    aria-label="Delete address"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#64748B]">No saved billing addresses yet.</p>
          )}

          <form onSubmit={handleAddAddress} className="pt-4 border-t border-[#E6E2D8] space-y-3">
            <p className="text-xs font-semibold text-[#0F1D36]">Add Billing Address</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                placeholder="Label (e.g. Office)"
                className="px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
              <input
                type="text"
                required
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
                placeholder="Street Address *"
                className="px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
              <input
                type="text"
                required
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                placeholder="City *"
                className="px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
              <input
                type="text"
                value={addrCountry}
                onChange={(e) => setAddrCountry(e.target.value)}
                placeholder="Country"
                className="px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg border border-[#0F1D36] text-xs font-semibold text-[#0F1D36] hover:bg-[#0F1D36] hover:text-white transition-colors cursor-pointer"
            >
              Add Address
            </button>
          </form>
        </div>
      </div>
    </PortalLayout>
  );
};

// =========================================================================
// SECURITY SETTINGS (REAUTHENTICATION, SESSIONS, EMAIL CHANGE, CLOSURE)
// =========================================================================

export const PortalSecurityPage: React.FC = () => {
  const { user, logoutAll, refreshSession } = usePortalAuth();
  const { navigate } = usePortalRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Email change
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [devEmailToken, setDevEmailToken] = useState('');

  // Closure
  const [closurePassword, setClosurePassword] = useState('');
  const [closureReason, setClosureReason] = useState('');

  const loadSessions = useCallback(async () => {
    const res = await portalRequest<{ sessions: any[] }>('/security/sessions');
    setSessions(res.sessions || []);
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await portalRequest('/security/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Password changed successfully.');
    } catch (err: any) {
      setError(err?.message || 'Password change failed.');
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const res = await portalRequest<{ message: string; devEmailChangeToken?: string }>(
        '/security/request-email-change',
        {
          method: 'POST',
          body: { currentPassword: emailChangePassword, newEmail },
        }
      );
      setNotice(res.message);
      if (res.devEmailChangeToken) {
        setDevEmailToken(res.devEmailChangeToken);
        setEmailToken(res.devEmailChangeToken);
      }
      setEmailChangePassword('');
    } catch (err: any) {
      setError(err?.message || 'Email change request failed.');
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await portalRequest('/security/confirm-email-change', {
        method: 'POST',
        body: { token: emailToken },
      });
      setEmailToken('');
      setDevEmailToken('');
      await refreshSession();
      setNotice('Primary email address updated.');
    } catch (err: any) {
      setError(err?.message || 'Unable to confirm email change.');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    await portalRequest(`/security/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    await loadSessions();
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    navigate('/portal/login', { replace: true });
  };

  const handleRequestClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      const res = await portalRequest<{ message: string }>('/security/request-closure', {
        method: 'POST',
        body: { currentPassword: closurePassword, reason: closureReason },
      });
      setClosurePassword('');
      setClosureReason('');
      await refreshSession();
      setNotice(res.message);
    } catch (err: any) {
      setError(err?.message || 'Account closure request failed.');
    }
  };

  return (
    <PortalLayout
      title="Security Settings"
      subtitle="Manage password reauthentication, verified email changes, active sessions, and account closure."
    >
      {error && (
        <div className="mb-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Password Change */}
        <form onSubmit={handleChangePassword} className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0F4C3A]" />
            <h2 className="text-base font-semibold text-[#0F1D36]">Change Password</h2>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">New Password (8+ chars) *</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
          >
            Update Password
          </button>
        </form>

        {/* Verified Email Change */}
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#0F1D36]">Verified Email Change</h2>
          <p className="text-xs text-[#64748B]">
            Current email: <strong className="text-[#0F1D36]">{user?.email}</strong> (
            {user?.emailVerified ? 'Verified' : 'Unverified'})
          </p>
          <form onSubmit={handleRequestEmailChange} className="space-y-3">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="New email address"
              className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
            />
            <input
              type="password"
              required
              value={emailChangePassword}
              onChange={(e) => setEmailChangePassword(e.target.value)}
              placeholder="Confirm current password"
              className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg border border-[#0F1D36] text-xs font-semibold text-[#0F1D36] hover:bg-[#0F1D36] hover:text-white cursor-pointer"
            >
              Request Email Verification Code
            </button>
          </form>

          {(devEmailToken || user?.pendingEmail) && (
            <form onSubmit={handleConfirmEmailChange} className="pt-3 border-t border-[#E6E2D8] space-y-2">
              <input
                type="text"
                required
                value={emailToken}
                onChange={(e) => setEmailToken(e.target.value)}
                placeholder="Enter email confirmation token"
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
              >
                Confirm New Email
              </button>
            </form>
          )}
        </div>

        {/* Active Sessions */}
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#0F1D36]">Active Sessions</h2>
            <button
              type="button"
              onClick={handleLogoutAll}
              className="text-xs font-semibold text-[#B91C1C] hover:underline cursor-pointer"
            >
              Logout All Devices
            </button>
          </div>
          <div className="space-y-2.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#0F1D36] truncate">
                    {s.isCurrent ? 'Current Session' : 'Signed-In Device'}
                  </p>
                  <p className="text-[#64748B] truncate">{s.userAgent}</p>
                  <p className="font-mono text-[10px] text-[#94A3B8]">
                    Last active: {formatPortalDateTime(s.lastSeenAt)}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(s.id)}
                    className="text-xs font-semibold text-[#B91C1C] hover:underline shrink-0 cursor-pointer"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Account Closure */}
        <form onSubmit={handleRequestClosure} className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#0F1D36]">Account Closure Request</h2>
          <p className="text-xs text-[#64748B]">
            Account closure requires password confirmation. Statutory invoices and payment records remain retained per financial compliance requirements.
          </p>
          {user?.accountStatus === 'pending_closure' && (
            <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#E7D8B1] text-xs text-[#785315]">
              Your account closure request is currently pending compliance review.
            </div>
          )}
          <input
            type="password"
            required
            value={closurePassword}
            onChange={(e) => setClosurePassword(e.target.value)}
            placeholder="Confirm current password"
            className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
          />
          <input
            type="text"
            value={closureReason}
            onChange={(e) => setClosureReason(e.target.value)}
            placeholder="Optional reason for closing your account"
            className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer"
          >
            Submit Account Closure Request
          </button>
        </form>
      </div>
    </PortalLayout>
  );
};

// =========================================================================
// PREFERENCES & SCOPED PORTAL GUIDANCE ASSISTANT
// =========================================================================

export const PortalSettingsPage: React.FC = () => {
  const { profile, refreshSession } = usePortalAuth();
  const { navigate } = usePortalRouter();

  const [currency, setCurrency] = useState<'USD' | 'PHP'>(profile?.preferredCurrency || 'USD');
  const [prefs, setPrefs] = useState(
    profile?.notificationPreferences || {
      emailOrders: true,
      emailProjects: true,
      emailMessages: true,
      emailBilling: true,
      inAppAll: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  // Permission-Scoped Read-Only Portal Assistant
  const [question, setQuestion] = useState('');
  const [assistantReply, setAssistantReply] = useState<{
    answer: string;
    suggestedRoute: string;
    scopeNotice: string;
  } | null>(null);
  const [asking, setAsking] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      await portalRequest('/profile', {
        method: 'PATCH',
        body: { preferredCurrency: currency, notificationPreferences: prefs },
      });
      await refreshSession();
      setNotice('Preferences updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleAskAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const res = await portalRequest<{
        answer: string;
        suggestedRoute: string;
        scopeNotice: string;
      }>('/assistant/ask', { method: 'POST', body: { question: question.trim() } });
      setAssistantReply(res);
    } finally {
      setAsking(false);
    }
  };

  return (
    <PortalLayout
      title="Preferences"
      subtitle="Configure display currency, notification preferences, and read-only portal guidance."
    >
      {notice && (
        <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSave} className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#0F4C3A]" />
            <h2 className="text-base font-semibold text-[#0F1D36]">Display &amp; Notification Settings</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1.5">Default Display Currency</label>
            <div className="inline-flex rounded-lg border border-[#E6E2D8] p-0.5 bg-[#FAF8F4]">
              {(['USD', 'PHP'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    currency === c ? 'bg-[#0F1D36] text-white' : 'text-[#475569]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-[#E6E2D8]">
            <p className="text-xs font-semibold text-[#0F1D36]">Notifications</p>
            {(
              [
                ['emailOrders', 'Order & payment status emails'],
                ['emailProjects', 'Project milestone & deliverable updates'],
                ['emailMessages', 'New coordinator messages'],
                ['emailBilling', 'Invoices & subscription renewals'],
                ['inAppAll', 'In-app portal notification badges'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm text-[#334155] cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                  className="rounded border-[#CBD5E1] accent-[#0F4C3A]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#0F4C3A] text-white text-sm font-semibold cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>

        {/* Permission-Scoped Read-Only Portal Guidance Assistant */}
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B8923A]" />
            <h2 className="text-base font-semibold text-[#0F1D36]">Portal Guidance Assistant</h2>
          </div>
          <p className="text-xs text-[#64748B]">
            Strictly read-only guidance scoped to your authenticated account. Helps check order status, credit balances, project progress, and files—cannot alter pricing, confirm payments, or modify credits.
          </p>
          <form onSubmit={handleAskAssistant} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about your orders, credits, projects, or files..."
              className="flex-1 px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
            />
            <button
              type="submit"
              disabled={asking}
              className="px-4 py-2 rounded-lg bg-[#0F1D36] text-white text-xs font-semibold cursor-pointer"
            >
              {asking ? 'Checking...' : 'Ask'}
            </button>
          </form>
          {assistantReply && (
            <div className="p-4 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] space-y-2 text-xs">
              <p className="text-[#0F1D36] leading-relaxed">{assistantReply.answer}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#64748B]">{assistantReply.scopeNotice}</span>
                <button
                  type="button"
                  onClick={() => navigate(assistantReply.suggestedRoute)}
                  className="font-semibold text-[#0F4C3A] hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  Open Section →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
};
