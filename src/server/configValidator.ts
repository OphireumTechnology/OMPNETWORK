/**
 * OPHIREUM NETWORK — Staging & Production External Provider Configuration Validator (Phase 29)
 * Inspects environment readiness without ever exposing secret values.
 * Enforces live_payments_enabled = false safety posture and deferred merchant onboarding rules.
 */

export interface ProviderReadinessItem {
  id: string;
  name: string;
  category: 'infrastructure' | 'ai' | 'communications' | 'payments';
  status: 'configured' | 'sandbox_ready' | 'unconfigured' | 'deferred_merchant_onboarding' | 'locked_off';
  requiredForStaging: boolean;
  missingEnvVars: string[];
  notes: string;
}

export interface SystemReadinessReport {
  environment: string;
  livePaymentsEnabled: false;
  stagingReady: boolean;
  checkedAt: string;
  providers: ProviderReadinessItem[];
}

function isPresent(name: string): boolean {
  const val = (process.env[name] || '').trim();
  if (!val) return false;
  if (val.includes('your-') || val.includes('replace-with') || val === 'changeme') return false;
  return true;
}

function missingOf(vars: string[]): string[] {
  return vars.filter((v) => !isPresent(v));
}

export function evaluateSystemReadiness(): SystemReadinessReport {
  const providers: ProviderReadinessItem[] = [
    {
      id: 'supabase_postgres',
      name: 'Supabase PostgreSQL + Auth + Storage',
      category: 'infrastructure',
      requiredForStaging: true,
      missingEnvVars: missingOf(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']),
      status: missingOf(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).length === 0 ? 'configured' : 'unconfigured',
      notes: 'Required for durable multi-replica persistence, RLS, migrations 000–005, pgvector, and 6 private buckets.',
    },
    {
      id: 'security_secrets',
      name: 'Session, Portal & MFA Cryptographic Keys',
      category: 'infrastructure',
      requiredForStaging: true,
      missingEnvVars: missingOf(['ADMIN_SESSION_SECRET', 'PORTAL_SIGNING_SECRET', 'MFA_ENCRYPTION_KEY']),
      status:
        missingOf(['ADMIN_SESSION_SECRET', 'PORTAL_SIGNING_SECRET', 'MFA_ENCRYPTION_KEY']).length === 0
          ? 'configured'
          : 'unconfigured',
      notes: 'Supports zero-downtime MFA key rotation via optional MFA_ENCRYPTION_KEY_PREVIOUS.',
    },
    {
      id: 'gemini_ai',
      name: 'Gemini AI (Text, Live Voice gemini-3.8-live, TTS, STT, gemini-embedding-2)',
      category: 'ai',
      requiredForStaging: true,
      missingEnvVars: missingOf(['GEMINI_API_KEY']),
      status: isPresent('GEMINI_API_KEY') ? 'configured' : 'unconfigured',
      notes: 'Server-side only via @google/genai; never exposed to browser bundles.',
    },
    {
      id: 'resend_email',
      name: 'Resend Transactional Email & Svix Webhooks',
      category: 'communications',
      requiredForStaging: true,
      missingEnvVars: missingOf(['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET']),
      status: missingOf(['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET']).length === 0 ? 'configured' : 'unconfigured',
      notes: 'Requires verified SPF/DKIM/DMARC sender domain for ophireummultimedia.com.',
    },
    {
      id: 'google_calendar',
      name: 'Google Calendar Consultation Sync',
      category: 'communications',
      requiredForStaging: false,
      missingEnvVars: missingOf(['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_CALENDAR_ID']),
      status:
        missingOf(['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_CALENDAR_ID']).length === 0
          ? 'configured'
          : 'unconfigured',
      notes: 'Unconfigured appointments remain honestly in pending_review status.',
    },
    {
      id: 'xendit_sandbox',
      name: 'Xendit Sandbox Gateway',
      category: 'payments',
      requiredForStaging: false,
      missingEnvVars: missingOf(['XENDIT_SECRET_KEY_TEST', 'XENDIT_WEBHOOK_SECRET']),
      status:
        missingOf(['XENDIT_SECRET_KEY_TEST', 'XENDIT_WEBHOOK_SECRET']).length === 0
          ? 'sandbox_ready'
          : 'unconfigured',
      notes: 'Sandbox only; live charges remain hard-locked off.',
    },
    {
      id: 'paypal_sandbox',
      name: 'PayPal Sandbox Gateway',
      category: 'payments',
      requiredForStaging: false,
      missingEnvVars: missingOf(['PAYPAL_CLIENT_ID_SANDBOX', 'PAYPAL_CLIENT_SECRET_SANDBOX', 'PAYPAL_WEBHOOK_SECRET']),
      status:
        missingOf(['PAYPAL_CLIENT_ID_SANDBOX', 'PAYPAL_CLIENT_SECRET_SANDBOX', 'PAYPAL_WEBHOOK_SECRET']).length === 0
          ? 'sandbox_ready'
          : 'unconfigured',
      notes: 'Sandbox only; live charges remain hard-locked off.',
    },
    {
      id: 'maya_sandbox',
      name: 'Maya Sandbox Gateway',
      category: 'payments',
      requiredForStaging: false,
      missingEnvVars: missingOf(['MAYA_PUBLIC_KEY_SANDBOX', 'MAYA_SECRET_KEY_SANDBOX', 'MAYA_WEBHOOK_SECRET']),
      status:
        missingOf(['MAYA_PUBLIC_KEY_SANDBOX', 'MAYA_SECRET_KEY_SANDBOX', 'MAYA_WEBHOOK_SECRET']).length === 0
          ? 'sandbox_ready'
          : 'unconfigured',
      notes: 'Sandbox only; live charges remain hard-locked off.',
    },
    {
      id: 'paymongo_gotyme',
      name: 'PayMongo & GoTyme Bank',
      category: 'payments',
      requiredForStaging: false,
      missingEnvVars: [],
      status: 'deferred_merchant_onboarding',
      notes: 'Intentionally disabled pending authorized Philippine merchant onboarding.',
    },
    {
      id: 'live_payments_lock',
      name: 'Production Live Payments Safety Lock',
      category: 'payments',
      requiredForStaging: false,
      missingEnvVars: [],
      status: 'locked_off',
      notes: 'Hard-locked to live_payments_enabled = false until explicit Owner production cutover authorization.',
    },
  ];

  const stagingReady = providers
    .filter((p) => p.requiredForStaging)
    .every((p) => p.status === 'configured' || p.status === 'sandbox_ready');

  return {
    environment: process.env.NODE_ENV || 'development',
    livePaymentsEnabled: false,
    stagingReady,
    checkedAt: new Date().toISOString(),
    providers,
  };
}
