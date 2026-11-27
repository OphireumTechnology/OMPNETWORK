# OPHIREUM NETWORK (`OMPNETWORK`) — Enterprise AI Infrastructure Architecture

**Project**: OPHIREUM MULTIMEDIA PRODUCTION (DTI Reg. No. 7567003)  
**Scope**: Phases 21–24, 32, 36, 37 — Durable AI Memory, Native Realtime Voice, Production RAG & 25-Agent Workforce Orchestration

---

## 1. Architectural Pillars

1. **Durable Cross-Replica Conversation & Privacy-Aware Memory (`005` + `006`)**:
   - All chat and voice turns persist in PostgreSQL (`ai_conversation_sessions`, `ai_conversation_messages`, `ai_voice_sessions`, `ai_session_events`, `ai_session_usage`, `ai_session_checkpoints`, plus Migration `006` tables `ai_conversations`, `ai_conversation_participants`, `ai_conversation_summaries`, `ai_conversation_memory`, `ai_conversation_consents`, `ai_conversation_attachments`, `ai_conversation_retention_jobs`).
   - Atomic sequence allocation, client message deduplication (`client_message_id`), and optimistic concurrency control (`expected_version`, SQLSTATE `40001` -> HTTP `409`) are enforced inside PostgreSQL `SECURITY DEFINER` RPC `append_ai_conversation_message()`.
   - **Pre-Persistence Redaction**: `redactSensitiveText()` (`src/server/resilience.ts`) scrubs Luhn-verified payment card PANs, CVVs, JWTs, Bearer tokens, PEM private keys, API keys, and passwords before writing messages or memory records.
   - **Consent-Gated Memory & RA 10173 Portability**: `customer_consented` memory writes fail closed unless an active `conversation_memory` consent exists (`POST /api/consultant/session/:sessionId/consent`). Full session export is exposed via `GET /api/consultant/session/:sessionId/export` and authorized deletion via `DELETE /api/consultant/session/:sessionId`.
   - **Token-Budgeted Context Assembly**: `buildTokenBudgetedContext()` caps recent message windows by token budget and pairs them with durable summaries (`ai_conversation_summaries`) and consented memories.

2. **Native Realtime AI Voice Receptionist (`WS /api/voice/live`)**:
   - Browser audio capture runs via dedicated `AudioWorklet` (`/audio/pcm-capture-worklet.js`, 16kHz PCM) with barge-in interruption, mute/unmute, audio device selection, and WebSocket relay to server-side Gemini Live (`gemini-3.8-live`) — **zero permanent `GEMINI_API_KEY` exposure to the browser**.
   - Preserves WAV TTS (`gemini-3.8-flash-lite-tts`), STT (`gemini-3.5-transcribe`), and MediaRecorder/text fallback when WebSocket or Web Audio is unavailable.
   - **Zero Raw Audio Persistence**: Database `CHECK (raw_audio_persisted = false)` and `CHECK (contains_raw_audio = false)` enforce at PostgreSQL schema level that raw microphone audio blobs are never stored.

3. **Production RAG & Knowledge Quarantine (`src/server/ai/knowledgeService.ts`)**:
   - Configured for `gemini-embedding-2` (768 dimensions) and conditional Supabase `pgvector` HNSW indexing (`vector(768)`).
   - **Explicit `RetrievalMode` Taxonomy**: Every search diagnostic reports `LIVE_SEMANTIC_RETRIEVAL`, `DEGRADED_KEYWORD_RETRIEVAL`, `LOCAL_DEVELOPMENT_FALLBACK`, or `PROVIDER_UNAVAILABLE` — never misrepresenting local dev hash vectors as production semantic retrieval.
   - **Production Isolation Guard**: In `NODE_ENV=production`, local hash embeddings are strictly prohibited (`EmbeddingProviderUnavailableError`, HTTP `503`) and never contaminate production `pgvector` indexes.
   - **Automatic Sensitive-Info Quarantine**: Ingestion scans for payment cards, private keys, and credentials; high-risk leaks are automatically quarantined (`quarantined = true`, `status = 'archived'`) and excluded from retrieval. Administrators may also manually quarantine via `POST /api/ai/knowledge/documents/:id/quarantine`.
   - **Prompt Injection Defense**: Retrieved chunks are isolated inside `<untrusted_knowledge_context>` boundaries via `frameUntrustedKnowledgeContext()` and filtered by tenant scope (`public`, `ophireum_internal`, `tenant:<id>`).

4. **25-Agent Enterprise AI Workforce (`A00`–`A24`) & Job Queue (`src/server/ai/workforceService.ts`)**:
   - Canonical execution state machine (`WorkforceExecutionState`): `QUEUED`, `RUNNING`, `WAITING_FOR_APPROVAL`, `APPROVED`, `SUCCEEDED`, `FAILED`, `RETRY_SCHEDULED`, `CANCELLED`, `BLOCKED_EXTERNAL_DEPENDENCY`, `DEGRADED_FALLBACK`.
   - Durable PostgreSQL job queue (`ai_workforce_job_queue`), atomic worker leasing RPC `claim_ai_workforce_job()` (`FOR UPDATE SKIP LOCKED`, `SET search_path = public, pg_temp`), exponential backoff retry scheduling, and dead-letter queue (`ai_workforce_dead_letters`) exposed via `GET/POST /api/ai/jobs` and `GET /api/ai/dashboard`.
   - High-risk agents (`A09`, `A10`, `A13`, `A19`, `A23`) and high-risk prompts enforce SHA-256 `actionHash` approval binding, expiry, cancel, and execute-once guards.

## 2. Live Staging Dependencies Required for 100% Live Acceptance
- Provision server-side `GEMINI_API_KEY` on Railway staging for live `gemini-4-hydrogen`, `gemini-3.8-live`, `gemini-3.8-flash-lite-tts`, `gemini-3.5-transcribe`, and `gemini-embedding-2` calls.
- Enable `pgvector` extension on isolated Supabase staging and run Migrations `000`–`006`.
- Execute live microphone/barge-in voice UAT in Chrome and Safari against staging.
