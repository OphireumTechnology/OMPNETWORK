import crypto from 'crypto';
import { PaymentProviderId, PortalCurrency } from '../types';

export interface PaymentReconciliationRecord {
  id: string;
  provider: PaymentProviderId;
  providerEventId: string;
  providerTransactionId?: string;
  orderIdClaimed?: string;
  amountMinor: number;
  currency: PortalCurrency;
  mismatchReason: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface MakerCheckerApprovalRecord {
  id: string;
  actionType: 'refund_above_threshold' | 'manual_credit_adjustment' | 'reconciliation_override' | 'dispute_resolution';
  entityId: string;
  amountMinor: number;
  currency: PortalCurrency;
  requestedByEmail: string;
  requestedByRole: string;
  approverEmail?: string;
  approverRole?: string;
  status: 'pending_second_approval' | 'approved' | 'rejected' | 'expired';
  justification: string;
  decisionNote?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface PaymentDisputeRecord {
  id: string;
  provider: PaymentProviderId;
  providerDisputeId: string;
  orderId?: string;
  amountMinor: number;
  currency: PortalCurrency;
  reason: string;
  status: 'open' | 'evidence_submitted' | 'won' | 'lost' | 'closed';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export const MAKER_CHECKER_REFUND_THRESHOLD_USD_MINOR = 50_000; // $500.00
export const MAKER_CHECKER_REFUND_THRESHOLD_PHP_MINOR = 2_500_000; // PHP 25,000.00

const reconciliationQueue: PaymentReconciliationRecord[] = [];
const makerCheckerApprovals: MakerCheckerApprovalRecord[] = [];
const paymentDisputes: PaymentDisputeRecord[] = [];

export function requiresMakerCheckerForRefund(amountMinor: number, currency: PortalCurrency): boolean {
  const threshold =
    currency === 'PHP' ? MAKER_CHECKER_REFUND_THRESHOLD_PHP_MINOR : MAKER_CHECKER_REFUND_THRESHOLD_USD_MINOR;
  return amountMinor >= threshold;
}

export function recordPaymentReconciliationException(input: {
  provider: PaymentProviderId;
  providerEventId: string;
  providerTransactionId?: string;
  orderIdClaimed?: string;
  amountMinor: number;
  currency: PortalCurrency;
  mismatchReason: string;
}): PaymentReconciliationRecord {
  const existing = reconciliationQueue.find(
    (r) => r.provider === input.provider && r.providerEventId === input.providerEventId
  );
  if (existing) return existing;

  const rec: PaymentReconciliationRecord = {
    id: crypto.randomUUID(),
    provider: input.provider,
    providerEventId: input.providerEventId,
    providerTransactionId: input.providerTransactionId,
    orderIdClaimed: input.orderIdClaimed,
    amountMinor: input.amountMinor,
    currency: input.currency,
    mismatchReason: input.mismatchReason.slice(0, 500),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  reconciliationQueue.push(rec);
  return rec;
}

export function listPaymentReconciliationExceptions(status?: string): PaymentReconciliationRecord[] {
  return [...reconciliationQueue]
    .filter((r) => !status || r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resolvePaymentReconciliationException(
  id: string,
  actorEmail: string,
  status: 'investigating' | 'resolved' | 'dismissed',
  resolutionNote: string
): PaymentReconciliationRecord | null {
  const rec = reconciliationQueue.find((r) => r.id === id);
  if (!rec) return null;
  rec.status = status;
  rec.resolvedBy = actorEmail;
  rec.resolutionNote = resolutionNote.slice(0, 500);
  if (status === 'resolved' || status === 'dismissed') {
    rec.resolvedAt = new Date().toISOString();
  }
  return rec;
}

export function createMakerCheckerApproval(input: {
  actionType: MakerCheckerApprovalRecord['actionType'];
  entityId: string;
  amountMinor: number;
  currency: PortalCurrency;
  requestedByEmail: string;
  requestedByRole: string;
  justification: string;
}): MakerCheckerApprovalRecord {
  const rec: MakerCheckerApprovalRecord = {
    id: crypto.randomUUID(),
    actionType: input.actionType,
    entityId: input.entityId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    requestedByEmail: input.requestedByEmail.toLowerCase(),
    requestedByRole: input.requestedByRole,
    status: 'pending_second_approval',
    justification: input.justification.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  makerCheckerApprovals.push(rec);
  return rec;
}

export function decideMakerCheckerApproval(input: {
  approvalId: string;
  decision: 'approved' | 'rejected';
  approverEmail: string;
  approverRole: string;
  decisionNote?: string;
}): { ok: boolean; record?: MakerCheckerApprovalRecord; error?: string; statusCode?: number } {
  const rec = makerCheckerApprovals.find((r) => r.id === input.approvalId);
  if (!rec) {
    return { ok: false, error: 'Maker-checker approval request not found.', statusCode: 404 };
  }
  if (rec.status !== 'pending_second_approval') {
    return { ok: false, error: `Approval is already in terminal state "${rec.status}".`, statusCode: 409 };
  }
  if (rec.requestedByEmail.toLowerCase() === input.approverEmail.toLowerCase()) {
    return {
      ok: false,
      error: 'Maker-checker violation: the requester cannot self-approve a high-value financial authorization.',
      statusCode: 403,
    };
  }
  rec.status = input.decision;
  rec.approverEmail = input.approverEmail.toLowerCase();
  rec.approverRole = input.approverRole;
  rec.decisionNote = (input.decisionNote || '').slice(0, 500);
  rec.decidedAt = new Date().toISOString();
  return { ok: true, record: rec };
}

export function listMakerCheckerApprovals(): MakerCheckerApprovalRecord[] {
  return [...makerCheckerApprovals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function recordPaymentDispute(input: {
  provider: PaymentProviderId;
  providerDisputeId: string;
  orderId?: string;
  amountMinor: number;
  currency: PortalCurrency;
  reason: string;
  assignedTo?: string;
}): PaymentDisputeRecord {
  const now = new Date().toISOString();
  const rec: PaymentDisputeRecord = {
    id: crypto.randomUUID(),
    provider: input.provider,
    providerDisputeId: input.providerDisputeId,
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    reason: input.reason.slice(0, 500),
    status: 'open',
    assignedTo: input.assignedTo,
    createdAt: now,
    updatedAt: now,
  };
  paymentDisputes.push(rec);
  return rec;
}

export function listPaymentDisputes(): PaymentDisputeRecord[] {
  return [...paymentDisputes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
