# 04 — Backend API Audit

**Server Architecture:** Express 4.21.2 running on Node 22 via `tsx server.ts` (`server.ts` + `src/server/app.ts`, 1,316 lines).  
**Live Production Gateway:** `https://api.ophireummultimedia.com` (Railway `hkg1`).

---

## 1. Complete Express API Endpoint Inventory (`main`)

| Method | Path | Auth Required | Rate Limiter | Input Validation | DB Persistence | Idempotency | Audit Log | Notes / Issues |
|---|---|---|---|---|---|---|---|---|
| `GET` | `/api/health` | Public | None | None | Read ping (`solution_requests`) | N/A | No | **Issue:** Always returns HTTP `200` even when `dbPing.ok === false` (`status: 'degraded_unconfigured'`). |
| `POST` | `/api/admin/auth/login` | Public (Bootstrap password) | `10 / 15m` | Email + non-empty password | Lookup `admin_users` (env fallback) | No | Yes (`admin_login`) | **Issues:** Spoofable IP rate limit; works with ephemeral `ADMIN_SESSION_SECRET`; falls back to `super_admin` if DB unconfigured. |
| `GET` | `/api/admin/auth/me` | Admin Bearer | None | None | Lookup `admin_users` | N/A | No | Returns active admin profile. No `/api/admin/auth/logout` endpoint exists. |
| `GET` | `/api/inquiries` | Admin Bearer | None | Pagination (`limit<=100`, `offset>=0`) | Read `solution_requests` | N/A | No | **Duplicate legacy alias** of `/api/admin/solution-requests` returning `{ inquiries }` instead of `{ records }`. |
| `GET` | `/api/admin/solution-requests` | Admin Bearer | None | Pagination | Read `solution_requests` | N/A | No | Read-only (no `PATCH` status update endpoint exists!). |
| `GET` | `/api/admin/appointments` | Admin Bearer | None | Pagination | Read `consultation_appointments` | N/A | No | Read-only (no admin confirm/cancel/reschedule endpoint exists!). |
| `GET` | `/api/admin/notifications` | Admin Bearer | None | Pagination | Read `notification_records` | N/A | No | Read-only (no manual retry trigger endpoint). |
| `GET` | `/api/admin/audit-logs` | Admin Bearer | None | Pagination | Read `audit_logs` | N/A | No | Read-only; no actor/event filtering. |
| `POST` | `/api/inquiries` | Public | `15 / 15m` | `validateSolutionRequestPayload` + server catalog pricing | Write `solution_requests` + `notification_records` + `audit_logs` | Yes (Header `Idempotency-Key` or body) | Yes | Well-structured server-authoritative pricing; fails closed `503` on DB failure. |
| `GET` | `/api/appointments/availability` | Public | None | `YYYY-MM-DD` regex | Read `consultation_appointments` + Google Calendar `freeBusy` | N/A | No | Verified live (`HTTP 200`). Unauthenticated; no rate limit (could amplify Google Calendar API calls once configured). |
| `POST` | `/api/appointments` | Public | `15 / 15m` | `validateAppointmentPayload` (future weekday check) | Write `consultation_appointments` + `notification_records` + `audit_logs` | Body only (**ignores `Idempotency-Key` header**) | Yes | **Issue:** Calls Google Calendar `createConsultationEvent` **BEFORE** DB insert (orphaned calendar events on 409 conflict / DB error / dedupe!). |
| `PATCH` | `/api/appointments/:referenceCode` | Management Token (`manageToken`) | **NONE** | `validateAppointmentActionPayload` | Update `consultation_appointments` | No | **NO** | **Issues:** Missing rate limit; 404 before auth check (enumeration); `===` hash comparison (not constant-time); `reschedule` skips past/weekend validation; never updates/deletes Google Calendar event; sends no email notification; writes no audit log. |
| `POST` | `/api/consultant/chat` | **Public (Unauthenticated)** | `40 / 15m` | `validateConsultantChatPayload` | None | No | No | **Issues:** Unauthenticated Gemini quota exposure (amplified by spoofable `X-Forwarded-For`); hardcoded non-standard model ID `gemini-4-hydrogen`. |
| `POST` | `/api/voice/session` | **Public (Unauthenticated)** | `40 / 15m` | `language` enum | None | No | No | Returns static session config + greeting; no real session persistence. |
| `POST` | `/api/voice/process` | **Public (Unauthenticated)** | `40 / 15m` | `validateVoiceProcessPayload` | None | No | No | Hardcoded model IDs `gemini-4-hydrogen` (text) & `gemini-3.8-flash-lite-tts` (TTS). |
| `POST` | `/api/voice/transcribe` | **Public (Unauthenticated)** | `40 / 15m` | `validateVoiceTranscribePayload` (`10mb` JSON limit!) | None | No | No | **Issue:** `10mb` body parser limit on an unauthenticated endpoint (`app.ts:1194`) enables memory pressure / Gemini quota abuse; hardcoded model ID `gemini-3.5-transcribe`. |

---

## 2. Backend API Findings

### Finding `AUD-API-001`
- **Severity:** `P1`
- **Location:** `src/server/app.ts:834–898` (`PATCH /api/appointments/:referenceCode`) and `src/server/validation.ts:192–211`
- **Evidence (Code-Level Observation):**
  1. Zero rate limiting on the endpoint.
  2. Returns `404` if `referenceCode` does not exist *before* checking `manageToken` (`lines 840–842`), enabling reference-code existence enumeration.
  3. Compares SHA-256 token hash via standard `!==` (`line 851`) instead of `crypto.timingSafeEqual`.
  4. `reschedule` validates only regex date format (`YYYY-MM-DD`) and slot allowlist—it does **not** reject past dates or weekends (unlike `POST /api/appointments`).
  5. `reschedule` and `cancel` never update or delete the linked Google Calendar event (`calendarEventId`), send no confirmation/admin email, and record no `audit_logs` entry.
- **Business Impact:** Customers can reschedule appointments into the past or weekends; cancelled meetings remain on executive calendars; missing audit trail.
- **Technical Impact:** Timing side-channel, reference enumeration, calendar state divergence.
- **Recommended Correction:** Add rate limiter, return uniform `401/403` on missing/invalid token, use `crypto.timingSafeEqual` on equal-length digests, share future-weekday validator with `POST`, implement `updateConsultationEvent`/`deleteConsultationEvent` in `calendarService.ts`, queue notifications, and log to `audit_logs`.
- **Required Test:** Unit/integration tests for past-date reschedule rejection, weekend rejection, timing-safe invalid token handling, calendar update/cancel invocation, and audit log insertion.
- **Dependencies:** `calendarService.ts` update/delete methods.
- **Current Status:** Open.

### Finding `AUD-API-002`
- **Severity:** `P1`
- **Location:** `src/server/app.ts:726–786` (`POST /api/appointments`)
- **Evidence (Code-Level Observation):**
  - `calendarService.createConsultationEvent(...)` is invoked at `line 728` **prior to** `db.createAppointment(...)` at `line 744`.
  - If two bookings race for the same slot, the second request creates a real Google Calendar event and then fails with `409 ConflictError` on `uq_active_consultation_slot`, leaving an orphaned Google Calendar invite with no rollback.
  - Also, `POST /api/appointments` reads `req.body.idempotencyKey` (`line 710`) but ignores the HTTP `Idempotency-Key` header (inconsistent with `POST /api/inquiries:578`).
- **Business Impact:** Executive calendar receives phantom/duplicate Google Meet events for rejected or failed bookings.
- **Technical Impact:** Non-transactional external side effect before DB commit.
- **Recommended Correction:** Commit the `consultation_appointments` row FIRST (with `calendar_sync_status = 'pending'`), then call `calendarService.createConsultationEvent()` and update the appointment row with `calendarEventId`, `meetingLink`, and `calendarSyncStatus = 'synced'` (or `'failed'` with retryable outbox). Read both `Idempotency-Key` header and body.
- **Required Test:** Simulated `ConflictError` / DB failure test confirming `calendarService.createConsultationEvent` is never invoked when DB insert fails.
- **Dependencies:** None.
- **Current Status:** Open.

### Finding `AUD-API-003`
- **Severity:** `P1`
- **Location:** `src/server/app.ts:242–307` (`GET /api/health`) and `railway.json:8`
- **Evidence (Code-Level Observation):** `GET /api/health` returns `res.status(200).json({ status: dbPing.ok ? 'healthy' : 'degraded_unconfigured', ... })` unconditionally.
- **Business Impact:** Railway deployment healthchecks (`railway.json:8`) promote broken/unconfigured deployments into production and never trigger automatic restarts or rollbacks on DB outage.
- **Technical Impact:** False-positive liveness/readiness signal.
- **Recommended Correction:** Split `/api/health/live` (process liveness `200`) and `/api/health/ready` (returns `503` when DB is down/unconfigured), or return `503` from `/api/health` in production when `dbPing.ok === false`. Also sanitize `/api/health` in production so internal architecture counts/config booleans are not needlessly exposed (or keep minimal `{ status, version }`).
- **Required Test:** Integration test asserting `/api/health` (or `/api/health/ready`) returns `503` when DB ping fails.
- **Dependencies:** Update `railway.json` `healthcheckPath` if split.
- **Current Status:** Open.

### Finding `AUD-API-004`
- **Severity:** `P2`
- **Location:** `src/server/app.ts:970, 1086, 1087, 1141, 1236` (Gemini model identifiers)
- **Evidence (Code-Level Observation):** Server AI routes hardcode model strings `gemini-4-hydrogen`, `gemini-3.8-flash-lite-tts`, and `gemini-3.5-transcribe`. Live runtime Gemini calls were not triggered during this read-only audit (to avoid mutating quota or invoking unverified endpoints).
- **Business Impact:** If those model aliases are invalid or deprecated on the Google GenAI endpoint configured in Railway, all AI Consultant and Voice API requests silently degrade to fallback responses or fail at runtime.
- **Technical Impact:** Unverified external API model IDs hardcoded without environment variable overrides (`GEMINI_TEXT_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_TRANSCRIBE_MODEL`).
- **Recommended Correction:** Externalize model IDs to validated server environment variables with supported `@google/genai` defaults (e.g., `gemini-2.5-flash` or current GA aliases) and add a controlled staging smoke test.
- **Required Test:** Staging smoke test against live Gemini API key verifying `200` non-fallback response for chat, TTS, and transcription.
- **Dependencies:** Validated `GEMINI_API_KEY` in staging/production.
- **Current Status:** Open (Unverified External Configuration).

### Finding `AUD-API-005`
- **Severity:** `P2`
- **Location:** `src/server/app.ts` (entire file, 1,316 lines) and `src/server/services/emailService.ts:97, 240, 297`
- **Evidence (Code-Level Observation):**
  - All routes, rate limiters, AI logic, and middleware reside in a single 1,316-line file (`app.ts`), which will become unmaintainable when adding customer auth, catalog, cart, checkout, 5 payment webhooks, invoices, fulfillment, and admin mutation routes.
  - `emailService.ts:97` defaults `ADMIN_NOTIFICATION_EMAIL` to personal Gmail `'ophireum.multimedia@gmail.com'` instead of corporate domain email (`contact@ophireummultimedia.com`).
  - `emailService.ts:240, 297` renders `estimatedOneTimeStartingUsd` even for `subscription_monthly` services (showing `$0` one-time without prominently displaying monthly recurring total).
  - `GET /api/inquiries` duplicates `GET /api/admin/solution-requests`.
- **Business Impact:** Monthly subscription customers receive confusing `$0` estimate confirmation emails; admin alerts misroute if env var is omitted.
- **Technical Impact:** High coupling and maintenance risk for commerce expansion.
- **Recommended Correction:** Modularize `src/server/routes/*` (`health`, `admin`, `inquiries`, `appointments`, `ai`, `customer`, `commerce`, `webhooks`), fix email template recurring price formatting, remove personal Gmail fallback, and deprecate duplicate `GET /api/inquiries`.
- **Required Test:** Email template unit tests covering one-time, monthly, and setup+monthly pricing models.
- **Dependencies:** Phase 1 refactoring.
- **Current Status:** Open.
