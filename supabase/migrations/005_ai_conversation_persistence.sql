-- ============================================================================
-- OPHIREUM NETWORK (OMPNETWORK)
-- Migration 005: Persistent AI Conversation Architecture & Vector Retrieval
--
-- Phase 21: Durable cross-replica AI chat & voice conversation persistence
-- Phase 24: Production pgvector embeddings & tenant-filtered knowledge search
--
-- Security & Privacy Guarantees:
-- - Raw microphone audio is NEVER persisted (enforced by CHECK constraint).
-- - Authenticated customer ownership via user_id + RLS.
-- - Anonymous session ownership via SHA-256 hashed session token (never raw).
-- - Optimistic concurrency (version column) + duplicate message prevention.
-- - All SECURITY DEFINER functions locked to SET search_path = public, pg_temp
--   and EXECUTE granted strictly to service_role.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PERSISTENT AI CONVERSATION SESSIONS (Phase 21)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key TEXT NOT NULL UNIQUE,
  owner_type TEXT NOT NULL DEFAULT 'anonymous' CHECK (owner_type IN ('authenticated', 'anonymous', 'admin')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_token_hash TEXT,
  tenant_scope TEXT NOT NULL DEFAULT 'public',
  channel_mode TEXT NOT NULL DEFAULT 'unified' CHECK (channel_mode IN ('chat', 'voice', 'live_audio', 'unified')),
  language TEXT NOT NULL DEFAULT 'en-US',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'expired', 'deleted')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  summary TEXT NOT NULL DEFAULT '',
  qualification_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconcile existing Migration 000 ai_conversation_sessions table cleanly on upgrade (preserves existing rows)
ALTER TABLE public.ai_conversation_sessions
  ADD COLUMN IF NOT EXISTS session_key TEXT,
  ADD COLUMN IF NOT EXISTS owner_type TEXT NOT NULL DEFAULT 'anonymous',
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anonymous_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS tenant_scope TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS channel_mode TEXT NOT NULL DEFAULT 'unified',
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en-US',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qualification_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  -- Legacy Migration 000 column session_token was NOT NULL; relax so Phase 21 never stores plaintext tokens
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_conversation_sessions'
      AND column_name = 'session_token'
  ) THEN
    ALTER TABLE public.ai_conversation_sessions ALTER COLUMN session_token DROP NOT NULL;
  END IF;

  -- Backfill session_key for any legacy rows
  UPDATE public.ai_conversation_sessions
  SET session_key = 'legacy-' || id::text
  WHERE session_key IS NULL;

  -- Enforce NOT NULL on session_key now that backfill is complete
  ALTER TABLE public.ai_conversation_sessions ALTER COLUMN session_key SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_conv_sessions_owner_type_chk'
  ) THEN
    ALTER TABLE public.ai_conversation_sessions
      ADD CONSTRAINT ai_conv_sessions_owner_type_chk
      CHECK (owner_type IN ('authenticated', 'anonymous', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_conv_sessions_channel_mode_chk'
  ) THEN
    ALTER TABLE public.ai_conversation_sessions
      ADD CONSTRAINT ai_conv_sessions_channel_mode_chk
      CHECK (channel_mode IN ('chat', 'voice', 'live_audio', 'unified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_conv_sessions_status_chk'
  ) THEN
    ALTER TABLE public.ai_conversation_sessions
      ADD CONSTRAINT ai_conv_sessions_status_chk
      CHECK (status IN ('active', 'archived', 'expired', 'deleted'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_conv_sessions_session_key
  ON public.ai_conversation_sessions(session_key);

CREATE INDEX IF NOT EXISTS idx_ai_conv_sessions_user
  ON public.ai_conversation_sessions(user_id, last_activity_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conv_sessions_expires
  ON public.ai_conversation_sessions(expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ai_conv_sessions_tenant
  ON public.ai_conversation_sessions(tenant_scope, last_activity_at DESC);

-- ============================================================================
-- 2. SHARED CHAT & VOICE CONVERSATION MESSAGES (Ordered + Deduplicated)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_conversation_sessions(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1),
  client_message_id TEXT,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system', 'tool')),
  channel TEXT NOT NULL CHECK (channel IN ('chat', 'voice', 'live_audio', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_call_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  contains_raw_audio BOOLEAN NOT NULL DEFAULT false CHECK (contains_raw_audio = false),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, sequence_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conv_messages_dedupe
  ON public.ai_conversation_messages(session_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conv_messages_session_seq
  ON public.ai_conversation_messages(session_id, sequence_number ASC);

-- ============================================================================
-- 3. REALTIME VOICE SESSION LIFECYCLE (Zero Raw Audio Persistence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_session_id UUID NOT NULL REFERENCES public.ai_conversation_sessions(id) ON DELETE CASCADE,
  transport TEXT NOT NULL CHECK (transport IN ('gemini_live_ws', 'http_wav_tts', 'browser_fallback')),
  model_name TEXT NOT NULL DEFAULT 'gemini-3.8-live',
  language TEXT NOT NULL DEFAULT 'en-US',
  input_sample_rate INTEGER NOT NULL DEFAULT 16000,
  output_sample_rate INTEGER NOT NULL DEFAULT 24000,
  status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting', 'active', 'reconnecting', 'degraded', 'ended', 'failed')),
  barge_in_count INTEGER NOT NULL DEFAULT 0 CHECK (barge_in_count >= 0),
  reconnect_count INTEGER NOT NULL DEFAULT 0 CHECK (reconnect_count >= 0),
  device_label_sanitized TEXT,
  raw_audio_persisted BOOLEAN NOT NULL DEFAULT false CHECK (raw_audio_persisted = false),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_conv
  ON public.ai_voice_sessions(conversation_session_id, started_at DESC);

-- ============================================================================
-- 4. AI SESSION EVENTS (Append-Only Execution & Tool Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_session_id UUID NOT NULL REFERENCES public.ai_conversation_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  replica_id TEXT NOT NULL DEFAULT 'primary',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_session_events_conv
  ON public.ai_session_events(conversation_session_id, created_at DESC);

-- ============================================================================
-- 5. AI SESSION USAGE TELEMETRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_session_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_session_id UUID NOT NULL REFERENCES public.ai_conversation_sessions(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('text', 'audio_live', 'audio_tts', 'audio_stt', 'embedding')),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  audio_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (audio_seconds >= 0),
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_session_usage_conv
  ON public.ai_session_usage(conversation_session_id, created_at DESC);

-- ============================================================================
-- 6. AI SESSION CHECKPOINTS (Summarization & Cross-Replica Recovery)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_session_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_session_id UUID NOT NULL REFERENCES public.ai_conversation_sessions(id) ON DELETE CASCADE,
  checkpoint_sequence INTEGER NOT NULL CHECK (checkpoint_sequence >= 1),
  summary_text TEXT NOT NULL,
  extracted_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_session_id, checkpoint_sequence)
);

-- ============================================================================
-- 7. ATOMIC CONCURRENT MESSAGE APPEND RPC (Optimistic Lock + Deduplication)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.append_ai_conversation_message(
  p_session_id UUID,
  p_sender TEXT,
  p_channel TEXT,
  p_content TEXT,
  p_client_message_id TEXT DEFAULT NULL,
  p_expected_version INTEGER DEFAULT NULL,
  p_tool_name TEXT DEFAULT NULL,
  p_tool_call_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  message_id UUID,
  sequence_number INTEGER,
  session_version INTEGER,
  deduplicated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.ai_conversation_sessions%ROWTYPE;
  v_existing public.ai_conversation_messages%ROWTYPE;
  v_next_seq INTEGER;
  v_new_version INTEGER;
  v_msg_id UUID;
BEGIN
  SELECT * INTO v_session
  FROM public.ai_conversation_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI_SESSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status <> 'active' OR v_session.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'AI_SESSION_INACTIVE' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.expires_at < NOW() THEN
    UPDATE public.ai_conversation_sessions
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_session_id;
    RAISE EXCEPTION 'AI_SESSION_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  IF p_client_message_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.ai_conversation_messages
    WHERE session_id = p_session_id
      AND client_message_id = p_client_message_id;
    IF FOUND THEN
      RETURN QUERY SELECT v_existing.id, v_existing.sequence_number, v_session.version, true;
      RETURN;
    END IF;
  END IF;

  IF p_expected_version IS NOT NULL AND v_session.version <> p_expected_version THEN
    RAISE EXCEPTION 'AI_SESSION_VERSION_CONFLICT: expected %, actual %', p_expected_version, v_session.version
      USING ERRCODE = '40001';
  END IF;

  v_next_seq := v_session.message_count + 1;
  v_new_version := v_session.version + 1;

  INSERT INTO public.ai_conversation_messages (
    session_id,
    sequence_number,
    client_message_id,
    sender,
    channel,
    content,
    tool_name,
    tool_call_id,
    metadata,
    contains_raw_audio
  ) VALUES (
    p_session_id,
    v_next_seq,
    p_client_message_id,
    p_sender,
    p_channel,
    p_content,
    p_tool_name,
    p_tool_call_id,
    COALESCE(p_metadata, '{}'::jsonb),
    false
  )
  RETURNING id INTO v_msg_id;

  UPDATE public.ai_conversation_sessions
  SET
    message_count = v_next_seq,
    version = v_new_version,
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id;

  RETURN QUERY SELECT v_msg_id, v_next_seq, v_new_version, false;
END;
$$;

REVOKE ALL ON FUNCTION public.append_ai_conversation_message(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_ai_conversation_message(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB) TO service_role;

-- ============================================================================
-- 8. PRODUCTION VECTOR EMBEDDING STORAGE & METADATA (Phase 24)
-- ============================================================================

ALTER TABLE public.ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_mime_type TEXT NOT NULL DEFAULT 'text/plain',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_knowledge_chunks
  ADD COLUMN IF NOT EXISTS tenant_scope TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'company_policy',
  ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT 'gemini-embedding-2',
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER NOT NULL DEFAULT 768,
  ADD COLUMN IF NOT EXISTS embedding_provider TEXT NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS embedding_values DOUBLE PRECISION[],
  ADD COLUMN IF NOT EXISTS document_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_tenant_cat
  ON public.ai_knowledge_chunks(tenant_scope, category);

-- Conditionally enable pgvector column + HNSW index when pgvector extension is installed (e.g., Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_knowledge_chunks'
        AND column_name = 'embedding_vec'
    ) THEN
      ALTER TABLE public.ai_knowledge_chunks ADD COLUMN embedding_vec vector(768);
    END IF;
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_embedding_hnsw ON public.ai_knowledge_chunks USING hnsw (embedding_vec vector_cosine_ops)';
  END IF;
END $$;

-- ============================================================================
-- 9. STRICT RLS & LEAST-PRIVILEGE GRANTS FOR CONVERSATION TABLES
-- ============================================================================

ALTER TABLE public.ai_conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_session_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_session_checkpoints ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_conversation_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_conversation_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_voice_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_session_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_session_usage FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_session_checkpoints FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversation_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversation_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_voice_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_session_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_session_usage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_session_checkpoints TO service_role;

-- Authenticated customers may only view their own non-deleted conversation sessions & messages
GRANT SELECT ON public.ai_conversation_sessions TO authenticated;
GRANT SELECT ON public.ai_conversation_messages TO authenticated;

DROP POLICY IF EXISTS "Owner or admin access ai_conversation_sessions" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS ai_conv_sessions_owner_select ON public.ai_conversation_sessions;
CREATE POLICY ai_conv_sessions_owner_select
  ON public.ai_conversation_sessions
  FOR SELECT
  TO authenticated
  USING (
    owner_type = 'authenticated'
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS ai_conv_messages_owner_select ON public.ai_conversation_messages;
CREATE POLICY ai_conv_messages_owner_select
  ON public.ai_conversation_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversation_sessions s
      WHERE s.id = ai_conversation_messages.session_id
        AND s.owner_type = 'authenticated'
        AND s.user_id = auth.uid()
        AND s.deleted_at IS NULL
    )
  );

-- Enforce append-only on ai_session_events (cannot tamper with execution history)
DROP TRIGGER IF EXISTS trg_ai_session_events_append_only ON public.ai_session_events;
CREATE TRIGGER trg_ai_session_events_append_only
  BEFORE UPDATE OR DELETE ON public.ai_session_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

COMMIT;
