import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { redactSensitiveText } from '../resilience';

export type ConversationOwnerType = 'authenticated' | 'anonymous' | 'admin';
export type ConversationChannel = 'chat' | 'voice' | 'live_audio' | 'tool';
export type VoiceTransportMode = 'gemini_live_ws' | 'http_wav_tts' | 'browser_fallback';

export interface AiConversationSessionRecord {
  id: string;
  sessionKey: string;
  ownerType: ConversationOwnerType;
  userId?: string;
  anonymousTokenHash?: string;
  tenantScope: string;
  channelMode: 'chat' | 'voice' | 'live_audio' | 'unified';
  language: string;
  status: 'active' | 'archived' | 'expired' | 'deleted';
  version: number;
  messageCount: number;
  summary: string;
  qualificationState: Record<string, unknown>;
  lastActivityAt: string;
  expiresAt: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationMessageRecord {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  clientMessageId?: string;
  sender: 'user' | 'assistant' | 'system' | 'tool';
  channel: ConversationChannel;
  content: string;
  toolName?: string;
  toolCallId?: string;
  metadata: Record<string, unknown>;
  containsRawAudio: false;
  createdAt: string;
}

export interface AiVoiceSessionRecord {
  id: string;
  conversationSessionId: string;
  transport: VoiceTransportMode;
  modelName: string;
  language: string;
  inputSampleRate: number;
  outputSampleRate: number;
  status: 'connecting' | 'active' | 'reconnecting' | 'degraded' | 'ended' | 'failed';
  bargeInCount: number;
  reconnectCount: number;
  deviceLabelSanitized?: string;
  rawAudioPersisted: false;
  startedAt: string;
  endedAt?: string;
  updatedAt: string;
}

export interface AiSessionEventRecord {
  id: string;
  conversationSessionId: string;
  eventType: string;
  actor: string;
  replicaId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AiSessionUsageRecord {
  id: string;
  conversationSessionId: string;
  modelName: string;
  modality: 'text' | 'audio_live' | 'audio_tts' | 'audio_stt' | 'embedding';
  inputTokens: number;
  outputTokens: number;
  audioSeconds: number;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface AiSessionCheckpointRecord {
  id: string;
  conversationSessionId: string;
  checkpointSequence: number;
  summaryText: string;
  extractedState: Record<string, unknown>;
  createdAt: string;
}

export type AiConsentType = 'conversation_memory' | 'voice_transcription' | 'data_retention';

export interface AiConversationConsentRecord {
  id: string;
  conversationSessionId: string;
  consentType: AiConsentType;
  granted: boolean;
  policyVersion: string;
  recordedAt: string;
  withdrawnAt?: string;
}

export interface AiConversationMemoryRecord {
  id: string;
  conversationSessionId: string;
  memoryKey: string;
  memoryValueRedacted: string;
  memoryScope: 'session' | 'customer_consented';
  consentVerified: boolean;
  sensitiveRedactionsApplied: number;
  status: 'active' | 'revoked' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface ConversationExportBundle {
  exportedAt: string;
  privacyNotice: string;
  session: Omit<AiConversationSessionRecord, 'anonymousTokenHash'>;
  messages: AiConversationMessageRecord[];
  checkpoints: AiSessionCheckpointRecord[];
  consents: AiConversationConsentRecord[];
  memories: AiConversationMemoryRecord[];
  rawAudioPersisted: false;
}

export function buildTokenBudgetedContext(
  messages: AiConversationMessageRecord[],
  options?: { maxTokens?: number; summaryPrefix?: string }
): {
  messages: AiConversationMessageRecord[];
  estimatedTokens: number;
  truncatedCount: number;
} {
  const maxTokens = Math.max(200, Math.min(32_000, options?.maxTokens ?? 4000));
  const summaryTokens = options?.summaryPrefix ? Math.ceil(options.summaryPrefix.length / 4) : 0;
  let remaining = Math.max(100, maxTokens - summaryTokens);
  const selected: AiConversationMessageRecord[] = [];

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const cost = Math.max(1, Math.ceil(msg.content.length / 4) + 6);
    if (cost > remaining && selected.length > 0) {
      break;
    }
    selected.unshift(msg);
    remaining = Math.max(0, remaining - cost);
  }

  return {
    messages: selected,
    estimatedTokens: maxTokens - remaining,
    truncatedCount: Math.max(0, messages.length - selected.length),
  };
}

export interface SessionAccessContext {
  userId?: string;
  isAdmin?: boolean;
  anonymousToken?: string;
}

export interface AppendMessageResult {
  message: AiConversationMessageRecord;
  sessionVersion: number;
  deduplicated: boolean;
}

export class ConversationConcurrencyError extends Error {
  public readonly statusCode = 409;
  public readonly code = 'SESSION_VERSION_CONFLICT';
  constructor(message = 'Conversation session was updated concurrently. Reload latest state and retry.') {
    super(message);
    this.name = 'ConversationConcurrencyError';
  }
}

export class ConversationForbiddenError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'SESSION_ACCESS_DENIED';
  constructor(message = 'You are not authorized to access this conversation session.') {
    super(message);
    this.name = 'ConversationForbiddenError';
  }
}

export class ConversationExpiredError extends Error {
  public readonly statusCode = 410;
  public readonly code = 'SESSION_EXPIRED';
  constructor(message = 'This conversation session has expired or been deleted.') {
    super(message);
    this.name = 'ConversationExpiredError';
  }
}

export function hashAnonymousToken(rawToken: string): string {
  return crypto.createHash('sha256').update(`ophireum-conv-tok-v1:${rawToken.trim()}`, 'utf8').digest('hex');
}

export function generateAnonymousSessionToken(): string {
  return `opm_st_${crypto.randomBytes(24).toString('base64url')}`;
}

function timingSafeHashEqual(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Verifies tenant & session ownership before reading, appending, checkpointing, or deleting.
 */
export function assertSessionAuthorized(
  session: AiConversationSessionRecord,
  access: SessionAccessContext
): void {
  if (session.deletedAt || session.status === 'deleted') {
    throw new ConversationExpiredError('Conversation session has been deleted.');
  }
  if (Date.parse(session.expiresAt) < Date.now() || session.status === 'expired') {
    throw new ConversationExpiredError('Conversation session has expired.');
  }
  if (access.isAdmin) {
    return;
  }
  if (session.ownerType === 'authenticated') {
    if (!access.userId || access.userId !== session.userId) {
      throw new ConversationForbiddenError('Authenticated customer session belongs to a different account.');
    }
    return;
  }
  if (session.ownerType === 'anonymous') {
    if (!access.anonymousToken) {
      throw new ConversationForbiddenError('Anonymous session token is required to continue this conversation.');
    }
    const candidateHash = hashAnonymousToken(access.anonymousToken);
    if (!timingSafeHashEqual(candidateHash, session.anonymousTokenHash)) {
      throw new ConversationForbiddenError('Invalid anonymous session ownership token.');
    }
    return;
  }
  throw new ConversationForbiddenError('Admin-scoped conversation session is restricted.');
}

export interface AiConversationStore {
  readonly backend: 'postgres_supabase' | 'memory_shared';
  createOrResumeSession(input: {
    sessionKey?: string;
    channelMode?: 'chat' | 'voice' | 'live_audio' | 'unified';
    language?: string;
    access?: SessionAccessContext;
    ttlHours?: number;
  }): Promise<{
    session: AiConversationSessionRecord;
    anonymousToken?: string;
    created: boolean;
  }>;
  getSessionByKey(
    sessionKey: string,
    access: SessionAccessContext
  ): Promise<AiConversationSessionRecord | null>;
  listMessages(
    sessionKey: string,
    access: SessionAccessContext,
    limit?: number
  ): Promise<{ session: AiConversationSessionRecord; messages: AiConversationMessageRecord[] } | null>;
  appendMessage(input: {
    sessionKey: string;
    access: SessionAccessContext;
    sender: AiConversationMessageRecord['sender'];
    channel: ConversationChannel;
    content: string;
    clientMessageId?: string;
    expectedVersion?: number;
    toolName?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AppendMessageResult>;
  updateQualificationState(
    sessionKey: string,
    access: SessionAccessContext,
    patch: Record<string, unknown>
  ): Promise<AiConversationSessionRecord>;
  startVoiceSession(input: {
    sessionKey: string;
    access: SessionAccessContext;
    transport: VoiceTransportMode;
    modelName: string;
    language: string;
    deviceLabel?: string;
  }): Promise<AiVoiceSessionRecord>;
  updateVoiceSession(
    voiceSessionId: string,
    patch: Partial<Pick<AiVoiceSessionRecord, 'status' | 'bargeInCount' | 'reconnectCount' | 'endedAt'>>
  ): Promise<void>;
  recordEvent(input: {
    conversationSessionId: string;
    eventType: string;
    actor?: string;
    payload?: Record<string, unknown>;
  }): Promise<AiSessionEventRecord>;
  recordUsage(input: {
    conversationSessionId: string;
    modelName: string;
    modality: AiSessionUsageRecord['modality'];
    inputTokens: number;
    outputTokens: number;
    audioSeconds?: number;
    estimatedCostUsd?: number;
  }): Promise<AiSessionUsageRecord>;
  createCheckpoint(input: {
    sessionKey: string;
    access: SessionAccessContext;
    summaryText: string;
    extractedState?: Record<string, unknown>;
  }): Promise<AiSessionCheckpointRecord>;
  deleteSession(sessionKey: string, access: SessionAccessContext): Promise<boolean>;
  purgeExpiredSessions(nowIso?: string): Promise<number>;
  listSessionAudit(sessionId: string): Promise<{
    voiceSessions: AiVoiceSessionRecord[];
    events: AiSessionEventRecord[];
    usage: AiSessionUsageRecord[];
    checkpoints: AiSessionCheckpointRecord[];
  }>;
  recordConsent?(input: {
    sessionKey: string;
    access: SessionAccessContext;
    consentType: AiConsentType;
    granted: boolean;
    policyVersion?: string;
  }): Promise<AiConversationConsentRecord>;
  saveMemory?(input: {
    sessionKey: string;
    access: SessionAccessContext;
    memoryKey: string;
    memoryValue: string;
    memoryScope?: 'session' | 'customer_consented';
  }): Promise<AiConversationMemoryRecord>;
  exportConversationData?(
    sessionKey: string,
    access: SessionAccessContext
  ): Promise<ConversationExportBundle | null>;
}

/**
 * Shared state container that can be passed to multiple Express app instances
 * in tests to simulate multi-replica shared persistence and backend restarts.
 */
export interface SharedConversationMemoryBacking {
  sessions: Map<string, AiConversationSessionRecord>;
  messagesBySessionId: Map<string, AiConversationMessageRecord[]>;
  voiceSessions: Map<string, AiVoiceSessionRecord>;
  events: AiSessionEventRecord[];
  usage: AiSessionUsageRecord[];
  checkpoints: AiSessionCheckpointRecord[];
  consents: AiConversationConsentRecord[];
  memories: AiConversationMemoryRecord[];
}

export function createSharedConversationBacking(): SharedConversationMemoryBacking {
  return {
    sessions: new Map(),
    messagesBySessionId: new Map(),
    voiceSessions: new Map(),
    events: [],
    usage: [],
    checkpoints: [],
    consents: [],
    memories: [],
  };
}

export class InMemoryAiConversationStore implements AiConversationStore {
  public readonly backend = 'memory_shared' as const;
  private readonly replicaId: string;
  private readonly backing: SharedConversationMemoryBacking;

  constructor(options?: { backing?: SharedConversationMemoryBacking; replicaId?: string }) {
    this.backing = options?.backing ?? createSharedConversationBacking();
    this.replicaId = options?.replicaId || process.env.RAILWAY_REPLICA_ID || `replica-${process.pid}`;
  }

  private findByKey(sessionKey: string): AiConversationSessionRecord | undefined {
    for (const s of this.backing.sessions.values()) {
      if (s.sessionKey === sessionKey) return s;
    }
    return undefined;
  }

  async createOrResumeSession(input: {
    sessionKey?: string;
    channelMode?: 'chat' | 'voice' | 'live_audio' | 'unified';
    language?: string;
    access?: SessionAccessContext;
    ttlHours?: number;
  }) {
    const cleanKey = (input.sessionKey || '').trim().slice(0, 80);
    const access = input.access || {};

    if (cleanKey) {
      const existing = this.findByKey(cleanKey);
      if (existing) {
        assertSessionAuthorized(existing, access);
        return { session: { ...existing }, created: false };
      }
    }

    const now = new Date();
    const ttlMs = Math.max(1, input.ttlHours ?? 24 * 30) * 3600 * 1000;
    const ownerType: ConversationOwnerType = access.isAdmin
      ? 'admin'
      : access.userId
        ? 'authenticated'
        : 'anonymous';

    let rawToken: string | undefined;
    let tokenHash: string | undefined;
    if (ownerType === 'anonymous') {
      rawToken = access.anonymousToken?.trim() || generateAnonymousSessionToken();
      tokenHash = hashAnonymousToken(rawToken);
    }

    const sessionKey = cleanKey || `opm-session-${crypto.randomUUID()}`;
    const record: AiConversationSessionRecord = {
      id: crypto.randomUUID(),
      sessionKey,
      ownerType,
      userId: ownerType === 'authenticated' ? access.userId : undefined,
      anonymousTokenHash: tokenHash,
      tenantScope: ownerType === 'authenticated' && access.userId ? `user:${access.userId}` : ownerType === 'admin' ? 'ophireum_internal' : 'public',
      channelMode: input.channelMode || 'unified',
      language: input.language || 'en-US',
      status: 'active',
      version: 1,
      messageCount: 0,
      summary: '',
      qualificationState: {},
      lastActivityAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.backing.sessions.set(record.id, record);
    this.backing.messagesBySessionId.set(record.id, []);
    await this.recordEvent({
      conversationSessionId: record.id,
      eventType: 'session_created',
      actor: record.userId || ownerType,
      payload: { channelMode: record.channelMode, language: record.language },
    });

    return {
      session: { ...record },
      anonymousToken: rawToken,
      created: true,
    };
  }

  async getSessionByKey(sessionKey: string, access: SessionAccessContext) {
    const found = this.findByKey(sessionKey);
    if (!found) return null;
    assertSessionAuthorized(found, access);
    return { ...found };
  }

  async listMessages(sessionKey: string, access: SessionAccessContext, limit = 80) {
    const found = this.findByKey(sessionKey);
    if (!found) return null;
    assertSessionAuthorized(found, access);
    const all = this.backing.messagesBySessionId.get(found.id) || [];
    const safeLimit = Math.max(1, Math.min(200, limit));
    return {
      session: { ...found },
      messages: all.slice(-safeLimit).map((m) => ({ ...m })),
    };
  }

  async appendMessage(input: {
    sessionKey: string;
    access: SessionAccessContext;
    sender: AiConversationMessageRecord['sender'];
    channel: ConversationChannel;
    content: string;
    clientMessageId?: string;
    expectedVersion?: number;
    toolName?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AppendMessageResult> {
    const session = this.findByKey(input.sessionKey);
    if (!session) {
      throw new ConversationExpiredError('Conversation session not found.');
    }
    assertSessionAuthorized(session, input.access);

    const list = this.backing.messagesBySessionId.get(session.id) || [];
    if (input.clientMessageId) {
      const existing = list.find((m) => m.clientMessageId === input.clientMessageId);
      if (existing) {
        return {
          message: { ...existing },
          sessionVersion: session.version,
          deduplicated: true,
        };
      }
    }

    if (input.expectedVersion !== undefined && session.version !== input.expectedVersion) {
      throw new ConversationConcurrencyError(
        `Session version mismatch: expected ${input.expectedVersion}, current ${session.version}.`
      );
    }

    // Never allow raw audio blobs or unredacted sensitive credentials/cards to be stored in conversation memory
    const sanitizedMetadata = sanitizeNoRawAudioMetadata(input.metadata || {});
    const redaction = redactSensitiveText(input.content);
    const now = new Date().toISOString();
    const nextSeq = session.messageCount + 1;
    const message: AiConversationMessageRecord = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      sequenceNumber: nextSeq,
      clientMessageId: input.clientMessageId,
      sender: input.sender,
      channel: input.channel,
      content: redaction.redactedText,
      toolName: input.toolName,
      toolCallId: input.toolCallId,
      metadata:
        redaction.findingsCount > 0
          ? {
              ...sanitizedMetadata,
              sensitiveRedactionsApplied: redaction.findingsCount,
              redactedCategories: redaction.categories,
            }
          : sanitizedMetadata,
      containsRawAudio: false,
      createdAt: now,
    };

    list.push(message);
    this.backing.messagesBySessionId.set(session.id, list);
    session.messageCount = nextSeq;
    session.version += 1;
    session.lastActivityAt = now;
    session.updatedAt = now;

    return {
      message: { ...message },
      sessionVersion: session.version,
      deduplicated: false,
    };
  }

  async updateQualificationState(
    sessionKey: string,
    access: SessionAccessContext,
    patch: Record<string, unknown>
  ): Promise<AiConversationSessionRecord> {
    const session = this.findByKey(sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, access);
    session.qualificationState = { ...session.qualificationState, ...patch };
    session.version += 1;
    session.updatedAt = new Date().toISOString();
    return { ...session };
  }

  async startVoiceSession(input: {
    sessionKey: string;
    access: SessionAccessContext;
    transport: VoiceTransportMode;
    modelName: string;
    language: string;
    deviceLabel?: string;
  }): Promise<AiVoiceSessionRecord> {
    const session = this.findByKey(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);
    const now = new Date().toISOString();
    const rec: AiVoiceSessionRecord = {
      id: crypto.randomUUID(),
      conversationSessionId: session.id,
      transport: input.transport,
      modelName: input.modelName,
      language: input.language,
      inputSampleRate: 16000,
      outputSampleRate: 24000,
      status: 'active',
      bargeInCount: 0,
      reconnectCount: 0,
      deviceLabelSanitized: input.deviceLabel ? input.deviceLabel.slice(0, 120) : undefined,
      rawAudioPersisted: false,
      startedAt: now,
      updatedAt: now,
    };
    this.backing.voiceSessions.set(rec.id, rec);
    await this.recordEvent({
      conversationSessionId: session.id,
      eventType: 'voice_session_started',
      actor: session.userId || session.ownerType,
      payload: { voiceSessionId: rec.id, transport: rec.transport, model: rec.modelName },
    });
    return { ...rec };
  }

  async updateVoiceSession(
    voiceSessionId: string,
    patch: Partial<Pick<AiVoiceSessionRecord, 'status' | 'bargeInCount' | 'reconnectCount' | 'endedAt'>>
  ): Promise<void> {
    const rec = this.backing.voiceSessions.get(voiceSessionId);
    if (!rec) return;
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
  }

  async recordEvent(input: {
    conversationSessionId: string;
    eventType: string;
    actor?: string;
    payload?: Record<string, unknown>;
  }): Promise<AiSessionEventRecord> {
    const rec: AiSessionEventRecord = {
      id: crypto.randomUUID(),
      conversationSessionId: input.conversationSessionId,
      eventType: input.eventType,
      actor: input.actor || 'system',
      replicaId: this.replicaId,
      payload: sanitizeNoRawAudioMetadata(input.payload || {}),
      createdAt: new Date().toISOString(),
    };
    this.backing.events.push(rec);
    return { ...rec };
  }

  async recordUsage(input: {
    conversationSessionId: string;
    modelName: string;
    modality: AiSessionUsageRecord['modality'];
    inputTokens: number;
    outputTokens: number;
    audioSeconds?: number;
    estimatedCostUsd?: number;
  }): Promise<AiSessionUsageRecord> {
    const rec: AiSessionUsageRecord = {
      id: crypto.randomUUID(),
      conversationSessionId: input.conversationSessionId,
      modelName: input.modelName,
      modality: input.modality,
      inputTokens: Math.max(0, Math.round(input.inputTokens)),
      outputTokens: Math.max(0, Math.round(input.outputTokens)),
      audioSeconds: Math.max(0, Number(input.audioSeconds || 0)),
      estimatedCostUsd: Math.max(0, Number(input.estimatedCostUsd || 0)),
      createdAt: new Date().toISOString(),
    };
    this.backing.usage.push(rec);
    return { ...rec };
  }

  async createCheckpoint(input: {
    sessionKey: string;
    access: SessionAccessContext;
    summaryText: string;
    extractedState?: Record<string, unknown>;
  }): Promise<AiSessionCheckpointRecord> {
    const session = this.findByKey(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);
    const existingCount = this.backing.checkpoints.filter(
      (c) => c.conversationSessionId === session.id
    ).length;
    const rec: AiSessionCheckpointRecord = {
      id: crypto.randomUUID(),
      conversationSessionId: session.id,
      checkpointSequence: existingCount + 1,
      summaryText: input.summaryText.slice(0, 4000),
      extractedState: input.extractedState || session.qualificationState,
      createdAt: new Date().toISOString(),
    };
    this.backing.checkpoints.push(rec);
    session.summary = rec.summaryText;
    session.version += 1;
    session.updatedAt = new Date().toISOString();
    return { ...rec };
  }

  async deleteSession(sessionKey: string, access: SessionAccessContext): Promise<boolean> {
    const session = this.findByKey(sessionKey);
    if (!session) return false;
    assertSessionAuthorized(session, access);
    const now = new Date().toISOString();
    session.status = 'deleted';
    session.deletedAt = now;
    session.updatedAt = now;
    this.backing.messagesBySessionId.delete(session.id);
    await this.recordEvent({
      conversationSessionId: session.id,
      eventType: 'session_deleted',
      actor: access.userId || (access.isAdmin ? 'admin' : 'anonymous'),
      payload: { reason: 'authorized_user_deletion' },
    });
    return true;
  }

  async purgeExpiredSessions(nowIso?: string): Promise<number> {
    const cutoff = Date.parse(nowIso || new Date().toISOString());
    let purged = 0;
    for (const session of this.backing.sessions.values()) {
      if (session.status === 'active' && Date.parse(session.expiresAt) <= cutoff) {
        session.status = 'expired';
        session.updatedAt = new Date(cutoff).toISOString();
        purged += 1;
      }
    }
    return purged;
  }

  async listSessionAudit(sessionId: string) {
    return {
      voiceSessions: Array.from(this.backing.voiceSessions.values()).filter(
        (v) => v.conversationSessionId === sessionId
      ),
      events: this.backing.events.filter((e) => e.conversationSessionId === sessionId),
      usage: this.backing.usage.filter((u) => u.conversationSessionId === sessionId),
      checkpoints: this.backing.checkpoints.filter((c) => c.conversationSessionId === sessionId),
    };
  }

  async recordConsent(input: {
    sessionKey: string;
    access: SessionAccessContext;
    consentType: AiConsentType;
    granted: boolean;
    policyVersion?: string;
  }): Promise<AiConversationConsentRecord> {
    const session = this.findByKey(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);
    const now = new Date().toISOString();
    const rec: AiConversationConsentRecord = {
      id: crypto.randomUUID(),
      conversationSessionId: session.id,
      consentType: input.consentType,
      granted: input.granted,
      policyVersion: input.policyVersion || '2026.1-draft',
      recordedAt: now,
      withdrawnAt: input.granted ? undefined : now,
    };
    this.backing.consents.push(rec);
    if (input.consentType === 'conversation_memory' && !input.granted) {
      for (const mem of this.backing.memories) {
        if (mem.conversationSessionId === session.id && mem.memoryScope === 'customer_consented') {
          mem.status = 'revoked';
          mem.updatedAt = now;
        }
      }
    }
    await this.recordEvent({
      conversationSessionId: session.id,
      eventType: input.granted ? 'consent_granted' : 'consent_withdrawn',
      actor: session.userId || session.ownerType,
      payload: { consentType: input.consentType, policyVersion: rec.policyVersion },
    });
    return { ...rec };
  }

  async saveMemory(input: {
    sessionKey: string;
    access: SessionAccessContext;
    memoryKey: string;
    memoryValue: string;
    memoryScope?: 'session' | 'customer_consented';
  }): Promise<AiConversationMemoryRecord> {
    const session = this.findByKey(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);

    const scope = input.memoryScope || 'session';
    const latestConsent = [...this.backing.consents]
      .filter((c) => c.conversationSessionId === session.id && c.consentType === 'conversation_memory')
      .pop();
    const hasConsent = Boolean(latestConsent?.granted);

    if (scope === 'customer_consented' && !hasConsent) {
      throw new ConversationForbiddenError(
        'Explicit conversation_memory consent is required before saving persistent customer memory.'
      );
    }

    const redaction = redactSensitiveText(input.memoryValue);
    const now = new Date().toISOString();
    const cleanKey = input.memoryKey.trim().slice(0, 80);
    const existing = this.backing.memories.find(
      (m) => m.conversationSessionId === session.id && m.memoryKey === cleanKey
    );
    if (existing) {
      existing.memoryValueRedacted = redaction.redactedText.slice(0, 2000);
      existing.memoryScope = scope;
      existing.consentVerified = hasConsent;
      existing.sensitiveRedactionsApplied = redaction.findingsCount;
      existing.status = 'active';
      existing.updatedAt = now;
      return { ...existing };
    }

    const rec: AiConversationMemoryRecord = {
      id: crypto.randomUUID(),
      conversationSessionId: session.id,
      memoryKey: cleanKey,
      memoryValueRedacted: redaction.redactedText.slice(0, 2000),
      memoryScope: scope,
      consentVerified: hasConsent,
      sensitiveRedactionsApplied: redaction.findingsCount,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.backing.memories.push(rec);
    return { ...rec };
  }

  async exportConversationData(
    sessionKey: string,
    access: SessionAccessContext
  ): Promise<ConversationExportBundle | null> {
    const session = this.findByKey(sessionKey);
    if (!session) return null;
    assertSessionAuthorized(session, access);
    const { anonymousTokenHash: _hidden, ...safeSession } = session;
    const messages = (this.backing.messagesBySessionId.get(session.id) || []).map((m) => ({ ...m }));
    const checkpoints = this.backing.checkpoints
      .filter((c) => c.conversationSessionId === session.id)
      .map((c) => ({ ...c }));
    const consents = this.backing.consents
      .filter((c) => c.conversationSessionId === session.id)
      .map((c) => ({ ...c }));
    const memories = this.backing.memories
      .filter((m) => m.conversationSessionId === session.id && m.status !== 'deleted')
      .map((m) => ({ ...m }));

    return {
      exportedAt: new Date().toISOString(),
      privacyNotice:
        'RA 10173 Data Portability Export — Sensitive secrets/payment data are redacted and raw microphone audio is never stored.',
      session: safeSession,
      messages,
      checkpoints,
      consents,
      memories,
      rawAudioPersisted: false,
    };
  }
}

/**
 * Durable PostgreSQL-backed conversation store via Supabase service_role (Migration 005).
 */
export class SupabaseAiConversationStore implements AiConversationStore {
  public readonly backend = 'postgres_supabase' as const;
  private readonly replicaId: string;

  constructor(private readonly client: SupabaseClient, replicaId?: string) {
    this.replicaId = replicaId || process.env.RAILWAY_REPLICA_ID || `replica-${process.pid}`;
  }

  private mapSession(row: any): AiConversationSessionRecord {
    return {
      id: row.id,
      sessionKey: row.session_key,
      ownerType: row.owner_type,
      userId: row.user_id || undefined,
      anonymousTokenHash: row.anonymous_token_hash || undefined,
      tenantScope: row.tenant_scope,
      channelMode: row.channel_mode,
      language: row.language,
      status: row.status,
      version: Number(row.version),
      messageCount: Number(row.message_count),
      summary: row.summary || '',
      qualificationState: row.qualification_state || {},
      lastActivityAt: row.last_activity_at,
      expiresAt: row.expires_at,
      deletedAt: row.deleted_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMessage(row: any): AiConversationMessageRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      sequenceNumber: Number(row.sequence_number),
      clientMessageId: row.client_message_id || undefined,
      sender: row.sender,
      channel: row.channel,
      content: row.content,
      toolName: row.tool_name || undefined,
      toolCallId: row.tool_call_id || undefined,
      metadata: row.metadata || {},
      containsRawAudio: false,
      createdAt: row.created_at,
    };
  }

  private async fetchRawSession(sessionKey: string): Promise<AiConversationSessionRecord | null> {
    const { data, error } = await this.client
      .from('ai_conversation_sessions')
      .select('*')
      .eq('session_key', sessionKey)
      .maybeSingle();
    if (error) throw new Error(`Supabase session lookup failed: ${error.message}`);
    return data ? this.mapSession(data) : null;
  }

  async createOrResumeSession(input: {
    sessionKey?: string;
    channelMode?: 'chat' | 'voice' | 'live_audio' | 'unified';
    language?: string;
    access?: SessionAccessContext;
    ttlHours?: number;
  }) {
    const cleanKey = (input.sessionKey || '').trim().slice(0, 80);
    const access = input.access || {};
    if (cleanKey) {
      const existing = await this.fetchRawSession(cleanKey);
      if (existing) {
        assertSessionAuthorized(existing, access);
        return { session: existing, created: false };
      }
    }

    const ownerType: ConversationOwnerType = access.isAdmin
      ? 'admin'
      : access.userId
        ? 'authenticated'
        : 'anonymous';
    let rawToken: string | undefined;
    let tokenHash: string | undefined;
    if (ownerType === 'anonymous') {
      rawToken = access.anonymousToken?.trim() || generateAnonymousSessionToken();
      tokenHash = hashAnonymousToken(rawToken);
    }

    const ttlMs = Math.max(1, input.ttlHours ?? 24 * 30) * 3600 * 1000;
    const sessionKey = cleanKey || `opm-session-${crypto.randomUUID()}`;
    const { data, error } = await this.client
      .from('ai_conversation_sessions')
      .insert({
        session_key: sessionKey,
        owner_type: ownerType,
        user_id: ownerType === 'authenticated' ? access.userId : null,
        anonymous_token_hash: tokenHash || null,
        tenant_scope:
          ownerType === 'authenticated' && access.userId
            ? `user:${access.userId}`
            : ownerType === 'admin'
              ? 'ophireum_internal'
              : 'public',
        channel_mode: input.channelMode || 'unified',
        language: input.language || 'en-US',
        expires_at: new Date(Date.now() + ttlMs).toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to persist AI conversation session: ${error?.message || 'Unknown error'}`);
    }
    const mapped = this.mapSession(data);
    await this.recordEvent({
      conversationSessionId: mapped.id,
      eventType: 'session_created',
      actor: mapped.userId || ownerType,
      payload: { channelMode: mapped.channelMode, language: mapped.language },
    });
    return { session: mapped, anonymousToken: rawToken, created: true };
  }

  async getSessionByKey(sessionKey: string, access: SessionAccessContext) {
    const found = await this.fetchRawSession(sessionKey);
    if (!found) return null;
    assertSessionAuthorized(found, access);
    return found;
  }

  async listMessages(sessionKey: string, access: SessionAccessContext, limit = 80) {
    const found = await this.fetchRawSession(sessionKey);
    if (!found) return null;
    assertSessionAuthorized(found, access);
    const { data, error } = await this.client
      .from('ai_conversation_messages')
      .select('*')
      .eq('session_id', found.id)
      .order('sequence_number', { ascending: true })
      .limit(Math.max(1, Math.min(200, limit)));
    if (error) throw new Error(`Failed to load conversation messages: ${error.message}`);
    return { session: found, messages: (data || []).map((r) => this.mapMessage(r)) };
  }

  async appendMessage(input: {
    sessionKey: string;
    access: SessionAccessContext;
    sender: AiConversationMessageRecord['sender'];
    channel: ConversationChannel;
    content: string;
    clientMessageId?: string;
    expectedVersion?: number;
    toolName?: string;
    toolCallId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AppendMessageResult> {
    const session = await this.fetchRawSession(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);

    const redaction = redactSensitiveText(input.content);
    const cleanMetadata = sanitizeNoRawAudioMetadata(input.metadata || {});
    const enrichedMetadata =
      redaction.findingsCount > 0
        ? {
            ...cleanMetadata,
            sensitiveRedactionsApplied: redaction.findingsCount,
            redactedCategories: redaction.categories,
          }
        : cleanMetadata;

    const { data, error } = await this.client.rpc('append_ai_conversation_message', {
      p_session_id: session.id,
      p_sender: input.sender,
      p_channel: input.channel,
      p_content: redaction.redactedText,
      p_client_message_id: input.clientMessageId || null,
      p_expected_version: input.expectedVersion ?? null,
      p_tool_name: input.toolName || null,
      p_tool_call_id: input.toolCallId || null,
      p_metadata: enrichedMetadata,
    });

    if (error) {
      if (error.message.includes('AI_SESSION_VERSION_CONFLICT')) {
        throw new ConversationConcurrencyError(error.message);
      }
      if (error.message.includes('AI_SESSION_EXPIRED') || error.message.includes('AI_SESSION_INACTIVE')) {
        throw new ConversationExpiredError(error.message);
      }
      throw new Error(`Failed to append AI conversation message: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    const message: AiConversationMessageRecord = {
      id: row.message_id,
      sessionId: session.id,
      sequenceNumber: Number(row.sequence_number),
      clientMessageId: input.clientMessageId,
      sender: input.sender,
      channel: input.channel,
      content: redaction.redactedText,
      toolName: input.toolName,
      toolCallId: input.toolCallId,
      metadata: enrichedMetadata,
      containsRawAudio: false,
      createdAt: new Date().toISOString(),
    };
    return {
      message,
      sessionVersion: Number(row.session_version),
      deduplicated: Boolean(row.deduplicated),
    };
  }

  async updateQualificationState(
    sessionKey: string,
    access: SessionAccessContext,
    patch: Record<string, unknown>
  ): Promise<AiConversationSessionRecord> {
    const session = await this.fetchRawSession(sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, access);
    const merged = { ...session.qualificationState, ...patch };
    const { data, error } = await this.client
      .from('ai_conversation_sessions')
      .update({
        qualification_state: merged,
        version: session.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .eq('version', session.version)
      .select('*')
      .single();
    if (error || !data) throw new ConversationConcurrencyError();
    return this.mapSession(data);
  }

  async startVoiceSession(input: {
    sessionKey: string;
    access: SessionAccessContext;
    transport: VoiceTransportMode;
    modelName: string;
    language: string;
    deviceLabel?: string;
  }): Promise<AiVoiceSessionRecord> {
    const session = await this.fetchRawSession(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);
    const { data, error } = await this.client
      .from('ai_voice_sessions')
      .insert({
        conversation_session_id: session.id,
        transport: input.transport,
        model_name: input.modelName,
        language: input.language,
        status: 'active',
        device_label_sanitized: input.deviceLabel ? input.deviceLabel.slice(0, 120) : null,
        raw_audio_persisted: false,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(`Failed to persist voice session: ${error?.message}`);
    return {
      id: data.id,
      conversationSessionId: data.conversation_session_id,
      transport: data.transport,
      modelName: data.model_name,
      language: data.language,
      inputSampleRate: data.input_sample_rate,
      outputSampleRate: data.output_sample_rate,
      status: data.status,
      bargeInCount: data.barge_in_count,
      reconnectCount: data.reconnect_count,
      deviceLabelSanitized: data.device_label_sanitized || undefined,
      rawAudioPersisted: false,
      startedAt: data.started_at,
      endedAt: data.ended_at || undefined,
      updatedAt: data.updated_at,
    };
  }

  async updateVoiceSession(
    voiceSessionId: string,
    patch: Partial<Pick<AiVoiceSessionRecord, 'status' | 'bargeInCount' | 'reconnectCount' | 'endedAt'>>
  ): Promise<void> {
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.bargeInCount !== undefined) dbPatch.barge_in_count = patch.bargeInCount;
    if (patch.reconnectCount !== undefined) dbPatch.reconnect_count = patch.reconnectCount;
    if (patch.endedAt !== undefined) dbPatch.ended_at = patch.endedAt;
    const { error } = await this.client.from('ai_voice_sessions').update(dbPatch).eq('id', voiceSessionId);
    if (error) throw new Error(`Failed to update voice session: ${error.message}`);
  }

  async recordEvent(input: {
    conversationSessionId: string;
    eventType: string;
    actor?: string;
    payload?: Record<string, unknown>;
  }): Promise<AiSessionEventRecord> {
    const { data, error } = await this.client
      .from('ai_session_events')
      .insert({
        conversation_session_id: input.conversationSessionId,
        event_type: input.eventType,
        actor: input.actor || 'system',
        replica_id: this.replicaId,
        payload: sanitizeNoRawAudioMetadata(input.payload || {}),
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(`Failed to record session event: ${error?.message}`);
    return {
      id: data.id,
      conversationSessionId: data.conversation_session_id,
      eventType: data.event_type,
      actor: data.actor,
      replicaId: data.replica_id,
      payload: data.payload || {},
      createdAt: data.created_at,
    };
  }

  async recordUsage(input: {
    conversationSessionId: string;
    modelName: string;
    modality: AiSessionUsageRecord['modality'];
    inputTokens: number;
    outputTokens: number;
    audioSeconds?: number;
    estimatedCostUsd?: number;
  }): Promise<AiSessionUsageRecord> {
    const { data, error } = await this.client
      .from('ai_session_usage')
      .insert({
        conversation_session_id: input.conversationSessionId,
        model_name: input.modelName,
        modality: input.modality,
        input_tokens: Math.max(0, Math.round(input.inputTokens)),
        output_tokens: Math.max(0, Math.round(input.outputTokens)),
        audio_seconds: Math.max(0, Number(input.audioSeconds || 0)),
        estimated_cost_usd: Math.max(0, Number(input.estimatedCostUsd || 0)),
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(`Failed to record session usage: ${error?.message}`);
    return {
      id: data.id,
      conversationSessionId: data.conversation_session_id,
      modelName: data.model_name,
      modality: data.modality,
      inputTokens: data.input_tokens,
      outputTokens: data.output_tokens,
      audioSeconds: Number(data.audio_seconds),
      estimatedCostUsd: Number(data.estimated_cost_usd),
      createdAt: data.created_at,
    };
  }

  async createCheckpoint(input: {
    sessionKey: string;
    access: SessionAccessContext;
    summaryText: string;
    extractedState?: Record<string, unknown>;
  }): Promise<AiSessionCheckpointRecord> {
    const session = await this.fetchRawSession(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);

    const { count } = await this.client
      .from('ai_session_checkpoints')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_session_id', session.id);

    const seq = (count || 0) + 1;
    const { data, error } = await this.client
      .from('ai_session_checkpoints')
      .insert({
        conversation_session_id: session.id,
        checkpoint_sequence: seq,
        summary_text: input.summaryText.slice(0, 4000),
        extracted_state: input.extractedState || session.qualificationState,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(`Failed to persist checkpoint: ${error?.message}`);

    await this.client
      .from('ai_conversation_sessions')
      .update({ summary: recSummary(input.summaryText), updated_at: new Date().toISOString() })
      .eq('id', session.id);

    return {
      id: data.id,
      conversationSessionId: data.conversation_session_id,
      checkpointSequence: data.checkpoint_sequence,
      summaryText: data.summary_text,
      extractedState: data.extracted_state || {},
      createdAt: data.created_at,
    };
  }

  async deleteSession(sessionKey: string, access: SessionAccessContext): Promise<boolean> {
    const session = await this.fetchRawSession(sessionKey);
    if (!session) return false;
    assertSessionAuthorized(session, access);
    const now = new Date().toISOString();
    await this.client.from('ai_conversation_messages').delete().eq('session_id', session.id);
    const { error } = await this.client
      .from('ai_conversation_sessions')
      .update({ status: 'deleted', deleted_at: now, updated_at: now })
      .eq('id', session.id);
    if (error) throw new Error(`Failed to delete AI conversation session: ${error.message}`);
    await this.recordEvent({
      conversationSessionId: session.id,
      eventType: 'session_deleted',
      actor: access.userId || (access.isAdmin ? 'admin' : 'anonymous'),
      payload: { reason: 'authorized_user_deletion' },
    });
    return true;
  }

  async purgeExpiredSessions(nowIso?: string): Promise<number> {
    const cutoff = nowIso || new Date().toISOString();
    const { data, error } = await this.client
      .from('ai_conversation_sessions')
      .update({ status: 'expired', updated_at: cutoff })
      .eq('status', 'active')
      .lt('expires_at', cutoff)
      .select('id');
    if (error) throw new Error(`Failed to purge expired sessions: ${error.message}`);
    return (data || []).length;
  }

  async listSessionAudit(sessionId: string) {
    const [vs, ev, us, cp] = await Promise.all([
      this.client.from('ai_voice_sessions').select('*').eq('conversation_session_id', sessionId),
      this.client.from('ai_session_events').select('*').eq('conversation_session_id', sessionId),
      this.client.from('ai_session_usage').select('*').eq('conversation_session_id', sessionId),
      this.client.from('ai_session_checkpoints').select('*').eq('conversation_session_id', sessionId),
    ]);
    return {
      voiceSessions: (vs.data || []) as any[],
      events: (ev.data || []) as any[],
      usage: (us.data || []) as any[],
      checkpoints: (cp.data || []) as any[],
    };
  }
}

function recSummary(text: string): string {
  return text.trim().slice(0, 4000);
}

/**
 * Strips any raw audio / binary PCM payload keys so raw microphone recordings
 * are never accidentally persisted in conversation metadata or event payloads.
 */
export function sanitizeNoRawAudioMetadata(raw: Record<string, unknown>): Record<string, unknown> {
  const forbidden = new Set([
    'audio',
    'audioBase64',
    'rawAudio',
    'pcm',
    'pcmBase64',
    'recording',
    'wav',
    'blob',
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (forbidden.has(key)) continue;
    if (typeof val === 'string' && val.length > 4000) {
      out[key] = `${val.slice(0, 4000)}...[truncated]`;
    } else {
      out[key] = val;
    }
  }
  return out;
}

export function createAiConversationStore(options?: {
  backing?: SharedConversationMemoryBacking;
  replicaId?: string;
}): AiConversationStore {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (url && key && !url.includes('your-ompnetwork-id')) {
    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    return new SupabaseAiConversationStore(client, options?.replicaId);
  }

  if (isProd) {
    throw new Error(
      'AI conversation persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in production. In-memory fallback is prohibited.'
    );
  }

  return new InMemoryAiConversationStore(options);
}
