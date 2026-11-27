# OPHIREUM NETWORK — LIVE PROVIDER ACCEPTANCE MATRIX (PHASE 75)

**Honesty & Evidence Policy:** No external provider credential is provisioned inside this local workspace container. Every external provider requiring live credentials, live API traffic, or live webhook delivery is recorded honestly as **0% live-verified (`BLOCKED_MISSING_CREDENTIALS`)** while documenting verified source-code readiness and adapter coverage.

---

## 1. Provider-by-Provider Acceptance Matrix (All 12 Phase 75 Providers)

| # | Provider | Purpose | Source Adapter & Config Status | Live Sandbox / Staging Evidence | Live Acceptance % | Current Blocker |
|---|---|---|---|---|---|---|
| 1 | **Railway Deployment Platform** | Production & staging API hosting (`OMPNETWORK` / `brave-nature`) | `railway.json` migrated to Railpack (`npm run build:all`, `node dist/server/index.mjs`); `/bun.lock` removed | Not executed from local sandbox | **0%** | Requires Railway push/deploy from authorized repository & Railway project |
| 2 | **Railway PostgreSQL 16** | Primary durable database (`DATABASE_URL` + `pg`) | `PostgresPoolManager`, `PostgresDatabaseRepository`, `PostgresPortalRepository`, `PostgresAiConversationStore`, `scripts/run-migrations.mjs`, Migration `007` verified locally on PGlite PG16 + CI Docker PG16 job | Not executed against hosted Railway Postgres instance | **0%** | Requires live Railway PostgreSQL `DATABASE_URL` provisioning |
| 3 | **GitHub Pages (`ophireummultimedia.com`)** | Static frontend hosting | `vite build` passes cleanly; `portalApi.ts` structured error handling + CORS baseline union repaired | Not executed against live Pages DNS/CDN | **0%** | Requires authorized release branch deployment & DNS verification |
| 4 | **Gemini Text API (`gemini-4-hydrogen` / `gemini-4-neon`)** | AI chat & 25-agent workforce execution | `@google/genai ^3.6.1`, `providerGovernance.ts` cost/token/kill-switch, explicit origin classification (`LIVE_PROVIDER_RESPONSE` vs `DEVELOPMENT_SIMULATION` vs `PROVIDER_UNAVAILABLE`) | Not executed against live Google AI API | **0%** | Missing `GEMINI_API_KEY` |
| 5 | **Gemini Realtime Live Audio (`gemini-3.8-live`)** | Native bidirectional WebSocket AI voice receptionist | `src/server/ai/liveVoiceGateway.ts` + `src/components/LiveVoiceReceptionistModal.tsx` (`AudioWorklet` PCM16, barge-in, 12 business tools, WAV fallback) | Not executed against live Gemini Live WS | **0%** | Missing `GEMINI_API_KEY` + real browser/mic test |
| 6 | **Gemini Embeddings (`gemini-embedding-2`)** | Vector RAG indexing & retrieval | `src/server/ai/knowledgeService.ts` + `ai_knowledge_chunks` vector metadata | Not executed against live Gemini Embeddings API | **0%** | Missing `GEMINI_API_KEY` |
| 7 | **Resend Email (`ophireummultimedia.com`)** | Transactional verification, password reset, receipts, notifications | `src/server/emailService.ts` + `email_outbox` durability | Not executed against live Resend API | **0%** | Missing `RESEND_API_KEY` + verified domain DNS (SPF/DKIM/DMARC) |
| 8 | **Google Calendar API** | Consultation scheduling & free/busy conflict sync | `src/server/calendarService.ts` | Not executed against live Google Calendar | **0%** | Missing `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` |
| 9 | **Xendit Sandbox** | PH/SEA invoice & e-wallet checkout + signed webhook | `src/server/portal/payments/paymentAdapters.ts` (`X-CALLBACK-TOKEN` raw-body verification, `live_payments_enabled = false`) | Not executed against live Xendit Sandbox | **0%** | Missing `XENDIT_SECRET_KEY_TEST` & `XENDIT_WEBHOOK_TOKEN` |
| 10 | **PayPal Sandbox** | International card/wallet checkout + webhook | `paymentAdapters.ts` (supports both `PAYPAL_CLIENT_ID_SANDBOX` & `PAYPAL_CLIENT_ID_TEST`) | Not executed against live PayPal Sandbox | **0%** | Missing `PAYPAL_CLIENT_ID_SANDBOX`, `PAYPAL_CLIENT_SECRET_SANDBOX`, `PAYPAL_WEBHOOK_ID` |
| 11 | **Maya Sandbox** | Philippine Maya checkout + webhook | `paymentAdapters.ts` (supports both `MAYA_*_SANDBOX` & `MAYA_*_TEST`) | Not executed against live Maya Sandbox | **0%** | Missing `MAYA_PUBLIC_KEY_SANDBOX`, `MAYA_SECRET_KEY_SANDBOX`, `MAYA_WEBHOOK_SECRET` |
| 12 | **PayMongo & GoTyme** | Deferred merchant payment gateways | Explicitly locked as `deferred_merchant_onboarding`; blocked from live checkout | N/A — intentionally deferred | **0% (Deferred)** | Merchant onboarding pending business approval |

---

## 2. Aggregate External Provider Acceptance Calculation

- **Verified Live External Providers:** `0 / 12` (or `0 / 11` excluding intentionally deferred PayMongo/GoTyme)
- **Live Provider Acceptance Score:** **0.0%**
- **Live Payments Safety Lock:** `LIVE_PAYMENTS_ENABLED=false` (verified across SQL defaults, `configValidator.ts`, and `paymentAdapters.ts`).
