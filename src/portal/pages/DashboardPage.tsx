import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Coins,
  FilePlus2,
  FolderKanban,
  LifeBuoy,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { PortalLayout } from '../components/PortalLayout';
import { portalRequest } from '../portalApi';
import { usePortalRouter } from '../PortalRouter';
import { usePortalAuth } from '../PortalAuthContext';
import {
  formatMoney,
  formatPortalDate,
  formatPortalDateTime,
  formatStatusLabel,
  Product,
  statusToneClass,
} from '../portalTypes';

interface DashboardData {
  metrics: {
    activeOrders: number;
    activeProjects: number;
    availableCredits: number;
    pendingCredits: number;
    completedProjects: number;
    pendingPayments: number;
    openSupportRequests: number;
  };
  recentOrders: any[];
  activeProjectsList: any[];
  recentActivities: any[];
  recommendedServices: Product[];
}

export const PortalDashboardPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const { profile } = usePortalAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currency = profile?.preferredCurrency || 'USD';

  useEffect(() => {
    let active = true;
    portalRequest<DashboardData>('/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'Unable to load dashboard.');
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
      title="Client Dashboard"
      subtitle="Overview of your active orders, creative production workspaces, credits, and recent updates."
    >
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {/* 6 Overview Metric Cards */}
      <section aria-label="Account summary metrics" className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Active Orders', value: data?.metrics.activeOrders ?? 0, to: '/portal/orders' },
          { label: 'Active Projects', value: data?.metrics.activeProjects ?? 0, to: '/portal/projects' },
          { label: 'Available Credits', value: data?.metrics.availableCredits ?? 0, to: '/portal/credits' },
          { label: 'Completed Projects', value: data?.metrics.completedProjects ?? 0, to: '/portal/projects' },
          { label: 'Pending Payments', value: data?.metrics.pendingPayments ?? 0, to: '/portal/payments' },
          { label: 'Open Support', value: data?.metrics.openSupportRequests ?? 0, to: '/portal/support' },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => navigate(card.to)}
            className="text-left bg-white border border-[#E6E2D8] hover:border-[#0F4C3A]/50 rounded-xl p-4 transition-colors cursor-pointer"
          >
            <div className="text-xs text-[#64748B] font-medium">{card.label}</div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#0F1D36]">
              {loading ? '—' : card.value.toLocaleString()}
            </div>
          </button>
        ))}
      </section>

      {/* Quick Actions */}
      <section className="mb-8 bg-white border border-[#E6E2D8] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#0F1D36]">Quick Actions</h2>
          <span className="text-xs text-[#64748B]">Start a workflow in one click</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Purchase a Service', icon: Store, to: '/portal/store', primary: true },
            { label: 'Create a Project', icon: FolderKanban, to: '/portal/projects?new=1' },
            { label: 'Submit Project Brief', icon: FilePlus2, to: '/portal/projects?new=1' },
            { label: 'Purchase Credits', icon: Coins, to: '/portal/store?category=subscription-credit-packages' },
            { label: 'View My Orders', icon: ShoppingBag, to: '/portal/orders' },
            { label: 'Contact Support', icon: LifeBuoy, to: '/portal/support?new=1' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  action.primary
                    ? 'bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white'
                    : 'bg-[#FAF8F4] hover:bg-[#F1EDE3] text-[#0F1D36] border border-[#E6E2D8]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Two-Column Core Sections: Recent Orders & Active Projects */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* A. Recent Orders */}
        <section className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#E6E2D8] flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F1D36]">Recent Orders</h2>
            <button
              onClick={() => navigate('/portal/orders')}
              className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-[#64748B]">Loading recent orders...</div>
          ) : !data?.recentOrders.length ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-[#0F1D36]">No orders placed yet</p>
              <p className="mt-1 text-xs text-[#64748B]">
                Browse the Service Store to select a multimedia package or credit bundle.
              </p>
              <button
                onClick={() => navigate('/portal/store')}
                className="mt-4 px-4 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer"
              >
                Explore Service Store
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FAF8F4] text-xs text-[#64748B] border-b border-[#E6E2D8]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Order</th>
                    <th className="px-4 py-2.5 font-medium">Service</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4]">
                  {data.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#FAF8F4]/70">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold text-[#0F1D36]">
                          {order.orderNumber}
                        </div>
                        <div className="text-[11px] text-[#64748B]">{formatPortalDate(order.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#334155]">
                        {order.items?.[0]?.productName || 'Service Package'}
                        {order.items?.length > 1 ? ` +${order.items.length - 1}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-[#0F1D36]">
                        {formatMoney(order.totalMinor, order.currency)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className={statusToneClass(order.paymentStatus)}>
                          {formatStatusLabel(order.paymentStatus)}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          {formatStatusLabel(order.fulfillmentStatus)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
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
        </section>

        {/* B. Active Projects */}
        <section className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#E6E2D8] flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F1D36]">Active Projects</h2>
            <button
              onClick={() => navigate('/portal/projects')}
              className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>All projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-[#64748B]">Loading projects...</div>
          ) : !data?.activeProjectsList.length ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-[#0F1D36]">No active projects yet</p>
              <p className="mt-1 text-xs text-[#64748B]">
                Submit a project brief or confirm a service order to open a collaborative workspace.
              </p>
              <button
                onClick={() => navigate('/portal/projects?new=1')}
                className="mt-4 px-4 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold cursor-pointer"
              >
                Create Project Brief
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {data.activeProjectsList.map((prj) => (
                <div key={prj.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[#FAF8F4]/70">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-[#64748B]">
                      <span className="font-mono font-semibold text-[#0F1D36]">{prj.referenceNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{prj.serviceName}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-[#0F1D36] truncate">{prj.title}</p>
                    <div className="mt-1 text-xs text-[#64748B]">
                      {prj.assignedCoordinator} · {formatStatusLabel(prj.currentStage)} · Updated{' '}
                      {formatPortalDate(prj.updatedAt)}
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-[#EFECE4] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0F4C3A] rounded-full"
                        style={{ width: `${prj.progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/portal/projects/${prj.id}`)}
                    className="px-3 py-1.5 rounded-lg border border-[#E6E2D8] text-xs font-semibold text-[#0F1D36] hover:border-[#0F4C3A] hover:text-[#0F4C3A] cursor-pointer whitespace-nowrap"
                  >
                    Open Project
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Bottom Two Columns: Recent Activities + Recommended Services */}
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* C. Recent Activities */}
        <section className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E2D8]">
            <h2 className="text-base font-semibold text-[#0F1D36]">Recent Activity</h2>
          </div>
          {!data?.recentActivities.length ? (
            <div className="p-6 text-xs text-[#64748B]">
              Order confirmations, messages, file uploads, and deliverable updates will appear here.
            </div>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {data.recentActivities.map((act) => (
                <div key={act.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#0F1D36]">{act.title}</span>
                    <span className="font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                      {formatPortalDateTime(act.createdAt)}
                    </span>
                  </div>
                  {act.detail && <p className="mt-0.5 text-xs text-[#64748B]">{act.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* D. Recommended Services */}
        <section className="bg-white border border-[#E6E2D8] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E2D8] flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F1D36]">Recommended Services & Packages</h2>
            <button
              onClick={() => navigate('/portal/store')}
              className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
            >
              Browse full catalog
            </button>
          </div>
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-[#EFECE4]">
            {(data?.recommendedServices || []).map((product) => {
              const pkg = product.packages[0];
              const priceMinor = currency === 'PHP' ? pkg.pricePhpMinor : pkg.priceUsdMinor;
              return (
                <div key={product.id} className="bg-white p-5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-[#64748B]">
                      {pkg.creditsIncluded > 0 ? `${pkg.creditsIncluded.toLocaleString()} credits` : pkg.turnaroundLabel}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-[#0F1D36]">{product.name}</h3>
                    <p className="mt-1 text-xs text-[#475569] line-clamp-2">{product.shortDescription}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#F2EFE8] flex items-center justify-between">
                    <span className="font-mono text-sm font-bold tabular-nums text-[#0F1D36]">
                      {pkg.isCustomQuote ? 'Custom Quote' : formatMoney(priceMinor, currency)}
                    </span>
                    <button
                      onClick={() => navigate(`/portal/store/${product.slug}`)}
                      className="text-xs font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
                    >
                      Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PortalLayout>
  );
};
