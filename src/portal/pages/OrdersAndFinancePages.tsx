import React, { useCallback, useEffect, useState } from 'react';
import {
  ShoppingBag,
  ArrowLeft,
  FileText,
  Printer,
  Coins,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Search,
} from 'lucide-react';
import { PortalLayout } from '../components/PortalLayout';
import { BrandLogo } from '../../components/BrandLogo';
import { resolveAbsoluteLogoUrl } from '../../data/brandAssets';
import { portalRequest } from '../portalApi';
import { usePortalAuth } from '../PortalAuthContext';
import { usePortalRouter } from '../PortalRouter';
import {
  formatMoney,
  formatPortalDate,
  formatPortalDateTime,
  formatStatusLabel,
  statusToneClass,
} from '../portalTypes';

const ORDER_WORKFLOW_STAGES = [
  'pending_payment',
  'payment_verification',
  'confirmed',
  'awaiting_project_brief',
  'in_production',
  'quality_review',
  'awaiting_client_review',
  'revision_requested',
  'final_approval',
  'completed',
];

export const PortalOrdersPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    portalRequest<{ orders: any[] }>('/orders')
      .then((res) => {
        if (active) setOrders(res.orders || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = orders.filter((o) => {
    if (filterStatus !== 'all' && o.fulfillmentStatus !== filterStatus) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.items.some((i: any) => i.productName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <PortalLayout
      title="My Orders"
      subtitle="Track order confirmation, payment verification, fulfillment milestones, and receipts."
    >
      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E6E2D8] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order number or service..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg text-[#0F1D36]"
            >
              <option value="all">All Statuses</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_production">In Production</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={() => navigate('/portal/store')}
              className="px-3.5 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer"
            >
              New Order
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <ShoppingBag className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#0F1D36]">No matching orders found</p>
            <button
              type="button"
              onClick={() => navigate('/portal/store')}
              className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
            >
              Explore Service Store
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-xs text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-medium">Order #</th>
                  <th className="py-3 px-4 font-medium">Services</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Payment</th>
                  <th className="py-3 px-4 font-medium">Fulfillment</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2D8]">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAF8F4]/70">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#0F1D36]">
                      {order.orderNumber}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#334155]">
                      {order.items[0]?.productName || 'Multimedia Package'}
                      {order.items.length > 1 ? ` (+${order.items.length - 1} more)` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#64748B]">
                      {formatPortalDate(order.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className={statusToneClass(order.paymentStatus)}>
                        {formatStatusLabel(order.paymentStatus)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className={statusToneClass(order.fulfillmentStatus)}>
                        {formatStatusLabel(order.fulfillmentStatus)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold tabular-nums text-right text-[#0F1D36]">
                      {formatMoney(order.totalMinor, order.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/portal/orders/${order.id}`)}
                        className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

export const PortalOrderDetailPage: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { navigate } = usePortalRouter();
  const [data, setData] = useState<{
    order: any;
    invoice: any;
    payment: any;
    linkedProjects: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await portalRequest<{
        order: any;
        invoice: any;
        payment: any;
        linkedProjects: any[];
      }>(`/orders/${encodeURIComponent(orderId)}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load order details.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelling(true);
    try {
      await portalRequest(`/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason || 'Cancelled by client' },
      });
      setCancelOpen(false);
      await loadOrder();
    } catch (err: any) {
      setError(err?.message || 'Unable to request cancellation.');
    } finally {
      setCancelling(false);
    }
  };

  const order = data?.order;
  const activeStageIndex = order ? ORDER_WORKFLOW_STAGES.indexOf(order.fulfillmentStatus) : -1;

  return (
    <PortalLayout
      title={order ? `Order ${order.orderNumber}` : 'Order Details'}
      subtitle="Full itemized breakdown, payment status, workflow progress, and linked deliverables."
    >
      <button
        type="button"
        onClick={() => navigate('/portal/orders')}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0F1D36] cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Orders</span>
      </button>

      {error && (
        <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading || !order ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center text-sm text-[#64748B]">
          Loading order details...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Workflow Tracker */}
          <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#0F1D36]">Order Status Workflow</h2>
                <p className="text-xs text-[#64748B]">
                  Current status:{' '}
                  <span className={statusToneClass(order.fulfillmentStatus)}>
                    {formatStatusLabel(order.fulfillmentStatus)}
                  </span>{' '}
                  · Payment:{' '}
                  <span className={statusToneClass(order.paymentStatus)}>
                    {formatStatusLabel(order.paymentStatus)}
                  </span>
                </p>
              </div>
              {order.fulfillmentStatus !== 'cancelled' && order.fulfillmentStatus !== 'completed' && (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg border border-rose-300 text-xs font-semibold text-[#B91C1C] hover:bg-rose-50 cursor-pointer"
                >
                  Request Cancellation
                </button>
              )}
            </div>

            {order.fulfillmentStatus === 'cancelled' ? (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                Order cancelled. {order.cancellationReason ? `Reason: ${order.cancellationReason}` : ''}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {ORDER_WORKFLOW_STAGES.map((st, idx) => {
                  const completed = activeStageIndex >= idx;
                  return (
                    <div
                      key={st}
                      className={`p-2.5 rounded-lg border text-[11px] ${
                        completed
                          ? 'bg-[#F4F9F7] border-[#0F4C3A]/30 text-[#0F1D36] font-semibold'
                          : 'bg-[#FAF8F4] border-[#E6E2D8] text-[#64748B]'
                      }`}
                    >
                      <span className="font-mono text-[10px] block text-[#94A3B8]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {formatStatusLabel(st)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items & Timeline */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E6E2D8]">
                  <h3 className="text-sm font-semibold text-[#0F1D36]">Order Line Items</h3>
                </div>
                <div className="divide-y divide-[#E6E2D8]">
                  {order.items.map((item: any) => (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#0F1D36]">{item.productName}</p>
                        <p className="text-xs text-[#64748B]">
                          {item.packageName} · Qty {item.quantity} · Unit{' '}
                          {formatMoney(item.unitPriceMinor, order.currency)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-[#0F1D36]">
                        {formatMoney(item.lineTotalMinor, order.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-[#FAF8F4] border-t border-[#E6E2D8] space-y-1 text-xs">
                  <div className="flex justify-between text-[#475569]">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatMoney(order.subtotalMinor, order.currency)}</span>
                  </div>
                  {order.discountMinor > 0 && (
                    <div className="flex justify-between text-[#15803D]">
                      <span>Discount ({order.discountCode})</span>
                      <span className="font-mono">−{formatMoney(order.discountMinor, order.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#475569]">
                    <span>Tax</span>
                    <span className="font-mono">{formatMoney(order.taxMinor, order.currency)}</span>
                  </div>
                  <div className="pt-2 border-t border-[#E6E2D8] flex justify-between text-sm font-bold text-[#0F1D36]">
                    <span>Total</span>
                    <span className="font-mono">{formatMoney(order.totalMinor, order.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#0F1D36]">Order Activity Timeline</h3>
                <ol className="space-y-3">
                  {(order.timeline || []).map((entry: any, i: number) => (
                    <li key={i} className="pl-4 border-l-2 border-[#E6E2D8]">
                      <p className="text-xs font-semibold text-[#0F1D36]">{entry.label}</p>
                      <p className="text-xs text-[#475569] mt-0.5">{entry.note}</p>
                      <p className="text-[11px] font-mono text-[#94A3B8] mt-0.5">
                        {formatPortalDateTime(entry.timestamp)}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Sidebar: Invoice, Payment, Linked Projects */}
            <div className="space-y-5">
              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3 text-xs">
                <h3 className="text-sm font-semibold text-[#0F1D36]">Billing &amp; Payment</h3>
                <div className="space-y-1.5 text-[#475569]">
                  <p>
                    <span className="text-[#64748B]">Invoice:</span>{' '}
                    <span className="font-mono font-semibold text-[#0F1D36]">
                      {data?.invoice?.invoiceNumber || 'Pending'}
                    </span>
                  </p>
                  <p>
                    <span className="text-[#64748B]">Provider:</span>{' '}
                    <span className="font-medium text-[#0F1D36]">
                      {formatStatusLabel(order.paymentProvider)}
                    </span>
                  </p>
                  <p>
                    <span className="text-[#64748B]">Billed To:</span> {order.billingDetails?.fullName} (
                    {order.billingDetails?.email})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/portal/invoices')}
                  className="w-full py-2 px-3 rounded-lg border border-[#E6E2D8] text-xs font-semibold text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer"
                >
                  Open Invoice Center
                </button>
              </div>

              <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-[#0F1D36]">Linked Projects</h3>
                {data?.linkedProjects?.length ? (
                  <div className="space-y-2">
                    {data.linkedProjects.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/portal/projects/${p.id}`)}
                        className="w-full p-3 rounded-lg border border-[#E6E2D8] hover:border-[#0F4C3A] text-left cursor-pointer"
                      >
                        <p className="text-xs font-mono text-[#64748B]">{p.referenceNumber}</p>
                        <p className="text-xs font-semibold text-[#0F1D36] mt-0.5">{p.title}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B]">
                    Production workspace activates automatically once payment is verified via webhook, or you can submit a brief under My Projects.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F1D36]/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCancelOrder}
            className="bg-white border border-[#E6E2D8] rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0F1D36]">Confirm Order Cancellation</h3>
              <button type="button" onClick={() => setCancelOpen(false)} className="text-[#64748B] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#475569]">
              Unpaid orders are cancelled immediately. Paid or in-production orders are routed to operations for refund and scope review.
            </p>
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Reason for cancellation</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg"
                placeholder="Please let us know why you are cancelling..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E6E2D8] text-xs font-semibold text-[#475569] cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="submit"
                disabled={cancelling}
                className="px-4 py-2 rounded-lg bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {cancelling ? 'Submitting...' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PortalLayout>
  );
};

// =========================================================================
// CREDITS & USAGE LEDGER
// =========================================================================

export const PortalCreditsPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    portalRequest<{ wallet: any; transactions: any[] }>('/credits')
      .then((res) => {
        if (!active) return;
        setWallet(res.wallet);
        setTransactions(res.transactions || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PortalLayout
      title="Credits & Usage"
      subtitle="Immutable credit ledger. Credits are allocated strictly upon server-verified payment confirmation."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Available Credits', value: wallet?.availableCredits ?? 0 },
          { label: 'Used Credits', value: wallet?.usedCredits ?? 0 },
          { label: 'Pending Credits', value: wallet?.pendingCredits ?? 0 },
          { label: 'Expiring Soon', value: wallet?.expiringCredits ?? 0 },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-[#E6E2D8] rounded-xl p-5">
            <p className="text-xs text-[#64748B]">{card.label}</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#0F1D36] mt-1">
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E6E2D8] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1D36]">Credit Transaction Ledger</h2>
            <p className="text-xs text-[#64748B]">Append-only record of allocations, service redemptions, and adjustments.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/portal/store?category=subscription-credit-packages')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Purchase Credit Package</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#64748B]">Loading ledger...</div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#64748B]">
            No credit transactions recorded yet. Purchase a verified credit package to populate your ledger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-xs text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium text-right">Change</th>
                  <th className="py-3 px-4 font-medium text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2D8]">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3 px-4 text-xs text-[#64748B]">{formatPortalDateTime(tx.createdAt)}</td>
                    <td className="py-3 px-4 text-xs font-medium text-[#0F1D36]">
                      {formatStatusLabel(tx.transactionType)}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#475569]">{tx.description}</td>
                    <td
                      className={`py-3 px-4 font-mono text-xs font-semibold tabular-nums text-right ${
                        tx.amount >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold tabular-nums text-right text-[#0F1D36]">
                      {tx.balanceAfter.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};

// =========================================================================
// SUBSCRIPTIONS
// =========================================================================

export const PortalSubscriptionsPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalRequest<{ subscriptions: any[] }>('/subscriptions');
      setSubscriptions(res.subscriptions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await portalRequest(`/subscriptions/${encodeURIComponent(cancelTarget.id)}/cancel`, {
        method: 'POST',
      });
      setCancelTarget(null);
      await loadSubs();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalLayout
      title="Subscriptions"
      subtitle="Manage recurring monthly creative plans, billing cycles, and renewal preferences."
    >
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/portal/store?category=subscription-credit-packages')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer"
        >
          <span>Compare Subscription Plans</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center text-sm text-[#64748B]">
          Loading subscriptions...
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-white border border-[#E6E2D8] rounded-xl p-10 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="text-sm font-semibold text-[#0F1D36]">No active or pending subscriptions</p>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            Explore our Starter, Creator, Professional, Business, or Custom Enterprise retainer plans in the Service Store.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0F1D36]">{sub.planName}</h3>
                  <p className="font-mono text-sm text-[#0F4C3A] font-semibold mt-0.5">
                    {formatMoney(sub.amountMinor, sub.currency)} / month
                  </p>
                </div>
                <span className={`text-xs ${statusToneClass(sub.status)}`}>
                  {formatStatusLabel(sub.status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#E6E2D8] py-3">
                <div>
                  <span className="text-[#64748B] block">Credits / Cycle</span>
                  <span className="font-mono font-semibold text-[#0F1D36]">
                    {(sub.creditsPerCycle || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Next Renewal</span>
                  <span className="font-medium text-[#0F1D36]">
                    {formatPortalDate(sub.currentPeriodEnd)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/portal/store?category=subscription-credit-packages')}
                  className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
                >
                  Upgrade / Change Plan
                </button>
                {sub.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setCancelTarget(sub)}
                    className="text-xs font-semibold text-[#B91C1C] hover:underline cursor-pointer"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-[#0F1D36]/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E2D8] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#0F1D36]">Cancel Subscription</h3>
            <p className="text-xs text-[#475569]">
              Are you sure you want to cancel <strong>{cancelTarget.planName}</strong>? Existing invoices and past credit history remain preserved.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-lg border border-[#E6E2D8] text-xs font-semibold cursor-pointer"
              >
                Keep Plan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmCancel}
                className="px-4 py-2 rounded-lg bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer"
              >
                {busy ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

// =========================================================================
// INVOICES & PRINTABLE RECEIPTS
// =========================================================================

export const PortalInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    portalRequest<{ invoices: any[] }>('/invoices')
      .then((res) => {
        if (active) setInvoices(res.invoices || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const escapeHtml = (value: unknown): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const downloadInvoiceHtml = (inv: any) => {
    const safeInvoiceNum = escapeHtml(inv.invoiceNumber);
    const safeLogoUrl = escapeHtml(resolveAbsoluteLogoUrl());
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:;"><title>${safeInvoiceNum}</title>
<style>body{font-family:system-ui,sans-serif;color:#0F1D36;padding:40px;max-width:800px;margin:auto}.brand-header{display:flex;align-items:center;gap:16px;margin-bottom:16px}.brand-logo{width:56px;height:56px;border-radius:9999px;object-fit:cover;border:1.5px solid #D9B664;flex-shrink:0}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #E6E2D8;text-align:left}.num{text-align:right;font-family:monospace}</style>
</head><body>
<div class="brand-header">
  <img src="${safeLogoUrl}" alt="Ophireum Multimedia Production Official Logo" class="brand-logo" />
  <div>
    <h1 style="margin:0;font-size:20px;">${escapeHtml(inv.issuingCompany?.name)}</h1>
    <p style="margin:4px 0 0;font-size:12px;color:#475569;">${escapeHtml(inv.issuingCompany?.registrationNo)} &middot; ${escapeHtml(inv.issuingCompany?.address)} &middot; ${escapeHtml(inv.issuingCompany?.email)}</p>
  </div>
</div>
<hr/>
<h2>Invoice ${safeInvoiceNum}</h2>
<p>Order: ${escapeHtml(inv.orderNumber)} | Issued: ${escapeHtml(formatPortalDate(inv.issuedAt))} | Status: ${escapeHtml(formatStatusLabel(inv.paymentStatus))}</p>
<p><strong>Billed To:</strong> ${escapeHtml(inv.clientBilling?.fullName)}${inv.clientBilling?.companyName ? ` (${escapeHtml(inv.clientBilling.companyName)})` : ''} &middot; ${escapeHtml(inv.clientBilling?.email)}</p>
<table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead><tbody>
${(inv.lineItems || [])
  .map(
    (li: any) =>
      `<tr><td>${escapeHtml(li.description)}</td><td class="num">${escapeHtml(li.quantity)}</td><td class="num">${escapeHtml(formatMoney(li.unitPriceMinor, inv.currency))}</td><td class="num">${escapeHtml(formatMoney(li.lineTotalMinor, inv.currency))}</td></tr>`
  )
  .join('')}
</tbody></table>
<p class="num">Subtotal: ${escapeHtml(formatMoney(inv.subtotalMinor, inv.currency))}</p>
<p class="num">Discount: -${escapeHtml(formatMoney(inv.discountMinor, inv.currency))}</p>
<p class="num">Tax: ${escapeHtml(formatMoney(inv.taxMinor, inv.currency))}</p>
<h3 class="num">Total (${escapeHtml(inv.currency)}): ${escapeHtml(formatMoney(inv.totalMinor, inv.currency))}</h3>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(inv.invoiceNumber || 'invoice').replace(/[^A-Za-z0-9_-]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PortalLayout
      title="Invoices & Receipts"
      subtitle="Sequential official billing documents issued by Ophireum Multimedia Production."
    >
      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FileText className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#0F1D36]">No invoices generated yet</p>
            <p className="text-xs text-[#64748B]">Invoices appear automatically when you submit an order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-xs text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-medium">Invoice #</th>
                  <th className="py-3 px-4 font-medium">Order #</th>
                  <th className="py-3 px-4 font-medium">Issued</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium text-right">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2D8]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FAF8F4]/70">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#0F1D36]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#475569]">{inv.orderNumber}</td>
                    <td className="py-3.5 px-4 text-xs text-[#64748B]">{formatPortalDate(inv.issuedAt)}</td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className={statusToneClass(inv.paymentStatus)}>
                        {formatStatusLabel(inv.paymentStatus)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold tabular-nums text-right text-[#0F1D36]">
                      {formatMoney(inv.totalMinor, inv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-3">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadInvoiceHtml(inv)}
                        className="text-xs text-[#475569] hover:text-[#0F1D36] cursor-pointer"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-[#0F1D36]/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6E2D8] rounded-xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#E6E2D8] pb-4">
              <div className="flex items-start gap-3.5">
                <BrandLogo variant="emblem" size="lg" ring="subtle" />
                <div>
                  <p className="text-xs font-mono text-[#B8923A]">{selectedInvoice.issuingCompany.name}</p>
                  <h3 className="text-lg font-bold text-[#0F1D36] mt-0.5">
                    Invoice {selectedInvoice.invoiceNumber}
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    {selectedInvoice.issuingCompany.registrationNo} · {selectedInvoice.issuingCompany.address}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 text-[#64748B] hover:text-[#0F1D36] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[#64748B] font-medium">Billed To</p>
                <p className="font-semibold text-[#0F1D36] mt-0.5">{selectedInvoice.clientBilling.fullName}</p>
                {selectedInvoice.clientBilling.companyName && (
                  <p className="text-[#475569]">{selectedInvoice.clientBilling.companyName}</p>
                )}
                <p className="text-[#475569]">{selectedInvoice.clientBilling.email}</p>
                {selectedInvoice.clientBilling.address && (
                  <p className="text-[#64748B]">{selectedInvoice.clientBilling.address}</p>
                )}
              </div>
              <div className="sm:text-right space-y-1">
                <p>
                  <span className="text-[#64748B]">Order:</span>{' '}
                  <span className="font-mono font-semibold">{selectedInvoice.orderNumber}</span>
                </p>
                <p>
                  <span className="text-[#64748B]">Issued:</span> {formatPortalDate(selectedInvoice.issuedAt)}
                </p>
                <p>
                  <span className="text-[#64748B]">Status:</span>{' '}
                  <span className={statusToneClass(selectedInvoice.paymentStatus)}>
                    {formatStatusLabel(selectedInvoice.paymentStatus)}
                  </span>
                </p>
              </div>
            </div>

            <div className="border border-[#E6E2D8] rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-[#64748B]">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Item</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E2D8]">
                  {selectedInvoice.lineItems.map((li: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-[#0F1D36]">{li.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{li.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatMoney(li.unitPriceMinor, selectedInvoice.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        {formatMoney(li.lineTotalMinor, selectedInvoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-end text-xs space-y-1">
              <p>Subtotal: <span className="font-mono">{formatMoney(selectedInvoice.subtotalMinor, selectedInvoice.currency)}</span></p>
              {selectedInvoice.discountMinor > 0 && (
                <p className="text-[#15803D]">
                  Discount: <span className="font-mono">−{formatMoney(selectedInvoice.discountMinor, selectedInvoice.currency)}</span>
                </p>
              )}
              <p>Tax: <span className="font-mono">{formatMoney(selectedInvoice.taxMinor, selectedInvoice.currency)}</span></p>
              <p className="text-sm font-bold text-[#0F1D36] pt-1">
                Total ({selectedInvoice.currency}):{' '}
                <span className="font-mono">{formatMoney(selectedInvoice.totalMinor, selectedInvoice.currency)}</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E2D8]">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6E2D8] text-xs font-semibold text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={() => downloadInvoiceHtml(selectedInvoice)}
                className="px-4 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold cursor-pointer"
              >
                Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

// =========================================================================
// PAYMENT HISTORY
// =========================================================================

export const PortalPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      portalRequest<{ payments: any[] }>('/payments'),
      portalRequest<{ providers: any[] }>('/payment-providers'),
    ])
      .then(([pRes, provRes]) => {
        if (!active) return;
        setPayments(pRes.payments || []);
        setProviders(provRes.providers || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PortalLayout
      title="Payment History"
      subtitle="Server-verified payment records, provider references, refund status, and gateway readiness."
    >
      <div className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden mb-6">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading payment history...</div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CreditCard className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#0F1D36]">No payment records yet</p>
            <p className="text-xs text-[#64748B]">Payment attempts and verified transactions will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F4] border-b border-[#E6E2D8] text-xs text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-medium">Order #</th>
                  <th className="py-3 px-4 font-medium">Provider</th>
                  <th className="py-3 px-4 font-medium">Reference</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2D8]">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#0F1D36]">
                      {p.orderNumber}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#334155]">
                      {formatStatusLabel(p.provider)} ({p.environment})
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#64748B]">
                      {p.providerTransactionId || 'Awaiting gateway ref'}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className={statusToneClass(p.status)}>{formatStatusLabel(p.status)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#64748B]">{formatPortalDate(p.createdAt)}</td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold tabular-nums text-right text-[#0F1D36]">
                      {formatMoney(p.amountMinor, p.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supported Payment Gateway Readiness Overview */}
      <div className="bg-white border border-[#E6E2D8] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#0F4C3A]" />
          <h2 className="text-sm font-semibold text-[#0F1D36]">Supported Payment Providers &amp; Readiness</h2>
        </div>
        <p className="text-xs text-[#64748B]">
          All online payment gateways stay disabled or sandbox-gated until verified merchant credentials and webhook signature checks are activated in the deployment environment.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {providers.map((prov) => (
            <div key={prov.provider} className="p-3 rounded-lg bg-[#FAF8F4] border border-[#E6E2D8] text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0F1D36]">{prov.displayName}</span>
                <span className="font-mono text-[10px] uppercase text-[#64748B]">{prov.mode}</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">{prov.supportedCurrencies.join(' · ')}</p>
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
};
