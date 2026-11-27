# OPHIREUM NETWORK — DATABASE REPOSITORY PARITY MATRIX (PHASE 52)

**Objective:** Verify 100% method-level parity between legacy/Supabase repository interfaces and the new **Native Railway PostgreSQL (`pg`)** repository implementations, ensuring zero silent fallback to in-memory or local JSON storage in production.

---

## 1. Core Database Repository (`DatabaseRepository`)

**Interface:** `src/server/db/repository.ts`  
**Native PostgreSQL Implementation:** `src/server/db/postgresRepository.ts` (`PostgresDatabaseRepository`)

| Domain / Method | SQL Backing Table(s) | Parameterized | Native PG Parity |
|---|---|---|---|
| `createSolutionRequest` / `findSolutionRequestByIdempotencyKey` / `listSolutionRequests` / `updateSolutionRequest` | `public.solution_requests` | Yes (`$1..$N`) | 100% |
| `createAppointment` / `listAppointments` / `updateAppointment` / `hasConflictingAppointment` | `public.consultation_appointments` | Yes | 100% (unique slot conflict -> 409) |
| `enqueueEmailOutbox` / `listEmailOutbox` / `markEmailOutboxSent` / `markEmailOutboxFailed` | `public.email_outbox` | Yes | 100% |
| `recordAuditLog` / `listAuditLogs` | `public.audit_logs` (append-only trigger) | Yes | 100% |
| `findAdminByEmail` / `listAdmins` / `upsertAdmin` | `public.admin_users` | Yes | 100% |
| `createAdminSession` / `findAdminSessionByTokenHash` / `revokeAdminSession` / `revokeAllAdminSessions` | `public.admin_sessions` | Yes | 100% |
| `getSettings` / `updateSettings` | `public.platform_settings` | Yes | 100% |
| `healthCheck` | `SELECT 1` via `PostgresPoolManager.ping()` | Yes | 100% |

---

## 2. Client Portal & Admin Repository (`PortalRepository`)

**Interface:** `src/server/portal/types.ts`  
**Native PostgreSQL Implementation:** `src/server/portal/postgresPortalRepository.ts` (`PostgresPortalRepository`)

| Domain | Implemented Methods | PostgreSQL Tables Used | Native PG Parity |
|---|---|---|---|
| Authentication & Sessions | `registerUser`, `findUserByEmail`, `findUserById`, `verifyEmail`, `createPasswordResetToken`, `consumePasswordResetToken`, `updateUserPassword`, `createSession`, `getSessionByTokenHash`, `revokeSession`, `revokeAllUserSessions`, `recordLoginAttempt` | `auth.users`, `portal_auth_users`, `portal_auth_sessions`, `profiles` | 100% |
| Profiles, Orgs & Addresses | `getProfile`, `updateProfile`, `listOrganizations`, `upsertOrganization`, `listAddresses`, `upsertAddress`, `deleteAddress` | `profiles`, `organizations`, `billing_addresses`, `portal_domain_records` | 100% |
| Service Catalog & Discounts | `listCatalog`, `getCatalogItem`, `upsertCatalogItem`, `validateDiscountCode`, `upsertDiscountCode`, `listDiscountCodes` | `service_catalog_items`, `discount_codes`, `portal_domain_records` | 100% |
| Custom Inquiries & Carts | `createCustomInquiry`, `listCustomInquiries`, `getCart`, `addToCart`, `updateCartItem`, `removeCartItem`, `clearCart` | `portal_custom_inquiries`, `portal_carts` | 100% |
| Orders, Payments & Webhooks | `createOrderFromCart`, `listOrders`, `getOrderById`, `allocatePaymentReference`, `createPayment`, `getPaymentById`, `updatePaymentStatus`, `recordPaymentWebhookEvent`, `hasProcessedWebhookEvent`, `createRefund`, `listRefunds`, `listInvoices`, `createInvoice` | `orders`, `payments`, `payment_reference_sequences` (via `allocate_ophireum_payment_ref()`), `payment_webhook_events`, `refunds`, `invoices`, `portal_domain_records` | 100% |
| Digital Products, Credits & Subscriptions | `listEntitlements`, `grantEntitlement`, `recordDownload`, `getCreditBalance`, `listCreditLedger`, `addCreditEntry`, `listSubscriptions`, `createSubscription`, `updateSubscriptionStatus` | `digital_entitlements`, `client_credit_ledger`, `subscriptions`, `portal_domain_records` | 100% |
| Projects, Deliverables & Revisions | `listProjects`, `getProjectById`, `createProject`, `updateProjectStatus`, `addProjectMilestone`, `updateProjectMilestone`, `addProjectMessage`, `addProjectDeliverable`, `requestRevision` | `client_projects`, `project_milestones`, `project_messages`, `project_deliverables`, `portal_domain_records` | 100% |
| Attachments, Tickets, Notifications, Privacy | `createAttachment`, `listAttachments`, `createSupportTicket`, `listSupportTickets`, `replySupportTicket`, `updateSupportTicketStatus`, `listNotifications`, `createNotification`, `markNotificationRead`, `recordActivity`, `listActivities`, `recordConsent`, `listConsents`, `exportUserData` | `portal_attachments`, `support_tickets`, `notifications`, `portal_activity_logs`, `legal_policy_acceptances`, `portal_domain_records` | 100% |
| Admin Oversight | `adminListClients`, `adminListOrders`, `adminUpdateOrderStatus`, `adminListPayments`, `adminListInvoices`, `adminListProjects`, `adminListSubscriptions`, `adminListTickets`, `adminListInquiries`, `adminUpdateInquiryStatus`, `adminListRefunds`, `adminGetOverviewMetrics` | All above tables (role-gated via Express RBAC + RLS context) | 100% |

---

## 3. AI Conversation & Memory Store (`AiConversationStore`)

**Interface:** `src/server/ai/conversationService.ts`  
**Native PostgreSQL Implementation:** `src/server/ai/postgresConversationStore.ts` (`PostgresAiConversationStore`)

| Method | SQL Tables / RPCs Used | Guarantees Verified |
|---|---|---|
| `createOrResumeSession` / `getSessionById` / `getSessionByKey` / `listSessionsForUser` | `public.ai_conversation_sessions`, `public.ai_conversations` | Authenticated & anonymous SHA-256 token ownership, tenant scoping |
| `appendMessage` | `public.append_ai_conversation_message(...)` RPC | Atomic sequence numbering, idempotent `client_message_id` dedup, optimistic concurrency (`AI_SESSION_VERSION_CONFLICT`), secret redaction prior to insert |
| `listMessages` / `deleteSession` | `public.ai_conversation_messages`, `public.ai_conversation_sessions` | Soft-delete/authorized deletion, strict zero raw audio constraint |
| `openVoiceSession` / `closeVoiceSession` | `public.ai_voice_sessions` | `raw_audio_persisted = false` enforced by DB CHECK constraint |
| `recordEvent` / `recordUsage` / `saveCheckpoint` | `public.ai_session_events` (append-only), `public.ai_session_usage`, `public.ai_session_checkpoints` | Tamper-evident audit events, token/cost tracking |
| `recordConsent` / `getLatestConsent` / `saveMemorySummary` / `listMemorySummaries` / `exportSessionData` | `public.ai_conversation_consents`, `public.ai_conversation_memory` (FK -> `public.ai_conversations`) | Consent-gated memory retention, RA 10173 export parity |

---

## 4. Production Fail-Closed Guarantee

In `src/server/app.ts`, when `NODE_ENV=production`:
- If `DATABASE_URL` is configured (or `DATABASE_PROVIDER=postgres`), the server boots **100% on Native PostgreSQL** (`PostgresPoolManager`, `PostgresDatabaseRepository`, `PostgresPortalRepository`, `PostgresAiConversationStore`) with **zero Supabase dependency**.
- If neither `DATABASE_URL` nor `SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY` is configured, startup throws a fatal error (`FAIL-CLOSED`) and refuses to boot with in-memory stores.
