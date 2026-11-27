import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { AdminAuthService, AuthenticatedAdminRequest } from '../auth';
import { DatabaseRepository } from '../db/types';
import { EnterpriseAiWorkforceService } from '../ai/workforceService';
import { CentralKnowledgeService, KnowledgeApprovalStatus, KnowledgeVisibility } from '../ai/knowledgeService';
import { SERVICE_CATALOG } from '../../data/serviceCatalog';
import { sanitizePlainText } from '../validation';

export function createAiRouter(deps: {
  authService: AdminAuthService;
  db: DatabaseRepository;
  workforceService: EnterpriseAiWorkforceService;
  knowledgeService: CentralKnowledgeService;
  aiClient: GoogleGenAI | null;
}): Router {
  const router = Router();

  // Public summary of the 25-agent Enterprise AI Workforce (safe metadata only — no internal prompts/tools)
  router.get('/agents/public', (_req: Request, res: Response) => {
    const agents = deps.workforceService.listAgents().map((a) => ({
      code: a.code,
      name: a.name,
      department: a.department,
      description: a.description,
      riskTier: a.riskTier,
      requiresHumanApproval: a.requiresHumanApproval,
      isActive: a.isActive,
    }));
    res.json({ success: true, total: agents.length, agents });
  });

  // Public / Client Architecture Blueprint Synthesizer (replaces mock setTimeout in EnterpriseModal)
  router.post('/studio/blueprint', async (req: Request & { correlationId?: string }, res: Response) => {
    const idea = sanitizePlainText(req.body?.idea, 1500);
    if (!idea || idea.length < 10) {
      res.status(400).json({
        success: false,
        error: 'Please describe your target system or project objective (minimum 10 characters).',
      });
      return;
    }

    const tokens = idea
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);
    const matchedServices = SERVICE_CATALOG.map((svc) => {
      const hay = `${svc.title} ${svc.shortDescription} ${svc.capabilities.join(' ')}`.toLowerCase();
      const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { svc, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.svc);

    const knowledgeHits = await deps.knowledgeService.search({
      query: idea,
      includeInternal: false,
      limit: 3,
    });

    if (deps.aiClient) {
      try {
        const knowledgeBlock = deps.knowledgeService.formatRetrievedKnowledgeForPrompt(knowledgeHits);
        const prompt = [
          `Generate a concise executive technical blueprint for this OPHIREUM client concept: "${idea}"`,
          matchedServices.length > 0
            ? `Matching catalog services:\n${matchedServices
                .map((s) => `- ${s.title} (Starting at $${s.pricing.startingUsd.toLocaleString('en-US')})`)
                .join('\n')}`
            : '',
          knowledgeBlock,
          'Return a crisp 4-section markdown blueprint: (1) Recommended Architecture Stack, (2) Matching OPHIREUM Divisions & Starting Investment Benchmarks, (3) Security & Compliance Guardrails, (4) Recommended Next Discovery Milestone. Never guarantee final pricing.',
        ]
          .filter(Boolean)
          .join('\n\n');

        const response: any = await Promise.race([
          deps.aiClient.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Blueprint timeout')), 10_000)),
        ]);

        const text = String(response?.text || '').trim();
        if (text) {
          res.json({
            success: true,
            provider: 'gemini-4-hydrogen',
            blueprint: text,
            matchedServices: matchedServices.map((s) => ({
              id: s.id,
              title: s.title,
              startingUsd: s.pricing.startingUsd,
            })),
            citations: knowledgeHits.map((k) => ({ title: k.title, version: k.version })),
          });
          return;
        }
      } catch {
        // Fall through to grounded deterministic blueprint
      }
    }

    const lines = [
      '### 1. Recommended Architecture Blueprint',
      '• Frontend: React + TypeScript SPA with strict CSP, responsive accessibility, and zero client-side secret exposure.',
      '• Backend & Persistence: Hardened Node/Express API gateway with PostgreSQL/Supabase Row Level Security (RLS), server-side validation, and immutable audit logging.',
      '• Security & Integrations: Server-side webhook signature verification, rate limiting, and explicit third-party provider boundaries.',
      '',
      '### 2. Matching OPHIREUM Catalog Solutions (Starting Estimates Only)',
      ...(matchedServices.length > 0
        ? matchedServices.map(
            (s) => `• ${s.title} — Starting at $${s.pricing.startingUsd.toLocaleString('en-US')} USD (${s.shortDescription})`
          )
        : ['• Custom Enterprise Software & Multi-Division Architecture — Scoped upon engineering discovery.']),
      '',
      '### 3. Compliance & Commercial Notice',
      '• Figures represent preliminary starting benchmarks only; external cloud hosting, third-party APIs, and gateway fees are itemized separately.',
      '',
      '### 4. Next Step',
      '• Submit a formal Solution Request or schedule an executive consultation with Founder & CEO Dhenze Languisan.',
    ];

    res.json({
      success: true,
      provider: 'ophireum-grounded-catalog-synthesizer',
      blueprint: lines.join('\n'),
      matchedServices: matchedServices.map((s) => ({
        id: s.id,
        title: s.title,
        startingUsd: s.pricing.startingUsd,
      })),
      citations: knowledgeHits.map((k) => ({ title: k.title, version: k.version })),
    });
  });

  // Human Escalation Intake (public/portal)
  router.post('/escalations', (req: Request, res: Response) => {
    const reason = sanitizePlainText(req.body?.reason, 1000);
    const userEmail = sanitizePlainText(req.body?.email, 180).toLowerCase() || undefined;
    const sessionId = sanitizePlainText(req.body?.sessionId, 120) || undefined;
    if (!reason) {
      res.status(400).json({ success: false, error: 'Escalation reason is required.' });
      return;
    }
    const escalation = deps.workforceService.createEscalation({
      source: req.body?.source === 'voice' ? 'voice' : 'consultant_chat',
      sessionId,
      userEmail,
      reason,
      priority: req.body?.priority === 'urgent' ? 'urgent' : req.body?.priority === 'high' ? 'high' : 'normal',
    });
    res.status(201).json({ success: true, escalation });
  });

  // ---- Admin-Protected Full AI Workforce Orchestration & Governance ----
  router.get(
    '/agents',
    deps.authService.requirePermission('ai.read'),
    (_req: AuthenticatedAdminRequest, res: Response) => {
      res.json({
        success: true,
        total: deps.workforceService.listAgents().length,
        agents: deps.workforceService.listAgents(),
      });
    }
  );

  router.post(
    '/agents/:code/execute',
    deps.authService.requirePermission('ai.execute'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const code = sanitizePlainText(req.params.code, 16).toUpperCase();
      const prompt = sanitizePlainText(req.body?.prompt, 4000);
      if (!prompt) {
        res.status(400).json({ success: false, error: 'Execution prompt is required.' });
        return;
      }

      const result = await deps.workforceService.executeAgent({
        agentCode: code,
        prompt,
        actor: req.adminUser!.email,
        actorRole: req.adminUser!.role,
        correlationId: req.correlationId,
        context: req.body?.context && typeof req.body.context === 'object' ? req.body.context : {},
      });

      if (result.ok === false) {
        res.status(result.statusCode).json({ success: false, error: result.error });
        return;
      }

      await deps.db.writeAuditLog({
        correlationId: req.correlationId,
        actor: req.adminUser!.email,
        actorRole: req.adminUser!.role,
        action:
          result.execution.status === 'pending_approval'
            ? 'ai_agent_execution_queued_approval'
            : 'ai_agent_executed',
        entityType: 'ai_agent_executions',
        entityId: result.execution.id,
        details: {
          agentCode: code,
          status: result.execution.status,
          providerModel: result.execution.providerModel,
        },
      });

      res.status(result.execution.status === 'pending_approval' ? 202 : 200).json({
        success: true,
        execution: result.execution,
      });
    }
  );

  router.get(
    '/executions',
    deps.authService.requirePermission('ai.read'),
    (req: AuthenticatedAdminRequest, res: Response) => {
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
      res.json({
        success: true,
        executions: deps.workforceService.listExecutions(limit),
        escalations: deps.workforceService.listEscalations(),
        usageCount: deps.workforceService.listUsage(500).length,
      });
    }
  );

  router.post(
    '/approvals/:executionId/decide',
    deps.authService.requirePermission('ai.approve'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const executionId = sanitizePlainText(req.params.executionId, 80);
      const decision = req.body?.decision === 'approved' ? 'approved' : req.body?.decision === 'rejected' ? 'rejected' : null;
      if (!decision) {
        res.status(400).json({ success: false, error: 'Decision must be approved or rejected.' });
        return;
      }
      const updated = await deps.workforceService.decidePendingExecution(
        executionId,
        decision,
        req.adminUser!.email
      );
      if (!updated) {
        res.status(404).json({ success: false, error: 'Pending AI execution not found.' });
        return;
      }
      await deps.db.writeAuditLog({
        correlationId: req.correlationId,
        actor: req.adminUser!.email,
        actorRole: req.adminUser!.role,
        action: `ai_execution_${decision}`,
        entityType: 'ai_agent_executions',
        entityId: executionId,
        details: { agentCode: updated.agentCode, finalStatus: updated.status },
      });
      res.json({ success: true, execution: updated });
    }
  );

  // ---- Central AI Knowledge Base Management ----
  router.get(
    '/knowledge/documents',
    deps.authService.requirePermission('ai.read'),
    (req: AuthenticatedAdminRequest, res: Response) => {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const docs = deps.knowledgeService.listDocuments({
        includeInternal: true,
        category,
      });
      res.json({ success: true, total: docs.length, documents: docs });
    }
  );

  router.post(
    '/knowledge/documents',
    deps.authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const title = sanitizePlainText(req.body?.title, 180);
      const category = sanitizePlainText(req.body?.category, 60) || 'general';
      const rawContent = sanitizePlainText(req.body?.rawContent, 20_000);
      const visibilityRaw = String(req.body?.visibility || 'public');
      const visibility: KnowledgeVisibility =
        visibilityRaw === 'internal_admin' || visibilityRaw === 'tenant_private'
          ? visibilityRaw
          : 'public';
      const tenantUserId =
        visibility === 'tenant_private' ? sanitizePlainText(req.body?.tenantUserId, 80) : undefined;
      const approvalStatus: KnowledgeApprovalStatus =
        req.body?.approvalStatus === 'approved' ? 'approved' : 'pending_review';

      if (!title || !rawContent) {
        res.status(400).json({ success: false, error: 'title and rawContent are required.' });
        return;
      }
      if (visibility === 'tenant_private' && !tenantUserId) {
        res.status(400).json({ success: false, error: 'tenantUserId is required for tenant_private documents.' });
        return;
      }

      const doc = await deps.knowledgeService.ingestDocument({
        title,
        category,
        visibility,
        tenantUserId,
        rawContent,
        sourceUri: sanitizePlainText(req.body?.sourceUri, 240) || undefined,
        createdBy: req.adminUser!.email,
        approvalStatus,
      });

      await deps.db.writeAuditLog({
        correlationId: req.correlationId,
        actor: req.adminUser!.email,
        actorRole: req.adminUser!.role,
        action: 'ai_knowledge_document_ingested',
        entityType: 'ai_knowledge_documents',
        entityId: doc.id,
        details: { title: doc.title, version: doc.version, visibility: doc.visibility },
      });

      res.status(201).json({ success: true, document: doc });
    }
  );

  router.patch(
    '/knowledge/documents/:documentId/approval',
    deps.authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const documentId = sanitizePlainText(req.params.documentId, 80);
      const status = String(req.body?.approvalStatus || '') as KnowledgeApprovalStatus;
      if (!['draft', 'pending_review', 'approved', 'archived'].includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid approvalStatus.' });
        return;
      }
      const updated = deps.knowledgeService.setApprovalStatus(documentId, status, req.adminUser!.email);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Knowledge document not found.' });
        return;
      }
      await deps.db.writeAuditLog({
        correlationId: req.correlationId,
        actor: req.adminUser!.email,
        actorRole: req.adminUser!.role,
        action: 'ai_knowledge_document_approval_updated',
        entityType: 'ai_knowledge_documents',
        entityId: documentId,
        details: { approvalStatus: status },
      });
      res.json({ success: true, document: updated });
    }
  );

  router.post(
    '/knowledge/search',
    deps.authService.requirePermission('ai.read'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const query = sanitizePlainText(req.body?.query, 500);
      const tenantUserId = sanitizePlainText(req.body?.tenantUserId, 80) || undefined;
      if (!query) {
        res.status(400).json({ success: false, error: 'Search query is required.' });
        return;
      }
      const results = await deps.knowledgeService.search({
        query,
        includeInternal: true,
        tenantUserId,
        limit: Math.min(10, Math.max(1, Number(req.body?.limit || 5))),
      });
      res.json({ success: true, results });
    }
  );

  return router;
}
