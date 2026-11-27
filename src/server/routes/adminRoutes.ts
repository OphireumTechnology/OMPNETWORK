import { Router, Response, NextFunction } from 'express';
import {
  AdminAuthService,
  AuthenticatedAdminRequest,
  ROLE_PERMISSIONS,
  buildAdminSessionCookieHeader,
} from '../auth';
import { DatabaseRepository, SolutionRequestRecord } from '../db/types';
import { OrderStatus, PortalRepository, ProjectStage, SupportTicketStatus } from '../portal/types';
import { PaymentGatewayRegistry } from '../portal/payments/paymentAdapters';
import {
  createMakerCheckerApproval,
  decideMakerCheckerApproval,
  listMakerCheckerApprovals,
  listPaymentDisputes,
  listPaymentReconciliationExceptions,
  recordPaymentDispute,
  requiresMakerCheckerForRefund,
  resolvePaymentReconciliationException,
} from '../portal/payments/financialGovernance';
import { TransactionalEmailService } from '../services/emailService';
import { GoogleCalendarService } from '../services/calendarService';
import { EnterpriseAiWorkforceService } from '../ai/workforceService';
import { CentralKnowledgeService } from '../ai/knowledgeService';
import { sanitizePlainText } from '../validation';
import { evaluateSystemReadiness } from '../configValidator';

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) before CSV quoting.
 */
export function sanitizeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  const trimmedLeading = str.replace(/^[\t\r\n ]+/, '');
  const safe = /^[=+\-@\t\r]/.test(str) || /^[=+\-@]/.test(trimmedLeading) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

interface SystemConfigEntry {
  key: string;
  value: unknown;
  description: string;
  updatedBy: string;
  updatedAt: string;
}

export function createAdminCommandRouter(deps: {
  authService: AdminAuthService;
  db: DatabaseRepository;
  portalRepo: PortalRepository;
  emailService: TransactionalEmailService;
  calendarService: GoogleCalendarService;
  workforceService: EnterpriseAiWorkforceService;
  knowledgeService: CentralKnowledgeService;
  geminiConfigured: boolean;
}): Router {
  const router = Router();
  const paymentRegistry = new PaymentGatewayRegistry();

  const systemConfigs = new Map<string, SystemConfigEntry>([
    [
      'fx_usd_to_php_rate',
      {
        key: 'fx_usd_to_php_rate',
        value: 58,
        description: 'Reference USD to PHP conversion rate for indicative catalog/portal estimates.',
        updatedBy: 'system',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'live_payments_enabled',
      {
        key: 'live_payments_enabled',
        value: false,
        description: 'Master safety switch keeping live commercial charges disabled pending owner approval.',
        updatedBy: 'system',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'ai_high_risk_approval_required',
      {
        key: 'ai_high_risk_approval_required',
        value: true,
        description: 'Enforces human approval before high-risk AI workforce actions execute.',
        updatedBy: 'system',
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  const audit = async (
    req: AuthenticatedAdminRequest,
    action: string,
    entityType: string,
    entityId?: string,
    details: Record<string, unknown> = {}
  ) => {
    await deps.db.writeAuditLog({
      correlationId: req.correlationId,
      actor: req.adminUser?.email || 'admin',
      actorRole: req.adminUser?.role || 'admin',
      action,
      entityType,
      entityId,
      details,
    });
  };

  // ---- Admin Auth Logout & TOTP MFA Management ----
  router.post(
    '/auth/logout',
    deps.authService.requireAdmin,
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const token = deps.authService.extractTokenFromRequest(req);
      if (token) {
        await deps.authService.revokeSessionTokenAsync(token);
      }
      res.setHeader('Set-Cookie', buildAdminSessionCookieHeader('', 0));
      await audit(req, 'admin_session_revoked', 'admin_auth', req.adminUser?.id, {
        jti: req.adminSessionJti,
      });
      res.json({ success: true, message: 'Administrator session revoked.' });
    }
  );

  router.post(
    '/auth/mfa/enroll',
    deps.authService.requireAdmin,
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const email = req.adminUser!.email;
      const enrollment = deps.authService.enrollAdminMfa(email);
      await audit(req, 'admin_mfa_enrollment_started', 'admin_auth', req.adminUser?.id);
      res.json({ success: true, ...enrollment });
    }
  );

  router.post(
    '/auth/mfa/confirm',
    deps.authService.requireAdmin,
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const code = sanitizePlainText(req.body?.code, 12);
      const confirmed = deps.authService.confirmAdminMfaEnrollment(req.adminUser!.email, code);
      if (!confirmed) {
        res.status(400).json({ success: false, error: 'Invalid 6-digit authenticator code.' });
        return;
      }
      await audit(req, 'admin_mfa_enabled', 'admin_auth', req.adminUser?.id);
      res.json({ success: true, mfaEnabled: true });
    }
  );

  router.post(
    '/auth/mfa/rotate-key',
    deps.authService.requirePermission('config.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const newKey = typeof req.body?.newEncryptionKey === 'string' ? req.body.newEncryptionKey.trim() : '';
      if (newKey.length < 32) {
        res.status(400).json({
          success: false,
          error: 'newEncryptionKey must be at least 32 characters.',
        });
        return;
      }
      const result = deps.authService.rotateMfaEncryptionKey(newKey);
      await audit(req, 'admin_mfa_key_rotated', 'admin_auth', req.adminUser?.id, {
        rotatedCount: result.rotatedCount,
        newKeyId: result.newKeyId,
      });
      res.json({ success: true, ...result });
    }
  );

  router.get(
    '/system/readiness',
    deps.authService.requirePermission('security.read'),
    (_req: AuthenticatedAdminRequest, res: Response) => {
      const readiness = evaluateSystemReadiness();
      res.json({ success: true, readiness });
    }
  );

  router.get(
    '/rbac/roles',
    deps.authService.requirePermission('dashboard.read'),
    (_req: AuthenticatedAdminRequest, res: Response) => {
      const roles = Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
        role,
        permissions: Array.from(perms),
      }));
      res.json({ success: true, roles });
    }
  );

  // ---- Inquiries Status Mutation ----
  router.patch(
    '/solution-requests/:referenceCode/status',
    deps.authService.requirePermission('inquiries.write'),
    async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction) => {
      try {
        const ref = sanitizePlainText(req.params.referenceCode, 60);
        const status = sanitizePlainText(req.body?.status, 40) as SolutionRequestRecord['status'];
        if (!['submitted', 'under_review', 'proposal_sent', 'archived'].includes(status)) {
          res.status(400).json({ success: false, error: 'Invalid inquiry status.' });
          return;
        }
        if (!deps.db.updateSolutionRequestStatus) {
          res.status(503).json({ success: false, error: 'Status update not supported by active DB adapter.' });
          return;
        }
        const updated = await deps.db.updateSolutionRequestStatus(ref, status);
        await audit(req, 'admin_update_inquiry_status', 'solution_requests', ref, { status });
        res.json({ success: true, record: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  // ---- Customers, Suspension & Credit Adjustments ----
  router.get(
    '/customers',
    deps.authService.requirePermission('customers.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const records = deps.portalRepo.adminListUsers ? await deps.portalRepo.adminListUsers() : [];
      res.json({ success: true, total: records.length, records });
    }
  );

  router.post(
    '/customers/:userId/suspend',
    deps.authService.requirePermission('customers.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const userId = sanitizePlainText(req.params.userId, 80);
      const reason = sanitizePlainText(req.body?.reason, 400) || 'Suspended by administrator';
      const updated = deps.portalRepo.suspendUser
        ? await deps.portalRepo.suspendUser(userId, reason, req.adminUser!.email)
        : null;
      if (!updated) {
        res.status(404).json({ success: false, error: 'Customer not found.' });
        return;
      }
      await audit(req, 'admin_suspend_customer', 'profiles', userId, { reason });
      res.json({ success: true, accountStatus: updated.accountStatus });
    }
  );

  router.post(
    '/customers/:userId/reactivate',
    deps.authService.requirePermission('customers.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const userId = sanitizePlainText(req.params.userId, 80);
      const updated = deps.portalRepo.reactivateUser
        ? await deps.portalRepo.reactivateUser(userId, req.adminUser!.email)
        : null;
      if (!updated) {
        res.status(404).json({ success: false, error: 'Customer not found.' });
        return;
      }
      await audit(req, 'admin_reactivate_customer', 'profiles', userId, {});
      res.json({ success: true, accountStatus: updated.accountStatus });
    }
  );

  router.post(
    '/customers/:userId/credits',
    deps.authService.requirePermission('credits.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const userId = sanitizePlainText(req.params.userId, 80);
      const amount = Number(req.body?.amount);
      const description = sanitizePlainText(req.body?.description, 240);
      if (!Number.isInteger(amount) || amount === 0 || !description) {
        res.status(400).json({ success: false, error: 'Non-zero integer amount and description are required.' });
        return;
      }
      try {
        const result = await deps.portalRepo.applyCreditLedgerEntry({
          userId,
          transactionType: 'credit_adjustment',
          amount,
          description: `[Admin ${req.adminUser!.email}] ${description}`,
        });
        await audit(req, 'admin_adjust_credits', 'credit_wallets', userId, { amount, description });
        res.status(200).json({ success: true, ...result });
      } catch (err: any) {
        res.status(400).json({ success: false, error: err?.message || 'Credit adjustment failed.' });
      }
    }
  );

  router.get(
    '/catalog',
    deps.authService.requirePermission('dashboard.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const [categories, products] = await Promise.all([
        deps.portalRepo.listCategories(),
        deps.portalRepo.listProducts(),
      ]);
      res.json({ success: true, categories, products });
    }
  );

  // ---- Orders & Status Transitions ----
  router.get(
    '/orders',
    deps.authService.requirePermission('orders.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const records = deps.portalRepo.adminListOrders ? await deps.portalRepo.adminListOrders() : [];
      res.json({ success: true, total: records.length, records });
    }
  );

  router.patch(
    '/orders/:orderId/status',
    deps.authService.requirePermission('orders.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const orderId = sanitizePlainText(req.params.orderId, 80);
      const status = sanitizePlainText(req.body?.status, 50) as OrderStatus;
      const note = sanitizePlainText(req.body?.note, 400);
      const allowed: OrderStatus[] = [
        'pending_payment',
        'payment_verification',
        'confirmed',
        'awaiting_project_brief',
        'in_production',
        'quality_review',
        'awaiting_client_review',
        'revision_requested',
        'final_approval',
        'completed',
        'cancelled',
      ];
      if (!allowed.includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid order status.' });
        return;
      }
      const updated = deps.portalRepo.adminUpdateOrderStatus
        ? await deps.portalRepo.adminUpdateOrderStatus(orderId, status, req.adminUser!.email, note)
        : null;
      if (!updated) {
        res.status(404).json({ success: false, error: 'Order not found.' });
        return;
      }
      await audit(req, 'admin_update_order_status', 'orders', orderId, { status, note });
      res.json({ success: true, order: updated });
    }
  );

  // ---- Payments, Invoices, Subscriptions & Refunds ----
  router.get(
    '/payments',
    deps.authService.requirePermission('payments.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const payments = deps.portalRepo.adminListPayments ? await deps.portalRepo.adminListPayments() : [];
      const invoices = deps.portalRepo.adminListInvoices ? await deps.portalRepo.adminListInvoices() : [];
      const subscriptions = deps.portalRepo.adminListSubscriptions
        ? await deps.portalRepo.adminListSubscriptions()
        : [];
      const refunds = deps.portalRepo.adminListRefunds ? await deps.portalRepo.adminListRefunds() : [];
      res.json({
        success: true,
        payments,
        invoices,
        subscriptions,
        refunds,
        providers: paymentRegistry.listConfigs(),
      });
    }
  );

  router.post(
    '/refunds',
    deps.authService.requirePermission('payments.refund'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const paymentId = sanitizePlainText(req.body?.paymentId, 80);
      const amountMinor = Number(req.body?.amountMinor);
      const reason = sanitizePlainText(req.body?.reason, 500);
      if (!paymentId || !Number.isInteger(amountMinor) || amountMinor <= 0 || !reason) {
        res.status(400).json({ success: false, error: 'paymentId, positive integer amountMinor, and reason are required.' });
        return;
      }
      const refund = deps.portalRepo.adminRequestRefund
        ? await deps.portalRepo.adminRequestRefund({
            paymentId,
            amountMinor,
            reason,
            requestedBy: req.adminUser!.email,
          })
        : null;
      if (!refund) {
        res.status(400).json({ success: false, error: 'Refund could not be created (payment not found, unpaid, or exceeds remaining balance).' });
        return;
      }
      await audit(req, 'admin_refund_requested', 'payment_refunds', refund.id, {
        paymentId,
        amountMinor,
        reason,
      });
      res.status(201).json({ success: true, refund });
    }
  );

  router.patch(
    '/refunds/:refundId/decide',
    deps.authService.requirePermission('payments.refund'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const refundId = sanitizePlainText(req.params.refundId, 80);
      const decision = sanitizePlainText(req.body?.decision, 20) as 'approved' | 'rejected' | 'processed';
      if (!['approved', 'rejected', 'processed'].includes(decision)) {
        res.status(400).json({ success: false, error: 'Decision must be approved, rejected, or processed.' });
        return;
      }
      const existingRefunds = deps.portalRepo.adminListRefunds ? await deps.portalRepo.adminListRefunds() : [];
      const targetRefund = existingRefunds.find((r) => r.id === refundId);
      if (
        targetRefund &&
        (decision === 'approved' || decision === 'processed') &&
        requiresMakerCheckerForRefund(targetRefund.amountMinor, targetRefund.currency) &&
        targetRefund.requestedBy.toLowerCase() === req.adminUser!.email.toLowerCase()
      ) {
        res.status(403).json({
          success: false,
          code: 'MAKER_CHECKER_REQUIRED',
          error:
            'Segregation-of-duties control: high-value refunds require approval from a different Finance Officer or Super Admin than the requester.',
        });
        return;
      }
      const refund = deps.portalRepo.adminDecideRefund
        ? await deps.portalRepo.adminDecideRefund(refundId, decision, req.adminUser!.email)
        : null;
      if (!refund) {
        res.status(404).json({ success: false, error: 'Refund request not found.' });
        return;
      }
      await audit(req, `admin_refund_${decision}`, 'payment_refunds', refundId, { decision });
      res.json({ success: true, refund });
    }
  );

  // ---- Phase 34: Payment Reconciliation Queue, Maker-Checker & Disputes ----
  router.get(
    '/payments/reconciliation',
    deps.authService.requirePermission('payments.read'),
    (req: AuthenticatedAdminRequest, res: Response) => {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const items = listPaymentReconciliationExceptions(status);
      res.json({ success: true, total: items.length, records: items });
    }
  );

  router.patch(
    '/payments/reconciliation/:id',
    deps.authService.requirePermission('payments.refund'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const id = sanitizePlainText(req.params.id, 80);
      const status = sanitizePlainText(req.body?.status, 30) as 'investigating' | 'resolved' | 'dismissed';
      const note = sanitizePlainText(req.body?.resolutionNote, 500);
      if (!['investigating', 'resolved', 'dismissed'].includes(status) || !note) {
        res.status(400).json({
          success: false,
          error: 'Valid status (investigating | resolved | dismissed) and resolutionNote are required.',
        });
        return;
      }
      const updated = resolvePaymentReconciliationException(id, req.adminUser!.email, status, note);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Reconciliation exception not found.' });
        return;
      }
      await audit(req, 'admin_reconciliation_updated', 'payment_reconciliation_queue', id, { status, note });
      res.json({ success: true, record: updated });
    }
  );

  router.get(
    '/payments/maker-checker',
    deps.authService.requirePermission('payments.read'),
    (_req: AuthenticatedAdminRequest, res: Response) => {
      const records = listMakerCheckerApprovals();
      res.json({ success: true, total: records.length, records });
    }
  );

  router.post(
    '/payments/maker-checker',
    deps.authService.requirePermission('payments.refund'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const actionType = sanitizePlainText(req.body?.actionType, 50) as
        | 'refund_above_threshold'
        | 'manual_credit_adjustment'
        | 'reconciliation_override'
        | 'dispute_resolution';
      const entityId = sanitizePlainText(req.body?.entityId, 80);
      const amountMinor = Number(req.body?.amountMinor);
      const currency = req.body?.currency === 'PHP' ? 'PHP' : req.body?.currency === 'USD' ? 'USD' : null;
      const justification = sanitizePlainText(req.body?.justification, 500);
      if (
        !['refund_above_threshold', 'manual_credit_adjustment', 'reconciliation_override', 'dispute_resolution'].includes(actionType) ||
        !entityId ||
        !Number.isInteger(amountMinor) ||
        amountMinor <= 0 ||
        !currency ||
        !justification
      ) {
        res.status(400).json({
          success: false,
          error: 'actionType, entityId, positive integer amountMinor, currency (USD/PHP), and justification are required.',
        });
        return;
      }
      const record = createMakerCheckerApproval({
        actionType,
        entityId,
        amountMinor,
        currency,
        requestedByEmail: req.adminUser!.email,
        requestedByRole: req.adminUser!.role,
        justification,
      });
      await audit(req, 'admin_maker_checker_requested', 'financial_maker_checker_approvals', record.id, {
        actionType,
        entityId,
        amountMinor,
        currency,
      });
      res.status(201).json({ success: true, approval: record });
    }
  );

  router.post(
    '/payments/maker-checker/:approvalId/decide',
    deps.authService.requirePermission('payments.refund'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const approvalId = sanitizePlainText(req.params.approvalId, 80);
      const decision = sanitizePlainText(req.body?.decision, 20) as 'approved' | 'rejected';
      const decisionNote = sanitizePlainText(req.body?.decisionNote, 500);
      if (!['approved', 'rejected'].includes(decision)) {
        res.status(400).json({ success: false, error: 'decision must be approved or rejected.' });
        return;
      }
      const result = decideMakerCheckerApproval({
        approvalId,
        decision,
        approverEmail: req.adminUser!.email,
        approverRole: req.adminUser!.role,
        decisionNote,
      });
      if (!result.ok || !result.record) {
        res.status(result.statusCode || 400).json({ success: false, error: result.error });
        return;
      }
      await audit(req, `admin_maker_checker_${decision}`, 'financial_maker_checker_approvals', approvalId, {
        decision,
        decisionNote,
      });
      res.json({ success: true, approval: result.record });
    }
  );

  router.get(
    '/payments/disputes',
    deps.authService.requirePermission('payments.read'),
    (_req: AuthenticatedAdminRequest, res: Response) => {
      const records = listPaymentDisputes();
      res.json({ success: true, total: records.length, records });
    }
  );

  router.post(
    '/payments/disputes',
    deps.authService.requirePermission('payments.refund'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const provider = sanitizePlainText(req.body?.provider, 40) as any;
      const providerDisputeId = sanitizePlainText(req.body?.providerDisputeId, 120);
      const orderId = sanitizePlainText(req.body?.orderId, 80) || undefined;
      const amountMinor = Number(req.body?.amountMinor);
      const currency = req.body?.currency === 'PHP' ? 'PHP' : req.body?.currency === 'USD' ? 'USD' : null;
      const reason = sanitizePlainText(req.body?.reason, 500);
      if (!provider || !providerDisputeId || !Number.isInteger(amountMinor) || amountMinor <= 0 || !currency || !reason) {
        res.status(400).json({
          success: false,
          error: 'provider, providerDisputeId, positive integer amountMinor, currency, and reason are required.',
        });
        return;
      }
      const record = recordPaymentDispute({
        provider,
        providerDisputeId,
        orderId,
        amountMinor,
        currency,
        reason,
        assignedTo: req.adminUser!.email,
      });
      await audit(req, 'admin_payment_dispute_recorded', 'payment_disputes', record.id, {
        provider,
        providerDisputeId,
        amountMinor,
        currency,
      });
      res.status(201).json({ success: true, dispute: record });
    }
  );

  // ---- Promotions ----
  router.get(
    '/promotions',
    deps.authService.requirePermission('dashboard.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const promotions = deps.portalRepo.listDiscountCodes ? await deps.portalRepo.listDiscountCodes(true) : [];
      res.json({ success: true, promotions });
    }
  );

  router.post(
    '/promotions',
    deps.authService.requirePermission('promotions.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const code = sanitizePlainText(req.body?.code, 40).toUpperCase();
      const description = sanitizePlainText(req.body?.description, 240);
      const discountType = req.body?.discountType === 'fixed_usd_minor' ? 'fixed_usd_minor' : 'percent';
      const value = Number(req.body?.value);
      const minSubtotalUsdMinor = Math.max(0, Number(req.body?.minSubtotalUsdMinor || 0));
      const isActive = req.body?.isActive !== false;
      if (!code || !Number.isFinite(value) || value <= 0) {
        res.status(400).json({ success: false, error: 'Valid code and positive discount value are required.' });
        return;
      }
      if (discountType === 'percent' && value > 80) {
        res.status(400).json({ success: false, error: 'Percentage promotions cannot exceed 80%.' });
        return;
      }
      const saved = deps.portalRepo.upsertDiscountCode
        ? await deps.portalRepo.upsertDiscountCode({
            code,
            description: description || `${code} promotional offer`,
            discountType,
            value: Math.floor(value),
            minSubtotalUsdMinor: Math.floor(minSubtotalUsdMinor),
            isActive,
          })
        : null;
      await audit(req, 'admin_upsert_promotion', 'promotions', code, { discountType, value, isActive });
      res.status(201).json({ success: true, promotion: saved });
    }
  );

  // ---- Projects & Support ----
  router.get(
    '/projects',
    deps.authService.requirePermission('projects.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const records = deps.portalRepo.adminListProjects ? await deps.portalRepo.adminListProjects() : [];
      res.json({ success: true, total: records.length, records });
    }
  );

  router.patch(
    '/projects/:projectId/stage',
    deps.authService.requirePermission('projects.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const projectId = sanitizePlainText(req.params.projectId, 80);
      const stage = sanitizePlainText(req.body?.stage, 50) as ProjectStage;
      const note = sanitizePlainText(req.body?.note, 400);
      const updated = deps.portalRepo.adminUpdateProjectStage
        ? await deps.portalRepo.adminUpdateProjectStage(projectId, stage, req.adminUser!.email, note)
        : null;
      if (!updated) {
        res.status(404).json({ success: false, error: 'Project not found.' });
        return;
      }
      await audit(req, 'admin_update_project_stage', 'projects', projectId, { stage, note });
      res.json({ success: true, project: updated });
    }
  );

  router.post(
    '/projects/:projectId/deliverables',
    deps.authService.requirePermission('projects.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const projectId = sanitizePlainText(req.params.projectId, 80);
      const title = sanitizePlainText(req.body?.title, 160);
      const description = sanitizePlainText(req.body?.description, 1000);
      const fileId = sanitizePlainText(req.body?.fileId, 80) || 'deliverable-file';
      if (!title) {
        res.status(400).json({ success: false, error: 'Deliverable title is required.' });
        return;
      }
      const deliverable = deps.portalRepo.adminCreateDeliverable
        ? await deps.portalRepo.adminCreateDeliverable({
            projectId,
            title,
            description,
            fileId,
            actor: req.adminUser!.email,
          })
        : null;
      if (!deliverable) {
        res.status(404).json({ success: false, error: 'Project not found.' });
        return;
      }
      await audit(req, 'admin_upload_deliverable', 'project_deliverables', deliverable.id, { projectId, title });
      res.status(201).json({ success: true, deliverable });
    }
  );

  router.post(
    '/subscriptions/:subscriptionId/renew',
    deps.authService.requirePermission('subscriptions.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const subId = sanitizePlainText(req.params.subscriptionId, 80);
      const txId = sanitizePlainText(req.body?.providerTransactionId, 120) || undefined;
      const result = deps.portalRepo.renewSubscription
        ? await deps.portalRepo.renewSubscription(subId, txId)
        : null;
      if (!result) {
        res.status(404).json({ success: false, error: 'Active subscription not found.' });
        return;
      }
      await audit(req, 'admin_renew_subscription', 'subscriptions', subId, { creditsAllocated: result.creditsAllocated });
      res.json({ success: true, ...result });
    }
  );

  router.post(
    '/subscriptions/:subscriptionId/renewal-failed',
    deps.authService.requirePermission('subscriptions.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const subId = sanitizePlainText(req.params.subscriptionId, 80);
      const reason = sanitizePlainText(req.body?.reason, 300) || 'Payment gateway declined renewal';
      const sub = deps.portalRepo.recordSubscriptionRenewalFailure
        ? await deps.portalRepo.recordSubscriptionRenewalFailure(subId, reason)
        : null;
      if (!sub) {
        res.status(404).json({ success: false, error: 'Subscription not found.' });
        return;
      }
      await audit(req, 'admin_subscription_renewal_failed', 'subscriptions', subId, { status: sub.status, reason });
      res.json({ success: true, subscription: sub });
    }
  );

  router.post(
    '/entitlements/:entitlementId/revoke',
    deps.authService.requirePermission('orders.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const entId = sanitizePlainText(req.params.entitlementId, 80);
      const reason = sanitizePlainText(req.body?.reason, 300) || 'Revoked by administrator';
      const ent = deps.portalRepo.revokeDigitalEntitlement
        ? await deps.portalRepo.revokeDigitalEntitlement(entId, reason, req.adminUser!.email)
        : null;
      if (!ent) {
        res.status(404).json({ success: false, error: 'Digital entitlement not found.' });
        return;
      }
      await audit(req, 'admin_revoke_digital_entitlement', 'digital_entitlements', entId, { reason });
      res.json({ success: true, entitlement: ent });
    }
  );

  router.get(
    '/tickets',
    deps.authService.requirePermission('support.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const records = deps.portalRepo.adminListSupportTickets ? await deps.portalRepo.adminListSupportTickets() : [];
      res.json({ success: true, total: records.length, records });
    }
  );

  router.post(
    '/tickets/:ticketId/reply',
    deps.authService.requirePermission('support.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const ticketId = sanitizePlainText(req.params.ticketId, 80);
      const body = sanitizePlainText(req.body?.body, 2000);
      const nextStatus = sanitizePlainText(req.body?.status, 30) as SupportTicketStatus;
      if (!body) {
        res.status(400).json({ success: false, error: 'Reply body is required.' });
        return;
      }
      const updated = deps.portalRepo.adminReplySupportTicket
        ? await deps.portalRepo.adminReplySupportTicket(
            ticketId,
            req.adminUser!.fullName,
            body,
            ['open', 'in_progress', 'waiting_for_client', 'resolved', 'closed'].includes(nextStatus)
              ? nextStatus
              : 'waiting_for_client'
          )
        : null;
      if (!updated) {
        res.status(404).json({ success: false, error: 'Support ticket not found.' });
        return;
      }
      await audit(req, 'admin_reply_support_ticket', 'support_tickets', ticketId, { nextStatus: updated.status });
      res.json({ success: true, ticket: updated });
    }
  );

  // ---- Integration Health, Outbox Retry & System Configuration ----
  router.get(
    '/integrations/health',
    deps.authService.requirePermission('dashboard.read'),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      const dbPing = await deps.db.ping();
      res.json({
        success: true,
        checkedAt: new Date().toISOString(),
        integrations: [
          {
            key: 'supabase_postgres',
            name: 'Supabase PostgreSQL',
            status: dbPing.ok ? 'healthy' : dbPing.configured ? 'error' : 'unconfigured',
            latencyMs: dbPing.latencyMs ?? null,
            detail: dbPing.error || (dbPing.ok ? 'Connected' : 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured'),
          },
          {
            key: 'resend_email',
            name: 'Resend Transactional Email',
            status: deps.emailService.isConfigured() ? 'healthy' : 'unconfigured',
            latencyMs: null,
            detail: deps.emailService.isConfigured() ? 'Configured' : 'RESEND_API_KEY not configured',
          },
          {
            key: 'google_calendar',
            name: 'Google Calendar Consultation Sync',
            status: deps.calendarService.isConfigured() ? 'healthy' : 'unconfigured',
            latencyMs: null,
            detail: deps.calendarService.isConfigured() ? 'Configured' : 'GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_CALENDAR_ID not configured',
          },
          {
            key: 'gemini_ai',
            name: 'Gemini AI Workforce Engine',
            status: deps.geminiConfigured ? 'healthy' : 'unconfigured',
            latencyMs: null,
            detail: deps.geminiConfigured ? 'Server-side GEMINI_API_KEY active' : 'Operating in grounded deterministic fallback',
          },
          ...paymentRegistry.listConfigs().map((p) => ({
            key: `payment_${p.provider}`,
            name: p.displayName,
            status: p.isEnabled ? 'sandbox' : 'unconfigured',
            latencyMs: null,
            detail: p.unavailableMessage,
          })),
        ],
      });
    }
  );

  router.post(
    '/outbox/retry',
    deps.authService.requirePermission('communications.write'),
    async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction) => {
      try {
        const processed = await deps.emailService.processRetryQueue(25);
        await audit(req, 'admin_outbox_retry_triggered', 'notification_records', undefined, { processed });
        res.json({ success: true, processed });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/config',
    deps.authService.requirePermission('dashboard.read'),
    (_req: AuthenticatedAdminRequest, res: Response) => {
      res.json({ success: true, configs: Array.from(systemConfigs.values()) });
    }
  );

  router.patch(
    '/config',
    deps.authService.requirePermission('config.write'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const key = sanitizePlainText(req.body?.key, 80);
      if (!key || !systemConfigs.has(key)) {
        res.status(404).json({ success: false, error: 'Unknown configuration key.' });
        return;
      }
      if (key === 'live_payments_enabled' && req.body?.value === true) {
        res.status(403).json({
          success: false,
          error: 'Live payment activation requires explicit owner sign-off and verified production merchant credentials.',
        });
        return;
      }
      const current = systemConfigs.get(key)!;
      const updated: SystemConfigEntry = {
        ...current,
        value: req.body?.value,
        updatedBy: req.adminUser!.email,
        updatedAt: new Date().toISOString(),
      };
      systemConfigs.set(key, updated);
      await audit(req, 'admin_update_system_config', 'system_configurations', key, {
        value: updated.value,
      });
      res.json({ success: true, config: updated });
    }
  );

  // ---- Real Business Intelligence & Executive Analytics (Zero Fabricated Numbers) ----
  const buildAnalyticsPayload = async (filters: { from?: string; to?: string; currency?: string }) => {
    const orders = deps.portalRepo.adminListOrders ? await deps.portalRepo.adminListOrders() : [];
    const payments = deps.portalRepo.adminListPayments ? await deps.portalRepo.adminListPayments() : [];
    const projects = deps.portalRepo.adminListProjects ? await deps.portalRepo.adminListProjects() : [];
    const tickets = deps.portalRepo.adminListSupportTickets ? await deps.portalRepo.adminListSupportTickets() : [];
    const users = deps.portalRepo.adminListUsers ? await deps.portalRepo.adminListUsers() : [];
    const subscriptions = deps.portalRepo.adminListSubscriptions ? await deps.portalRepo.adminListSubscriptions() : [];

    let inquiriesTotal = 0;
    let appointmentsTotal = 0;
    let appointmentsConfirmed = 0;
    try {
      const inq = await deps.db.listSolutionRequests({ limit: 100, offset: 0 });
      inquiriesTotal = inq.total;
      const appts = await deps.db.listAppointments({ limit: 100, offset: 0 });
      appointmentsTotal = appts.total;
      appointmentsConfirmed = appts.records.filter((a) => a.status === 'confirmed').length;
    } catch {
      // DB unconfigured — report exact 0 honestly
    }

    const fromMs = filters.from ? Date.parse(filters.from) : NaN;
    const toMs = filters.to ? Date.parse(filters.to) : NaN;

    const filteredOrders = orders.filter((o) => {
      if (filters.currency && filters.currency !== 'ALL' && o.currency !== filters.currency) return false;
      const ts = Date.parse(o.createdAt);
      if (!Number.isNaN(fromMs) && ts < fromMs) return false;
      if (!Number.isNaN(toMs) && ts > toMs) return false;
      return true;
    });

    const filteredPayments = payments.filter((p) => {
      if (filters.currency && filters.currency !== 'ALL' && p.currency !== filters.currency) return false;
      const ts = Date.parse(p.createdAt);
      if (!Number.isNaN(fromMs) && ts < fromMs) return false;
      if (!Number.isNaN(toMs) && ts > toMs) return false;
      return true;
    });

    const paidPayments = filteredPayments.filter((p) => p.status === 'paid');
    const revenueUsdMinor = paidPayments
      .filter((p) => p.currency === 'USD')
      .reduce((sum, p) => sum + p.amountMinor - p.refundedMinor, 0);
    const revenuePhpMinor = paidPayments
      .filter((p) => p.currency === 'PHP')
      .reduce((sum, p) => sum + p.amountMinor - p.refundedMinor, 0);

    const paymentSuccessRatePct =
      filteredPayments.length > 0
        ? Number(((paidPayments.length / filteredPayments.length) * 100).toFixed(1))
        : 0;

    const serviceCounts = new Map<string, { productName: string; orders: number; units: number }>();
    for (const o of filteredOrders) {
      for (const item of o.items) {
        const cur = serviceCounts.get(item.productId) || {
          productName: item.productName,
          orders: 0,
          units: 0,
        };
        cur.orders += 1;
        cur.units += item.quantity;
        serviceCounts.set(item.productId, cur);
      }
    }

    const completedProjects = projects.filter((p) => p.currentStage === 'project_completed').length;
    const resolvedTickets = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;
    const aiExecutions = deps.workforceService.listExecutions(500);
    const aiUsage = deps.workforceService.listUsage(500);
    const escalations = deps.workforceService.listEscalations();

    return {
      generatedAt: new Date().toISOString(),
      dataSourceNote: 'Computed strictly from real persisted platform records. Zero placeholder or fabricated figures.',
      filters,
      kpis: {
        registeredCustomers: users.length,
        totalOrders: filteredOrders.length,
        paidOrders: filteredOrders.filter((o) => o.paymentStatus === 'paid').length,
        revenueUsdMinor,
        revenuePhpMinor,
        paymentSuccessRatePct,
        activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
        totalProjects: projects.length,
        projectCompletionRatePct:
          projects.length > 0 ? Number(((completedProjects / projects.length) * 100).toFixed(1)) : 0,
        totalInquiries: inquiriesTotal,
        totalAppointments: appointmentsTotal,
        appointmentConfirmationRatePct:
          appointmentsTotal > 0
            ? Number(((appointmentsConfirmed / appointmentsTotal) * 100).toFixed(1))
            : 0,
        totalSupportTickets: tickets.length,
        supportResolutionRatePct:
          tickets.length > 0 ? Number(((resolvedTickets / tickets.length) * 100).toFixed(1)) : 0,
        aiExecutionsTotal: aiExecutions.length,
        aiPendingApprovals: aiExecutions.filter((e) => e.status === 'pending_approval').length,
        aiOpenEscalations: escalations.filter((e) => e.status !== 'resolved').length,
        aiAverageLatencyMs:
          aiUsage.length > 0
            ? Math.round(aiUsage.reduce((sum, u) => sum + u.latencyMs, 0) / aiUsage.length)
            : 0,
        knowledgeDocumentsApproved: deps.knowledgeService.listDocuments({
          includeInternal: true,
          approvalStatus: 'approved',
        }).length,
      },
      topServices: Array.from(serviceCounts.values())
        .sort((a, b) => b.units - a.units)
        .slice(0, 10),
    };
  };

  router.get(
    '/analytics/overview',
    deps.authService.requirePermission('analytics.read'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const payload = await buildAnalyticsPayload({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        currency: typeof req.query.currency === 'string' ? req.query.currency.toUpperCase() : 'ALL',
      });
      res.json({ success: true, analytics: payload });
    }
  );

  router.get(
    '/analytics/export.csv',
    deps.authService.requirePermission('analytics.export'),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      const payload = await buildAnalyticsPayload({
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        currency: typeof req.query.currency === 'string' ? req.query.currency.toUpperCase() : 'ALL',
      });
      const rows = [
        ['metric', 'value'],
        ...Object.entries(payload.kpis).map(([k, v]) => [k, String(v)]),
        ...payload.topServices.map((svc) => [`top_service:${svc.productName}`, String(svc.units)]),
      ];
      const csv = rows.map((r) => r.map((cell) => sanitizeCsvCell(cell)).join(',')).join('\n');
      await audit(req, 'admin_export_analytics_csv', 'analytics', undefined, payload.filters);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="ophireum-bi-analytics.csv"');
      res.send(csv);
    }
  );

  return router;
}
