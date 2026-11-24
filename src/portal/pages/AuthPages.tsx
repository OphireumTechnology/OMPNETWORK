import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { OphireumBrandMark } from '../components/PortalLayout';
import { usePortalAuth } from '../PortalAuthContext';
import { usePortalRouter } from '../PortalRouter';
import { portalRequest } from '../portalApi';

const AuthShell: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => {
  const { exitToPublicSite } = usePortalRouter();

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1D36] grid lg:grid-cols-[440px_1fr]">
      {/* Left Brand Panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-[#0F1D36] text-[#E8E4DA] p-10">
        <div>
          <button
            onClick={exitToPublicSite}
            className="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Ophireum Website</span>
          </button>
          <div className="flex items-center gap-3 mb-8">
            <OphireumBrandMark />
            <div>
              <div className="text-base font-bold text-white tracking-tight">Ophireum Multimedia</div>
              <div className="text-xs text-[#D9B664]">Client Operations Portal</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white leading-snug tracking-tight">
            One calm workspace for your services, projects, billing, and deliverables.
          </h2>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            Order multimedia & AI creative packages, share project briefs, collaborate directly with our production desk, and download verified deliverables securely.
          </p>
        </div>

        <div className="pt-6 border-t border-white/10 space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-200">
            <ShieldCheck className="w-4 h-4 text-[#D9B664] shrink-0" />
            <span>Private client isolation & server-verified transactions</span>
          </div>
          <p>Ophireum Multimedia Production · Clark Freeport Zone, Pampanga, Philippines</p>
        </div>
      </aside>

      {/* Right Form Area */}
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <OphireumBrandMark size="sm" />
              <span className="text-sm font-bold text-[#0F1D36]">Ophireum Client Portal</span>
            </div>
            <button
              onClick={exitToPublicSite}
              className="text-xs font-medium text-[#0F4C3A] hover:underline cursor-pointer"
            >
              Public Website
            </button>
          </div>

          <div className="bg-white border border-[#E6E2D8] rounded-xl p-6 sm:p-8">
            <h1 className="text-xl font-bold text-[#0F1D36] tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-[#475569]">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export const PortalLoginPage: React.FC = () => {
  const { login } = usePortalAuth();
  const { navigate, query } = usePortalRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const nextPath = query.get('next');
  const safeNext =
    nextPath &&
    nextPath.startsWith('/portal/') &&
    !nextPath.startsWith('//') &&
    !nextPath.includes('://')
      ? nextPath
      : '/portal/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(safeNext, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to your account"
      subtitle="Access your orders, projects, credits, invoices, and deliverables."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-[#B91C1C]">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1.5">Email Address</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-[#334155]">Password</label>
            <button
              type="button"
              onClick={() => navigate('/portal/forgot-password')}
              className="text-xs font-medium text-[#0F4C3A] hover:underline cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4" />
          <span>{busy ? 'Signing in...' : 'Sign In'}</span>
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#E6E2D8] text-center text-sm text-[#475569]">
        New to Ophireum Multimedia?{' '}
        <button
          onClick={() => navigate('/portal/register')}
          className="font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
        >
          Create a client account
        </button>
      </div>
    </AuthShell>
  );
};

export const PortalRegisterPage: React.FC = () => {
  const { register } = usePortalAuth();
  const { navigate } = usePortalRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await register({ firstName, lastName, companyName, phone, email, password });
      navigate('/portal/verify-email', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your client account"
      subtitle="Register to browse services, manage projects, and track deliverables."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-[#B91C1C]">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">First Name</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Maria"
              className="w-full px-3 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">Last Name</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Santos"
              className="w-full px-3 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1.5">Email Address</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@company.com"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">Company (Optional)</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Studio or Business"
              className="w-full px-3 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">Phone (Optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+63 9XX XXX XXXX"
              className="w-full px-3 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1.5">Password (8+ characters)</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#334155] mb-1.5">Confirm Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          {busy ? 'Creating account...' : 'Create Client Account'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#E6E2D8] text-center text-sm text-[#475569]">
        Already have an account?{' '}
        <button
          onClick={() => navigate('/portal/login')}
          className="font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
        >
          Sign in
        </button>
      </div>
    </AuthShell>
  );
};

export const PortalVerifyEmailPage: React.FC = () => {
  const { user, devVerificationToken, setDevVerificationToken, refreshSession } = usePortalAuth();
  const { navigate, query } = usePortalRouter();
  const [token, setToken] = useState(query.get('token') || devVerificationToken || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await portalRequest('/auth/verify-email', {
        method: 'POST',
        body: { token: token.trim() },
        skipAuth: true,
      });
      setDevVerificationToken(null);
      await refreshSession();
      setMessage('Email address verified successfully.');
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await portalRequest<{ message: string; devVerificationToken?: string }>(
        '/auth/resend-verification',
        { method: 'POST' }
      );
      if (res.devVerificationToken) {
        setDevVerificationToken(res.devVerificationToken);
        setToken(res.devVerificationToken);
      }
      setMessage(res.message);
    } catch (err: any) {
      setError(err?.message || 'Unable to resend verification token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email address"
      subtitle="Confirm ownership of your email to secure your Ophireum Multimedia account."
    >
      {user?.emailVerified || message.includes('verified successfully') ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0 mt-0.5" />
            <div className="text-sm text-[#14532D]">
              Your email address is verified. You can now use all client portal features.
            </div>
          </div>
          <button
            onClick={() => navigate('/portal/dashboard', { replace: true })}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
          >
            Continue to Dashboard
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-[#B91C1C]">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-[#15803D]">
              {message}
            </div>
          )}
          {devVerificationToken && (
            <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#E7D8B1] text-xs text-[#785315]">
              Preview environment notice: transactional email delivery is not configured locally, so your verification code has been prefilled below for testing.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">Verification Code</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste verification code from email"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>{busy ? 'Verifying...' : 'Verify Email'}</span>
          </button>
          <div className="flex items-center justify-between pt-2 text-xs">
            {user ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={busy}
                className="font-semibold text-[#0F4C3A] hover:underline cursor-pointer"
              >
                Resend verification code
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => navigate(user ? '/portal/dashboard' : '/portal/login')}
              className="text-[#475569] hover:text-[#0F1D36] cursor-pointer"
            >
              {user ? 'Skip for now →' : 'Back to Sign In'}
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export const PortalForgotPasswordPage: React.FC = () => {
  const { navigate } = usePortalRouter();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devNotice, setDevNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await portalRequest<{ message: string; devResetToken?: string }>(
        '/auth/forgot-password',
        { method: 'POST', body: { email }, skipAuth: true }
      );
      if (res.devResetToken) {
        setToken(res.devResetToken);
        setDevNotice(true);
      }
      setStep('reset');
    } catch (err: any) {
      setError(err?.message || 'Unable to process recovery request.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await portalRequest('/auth/reset-password', {
        method: 'POST',
        body: { token: token.trim(), newPassword },
        skipAuth: true,
      });
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Password Recovery"
      subtitle="Request a secure password reset token to regain access to your account."
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-[#B91C1C]">
          {error}
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">Registered Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36] focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
          >
            {busy ? 'Sending instructions...' : 'Send Reset Instructions'}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleReset} className="space-y-4">
          {devNotice && (
            <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#E7D8B1] text-xs text-[#785315]">
              Preview environment notice: your recovery token has been prefilled below for verification.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">Recovery Token</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste recovery token"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1.5">New Password (8+ characters)</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8D3C8] rounded-lg text-[#0F1D36]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
          >
            {busy ? 'Updating password...' : 'Update Password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-[#14532D]">
            Your password has been reset and all prior sessions were revoked. Sign in with your new password.
          </div>
          <button
            onClick={() => navigate('/portal/login', { replace: true })}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white text-sm font-semibold cursor-pointer"
          >
            Return to Sign In
          </button>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-[#E6E2D8] text-center text-sm">
        <button
          onClick={() => navigate('/portal/login')}
          className="text-[#475569] hover:text-[#0F1D36] cursor-pointer"
        >
          Back to Sign In
        </button>
      </div>
    </AuthShell>
  );
};
