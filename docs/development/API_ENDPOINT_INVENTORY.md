# OPHIREUM NETWORK (`OMPNETWORK`) — Complete API Endpoint Inventory

**Base URL (Production Target)**: `https://api.ophireummultimedia.com`  
**Security Baseline**: `X-Request-Id` correlation, CORS allowlist, distributed rate limiting, `HttpOnly` admin cookies + CSRF header protection, strict `rawBody` webhook verification, and fail-closed production mode.

---

## 1. Platform Health, Readiness & Observability
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | Public | Structured runtime health (`healthy \| degraded`), component status, and circuit breaker snapshots (zero secrets) |
| `GET` | `/api/ready` | Public | Kubernetes/Railway readiness probe (`200 ready` / `503 not_ready` when draining or storage unready) |
| `GET` | `/api/version` | Public | Application name (`ophireum-network`), version (`1.0.0-rc.1`), commit SHA, Node version, runtime mode |

## 2. Public Catalog, Inquiries, Consultations & Legal
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/catalog` | Public | Authoritative 78-service, 10-division catalog |
| `POST` | `/api/inquiries` | Public (rate-limited) | Validated solution inquiry intake + deduplication + email outbox |
| `GET` | `/api/appointments/availability` | Public | Real DB-backed consultation slot availability |
| `POST` | `/api/appointments` | Public (rate-limited) | DB-first consultation booking + optional Google Calendar sync |
| `PATCH` | `/api/appointments/:ref` | Management Token (constant-time) | Weekday/non-past appointment reschedule + Calendar sync |
| `DELETE` | `/api/appointments/:ref` | Management Token (constant-time) | Appointment cancellation + Calendar sync |
| `GET` | `/api/legal/policies` | Public | 10 versioned PH legal/privacy policies (`pending_legal_review` disclosure preserved) |
| `POST` | `/api/legal/consents` | Public / Customer | Versioned legal policy acceptance recorder |
| `POST` | `/api/legal/privacy-requests` | Public / Customer | RA 10173 Data Subject Request (DSR) & complaint intake |

## 3. AI Consultant, Persistent Memory & Realtime Voice
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/consultant/chat` | Public / Customer Bearer / `X-AI-Session-Token` | Persistent multi-turn AI consultation with auto-redaction & catalog grounding |
| `GET` | `/api/consultant/session/:sessionId` | Session Owner / Admin | Resume durable conversation history across replicas |
| `DELETE` | `/api/consultant/session/:sessionId` | Session Owner / Admin | Authorized conversation deletion |
| `POST` | `/api/consultant/session/:sessionId/checkpoint` | Session Owner / Admin | Create durable summary checkpoint |
| `POST` | `/api/consultant/session/:sessionId/consent` | Session Owner / Admin | Record or withdraw `conversation_memory`, `voice_transcription`, or `data_retention` consent |
| `GET` | `/api/consultant/session/:sessionId/export` | Session Owner / Admin | RA 10173 data portability export bundle (redacted messages, consents, memories, usage) |
| `POST` | `/api/consultant/tools/execute` | Session Owner / Customer | Confirmation-gated execution of 12 authorized receptionist business tools |
| `WS` | `/api/voice/live` | Session Owner / Customer | Bidirectional Gemini Live (`gemini-3.8-live`) PCM streaming gateway with barge-in & zero raw audio storage |
| `POST` | `/api/voice/session` | Public / Customer | Initialize voice consultation session |
| `POST` | `/api/voice/process` | Session Owner | Voice turn processing fallback |
| `POST` | `/api/voice/transcribe` | Session Owner | Server-side STT (`gemini-3.5-transcribe`) fallback |
| `POST` | `/api/voice/speak` | Session Owner | Server-side WAV TTS (`gemini-3.8-flash-lite-tts`) fallback |

## 4. Client Portal Commerce, Fulfillment & Account Security (`/api/portal/*`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/portal/auth/register`, `/login`, `/logout`, `/me` | Public / Customer Bearer | Customer lifecycle, password hashing, session validation, suspension enforcement |
| `POST` | `/api/portal/security/mfa/enroll`, `/confirm`, `/disable` | Customer Bearer | Optional RFC 6238 TOTP MFA enrollment & management |
| `GET` | `/api/portal/catalog`, `/offers` | Public / Customer | Server-authoritative store catalog & active promotions |
| `GET/POST/PATCH/DELETE` | `/api/portal/cart*` | Customer Bearer | Persistent shopping cart & promo code validation |
| `POST` | `/api/portal/checkout` | Customer Bearer | Server-authoritative order, invoice & payment initiation (sandbox/disabled) |
| `GET` | `/api/portal/orders*`, `/invoices*`, `/payments*`, `/subscriptions*` | Customer Bearer | Owner-isolated orders, invoices, payments, receipts, subscriptions |
| `GET/POST` | `/api/portal/projects*`, `/files*`, `/tickets*`, `/notifications*` | Customer Bearer | Production milestones, private uploads, support tickets, alerts |
| `GET/POST` | `/api/portal/organization*`, `/downloads*`, `/privacy/*` | Customer Bearer | Organization accounts, signed digital downloads, DSR privacy export |
| `POST` | `/api/portal/webhooks/:provider` | Provider Cryptographic Signature (`rawBody` required) | Strict `rawBody` + timestamp replay + idempotent payment webhook ingestion |
| `POST` | `/api/webhooks/resend` | Svix v1 Signature (`rawBody` required) | Resend email delivery/bounce webhook updates |

## 5. Admin Command Center & Financial Governance (`/api/admin/*`)
| Method | Path | Auth / Permission | Purpose |
|---|---|---|---|
| `POST` | `/api/admin/auth/login`, `/logout`, `/mfa/enroll`, `/mfa/confirm`, `/mfa/rotate-key` | Admin + MFA + RBAC | Admin authentication, session fixation rotation, `enc:v2:<kid>` MFA key rotation |
| `GET` | `/api/admin/system/readiness`, `/rbac/roles`, `/integrations/health`, `/audit-logs` | `security.read` / `dashboard.read` | Staging readiness validator, 9-role RBAC matrix, immutable audit viewer |
| `GET/PATCH/POST` | `/api/admin/solution-requests*`, `/customers*`, `/orders*`, `/projects*`, `/tickets*`, `/promotions*`, `/subscriptions*` | Granular RBAC Permissions | Full enterprise CRM, commerce, fulfillment, and customer suspension controls |
| `PATCH` | `/api/admin/refunds/:refundId/decide` | `payments.refund` + Maker-Checker | Refund adjudication with mandatory dual-control above `$500` / `₱25,000` |
| `GET/PATCH` | `/api/admin/payments/reconciliation*` | `payments.read` / `payments.refund` | Unmatched & amount-mismatch webhook reconciliation queue |
| `GET/POST` | `/api/admin/payments/maker-checker*` | `payments.read` / `payments.refund` | Dual-control approval queue (blocks self-approval HTTP `403`) |
| `GET/POST` | `/api/admin/payments/disputes*` | `payments.read` / `payments.refund` | Payment chargeback & dispute register |
| `GET` | `/api/admin/analytics/overview`, `/analytics/export.csv` | `analytics.read` | DB-driven BI metrics & CSV formula-injection-safe export |
| `GET/PUT` | `/api/admin/config` | `config.write` | System settings (`live_payments_enabled = true` hard-blocked `403`) |

## 6. 25-Agent Enterprise AI Workforce & Central Knowledge (`/api/ai/*`)
| Method | Path | Auth / Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/ai/agents/public`, `/knowledge/search/public` | Public | Read-only 25-agent overview & strictly `public`-scoped KB search |
| `POST` | `/api/ai/studio/blueprint` | Public (rate-limited) | Grounded enterprise solution blueprint generator |
| `GET` | `/api/ai/agents`, `/dashboard`, `/executions`, `/approvals` | `ai.read` | Full `A00`–`A24` registry, execution state metrics, DLQ counts, approval queue |
| `GET/POST` | `/api/ai/jobs` | `ai.read` / `ai.execute` | Durable workforce job queue & dead-letter visibility |
| `POST` | `/api/ai/agents/:code/execute` | `ai.execute` + Agent Role Allowlist | Execute agent (`202 pending_approval` for high-risk actions) |
| `POST` | `/api/ai/approvals/:id/decide`, `/cancel` | `ai.approve` | Action-hash-bound approval adjudication |
| `GET/POST/DELETE` | `/api/ai/knowledge/documents*`, `/upload`, `/:id/{approve,reindex,revoke,quarantine}`, `/search` | `ai.read` / `ai.knowledge.write` | Knowledge CRUD, auto/manual quarantine, explicit `RetrievalMode` diagnostics |
