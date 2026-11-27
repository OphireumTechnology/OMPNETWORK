-- ============================================================================
-- OPHIREUM NETWORK (OMPNETWORK)
-- Migration 006: Enterprise Reliability, Durable AI Memory, Distributed Auth,
--                Financial Governance, Workforce Job Queue & Legal Consents
--
-- Append-only migration building cleanly on Migrations 000 through 005.
-- Never modifies historical migration files.
--
-- Covers:
-- - Phase 32: ai_conversations, ai_conversation_participants,
--             ai_conversation_summaries, ai_conversation_memory,
--             ai_conversation_consents, ai_conversation_attachments,
--             ai_conversation_retention_jobs
-- - Phase 33: auth_security_events (append-only), auth_lockouts, mfa_challenges
-- - Phase 34: financial_maker_checker_approvals (segregation of duties),
--             payment_reconciliation_queue, payment_settlement_records,
--             payment_disputes
-- - Phase 36: knowledge quarantine & sensitive-flag governance columns
-- - Phase 37: ai_workforce_job_queue, ai_workforce_dead_letters,
--             claim_ai_workforce_job() SECURITY DEFINER RPC
-- - Phase 46: legal_policy_acceptances (versioned RA 10173 / RA 11967 records)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PHASE 32 — DURABLE AI CONVERSATION & PRIVACY-AWARE MEMORY SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE REFERENCES public.ai_conversation_sessions(id) ON DELETE CASCADE,
  tenant_scope TEXT NOT NULL DEFAULT 'public',
  organization_id TEXT,
  principal_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('authenticated', 'anonymous', 'admin')),
  channel TEXT NOT NULL DEFAULT 'unified' CHECK (channel IN ('chat', 'voice', 'live_audio', 'unified')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'expired', 'deleted')),
  correlation_id TEXT,
  retention_policy TEXT NOT NULL DEFAULT 'standard_30d',
  retention_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant_principal
  ON public.ai_conversations(tenant_scope, principal_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_scope TEXT NOT NULL DEFAULT 'public',
  principal_id TEXT NOT NULL,
  participant_role TEXT NOT NULL CHECK (participant_role IN ('customer', 'visitor', 'assistant', 'admin', 'support_officer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  correlation_id TEXT,
  UNIQUE (conversation_id, principal_id, participant_role)
);

CREATE TABLE IF NOT EXISTS public.ai_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_scope TEXT NOT NULL DEFAULT 'public',
  principal_id TEXT NOT NULL,
  summary_version INTEGER NOT NULL DEFAULT 1 CHECK (summary_version >= 1),
  summary_text TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  covered_up_to_sequence INTEGER NOT NULL DEFAULT 0 CHECK (covered_up_to_sequence >= 0),
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, summary_version)
);

CREATE TABLE IF NOT EXISTS public.ai_conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_scope TEXT NOT NULL DEFAULT 'public',
  principal_id TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value_redacted TEXT NOT NULL,
  memory_scope TEXT NOT NULL DEFAULT 'session' CHECK (memory_scope IN ('session', 'customer_consented')),
  consent_verified BOOLEAN NOT NULL DEFAULT false,
  sensitive_redactions_applied INTEGER NOT NULL DEFAULT 0 CHECK (sensitive_redactions_applied >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'deleted')),
  retention_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_memory_principal
  ON public.ai_conversation_memory(tenant_scope, principal_id, status);

CREATE TABLE IF NOT EXISTS public.ai_conversation_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_scope TEXT NOT NULL DEFAULT 'public',
  principal_id TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('conversation_memory', 'voice_transcription', 'data_retention')),
  granted BOOLEAN NOT NULL,
  policy_version TEXT NOT NULL DEFAULT '2026.1-draft',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_consents_lookup
  ON public.ai_conversation_consents(conversation_id, consent_type, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_conversation_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_scope TEXT NOT NULL DEFAULT 'public',
  principal_id TEXT NOT NULL,
  storage_bucket TEXT NOT NULL CHECK (storage_bucket IN ('portal-uploads', 'project-briefs', 'support-attachments')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  sha256_checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'quarantined', 'deleted')),
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_conversation_retention_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('expire_sessions', 'purge_deleted', 'enforce_retention_window')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  records_affected INTEGER NOT NULL DEFAULT 0 CHECK (records_affected >= 0),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. PHASE 33 — DISTRIBUTED AUTHENTICATION, LOCKOUTS & MFA CHALLENGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type TEXT NOT NULL CHECK (principal_type IN ('admin', 'customer', 'anonymous')),
  principal_identifier TEXT NOT NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied', 'locked', 'revoked', 'rotated')),
  ip_address TEXT,
  user_agent TEXT,
  correlation_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_principal
  ON public.auth_security_events(principal_identifier, created_at DESC);

CREATE TABLE IF NOT EXISTS public.auth_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('admin_login', 'admin_mfa', 'portal_login', 'password_reset')),
  subject_key TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, subject_key)
);

CREATE TABLE IF NOT EXISTS public.mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type TEXT NOT NULL CHECK (principal_type IN ('admin', 'customer')),
  principal_id TEXT NOT NULL,
  challenge_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. PHASE 34 — FINANCIAL MAKER-CHECKER, RECONCILIATION, SETTLEMENT & DISPUTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_maker_checker_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('refund_above_threshold', 'manual_credit_adjustment', 'reconciliation_override', 'dispute_resolution')),
  entity_id TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  requested_by_email TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  approver_email TEXT,
  approver_role TEXT,
  status TEXT NOT NULL DEFAULT 'pending_second_approval' CHECK (status IN ('pending_second_approval', 'approved', 'rejected', 'expired')),
  justification TEXT NOT NULL,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT chk_maker_checker_distinct_actors CHECK (
    approver_email IS NULL OR lower(approver_email) <> lower(requested_by_email)
  )
);

CREATE TABLE IF NOT EXISTS public.payment_reconciliation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_transaction_id TEXT,
  order_id_claimed TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  mismatch_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.payment_settlement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  settlement_batch_ref TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  gross_amount_minor BIGINT NOT NULL CHECK (gross_amount_minor >= 0),
  fee_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (fee_amount_minor >= 0),
  net_amount_minor BIGINT NOT NULL CHECK (net_amount_minor >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'exception')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, settlement_batch_ref)
);

CREATE TABLE IF NOT EXISTS public.payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_dispute_id TEXT NOT NULL,
  order_id TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'evidence_submitted', 'won', 'lost', 'closed')),
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_dispute_id)
);

-- ============================================================================
-- 4. PHASE 36 — KNOWLEDGE QUARANTINE & SENSITIVE SCAN METADATA
-- ============================================================================

ALTER TABLE public.ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS quarantined BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
  ADD COLUMN IF NOT EXISTS sensitive_flags_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ai_knowledge_chunks
  ADD COLUMN IF NOT EXISTS retrieval_eligible BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- 5. PHASE 37 — DURABLE AI WORKFORCE JOB QUEUE & DEAD-LETTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_workforce_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,
  agent_code TEXT NOT NULL,
  tenant_scope TEXT NOT NULL DEFAULT 'ophireum_internal',
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  prompt TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_hash TEXT NOT NULL,
  execution_state TEXT NOT NULL DEFAULT 'QUEUED' CHECK (
    execution_state IN (
      'QUEUED',
      'RUNNING',
      'WAITING_FOR_APPROVAL',
      'APPROVED',
      'SUCCEEDED',
      'FAILED',
      'RETRY_SCHEDULED',
      'CANCELLED',
      'BLOCKED_EXTERNAL_DEPENDENCY',
      'DEGRADED_FALLBACK'
    )
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_workforce_jobs_sched
  ON public.ai_workforce_job_queue(execution_state, next_run_at ASC);

CREATE TABLE IF NOT EXISTS public.ai_workforce_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ai_workforce_job_queue(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL,
  action_hash TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  attempts_exhausted INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.claim_ai_workforce_job(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS SETOF public.ai_workforce_job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  SELECT id INTO v_job_id
  FROM public.ai_workforce_job_queue
  WHERE (
    execution_state IN ('QUEUED', 'RETRY_SCHEDULED')
    AND next_run_at <= NOW()
  ) OR (
    execution_state = 'RUNNING'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < NOW()
  )
  ORDER BY next_run_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.ai_workforce_job_queue
  SET
    execution_state = 'RUNNING',
    worker_id = p_worker_id,
    attempt_count = attempt_count + 1,
    lease_expires_at = NOW() + make_interval(secs => GREATEST(10, LEAST(600, p_lease_seconds))),
    updated_at = NOW()
  WHERE id = v_job_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_workforce_job(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_workforce_job(TEXT, INTEGER) TO service_role;

-- ============================================================================
-- 6. PHASE 46 — VERSIONED LEGAL POLICY ACCEPTANCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.legal_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  policy_slug TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  review_status_at_acceptance TEXT NOT NULL DEFAULT 'pending_legal_review',
  accepted BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_email_slug
  ON public.legal_policy_acceptances(email, policy_slug, accepted_at DESC);

-- ============================================================================
-- 7. STRICT RLS, LEAST-PRIVILEGE GRANTS & APPEND-ONLY AUDIT PROTECTION
-- ============================================================================

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_retention_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_maker_checker_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reconciliation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settlement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workforce_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workforce_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_policy_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.ai_conversations,
  public.ai_conversation_participants,
  public.ai_conversation_summaries,
  public.ai_conversation_memory,
  public.ai_conversation_consents,
  public.ai_conversation_attachments,
  public.ai_conversation_retention_jobs,
  public.auth_security_events,
  public.auth_lockouts,
  public.mfa_challenges,
  public.financial_maker_checker_approvals,
  public.payment_reconciliation_queue,
  public.payment_settlement_records,
  public.payment_disputes,
  public.ai_workforce_job_queue,
  public.ai_workforce_dead_letters,
  public.legal_policy_acceptances
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.ai_conversations,
  public.ai_conversation_participants,
  public.ai_conversation_summaries,
  public.ai_conversation_memory,
  public.ai_conversation_consents,
  public.ai_conversation_attachments,
  public.ai_conversation_retention_jobs,
  public.auth_lockouts,
  public.mfa_challenges,
  public.financial_maker_checker_approvals,
  public.payment_reconciliation_queue,
  public.payment_settlement_records,
  public.payment_disputes,
  public.ai_workforce_job_queue,
  public.ai_workforce_dead_letters,
  public.legal_policy_acceptances
TO service_role;

-- Append-only permissions on auth_security_events
GRANT SELECT, INSERT ON public.auth_security_events TO service_role;

DROP TRIGGER IF EXISTS trg_auth_security_events_append_only ON public.auth_security_events;
CREATE TRIGGER trg_auth_security_events_append_only
  BEFORE UPDATE OR DELETE ON public.auth_security_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- Authenticated users may read only their own legal acceptances & AI consents
GRANT SELECT ON public.legal_policy_acceptances TO authenticated;
DROP POLICY IF EXISTS legal_acceptances_owner_select ON public.legal_policy_acceptances;
CREATE POLICY legal_acceptances_owner_select
  ON public.legal_policy_acceptances
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.ai_conversations TO authenticated;
DROP POLICY IF EXISTS ai_conversations_owner_select ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_select
  ON public.ai_conversations
  FOR SELECT
  TO authenticated
  USING (principal_type = 'authenticated' AND principal_id = auth.uid()::text AND status <> 'deleted');

COMMIT;
