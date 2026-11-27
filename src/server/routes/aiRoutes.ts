import express, { Request, Response, Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { AdminAuthService, AuthenticatedAdminRequest } from '../auth';
import { EnterpriseAiWorkforceService } from '../ai/workforceService';
import { CentralKnowledgeService, KnowledgeDocumentRecord } from '../ai/knowledgeService';
import { DatabaseRepository } from '../db/types';
import { sanitizePlainText } from '../validation';

const VALID_KB_CATEGORIES: KnowledgeDocumentRecord['category'][] = [
  'company_policy',
  'service_catalog',
  'pricing_guide',
  'sop',
  'faq',
  'legal',
  'brand_voice',
];

export function createAiRouter(deps: {
  authService: AdminAuthService;
  db: DatabaseRepository;
  workforceService: EnterpriseAiWorkforceService;
  knowledgeService: CentralKnowledgeService;
  aiClient: GoogleGenAI | null;
}): Router {
  const router = Router();
  const { authService, db, workforceService, knowledgeService, aiClient } = deps;

  const audit = async (
    req: AuthenticatedAdminRequest,
    action: string,
    entityType: string,
    entityId?: string,
    details: Record<string, unknown> = {}
  ) => {
    try {
      await db.writeAuditLog({
        correlationId: req.correlationId,
        actor: req.adminUser?.email || 'admin',
        actorRole: req.adminUser?.role || 'admin',
        action,
        entityType,
        entityId,
        details,
      });
    } catch {
      // Non-fatal if optional DB is unconfigured in local dev
    }
  };

  // Public read-only agent registry overview
  router.get('/agents/public', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      total: workforceService.listAgents().length,
      count: workforceService.listAgents().length,
      agents: workforceService.listAgents().map((a) => ({
        code: a.code,
        name: a.name,
        category: a.category,
        roleSummary: a.roleSummary,
        requiresApprovalByDefault: a.requiresApprovalByDefault,
        outputSchema: a.outputContract.schemaName,
      })),
    });
  });

  // Public safe knowledge search (strictly public tenantScope & public role only)
  router.get('/knowledge/search/public', async (req: Request, res: Response) => {
    const q = sanitizePlainText(req.query.q, 300);
    if (!q) {
      res.status(400).json({ success: false, error: 'Query parameter q is required.' });
      return;
    }
    const hits = await knowledgeService.search(q, {
      limit: 4,
      tenantScope: 'public',
      actorRole: 'public',
      includeInternal: false,
    });
    res.status(200).json({ success: true, hits });
  });

  // Protected AI Workforce & Central Knowledge System routes
  router.get('/agents', authService.requirePermission('ai.read'), (_req: AuthenticatedAdminRequest, res: Response) => {
    res.status(200).json({
      success: true,
      total: workforceService.listAgents().length,
      count: workforceService.listAgents().length,
      agents: workforceService.listAgents(),
    });
  });

  router.get('/dashboard', authService.requirePermission('ai.read'), (_req: AuthenticatedAdminRequest, res: Response) => {
    res.status(200).json({
      success: true,
      dashboard: workforceService.getOperationalDashboard(),
      knowledgeStats: knowledgeService.getStats(),
    });
  });

  router.get('/executions', authService.requirePermission('ai.read'), (req: AuthenticatedAdminRequest, res: Response) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const tenantScope = sanitizePlainText(req.query.tenantScope, 80) || undefined;
    res.status(200).json({
      success: true,
      executions: workforceService.listExecutions(limit, tenantScope),
      pendingApprovals: workforceService.listPendingApprovals(),
    });
  });

  router.post(
    '/agents/:code/execute',
    authService.requirePermission('ai.execute'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const admin = req.adminUser!;
      const code = sanitizePlainText(req.params.code, 10).toUpperCase();
      const prompt = sanitizePlainText(req.body?.prompt, 4000);
      const context =
        req.body?.context && typeof req.body.context === 'object'
          ? (req.body.context as Record<string, unknown>)
          : undefined;
      const tenantScope = sanitizePlainText(req.body?.tenantScope, 80) || 'ophireum_internal';
      const forceApproval = Boolean(req.body?.forceApproval);

      const result = await workforceService.executeAgent({
        agentCode: code,
        actor: admin.email,
        actorRole: admin.role,
        prompt,
        context,
        tenantScope,
        forceApproval,
      });

      if (result.error || !result.execution) {
        res.status(result.statusCode || 400).json({ success: false, error: result.error });
        return;
      }

      res.status(result.execution.status === 'pending_approval' ? 202 : 200).json({
        success: true,
        execution: result.execution,
      });
    }
  );

  router.get('/approvals', authService.requirePermission('ai.read'), (_req: AuthenticatedAdminRequest, res: Response) => {
    res.status(200).json({
      success: true,
      approvals: workforceService.listPendingApprovals(),
    });
  });

  router.post(
    '/approvals/:id/decide',
    authService.requirePermission('ai.approve'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const admin = req.adminUser!;
      const rawDecision = String(req.body?.decision || '').toLowerCase().trim();
      const decision =
        rawDecision === 'approve' || rawDecision === 'approved'
          ? 'approve'
          : rawDecision === 'cancel' || rawDecision === 'cancelled'
            ? 'cancel'
            : rawDecision === 'reject' || rawDecision === 'rejected'
              ? 'reject'
              : null;
      if (!decision) {
        res.status(400).json({ success: false, error: 'decision must be "approve", "reject", or "cancel".' });
        return;
      }
      const note = sanitizePlainText(req.body?.note, 500);
      const expectedActionHash = sanitizePlainText(req.body?.actionHash, 128) || undefined;
      const result = await workforceService.decideApproval(
        sanitizePlainText(req.params.id, 80),
        decision,
        admin.email,
        admin.role,
        note,
        expectedActionHash
      );
      if (result.error || !result.execution) {
        res.status(result.statusCode || 400).json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, execution: result.execution });
    }
  );

  router.post(
    '/approvals/:id/cancel',
    authService.requirePermission('ai.approve'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const admin = req.adminUser!;
      const note = sanitizePlainText(req.body?.note, 500) || 'Cancelled via AI Governance Queue';
      const result = await workforceService.decideApproval(
        sanitizePlainText(req.params.id, 80),
        'cancel',
        admin.email,
        admin.role,
        note
      );
      if (result.error || !result.execution) {
        res.status(result.statusCode || 400).json({ success: false, error: result.error });
        return;
      }
      res.status(200).json({ success: true, execution: result.execution });
    }
  );

  // Central Knowledge System
  router.get('/knowledge/documents', authService.requirePermission('ai.read'), (req: AuthenticatedAdminRequest, res: Response) => {
    const status = sanitizePlainText(req.query.status, 30) || undefined;
    const tenantScope = sanitizePlainText(req.query.tenantScope, 80) || undefined;
    res.status(200).json({
      success: true,
      stats: knowledgeService.getStats(),
      documents: knowledgeService.listDocuments({ status, tenantScope, includeInternal: true }),
    });
  });

  router.post(
    '/knowledge/documents',
    authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const admin = req.adminUser!;
      const title = sanitizePlainText(req.body?.title, 180);
      const categoryRaw = sanitizePlainText(req.body?.category, 40) as KnowledgeDocumentRecord['category'];
      const category = VALID_KB_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'sop';
      const tenantScope = sanitizePlainText(req.body?.tenantScope, 80) || 'public';
      const sourceRef = sanitizePlainText(req.body?.sourceRef, 160) || 'admin_console';
      const content = sanitizePlainText(req.body?.content, 40000);
      const autoApprove = Boolean(req.body?.autoApprove);

      if (!title || !content || content.length < 10) {
        res.status(400).json({ success: false, error: 'Document title and content (10+ chars) are required.' });
        return;
      }

      try {
        const result = await knowledgeService.ingestDocument({
          title,
          category,
          tenantScope,
          sourceRef,
          content,
          uploadedBy: admin.email,
          autoApprove,
        });
        await audit(req, 'kb_document_ingested', 'knowledge_document', result.document.id, {
          title: result.document.title,
          tenantScope,
          status: result.document.status,
          injectionPatternsNeutralized: result.injectionPatternsNeutralized,
        });
        res.status(201).json({
          success: true,
          document: result.document,
          injectionPatternsNeutralized: result.injectionPatternsNeutralized,
        });
      } catch (err: any) {
        res.status(400).json({ success: false, error: err?.message || 'Unable to ingest knowledge document.' });
      }
    }
  );

  router.post(
    '/knowledge/upload',
    express.json({ limit: '4mb' }),
    authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const admin = req.adminUser!;
      const fileName = sanitizePlainText(req.body?.fileName, 180);
      const mimeType = sanitizePlainText(req.body?.mimeType, 100);
      const contentBase64 = typeof req.body?.contentBase64 === 'string' ? req.body.contentBase64 : '';
      const title = sanitizePlainText(req.body?.title, 180) || fileName;
      const categoryRaw = sanitizePlainText(req.body?.category, 40) as KnowledgeDocumentRecord['category'];
      const category = VALID_KB_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'sop';
      const tenantScope = sanitizePlainText(req.body?.tenantScope, 80) || 'public';
      const autoApprove = Boolean(req.body?.autoApprove);

      if (!fileName || !mimeType || !contentBase64) {
        res.status(400).json({ success: false, error: 'fileName, mimeType, and contentBase64 are required.' });
        return;
      }

      const outcome = await knowledgeService.uploadFileDocument({
        fileName,
        mimeType,
        contentBase64,
        title,
        category,
        tenantScope,
        uploadedBy: admin.email,
        autoApprove,
      });

      if (outcome.error || !outcome.document) {
        res.status(400).json({ success: false, error: outcome.error || 'Upload failed.' });
        return;
      }

      await audit(req, 'kb_file_uploaded', 'knowledge_document', outcome.document.id, {
        fileName,
        mimeType,
        tenantScope,
        injectionPatternsNeutralized: outcome.injectionPatternsNeutralized,
      });
      res.status(201).json({
        success: true,
        document: outcome.document,
        injectionPatternsNeutralized: outcome.injectionPatternsNeutralized,
      });
    }
  );

  router.post(
    '/knowledge/documents/:id/approve',
    authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const admin = req.adminUser!;
      const doc = await knowledgeService.approveDocument(sanitizePlainText(req.params.id, 80), admin.email);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Knowledge document not found.' });
        return;
      }
      await audit(req, 'kb_document_approved', 'knowledge_document', doc.id, {
        title: doc.title,
        chunkCount: doc.chunkCount,
      });
      res.status(200).json({ success: true, document: doc });
    }
  );

  router.post(
    '/knowledge/documents/:id/reindex',
    authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const admin = req.adminUser!;
      const doc = await knowledgeService.reindexDocument(sanitizePlainText(req.params.id, 80), admin.email);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Knowledge document not found.' });
        return;
      }
      await audit(req, 'kb_document_reindexed', 'knowledge_document', doc.id, {
        version: doc.version,
        chunkCount: doc.chunkCount,
      });
      res.status(200).json({ success: true, document: doc });
    }
  );

  router.post(
    '/knowledge/documents/:id/revoke',
    authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const doc = await knowledgeService.revokeDocumentAccess(sanitizePlainText(req.params.id, 80));
      if (!doc) {
        res.status(404).json({ success: false, error: 'Knowledge document not found.' });
        return;
      }
      await audit(req, 'kb_document_revoked', 'knowledge_document', doc.id);
      res.status(200).json({ success: true, document: doc });
    }
  );

  router.delete(
    '/knowledge/documents/:id',
    authService.requirePermission('ai.knowledge.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const docId = sanitizePlainText(req.params.id, 80);
      const deleted = await knowledgeService.deleteDocument(docId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Knowledge document not found.' });
        return;
      }
      await audit(req, 'kb_document_deleted', 'knowledge_document', docId);
      res.status(200).json({ success: true });
    }
  );

  router.get('/knowledge/search', authService.requirePermission('ai.read'), async (req: AuthenticatedAdminRequest, res: Response) => {
    const admin = req.adminUser!;
    const q = sanitizePlainText(req.query.q, 300);
    const tenantScope = sanitizePlainText(req.query.tenantScope, 80) || 'ophireum_internal';
    if (!q) {
      res.status(400).json({ success: false, error: 'Query parameter q is required.' });
      return;
    }
    const hits = await knowledgeService.search(q, {
      limit: 6,
      tenantScope,
      actorRole: admin.role,
      includeInternal: true,
    });
    res.status(200).json({ success: true, hits });
  });

  router.post('/studio/blueprint', async (req: Request, res: Response) => {
    const idea = sanitizePlainText(req.body?.idea || req.body?.prompt, 1500);
    if (!idea || idea.length < 8) {
      res.status(400).json({ success: false, error: 'Please describe your project idea (minimum 8 characters).' });
      return;
    }

    const kbHits = await knowledgeService.search(idea, {
      limit: 3,
      tenantScope: 'public',
      actorRole: 'public',
      includeInternal: false,
    });

    if (aiClient) {
      try {
        const prompt = [
          'You are OPHIREUM AI Solutions Architect. Produce a structured, concise enterprise solution blueprint for this client brief.',
          knowledgeService.formatRetrievedKnowledgeForPrompt(kbHits),
          `Client Idea: ${idea}`,
          'Include: (1) Recommended OPHIREUM Divisions & Services, (2) Technical & Creative Architecture, (3) 4-Phase Delivery Roadmap, and (4) Security & Governance Guardrails. Never invent binding fixed prices.',
        ].join('\n\n');
        const response = await aiClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
        });
        const blueprint = (response.text || '').trim();
        if (blueprint.length > 40) {
          res.status(200).json({
            success: true,
            mode: 'gemini_live',
            blueprint,
            citations: kbHits.map((h) => h.citationLabel),
          });
          return;
        }
      } catch {
        // Fall through to deterministic grounded studio blueprint below
      }
    }

    const blueprint = [
      `# OPHIREUM Enterprise Solution Blueprint`,
      `**Brief Summary:** ${idea}`,
      ``,
      `## 1. Recommended Divisions & Delivery Track`,
      `- **Software & Web Architecture**: Responsive multi-tenant portal, hardened REST API gateway, and role-based access control.`,
      `- **AI Creative & Multimedia Production**: Brand-aligned asset pipeline, review checkpoints, and versioned master deliverables.`,
      `- **Commerce & Billing Governance**: Server-authoritative pricing, signed payment webhooks, and invoice/receipt automation.`,
      ``,
      `## 2. Four-Phase Execution Roadmap`,
      `1. **Discovery & Technical Specification (Week 1)**: Requirements sign-off, schema design, and compliance checklist.`,
      `2. **Core Platform & Pipeline Build (Weeks 2–4)**: Persistent database workflows, API contracts, and client portal integration.`,
      `3. **Creative QA & Security Hardening (Week 5)**: Automated security regression testing, RBAC verification, and client review.`,
      `4. **Staging Acceptance & Launch (Week 6)**: Controlled release validation, runbook handover, and ongoing SLA support.`,
    ].join('\n');

    res.status(200).json({
      success: true,
      mode: 'grounded_deterministic_fallback',
      blueprint,
      citations: kbHits.map((h) => h.citationLabel),
    });
  });

  return router;
}
