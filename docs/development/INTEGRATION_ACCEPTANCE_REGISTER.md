# OPHIREUM NETWORK (`OMPNETWORK`) — Integration Acceptance Register

All external third-party integrations are engineered with strict server-side boundaries, signature verification, and honest `unconfigured` / `disabled` states whenever credentials are absent. Zero live third-party calls were fabricated.

| Integration | Adapter / Route | Local Source Status | Staging Acceptance Status | Production Status | Required Credentials / Prerequisite |
|---|---|---|---|---|---|
| Supabase PostgreSQL & Auth | `supabaseRepository.ts`, `supabasePortalRepository.ts` | `COMPLETE_VERIFIED` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` + apply migrations `000`–`003` |
| Resend Transactional Email & Webhooks | `emailService.ts`, `POST /api/webhooks/resend` | `COMPLETE_VERIFIED` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, verified domain `EMAIL_FROM` |
| Google Calendar Consultation Sync | `calendarService.ts` (`create`, `update`, `cancel`) | `COMPLETE_VERIFIED` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID` |
| Google Gemini AI (`@google/genai`) | `aiRoutes.ts`, `workforceService.ts`, `knowledgeService.ts`, `app.ts` | `COMPLETE_VERIFIED` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | Server-side `GEMINI_API_KEY` |
| Xendit Sandbox Checkout & Webhook | `paymentAdapters.ts` | `COMPLETE_NEEDS_INTEGRATION_TEST` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | `XENDIT_SECRET_KEY_TEST`, `XENDIT_WEBHOOK_TOKEN_TEST` |
| PayPal Sandbox Checkout & Webhook | `paymentAdapters.ts` | `COMPLETE_NEEDS_INTEGRATION_TEST` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | `PAYPAL_CLIENT_ID_SANDBOX`, `PAYPAL_CLIENT_SECRET_SANDBOX`, `PAYPAL_WEBHOOK_SECRET_SANDBOX` |
| Maya Sandbox Checkout & Webhook | `paymentAdapters.ts` | `COMPLETE_NEEDS_INTEGRATION_TEST` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | `MAYA_PUBLIC_KEY_TEST`, `MAYA_SECRET_KEY_TEST`, `MAYA_WEBHOOK_SECRET_TEST` |
| Card Gateway (Visa/Mastercard) | `paymentAdapters.ts` | `COMPLETE_NEEDS_INTEGRATION_TEST` | `BLOCKED_EXTERNAL_DEPENDENCY` | `OWNER_APPROVAL_REQUIRED` | `CARD_GATEWAY_SECRET_KEY_TEST`, `CARD_GATEWAY_WEBHOOK_SECRET_TEST` |
| PayMongo & GoTyme Bank Direct | `paymentAdapters.ts` | `DEFERRED_BY_DESIGN` | `DEFERRED_BY_DESIGN` | `DEFERRED_BY_DESIGN` | Explicitly deferred per governance policy; remain disabled |
