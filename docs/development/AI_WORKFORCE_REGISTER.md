# OPHIREUM NETWORK (`OMPNETWORK`) — Enterprise AI Workforce Register

**Implementation**: `src/server/ai/workforceService.ts`, `src/server/ai/knowledgeService.ts`, `src/server/routes/aiRoutes.ts`  
**Primary Model**: `gemini-4-hydrogen` (server-side `@google/genai` SDK with `User-Agent: aistudio-build` and grounded deterministic fallback when `GEMINI_API_KEY` is unconfigured)  
**Voice / Embeddings**: `gemini-3.5-transcribe` (STT), `gemini-3.8-flash-lite-tts` (TTS), `gemini-embedding-2` (Knowledge Base embeddings with TF-IDF hybrid fallback)

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

## Governance Controls
- Role-based allowlists prevent unauthorized admin roles from executing privileged agents.
- High-risk agents (`A09`, `A10`, `A13`, `A19`, `A23`) — plus any prompt containing high-risk financial/security/production keywords — automatically halt in `pending_approval` (HTTP `202`) until an authorized approver executes `POST /api/ai/approvals/:executionId/decide`.
- All executions and approval decisions write immutable entries to `audit_logs`.
- Central Knowledge retrieval enforces tenant boundaries (`public`, `internal_admin`, `tenant_private`) and wraps snippets inside `<untrusted_knowledge_context>` tags.
