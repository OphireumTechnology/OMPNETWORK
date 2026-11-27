import React, { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Store,
  ShoppingBag,
  FolderKanban,
  MessageSquare,
  Coins,
  RefreshCw,
  FileText,
  CreditCard,
  FolderOpen,
  LifeBuoy,
  Bell,
  UserRound,
  ShieldCheck,
  Settings,
  LogOut,
  Search,
  ShoppingCart,
  Menu,
  X,
  ArrowLeft,
  ChevronDown,
  Building2,
  Tag,
  Download,
  Calendar,
  Bot,
  Lock,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { usePortalAuth } from '../PortalAuthContext';
import { usePortalRouter } from '../PortalRouter';

export const OphireumBrandMark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => (
  <BrandLogo variant="emblem" size={size} ring="gold" eager decorative />
);

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefixes?: string[];
  badge?: number;
}

export const PortalLayout: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => {
  const { user, profile, wallet, unreadNotifications, cartItemCount, logout } = usePortalAuth();
  const { path, navigate, exitToPublicSite } = usePortalRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const firstName = profile?.firstName || user?.email?.split('@')[0] || 'Client';

  const navGroups: Array<{ heading: string; items: SidebarItem[] }> = [
    {
      heading: 'Workspace',
      items: [
        { label: 'Dashboard', path: '/portal/dashboard', icon: LayoutDashboard },
        { label: 'My Services', path: '/portal/services', icon: Briefcase },
        { label: 'Service Store', path: '/portal/store', icon: Store, matchPrefixes: ['/portal/store'] },
        { label: 'Offers & Promotions', path: '/portal/offers', icon: Tag },
        { label: 'My Orders', path: '/portal/orders', icon: ShoppingBag, matchPrefixes: ['/portal/orders'] },
      ],
    },
    {
      heading: 'Production',
      items: [
        { label: 'My Projects', path: '/portal/projects', icon: FolderKanban, matchPrefixes: ['/portal/projects'] },
        { label: 'Project Discussions', path: '/portal/messages', icon: MessageSquare },
        { label: 'My Files & Deliverables', path: '/portal/files', icon: FolderOpen },
        { label: 'Digital Downloads', path: '/portal/downloads', icon: Download },
        { label: 'Consultations', path: '/portal/consultations', icon: Calendar },
        { label: 'AI Consultant', path: '/portal/consultant', icon: Bot },
      ],
    },
    {
      heading: 'Billing & Credits',
      items: [
        { label: 'Credits & Usage', path: '/portal/credits', icon: Coins },
        { label: 'Subscriptions', path: '/portal/subscriptions', icon: RefreshCw },
        { label: 'Invoices & Receipts', path: '/portal/invoices', icon: FileText },
        { label: 'Payment History', path: '/portal/payments', icon: CreditCard },
      ],
    },
    {
      heading: 'Support & Account',
      items: [
        { label: 'Support Center', path: '/portal/support', icon: LifeBuoy },
        {
          label: 'Notifications',
          path: '/portal/notifications',
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
        },
        { label: 'Profile & Account', path: '/portal/profile', icon: UserRound },
        { label: 'Organization', path: '/portal/organization', icon: Building2 },
        { label: 'Privacy & MFA', path: '/portal/privacy', icon: Lock },
        { label: 'Security Settings', path: '/portal/security', icon: ShieldCheck },
        { label: 'Preferences', path: '/portal/settings', icon: Settings },
      ],
    },
  ];

  const isActivePath = (item: SidebarItem) => {
    if (path === item.path) return true;
    if (item.matchPrefixes) {
      return item.matchPrefixes.some((prefix) => path.startsWith(`${prefix}/`));
    }
    return false;
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/portal/store?q=${encodeURIComponent(q)}`);
    setMobileNavOpen(false);
  };

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    setMobileNavOpen(false);
    await logout();
    navigate('/portal/login', { replace: true });
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F1D36] text-[#E8E4DA]">
      {/* Brand Lockup */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            navigate('/portal/dashboard');
            setMobileNavOpen(false);
          }}
          className="flex items-center gap-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8923A] rounded-lg"
        >
          <BrandLogo
            variant="horizontal"
            theme="portal-dark"
            size="md"
            ring="gold"
            title="Ophireum Multimedia"
            subtitle="Client Portal"
            eager
          />
        </button>
        <button
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Client Portal Navigation">
        {navGroups.map((group) => (
          <div key={group.heading}>
            <div className="px-3 mb-1.5 text-[11px] font-medium text-slate-400 tracking-wide">
              {group.heading}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(item);
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-colors cursor-pointer text-left ${
                      active
                        ? 'bg-[#172B4D] text-white font-semibold'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white font-normal'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-[#D9B664]' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="font-mono text-[11px] tabular-nums text-[#D9B664] font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <button
          onClick={exitToPublicSite}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Back to Public Website</span>
        </button>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-rose-200 hover:text-white hover:bg-rose-500/20 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1D36] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 sticky top-0 h-screen border-r border-[#0F1D36]">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0F1D36]/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-[280px] max-w-[85vw] h-full z-10 shadow-2xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Verification Prompt Banner (only if email not yet verified) */}
        {user && !user.emailVerified && (
          <div className="bg-[#FFFBEB] border-b border-[#E7D8B1] px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#785315]">
            <span>
              Your email address <strong className="font-semibold">{user.email}</strong> is awaiting verification.
            </span>
            <button
              onClick={() => navigate('/portal/verify-email')}
              className="font-semibold text-[#0F4C3A] underline underline-offset-2 hover:text-[#0B3B2D] cursor-pointer whitespace-nowrap"
            >
              Verify Email Now
            </button>
          </div>
        )}

        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E6E2D8]">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            {/* Left: Mobile trigger + Welcome */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-[#E6E2D8] text-[#0F1D36] hover:bg-[#FAF8F4] cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/portal/dashboard')}
                className="lg:hidden shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8923A]"
                aria-label="Ophireum Multimedia Client Portal Dashboard"
              >
                <BrandLogo variant="emblem" size="sm" ring="gold" eager decorative />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F1D36] truncate">
                  Welcome, {firstName}
                </p>
                <p className="text-xs text-[#64748B] truncate hidden sm:block">
                  {title}
                </p>
              </div>
            </div>

            {/* Center: Search */}
            <form onSubmit={handleGlobalSearch} className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services, packages, or categories..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#FAF8F4] border border-[#E6E2D8] rounded-lg text-[#0F1D36] placeholder:text-[#64748B] focus:outline-none focus:border-[#0F4C3A] focus:bg-white transition-colors"
                />
              </div>
            </form>

            {/* Right: Credits, Store CTA, Cart, Notifications, Profile */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => navigate('/portal/credits')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6E2D8] bg-[#FAF8F4] hover:border-[#B8923A] transition-colors cursor-pointer whitespace-nowrap"
                title="Available service credits"
              >
                <Coins className="w-3.5 h-3.5 text-[#B8923A]" />
                <span className="font-mono text-xs font-semibold tabular-nums text-[#0F1D36]">
                  {(wallet?.availableCredits ?? 0).toLocaleString()}
                </span>
                <span className="text-xs text-[#64748B]">credits</span>
              </button>

              <button
                onClick={() => navigate('/portal/store')}
                className="hidden xl:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Service Store</span>
              </button>

              <button
                onClick={() => navigate('/portal/cart')}
                className="relative p-2 rounded-lg border border-[#E6E2D8] text-[#0F1D36] hover:bg-[#FAF8F4] transition-colors cursor-pointer"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0F4C3A] text-white font-mono text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {cartItemCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate('/portal/notifications')}
                className="relative p-2 rounded-lg border border-[#E6E2D8] text-[#0F1D36] hover:bg-[#FAF8F4] transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B8923A] text-white font-mono text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-[#E6E2D8] hover:bg-[#FAF8F4] transition-colors cursor-pointer"
                  aria-label="Account menu"
                >
                  <div className="w-7 h-7 rounded-md bg-[#0F1D36] text-[#D9B664] text-xs font-semibold flex items-center justify-center">
                    {firstName.slice(0, 2).toUpperCase()}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
                </button>
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E6E2D8] rounded-xl shadow-lg py-1.5 z-20 text-sm">
                      <div className="px-3.5 py-2 border-b border-[#E6E2D8]">
                        <p className="font-semibold text-[#0F1D36] truncate">{profile?.fullName || firstName}</p>
                        <p className="text-xs text-[#64748B] truncate">{user?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          navigate('/portal/profile');
                        }}
                        className="w-full text-left px-3.5 py-2 text-[#334155] hover:bg-[#FAF8F4] cursor-pointer"
                      >
                        Profile & Billing
                      </button>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          navigate('/portal/security');
                        }}
                        className="w-full text-left px-3.5 py-2 text-[#334155] hover:bg-[#FAF8F4] cursor-pointer"
                      >
                        Security Settings
                      </button>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          navigate('/portal/settings');
                        }}
                        className="w-full text-left px-3.5 py-2 text-[#334155] hover:bg-[#FAF8F4] cursor-pointer"
                      >
                        Preferences
                      </button>
                      <div className="my-1 border-t border-[#E6E2D8]" />
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-3.5 py-2 text-[#B91C1C] hover:bg-rose-50 cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1360px] w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F1D36]">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-[#475569]">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
};
