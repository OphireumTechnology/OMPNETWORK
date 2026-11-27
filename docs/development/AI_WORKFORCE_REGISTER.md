# OPHIREUM NETWORK (`OMPNETWORK`) — Enterprise AI Workforce Register

**Implementation**: `src/server/ai/workforceService.ts`, `src/server/ai/knowledgeService.ts`, `src/server/ai/conversationService.ts`, `src/server/ai/liveVoiceGateway.ts`, `src/server/ai/receptionistTools.ts`, `src/server/routes/aiRoutes.ts`  
**Models**: `gemini-4-hydrogen` (reasoning), `gemini-3.8-live` (realtime bidirectional audio), `gemini-3.5-transcribe` (STT), `gemini-3.8-flash-lite-tts` (TTS), `gemini-embedding-2` (768-dim RAG embeddings)  
**Canonical Execution States (Phase 37)**: `QUEUED` | `RUNNING` | `WAITING_FOR_APPROVAL` | `APPROVED` | `SUCCEEDED` | `FAILED` | `RETRY_SCHEDULED` | `CANCELLED` | `BLOCKED_EXTERNAL_DEPENDENCY` | `DEGRADED_FALLBACK`

## Commissioned 25-Agent Registry (`A00`–`A24`)

| Code | Agent Name | Department | Risk Tier | Human Approval Gate |
|---|---|---|---|---|
| `A00` | Master AI Operations Orchestrator | Executive Operations | Medium | No |
| `A01` | AI Receptionist & Lead Intake Specialist | Front Desk & Intake | Low | No |
| `A02` | AI Sales Consultant & Quotation Specialist | Commercial & Sales | Low | No |
| `A03` | AI Appointment & Calendar Coordinator | Scheduling & Coordination | Low | No |
| `A04` | AI Client Onboarding Specialist | Client Success | Low | No |
| `A05` | AI Customer Support & Resolution Agent | Client Support | Low | No |
| `A06` | AI Project Management Officer | Project Delivery | Low | No |
| `A07` | AI Software Architecture & Engineering Assistant | Engineering | Medium | No |
| `A08` | AI QA & Testing Specialist | Quality Assurance | Low | No |
| `A09` | AI DevOps & Reliability Advisor | Infrastructure & SRE | **High** | **Yes (`202 pending_approval`)** |
| `A10` | AI Cybersecurity & Compliance Analyst | Security & Trust | **High** | **Yes (`202 pending_approval`)** |
| `A11` | AI Creative & Multimedia Production Assistant | Creative & Studio | Low | No |
| `A12` | AI UI/UX & Accessibility Reviewer | Product Design | Low | No |
| `A13` | AI Billing, Invoicing & Reconciliation Assistant | Finance & Billing | **High** | **Yes (`202 pending_approval`)** |
| `A14` | AI Subscription & Credit Lifecycle Specialist | Revenue Operations | Medium | No |
| `A15` | AI Digital Fulfillment & Licensing Specialist | Fulfillment | Low | No |
| `A16` | AI Business Intelligence & Executive Analytics Agent | Business Intelligence | Low | No |
| `A17` | AI Marketing & Growth Strategist | Marketing | Low | No |
| `A18` | AI Proposal & RFP Writer | Enterprise Sales | Low | No |
| `A19` | AI Legal & Privacy Compliance Drafter | Legal & Compliance | **High** | **Yes (`202 pending_approval`)** |
| `A20` | AI Blockchain & Web3 Feasibility Analyst | Blockchain Division | Medium | No |
| `A21` | AI Emerging Tech & IoT/Spatial Feasibility Analyst | Emerging Tech Division | Medium | No |
| `A22` | AI Communications & Email Quality Specialist | Communications | Low | No |
| `A23` | AI Executive Risk & Audit Reviewer | Internal Audit | **High** | **Yes (`202 pending_approval`)** |
| `A24` | AI Knowledge Curator & RAG Librarian | Knowledge Management | Low | No |

## Phase 32, 36 & 37 Governance Controls
- **Job Queue & Dead-Letter Queue**: Durable PostgreSQL `ai_workforce_job_queue` + `ai_workforce_dead_letters` + atomic `claim_ai_workforce_job()` (`FOR UPDATE SKIP LOCKED`), exposed via `GET/POST /api/ai/jobs` and `GET /api/ai/dashboard`.
- **Approval Integrity**: High-risk agents (`A09`, `A10`, `A13`, `A19`, `A23`) and high-risk prompts halt in `WAITING_FOR_APPROVAL` (`202 pending_approval`) with SHA-256 `actionHash` binding, expiration, cancellation, and execute-once guards.
- **Knowledge Quarantine & Explicit `RetrievalMode`**: Automatic sensitive-data scanning quarantines documents containing payment cards, private keys, or secrets (`status = 'quarantined'`, excluded from retrieval); manual quarantine via `POST /api/ai/knowledge/documents/:id/quarantine`; explicit `RetrievalMode` diagnostics (`LIVE_SEMANTIC_RETRIEVAL`, `DEGRADED_KEYWORD_RETRIEVAL`, `LOCAL_DEVELOPMENT_FALLBACK`, `PROVIDER_UNAVAILABLE`).
- **Conversation Privacy**: Pre-persistence secret redaction, consent-gated `customer_consented` memory (`POST /api/consultant/session/:id/consent`), RA 10173 portability export (`GET /api/consultant/session/:id/export`), and DB-enforced zero raw audio storage.
