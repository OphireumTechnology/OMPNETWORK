# OPHIREUM NETWORK (`OMPNETWORK`) — Multi-Replica & Horizontal Scaling Acceptance Report

**Scope**: Phases 21, 31, 32, 33, 37, 43  
**Target Deployment Topology**: Railway Horizontal Backend Replicas (`>= 2` instances of `node dist/server/index.mjs`) backed by Supabase PostgreSQL

---

## 1. Multi-Replica State Consistency Architecture

| Subsystem | Cross-Replica Persistence Mechanism | Verified Behavior |
|---|---|---|
| **AI Conversation History & Memory** | PostgreSQL tables (`005` + `006`) + `append_ai_conversation_message()` `SECURITY DEFINER` RPC with `expected_version` optimistic locking (`SQLSTATE 40001` -> HTTP `409`) and `client_message_id` deduplication | Verified locally via shared backing across two independent Express instances (`tests/ai-conversation-live-voice.test.ts`) and in real PostgreSQL 16 (`tests/postgres-migrations.test.ts`) |
| **Admin Session Revocation** | PostgreSQL `revoked_session_tokens` table (`004`) synced via `AdminAuthService.revokeSessionTokenAsync()` | Verified in `tests/security-negative.test.ts` (logout on Replica A immediately invalidates bearer/cookie token on Replica B) |
| **Distributed Rate Limiting** | PostgreSQL `distributed_rate_limit_buckets` + `check_and_increment_rate_limit()` atomic RPC (`004`) | Verified atomically in real PostgreSQL 16 (`tests/postgres-migrations.test.ts`) |
| **Payment Reference Sequencing** | PostgreSQL `payment_reference_sequences` + `allocate_ophireum_payment_ref()` (`003`/`004`) | Verified under 100-concurrent requests (`tests/enterprise-remediation.test.ts`) and PostgreSQL 16 rollover/rollback/`>999` exhaustion (`tests/postgres-migrations.test.ts`) |
| **AI Workforce Job Queue** | PostgreSQL `ai_workforce_job_queue` + `claim_ai_workforce_job()` using `FOR UPDATE SKIP LOCKED` + lease expiration (`006`) | Verified atomic single-worker lease claiming and rejection of second concurrent worker in real PostgreSQL 16 (`tests/postgres-migrations.test.ts`) |
| **Graceful Draining & Backpressure** | `createRuntimeLifecycleState(400)` (`src/server/resilience.ts`) + `SIGTERM`/`SIGINT` handlers in `server.ts` | Verified `/api/ready` returns `503 not_ready` during drain and `dist/server/index.mjs` exits cleanly with code `0` (`scripts/prod-smoke-check.mjs`, `tests/enterprise-phases31-46.test.ts`) |
| **Fail-Closed Production Boot** | Refuses startup with non-zero exit when `NODE_ENV=production` lacks `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Verified against compiled `dist/server/index.mjs` in `scripts/prod-smoke-check.mjs` |

## 2. Live Staging Multi-Replica Verification Required
- Deploy **2 Railway staging replicas** running `node dist/server/index.mjs` against an isolated Supabase staging PostgreSQL instance (`000`–`006` applied).
- Execute live cross-replica smoke tests:
  1. Start AI chat/voice session on Replica 1 -> resume on Replica 2 -> restart Replica 1 -> verify zero message loss.
  2. Login as Admin -> logout on Replica 1 -> confirm HTTP `401` on Replica 2.
  3. Trigger `GET /api/admin/payments/maker-checker` and concurrent `/api/ai/jobs` worker claims across both replicas.
  4. Rolling-restart Replica 1 while sending traffic -> verify zero dropped 5xx requests during `SIGTERM` drain.
