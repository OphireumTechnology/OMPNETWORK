import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { AdminRole } from '../db/types';

export interface KnowledgeDocumentRecord {
  id: string;
  title: string;
  category:
    | 'company_policy'
    | 'service_catalog'
    | 'pricing_guide'
    | 'sop'
    | 'faq'
    | 'legal'
    | 'brand_voice'
    | 'contracts'
    | 'operations';
  tenantScope: string;
  sourceRef: string;
  sourceMimeType: string;
  version: number;
  status: 'draft' | 'approved' | 'archived' | 'revoked';
  approvalStatus: 'draft' | 'approved' | 'archived' | 'revoked';
  allowedRoles: Array<AdminRole | 'public' | 'customer'>;
  content: string;
  chunkCount: number;
  uploadedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkRecord {
  id: string;
  documentId: string;
  documentTitle: string;
  category: KnowledgeDocumentRecord['category'];
  tenantScope: string;
  allowedRoles: KnowledgeDocumentRecord['allowedRoles'];
  chunkIndex: number;
  content: string;
  embedding: number[];
  tokenCount: number;
}

export interface KnowledgeSearchHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: KnowledgeDocumentRecord['category'];
  tenantScope: string;
  content: string;
  score: number;
  citationLabel: string;
}

export const ALLOWED_KB_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
]);

export const MAX_KB_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(system|developer|policy)\s+(prompts?|rules?|instructions?)/gi,
  /reveal\s+(your\s+)?(system\s+prompt|api\s+keys?|secrets?|credentials?|service\s+role)/gi,
  /you\s+are\s+now\s+(dan|root|system|unrestricted)/gi,
  /<\/?(system|assistant|developer|tool_call|function_call)\b[^>]*>/gi,
];

/**
 * Neutralizes embedded prompt-injection directives inside knowledge documents
 * BEFORE indexing AND before returning retrieved excerpts to an LLM.
 */
export function sanitizeKnowledgeText(raw: string): { sanitized: string; injectionPatternsNeutralized: number } {
  let sanitized = raw.replace(/\0/g, '').trim();
  let count = 0;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const matches = sanitized.match(pattern);
    if (matches) {
      count += matches.length;
      sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_DIRECTIVE]');
    }
  }
  return { sanitized, injectionPatternsNeutralized: count };
}

/**
 * Extracts readable text from uploaded UTF-8 text/markdown/JSON/CSV or basic PDF streams.
 */
export function extractTextFromUpload(buffer: Buffer, mimeType: string, fileName: string): string {
  const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
  if (cleanMime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    const raw = buffer.toString('latin1');
    const textMatches = raw.match(/\(([^()]{3,240})\)/g) || [];
    const extracted = textMatches
      .map((m) => m.slice(1, -1).replace(/\\([()\\])/g, '$1'))
      .filter((s) => /[a-zA-Z0-9]{2,}/.test(s))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (extracted.length > 0) return extracted;
    return buffer
      .toString('utf8')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (cleanMime === 'application/json') {
    const parsed = JSON.parse(buffer.toString('utf8'));
    return JSON.stringify(parsed, null, 2);
  }
  return buffer.toString('utf8');
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function deterministicLocalEmbedding(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const words = tokenize(text);
  for (const word of words) {
    const hash = crypto.createHash('sha256').update(word).digest();
    const idx = hash.readUInt16BE(0) % dims;
    const sign = hash[2] % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function chunkText(text: string, maxChars = 700, overlap = 120): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + maxChars);
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

const ALL_PUBLIC_AND_STAFF: KnowledgeDocumentRecord['allowedRoles'] = [
  'public',
  'customer',
  'super_admin',
  'admin',
  'operations_manager',
  'finance_officer',
  'sales_officer',
  'project_manager',
  'developer',
  'support_officer',
  'auditor',
];

const INTERNAL_STAFF_ROLES: KnowledgeDocumentRecord['allowedRoles'] = [
  'super_admin',
  'admin',
  'operations_manager',
  'finance_officer',
  'sales_officer',
  'project_manager',
  'developer',
  'support_officer',
  'auditor',
];

const DEFAULT_SEED_DOCUMENTS: Array<{
  title: string;
  category: KnowledgeDocumentRecord['category'];
  tenantScope: string;
  sourceRef: string;
  allowedRoles: KnowledgeDocumentRecord['allowedRoles'];
  content: string;
}> = [
  {
    title: 'OPHIREUM MULTIMEDIA PRODUCTION — Company Identity & Office',
    category: 'company_policy',
    tenantScope: 'public',
    sourceRef: 'seed:company_identity',
    allowedRoles: ALL_PUBLIC_AND_STAFF,
    content:
      'OPHIREUM MULTIMEDIA PRODUCTION is a DTI-registered Philippine multimedia, creative, software, and AI enterprise studio (DTI Reg. No. 7567003). Office address: KMC | One West Aeropark, 5th Floor & Penthouse, Clark Freeport Zone, Pampanga 2010, Philippines. Official contact email: contact@ophireummultimedia.com. Official website: https://ophireummultimedia.com/.',
  },
  {
    title: 'OPHIREUM Service Divisions & Client Portal Catalog Policy',
    category: 'service_catalog',
    tenantScope: 'public',
    sourceRef: 'seed:service_catalog',
    allowedRoles: ALL_PUBLIC_AND_STAFF,
    content:
      'OPHIREUM delivers 78 structured services across 10 divisions: Graphic Design & Visual Identity, Video & Audio Production, Photography, Web & App Development, Digital Marketing, Content & Copywriting, Events & Production Support, 3D & Animation, Corporate & B2B Communications, and AI & Creative Automation. The Client Portal features 7 structured store categories with transparent USD and PHP pricing, credit packs, monthly retainers, and custom enterprise packages.',
  },
  {
    title: 'Payment Verification, Payment Reference Format & Refund Policy',
    category: 'pricing_guide',
    tenantScope: 'public',
    sourceRef: 'seed:payment_policy',
    allowedRoles: ALL_PUBLIC_AND_STAFF,
    content:
      'All order totals are calculated strictly on the server from authoritative catalog prices. Payments are confirmed exclusively via cryptographically verified provider webhooks; clients can never mark orders paid or top up credits directly. Confirmed payments receive an atomic Asia/Manila payment reference formatted MMDDYYYYHHMMAM/PMNNN. Live payment charges remain disabled until merchant onboarding and compliance sign-off complete. Refunds require Finance Officer review and approval.',
  },
  {
    title: 'Privacy, Security & Philippine Data Privacy Act (RA 10173)',
    category: 'legal',
    tenantScope: 'public',
    sourceRef: 'seed:privacy_ra10173',
    allowedRoles: ALL_PUBLIC_AND_STAFF,
    content:
      'OPHIREUM enforces strict data minimization, explicit consent logging, private bucket file isolation with expiring signed download URLs, Row Level Security across customer records, and client personal data portability exports aligned with Republic Act No. 10173 (Philippine Data Privacy Act of 2012) and GDPR principles. Legal policy templates remain marked Draft Pending Licensed Counsel Sign-Off until reviewed by a licensed Philippine attorney.',
  },
  {
    title: 'Internal Operations & AI Workforce Governance SOP',
    category: 'sop',
    tenantScope: 'ophireum_internal',
    sourceRef: 'seed:internal_governance_sop',
    allowedRoles: INTERNAL_STAFF_ROLES,
    content:
      'All 25 AI Workforce Agents (A00–A24) operate under strict RBAC enforcement, tenant isolation, and human approval gates. High-impact financial, legal, refund, pricing, and external publishing tasks require explicit human authorization bound by a SHA-256 action hash. All executions and approval decisions are written to the append-only audit log.',
  },
];

export class CentralKnowledgeService {
  private readonly documents: KnowledgeDocumentRecord[] = [];
  private readonly chunks: KnowledgeChunkRecord[] = [];
  private readonly aiClient: GoogleGenAI | null;

  constructor(aiClientOrOptions?: GoogleGenAI | null | { aiClient?: GoogleGenAI | null; geminiApiKey?: string }) {
    if (aiClientOrOptions instanceof GoogleGenAI) {
      this.aiClient = aiClientOrOptions;
    } else if (aiClientOrOptions && typeof aiClientOrOptions === 'object') {
      if (aiClientOrOptions.aiClient !== undefined) {
        this.aiClient = aiClientOrOptions.aiClient;
      } else if (aiClientOrOptions.geminiApiKey) {
        this.aiClient = new GoogleGenAI({
          apiKey: aiClientOrOptions.geminiApiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
      } else {
        this.aiClient = null;
      }
    } else {
      this.aiClient = null;
    }
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const ts = new Date().toISOString();
    for (const seed of DEFAULT_SEED_DOCUMENTS) {
      const id = crypto.randomUUID();
      const docChunks = chunkText(seed.content);
      const doc: KnowledgeDocumentRecord = {
        id,
        title: seed.title,
        category: seed.category,
        tenantScope: seed.tenantScope,
        sourceRef: seed.sourceRef,
        sourceMimeType: 'text/plain',
        version: 1,
        status: 'approved',
        approvalStatus: 'approved',
        allowedRoles: seed.allowedRoles,
        content: seed.content,
        chunkCount: docChunks.length,
        uploadedBy: 'system_seed',
        approvedBy: 'system_seed',
        createdAt: ts,
        updatedAt: ts,
      };
      this.documents.push(doc);
      docChunks.forEach((chunkContent, idx) => {
        this.chunks.push({
          id: crypto.randomUUID(),
          documentId: id,
          documentTitle: doc.title,
          category: doc.category,
          tenantScope: doc.tenantScope,
          allowedRoles: doc.allowedRoles,
          chunkIndex: idx,
          content: chunkContent,
          embedding: deterministicLocalEmbedding(chunkContent),
          tokenCount: Math.ceil(chunkContent.length / 4),
        });
      });
    }
  }

  private async embedText(text: string): Promise<number[]> {
    if (this.aiClient) {
      try {
        const res = await this.aiClient.models.embedContent({
          model: 'gemini-embedding-2',
          contents: text.slice(0, 2000),
        });
        const values = res.embeddings?.[0]?.values;
        if (Array.isArray(values) && values.length > 0) {
          return values;
        }
      } catch {
        // Degrade safely to deterministic local embedding vector
      }
    }
    return deterministicLocalEmbedding(text);
  }

  private async indexDocumentChunks(doc: KnowledgeDocumentRecord): Promise<number> {
    for (let i = this.chunks.length - 1; i >= 0; i -= 1) {
      if (this.chunks[i].documentId === doc.id) {
        this.chunks.splice(i, 1);
      }
    }
    if (doc.status !== 'approved') {
      doc.chunkCount = 0;
      return 0;
    }
    const parts = chunkText(doc.content);
    for (let idx = 0; idx < parts.length; idx += 1) {
      const part = parts[idx];
      const embedding = await this.embedText(part);
      this.chunks.push({
        id: crypto.randomUUID(),
        documentId: doc.id,
        documentTitle: doc.title,
        category: doc.category,
        tenantScope: doc.tenantScope,
        allowedRoles: doc.allowedRoles,
        chunkIndex: idx,
        content: part,
        embedding,
        tokenCount: Math.ceil(part.length / 4),
      });
    }
    doc.chunkCount = parts.length;
    return parts.length;
  }

  listDocuments(filters?: {
    status?: string;
    approvalStatus?: string;
    tenantScope?: string;
    includeInternal?: boolean;
  }): KnowledgeDocumentRecord[] {
    const targetStatus = filters?.status || filters?.approvalStatus;
    return this.documents
      .filter((d) => {
        if (targetStatus && d.status !== targetStatus) return false;
        if (filters?.tenantScope && d.tenantScope !== filters.tenantScope) return false;
        if (filters?.includeInternal === false && d.tenantScope !== 'public') return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getDocument(documentId: string): KnowledgeDocumentRecord | null {
    return this.documents.find((d) => d.id === documentId) || null;
  }

  async ingestDocument(input: {
    title: string;
    category: KnowledgeDocumentRecord['category'];
    tenantScope?: string;
    tenantUserId?: string;
    visibility?: 'public' | 'internal_admin' | 'tenant_private';
    sourceRef?: string;
    sourceMimeType?: string;
    allowedRoles?: KnowledgeDocumentRecord['allowedRoles'];
    content?: string;
    rawContent?: string;
    uploadedBy?: string;
    createdBy?: string;
    autoApprove?: boolean;
    approvalStatus?: 'draft' | 'approved' | 'archived' | 'revoked';
  }): Promise<{ document: KnowledgeDocumentRecord; injectionPatternsNeutralized: number }> {
    const ts = new Date().toISOString();
    const rawText = input.content ?? input.rawContent ?? '';
    const { sanitized, injectionPatternsNeutralized } = sanitizeKnowledgeText(rawText);
    if (!sanitized) {
      throw new Error('Document contains no indexable text after sanitization.');
    }

    const tenantScope = (
      input.tenantScope ||
      input.tenantUserId ||
      (input.visibility === 'internal_admin' ? 'ophireum_internal' : 'public')
    ).trim();
    const existingSameTitle = this.documents.find(
      (d) =>
        d.title.toLowerCase() === input.title.trim().toLowerCase() &&
        d.tenantScope === tenantScope
    );

    const version = existingSameTitle ? existingSameTitle.version + 1 : 1;
    const defaultRoles: KnowledgeDocumentRecord['allowedRoles'] =
      tenantScope === 'public'
        ? ALL_PUBLIC_AND_STAFF
        : tenantScope === 'ophireum_internal'
          ? INTERNAL_STAFF_ROLES
          : ['customer', ...INTERNAL_STAFF_ROLES];

    const uploader = input.uploadedBy || input.createdBy || 'system';
    const isApproved = input.autoApprove || input.approvalStatus === 'approved';
    const status = isApproved ? 'approved' : input.approvalStatus || 'draft';
    const doc: KnowledgeDocumentRecord = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      category: input.category,
      tenantScope,
      sourceRef: (input.sourceRef || 'admin_upload').trim(),
      sourceMimeType: input.sourceMimeType || 'text/plain',
      version,
      status,
      approvalStatus: status,
      allowedRoles: input.allowedRoles && input.allowedRoles.length > 0 ? input.allowedRoles : defaultRoles,
      content: sanitized,
      chunkCount: 0,
      uploadedBy: uploader,
      approvedBy: isApproved ? uploader : undefined,
      createdAt: ts,
      updatedAt: ts,
    };

    this.documents.push(doc);
    if (doc.status === 'approved') {
      await this.indexDocumentChunks(doc);
    }
    return { document: doc, injectionPatternsNeutralized };
  }

  async uploadFileDocument(input: {
    fileName: string;
    mimeType: string;
    contentBase64: string;
    title?: string;
    category: KnowledgeDocumentRecord['category'];
    tenantScope?: string;
    allowedRoles?: KnowledgeDocumentRecord['allowedRoles'];
    uploadedBy: string;
    autoApprove?: boolean;
  }): Promise<{ document?: KnowledgeDocumentRecord; injectionPatternsNeutralized?: number; error?: string }> {
    const cleanMime = input.mimeType.toLowerCase().split(';')[0].trim();
    if (!ALLOWED_KB_MIME_TYPES.has(cleanMime)) {
      return {
        error: `Unsupported knowledge file MIME type: ${cleanMime}. Allowed: text/plain, text/markdown, text/csv, application/json, application/pdf.`,
      };
    }
    const cleanB64 = input.contentBase64.includes(',') ? input.contentBase64.split(',').pop()! : input.contentBase64;
    const buffer = Buffer.from(cleanB64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_KB_UPLOAD_BYTES) {
      return { error: `File must be non-empty and under ${MAX_KB_UPLOAD_BYTES / (1024 * 1024)} MB.` };
    }
    let extracted = '';
    try {
      extracted = extractTextFromUpload(buffer, cleanMime, input.fileName);
    } catch {
      return { error: 'Unable to parse uploaded file content.' };
    }
    if (!extracted.trim()) {
      return { error: 'No readable text could be extracted from the uploaded file.' };
    }

    return this.ingestDocument({
      title: (input.title || input.fileName).trim(),
      category: input.category,
      tenantScope: input.tenantScope,
      sourceRef: `upload:${input.fileName.replace(/[/\\]/g, '_')}`,
      sourceMimeType: cleanMime,
      allowedRoles: input.allowedRoles,
      content: extracted,
      uploadedBy: input.uploadedBy,
      autoApprove: input.autoApprove,
    });
  }

  async approveDocument(documentId: string, approver: string): Promise<KnowledgeDocumentRecord | null> {
    const doc = this.documents.find((d) => d.id === documentId);
    if (!doc) return null;
    doc.status = 'approved';
    doc.approvalStatus = 'approved';
    doc.approvedBy = approver;
    doc.updatedAt = new Date().toISOString();
    await this.indexDocumentChunks(doc);
    return doc;
  }

  async reindexDocument(documentId: string, actor: string): Promise<KnowledgeDocumentRecord | null> {
    const doc = this.documents.find((d) => d.id === documentId);
    if (!doc) return null;
    doc.version += 1;
    doc.updatedAt = new Date().toISOString();
    doc.approvedBy = doc.approvedBy || actor;
    await this.indexDocumentChunks(doc);
    return doc;
  }

  async revokeDocumentAccess(documentId: string): Promise<KnowledgeDocumentRecord | null> {
    const doc = this.documents.find((d) => d.id === documentId);
    if (!doc) return null;
    doc.status = 'revoked';
    doc.approvalStatus = 'revoked';
    doc.updatedAt = new Date().toISOString();
    await this.indexDocumentChunks(doc);
    return doc;
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    const idx = this.documents.findIndex((d) => d.id === documentId);
    if (idx < 0) return false;
    this.documents.splice(idx, 1);
    for (let i = this.chunks.length - 1; i >= 0; i -= 1) {
      if (this.chunks[i].documentId === documentId) {
        this.chunks.splice(i, 1);
      }
    }
    return true;
  }

  /**
   * Permission-first tenant-filtered semantic + lexical hybrid retrieval.
   * Enforces tenantScope and actorRole BEFORE scoring or returning any chunk.
   */
  async search(
    queryOrOpts:
      | string
      | {
          query: string;
          limit?: number;
          tenantScope?: string;
          tenantUserId?: string;
          actorRole?: AdminRole | 'public' | 'customer';
          includeInternal?: boolean;
        },
    maybeOptions?: {
      limit?: number;
      tenantScope?: string;
      tenantUserId?: string;
      actorRole?: AdminRole | 'public' | 'customer';
      includeInternal?: boolean;
    }
  ): Promise<KnowledgeSearchHit[]> {
    const query = typeof queryOrOpts === 'string' ? queryOrOpts : queryOrOpts.query;
    const options = typeof queryOrOpts === 'string' ? maybeOptions : queryOrOpts;
    const limit = Math.max(1, Math.min(12, options?.limit ?? 4));
    const requestedTenant = (options?.tenantScope || options?.tenantUserId || 'public').trim();
    const actorRole =
      options?.actorRole ??
      (requestedTenant !== 'public' && requestedTenant !== 'ophireum_internal' ? 'customer' : 'public');
    const isAdminActor = actorRole !== 'public' && actorRole !== 'customer';

    const authorizedChunks = this.chunks.filter((chunk) => {
      const doc = this.documents.find((d) => d.id === chunk.documentId);
      if (!doc || doc.status !== 'approved') return false;

      if (chunk.tenantScope !== 'public') {
        if (chunk.tenantScope === 'ophireum_internal') {
          if (!isAdminActor || !options?.includeInternal) return false;
        } else if (chunk.tenantScope !== requestedTenant) {
          return false;
        }
      }

      if (!chunk.allowedRoles.includes(actorRole) && actorRole !== 'super_admin') {
        return false;
      }
      return true;
    });

    if (authorizedChunks.length === 0) return [];

    const qEmbedding = await this.embedText(query);
    const qTokens = new Set(tokenize(query));

    const scored = authorizedChunks.map((chunk) => {
      const vecScore = cosineSimilarity(qEmbedding, chunk.embedding);
      const chunkTokens = tokenize(chunk.content + ' ' + chunk.documentTitle);
      let lexicalHits = 0;
      for (const tok of qTokens) {
        if (chunkTokens.includes(tok)) lexicalHits += 1;
      }
      const lexicalScore = qTokens.size > 0 ? lexicalHits / qTokens.size : 0;
      const combinedScore = Number((vecScore * 0.55 + lexicalScore * 0.45).toFixed(4));
      const { sanitized } = sanitizeKnowledgeText(chunk.content);
      return {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        category: chunk.category,
        tenantScope: chunk.tenantScope,
        content: sanitized,
        score: combinedScore,
        citationLabel: `${chunk.documentTitle} [${chunk.documentId.slice(0, 8)}#c${chunk.chunkIndex}]`,
        _relevant: lexicalHits > 0 || vecScore >= 0.35,
      };
    });

    return scored
      .filter((h) => h._relevant && h.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ _relevant: _r, ...hit }) => hit);
  }

  formatRetrievedKnowledgeForPrompt(hits: KnowledgeSearchHit[]): string {
    if (!hits || hits.length === 0) {
      return '<untrusted_knowledge_context>\nNo verified knowledge documents matched.\n</untrusted_knowledge_context>';
    }
    const body = hits
      .map((h) => `[Source: ${h.citationLabel} | Score: ${h.score}]\n${sanitizeKnowledgeText(h.content).sanitized}`)
      .join('\n\n');
    return `<untrusted_knowledge_context>\n${body}\n</untrusted_knowledge_context>`;
  }

  getStats() {
    return {
      totalDocuments: this.documents.length,
      approvedDocuments: this.documents.filter((d) => d.status === 'approved').length,
      draftDocuments: this.documents.filter((d) => d.status === 'draft').length,
      revokedDocuments: this.documents.filter((d) => d.status === 'revoked').length,
      totalChunks: this.chunks.length,
    };
  }
}

export { CentralKnowledgeService as KnowledgeService };
