/**
 * OPHIREUM NETWORK — Native PostgreSQL AiConversationStore (Phases 50 & 56)
 *
 * Implements 100% of AiConversationStore directly against Railway PostgreSQL
 * (ai_conversation_sessions, ai_conversation_messages, ai_voice_sessions,
 * ai_session_events, ai_session_usage, ai_session_checkpoints,
 * ai_conversation_consents, ai_conversation_memory) with zero in-memory fallback.
 */

import crypto from 'node:crypto';
import { PostgresPoolManager } from '../db/postgresPool';
import { redactSensitiveText } from '../resilience';
import {
  AiConsentType,
  AiConversationConsentRecord,
  AiConversationMemoryRecord,
  AiConversationMessageRecord,
  AiConversationSessionRecord,
  AiConversationStore,
  AiSessionCheckpointRecord,
  AiSessionEventRecord,
  AiSessionUsageRecord,
  AiVoiceSessionRecord,
  AppendMessageResult,
  ConversationChannel,
  ConversationConcurrencyError,
  ConversationExpiredError,
  ConversationExportBundle,
  SessionAccessContext,
  VoiceTransportMode,
  assertSessionAuthorized,
  generateAnonymousSessionToken,
  hashAnonymousToken,
  sanitizeNoRawAudioMetadata,
} from './conversationService';

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapSessionRow(row: Record<string, any>): AiConversationSessionRecord {
  return {
    id: String(row.id),
    sessionKey: String(row.session_key),
    ownerType: row.owner_type || 'anonymous',
    userId: row.user_id ? String(row.user_id) : undefined,
    anonymousTokenHash: row.anonymous_token_hash || undefined,
    tenantScope: String(row.tenant_scope || 'public'),
    channelMode: row.channel_mode || 'unified',
    language: String(row.language || 'en-US'),
    status: row.status || 'active',
    version: Number(row.version || 1),
    messageCount: Number(row.message_count || 0),
    summary: String(row.summary || ''),
    qualificationState: (row.qualification_state && typeof row.qualification_state === 'object'
      ? row.qualification_state
      : {}) as Record<string, unknown>,
    lastActivityAt: toIso(row.last_activity_at),
    expiresAt: toIso(row.expires_at),
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapMessageRow(row: Record<string, any>): AiConversationMessageRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    sequenceNumber: Number(row.sequence_number),
    clientMessageId: row.client_message_id || undefined,
    sender: row.sender,
    channel: row.channel || 'chat',
    content: String(row.content || ''),
    toolName: row.tool_name || undefined,
    toolCallId: row.tool_call_id || undefined,
    metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>,
    containsRawAudio: false,
    createdAt: toIso(row.created_at),
  };
}

export class PostgresAiConversationStore implements AiConversationStore {
  public readonly backend = 'postgres_native' as const;
  private readonly replicaId: string;

  constructor(private readonly pool: PostgresPoolManager, replicaId?: string) {
    this.replicaId = replicaId || process.env.RAILWAY_REPLICA_ID || `pg-replica-${process.pid}`;
  }

  async close(): Promise<void> {
    await this.pool.close();
  }

  private async fetchRawSession(sessionKey: string): Promise<AiConversationSessionRecord | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM public.ai_conversation_sessions WHERE session_key = $1 LIMIT 1',
      [sessionKey]
    );
    return rows[0] ? mapSessionRow(rows[0]) : null;
  }

  async createOrResumeSession(input: {
    sessionKey?: string;
    channelMode?: 'chat' | 'voice' | 'live_audio' | 'unified';
    language?: string;
    access?: SessionAccessContext;
    ttlHours?: number;
  }): Promise<{ session: AiConversationSessionRecord; anonymousToken?: string; created: boolean }> {
    const access = input.access || {};
    if (input.sessionKey) {
      const existing = await this.fetchRawSession(input.sessionKey);
      if (existing) {
        assertSessionAuthorized(existing, access);
        return { session: existing, created: false };
      }
    }

    const sessionKey =
      input.sessionKey && input.sessionKey.trim().length >= 8
        ? input.sessionKey.trim().slice(0, 120)
        : `conv_${crypto.randomBytes(12).toString('hex')}`;

    const ownerType = access.userId ? 'authenticated' : access.isAdmin ? 'admin' : 'anonymous';
    const anonymousToken = ownerType === 'anonymous' ? generateAnonymousSessionToken() : undefined;
    const anonymousTokenHash = anonymousToken ? hashAnonymousToken(anonymousToken) : null;
    const ttlHours = Math.max(1, Math.min(720, input.ttlHours ?? 72));
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_conversation_sessions (
        session_key, owner_type, user_id, anonymous_token_hash, tenant_scope,
        channel_mode, language, status, version, message_count, summary,
        qualification_state, last_activity_at, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, 'active', 1, 0, '',
        '{}'::jsonb, NOW(), $8
      ) RETURNING *`,
      [
        sessionKey,
        ownerType,
        access.userId || null,
        anonymousTokenHash,
        access.userId ? `user:${access.userId}` : 'public',
        input.channelMode || 'unified',
        input.language || 'en-US',
        expiresAt,
      ]
    );

    const session = mapSessionRow(rows[0]);
    await this.recordEvent({
      conversationSessionId: session.id,
      eventType: 'session_created',
      actor: access.userId || (access.isAdmin ? 'admin' : 'anonymous'),
      payload: { channelMode: session.channelMode, language: session.language },
    });

    return { session, anonymousToken, created: true };
  }

  async getSessionByKey(
    sessionKey: string,
    access: SessionAccessContext
  ): Promise<AiConversationSessionRecord | null> {
    const session = await this.fetchRawSession(sessionKey);
    if (!session) return null;
    assertSessionAuthorized(session, access);
    return session;
  }

  async listMessages(
    sessionKey: string,
    access: SessionAccessContext,
    limit = 60
  ): Promise<{ session: AiConversationSessionRecord; messages: AiConversationMessageRecord[] } | null> {
    const session = await this.fetchRawSession(sessionKey);
    if (!session) return null;
    assertSessionAuthorized(session, access);

    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const { rows } = await this.pool.query(
      `SELECT * FROM (
        SELECT * FROM public.ai_conversation_messages
        WHERE session_id = $1
        ORDER BY sequence_number DESC
        LIMIT $2
      ) sub ORDER BY sequence_number ASC`,
      [session.id, safeLimit]
    );
    return { session, messages: rows.map(mapMessageRow) };
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
    if (!session) {
      throw new ConversationExpiredError('Conversation session not found.');
    }
    assertSessionAuthorized(session, input.access);

    const redacted = redactSensitiveText(input.content);
    const cleanMetadata = sanitizeNoRawAudioMetadata({
      ...(input.metadata || {}),
      ...(redacted.findingsCount > 0 ? { sensitiveRedactionsApplied: redacted.findingsCount } : {}),
    });

    return this.pool.withTransaction(async (tx) => {
      const { rows: lockedRows } = await tx.query(
        'SELECT * FROM public.ai_conversation_sessions WHERE id = $1 FOR UPDATE',
        [session.id]
      );
      if (!lockedRows[0]) {
        throw new ConversationExpiredError('Conversation session not found.');
      }
      const locked = mapSessionRow(lockedRows[0]);

      if (input.clientMessageId) {
        const { rows: dupRows } = await tx.query(
          `SELECT * FROM public.ai_conversation_messages
           WHERE session_id = $1 AND client_message_id = $2 LIMIT 1`,
          [locked.id, input.clientMessageId]
        );
        if (dupRows[0]) {
          return {
            message: mapMessageRow(dupRows[0]),
            sessionVersion: locked.version,
            deduplicated: true,
          };
        }
      }

      if (input.expectedVersion !== undefined && locked.version !== input.expectedVersion) {
        throw new ConversationConcurrencyError(
          `Expected session version ${input.expectedVersion}, found ${locked.version}.`
        );
      }

      const nextSeq = locked.messageCount + 1;
      const nextVersion = locked.version + 1;

      const { rows: msgRows } = await tx.query(
        `INSERT INTO public.ai_conversation_messages (
          session_id, sequence_number, client_message_id, sender, channel,
          content, tool_name, tool_call_id, metadata, contains_raw_audio
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9::jsonb, FALSE
        ) RETURNING *`,
        [
          locked.id,
          nextSeq,
          input.clientMessageId || null,
          input.sender,
          input.channel,
          redacted.redactedText.slice(0, 12_000),
          input.toolName || null,
          input.toolCallId || null,
          JSON.stringify(cleanMetadata),
        ]
      );

      const { rows: updatedRows } = await tx.query(
        `UPDATE public.ai_conversation_sessions
         SET version = $1,
             message_count = $2,
             last_activity_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [nextVersion, nextSeq, locked.id]
      );

      const updated = mapSessionRow(updatedRows[0]);
      return {
        message: mapMessageRow(msgRows[0]),
        sessionVersion: updated.version,
        deduplicated: false,
      };
    });
  }

  async updateQualificationState(
    sessionKey: string,
    access: SessionAccessContext,
    patch: Record<string, unknown>
  ): Promise<AiConversationSessionRecord> {
    const session = await this.fetchRawSession(sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, access);

    const merged = { ...session.qualificationState, ...sanitizeNoRawAudioMetadata(patch) };
    const { rows } = await this.pool.query(
      `UPDATE public.ai_conversation_sessions
       SET qualification_state = $1::jsonb,
           version = version + 1,
           last_activity_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(merged), session.id]
    );
    return mapSessionRow(rows[0]);
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

    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_voice_sessions (
        conversation_session_id, transport, model_name, language,
        input_sample_rate, output_sample_rate, status, barge_in_count,
        reconnect_count, device_label_sanitized, raw_audio_persisted
      ) VALUES (
        $1, $2, $3, $4,
        16000, 24000, 'active', 0,
        0, $5, FALSE
      ) RETURNING *`,
      [
        session.id,
        input.transport,
        input.modelName,
        input.language,
        input.deviceLabel ? input.deviceLabel.slice(0, 120) : null,
      ]
    );

    const row = rows[0];
    return {
      id: String(row.id),
      conversationSessionId: String(row.conversation_session_id),
      transport: row.transport,
      modelName: String(row.model_name),
      language: String(row.language),
      inputSampleRate: Number(row.input_sample_rate || 16000),
      outputSampleRate: Number(row.output_sample_rate || 24000),
      status: row.status,
      bargeInCount: Number(row.barge_in_count || 0),
      reconnectCount: Number(row.reconnect_count || 0),
      deviceLabelSanitized: row.device_label_sanitized || undefined,
      rawAudioPersisted: false,
      startedAt: toIso(row.started_at),
      endedAt: row.ended_at ? toIso(row.ended_at) : undefined,
      updatedAt: toIso(row.updated_at),
    };
  }

  async updateVoiceSession(
    voiceSessionId: string,
    patch: Partial<Pick<AiVoiceSessionRecord, 'status' | 'bargeInCount' | 'reconnectCount' | 'endedAt'>>
  ): Promise<void> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (patch.status !== undefined) {
      params.push(patch.status);
      sets.push(`status = $${params.length}`);
    }
    if (patch.bargeInCount !== undefined) {
      params.push(patch.bargeInCount);
      sets.push(`barge_in_count = $${params.length}`);
    }
    if (patch.reconnectCount !== undefined) {
      params.push(patch.reconnectCount);
      sets.push(`reconnect_count = $${params.length}`);
    }
    if (patch.endedAt !== undefined) {
      params.push(patch.endedAt);
      sets.push(`ended_at = $${params.length}`);
    }
    params.push(voiceSessionId);
    await this.pool.query(
      `UPDATE public.ai_voice_sessions SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );
  }

  async recordEvent(input: {
    conversationSessionId: string;
    eventType: string;
    actor?: string;
    payload?: Record<string, unknown>;
  }): Promise<AiSessionEventRecord> {
    const cleanPayload = sanitizeNoRawAudioMetadata(input.payload || {});
    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_session_events (
        conversation_session_id, event_type, actor, replica_id, payload
      ) VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *`,
      [
        input.conversationSessionId,
        input.eventType,
        input.actor || 'system',
        this.replicaId,
        JSON.stringify(cleanPayload),
      ]
    );
    const row = rows[0];
    return {
      id: String(row.id),
      conversationSessionId: String(row.conversation_session_id),
      eventType: String(row.event_type),
      actor: String(row.actor),
      replicaId: String(row.replica_id),
      payload: row.payload || {},
      createdAt: toIso(row.created_at),
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
    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_session_usage (
        conversation_session_id, model_name, modality, input_tokens,
        output_tokens, audio_seconds, estimated_cost_usd
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        input.conversationSessionId,
        input.modelName,
        input.modality,
        Math.max(0, Math.round(input.inputTokens)),
        Math.max(0, Math.round(input.outputTokens)),
        Math.max(0, Number(input.audioSeconds || 0)),
        Math.max(0, Number(input.estimatedCostUsd || 0)),
      ]
    );
    const row = rows[0];
    return {
      id: String(row.id),
      conversationSessionId: String(row.conversation_session_id),
      modelName: String(row.model_name),
      modality: row.modality,
      inputTokens: Number(row.input_tokens || 0),
      outputTokens: Number(row.output_tokens || 0),
      audioSeconds: Number(row.audio_seconds || 0),
      estimatedCostUsd: Number(row.estimated_cost_usd || 0),
      createdAt: toIso(row.created_at),
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

    const { rows: countRows } = await this.pool.query(
      'SELECT COUNT(*)::int AS cnt FROM public.ai_session_checkpoints WHERE conversation_session_id = $1',
      [session.id]
    );
    const seq = Number(countRows[0]?.cnt || 0) + 1;
    const redactedSummary = redactSensitiveText(input.summaryText).redactedText.slice(0, 4000);

    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_session_checkpoints (
        conversation_session_id, checkpoint_sequence, summary_text, extracted_state
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING *`,
      [
        session.id,
        seq,
        redactedSummary,
        JSON.stringify(input.extractedState || session.qualificationState),
      ]
    );

    await this.pool.query(
      'UPDATE public.ai_conversation_sessions SET summary = $1, updated_at = NOW() WHERE id = $2',
      [redactedSummary, session.id]
    );

    const row = rows[0];
    return {
      id: String(row.id),
      conversationSessionId: String(row.conversation_session_id),
      checkpointSequence: Number(row.checkpoint_sequence),
      summaryText: String(row.summary_text),
      extractedState: row.extracted_state || {},
      createdAt: toIso(row.created_at),
    };
  }

  async deleteSession(sessionKey: string, access: SessionAccessContext): Promise<boolean> {
    const session = await this.fetchRawSession(sessionKey);
    if (!session) return false;
    assertSessionAuthorized(session, access);

    await this.pool.withTransaction(async (tx) => {
      await tx.query('DELETE FROM public.ai_conversation_messages WHERE session_id = $1', [session.id]);
      await tx.query(
        `UPDATE public.ai_conversation_sessions
         SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [session.id]
      );
    });

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
    const { rows } = await this.pool.query(
      `UPDATE public.ai_conversation_sessions
       SET status = 'expired', updated_at = $1
       WHERE status = 'active' AND expires_at < $1
       RETURNING id`,
      [cutoff]
    );
    return rows.length;
  }

  async listSessionAudit(sessionId: string) {
    const [vs, ev, us, cp] = await Promise.all([
      this.pool.query('SELECT * FROM public.ai_voice_sessions WHERE conversation_session_id = $1', [sessionId]),
      this.pool.query('SELECT * FROM public.ai_session_events WHERE conversation_session_id = $1', [sessionId]),
      this.pool.query('SELECT * FROM public.ai_session_usage WHERE conversation_session_id = $1', [sessionId]),
      this.pool.query('SELECT * FROM public.ai_session_checkpoints WHERE conversation_session_id = $1', [sessionId]),
    ]);
    return {
      voiceSessions: vs.rows as any[],
      events: ev.rows as any[],
      usage: us.rows as any[],
      checkpoints: cp.rows as any[],
    };
  }

  private async ensureConversationRow(session: AiConversationSessionRecord): Promise<string> {
    const principalId = session.userId || (session.ownerType === 'admin' ? 'admin' : session.sessionKey);
    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_conversations (
        session_id, tenant_scope, principal_id, principal_type, channel, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id) DO UPDATE SET updated_at = NOW()
      RETURNING id`,
      [
        session.id,
        session.tenantScope,
        principalId,
        session.ownerType,
        session.channelMode,
        session.status,
      ]
    );
    return String(rows[0].id);
  }

  async recordConsent(input: {
    sessionKey: string;
    access: SessionAccessContext;
    consentType: AiConsentType;
    granted: boolean;
    policyVersion?: string;
  }): Promise<AiConversationConsentRecord> {
    const session = await this.fetchRawSession(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);

    const conversationId = await this.ensureConversationRow(session);
    const principalId = session.userId || (session.ownerType === 'admin' ? 'admin' : session.sessionKey);

    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_conversation_consents (
        conversation_id, tenant_scope, principal_id, consent_type, granted, policy_version, withdrawn_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        conversationId,
        session.tenantScope,
        principalId,
        input.consentType,
        input.granted,
        input.policyVersion || '2026.1-draft',
        input.granted ? null : new Date().toISOString(),
      ]
    );
    const row = rows[0];
    return {
      id: String(row.id),
      conversationSessionId: session.id,
      consentType: row.consent_type,
      granted: Boolean(row.granted),
      policyVersion: String(row.policy_version || '2026.1-draft'),
      recordedAt: toIso(row.recorded_at),
      withdrawnAt: row.withdrawn_at ? toIso(row.withdrawn_at) : undefined,
    };
  }

  async saveMemory(input: {
    sessionKey: string;
    access: SessionAccessContext;
    memoryKey: string;
    memoryValue: string;
    memoryScope?: 'session' | 'customer_consented';
  }): Promise<AiConversationMemoryRecord> {
    const session = await this.fetchRawSession(input.sessionKey);
    if (!session) throw new ConversationExpiredError('Conversation session not found.');
    assertSessionAuthorized(session, input.access);

    const conversationId = await this.ensureConversationRow(session);
    const principalId = session.userId || (session.ownerType === 'admin' ? 'admin' : session.sessionKey);
    const scope = input.memoryScope || 'session';
    let consentVerified = scope === 'session';
    if (scope === 'customer_consented') {
      const { rows: cRows } = await this.pool.query(
        `SELECT granted FROM public.ai_conversation_consents
         WHERE conversation_id = $1 AND consent_type = 'conversation_memory'
         ORDER BY recorded_at DESC LIMIT 1`,
        [conversationId]
      );
      if (!cRows[0]?.granted) {
        throw new Error('CONSENT_REQUIRED: Customer conversation_memory consent is required before saving long-term memory.');
      }
      consentVerified = true;
    }

    const redacted = redactSensitiveText(input.memoryValue);
    const { rows } = await this.pool.query(
      `INSERT INTO public.ai_conversation_memory (
        conversation_id, tenant_scope, principal_id, memory_key, memory_value_redacted,
        memory_scope, consent_verified, sensitive_redactions_applied, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
      ON CONFLICT (conversation_id, memory_key) DO UPDATE SET
        memory_value_redacted = EXCLUDED.memory_value_redacted,
        memory_scope = EXCLUDED.memory_scope,
        consent_verified = EXCLUDED.consent_verified,
        sensitive_redactions_applied = EXCLUDED.sensitive_redactions_applied,
        status = 'active',
        updated_at = NOW()
      RETURNING *`,
      [
        conversationId,
        session.tenantScope,
        principalId,
        input.memoryKey.trim().slice(0, 120),
        redacted.redactedText.slice(0, 2000),
        scope,
        consentVerified,
        redacted.findingsCount,
      ]
    );

    const row = rows[0];
    return {
      id: String(row.id),
      conversationSessionId: session.id,
      memoryKey: String(row.memory_key),
      memoryValueRedacted: String(row.memory_value_redacted),
      memoryScope: row.memory_scope,
      consentVerified: Boolean(row.consent_verified),
      sensitiveRedactionsApplied: Number(row.sensitive_redactions_applied || 0),
      status: row.status || 'active',
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at || row.created_at),
    };
  }

  async exportConversationData(
    sessionKey: string,
    access: SessionAccessContext
  ): Promise<ConversationExportBundle | null> {
    const loaded = await this.listMessages(sessionKey, access, 200);
    if (!loaded) return null;
    const { session, messages } = loaded;
    const { anonymousTokenHash: _hidden, ...safeSession } = session;

    const { rows: convRows } = await this.pool.query(
      'SELECT id FROM public.ai_conversations WHERE session_id = $1 LIMIT 1',
      [session.id]
    );
    const conversationId = convRows[0]?.id ? String(convRows[0].id) : null;

    const [cpRes, conRes, memRes] = await Promise.all([
      this.pool.query(
        'SELECT * FROM public.ai_session_checkpoints WHERE conversation_session_id = $1 ORDER BY checkpoint_sequence ASC',
        [session.id]
      ),
      conversationId
        ? this.pool.query(
            'SELECT * FROM public.ai_conversation_consents WHERE conversation_id = $1 ORDER BY recorded_at ASC',
            [conversationId]
          )
        : Promise.resolve({ rows: [] }),
      conversationId
        ? this.pool.query(
            'SELECT * FROM public.ai_conversation_memory WHERE conversation_id = $1 ORDER BY created_at ASC',
            [conversationId]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      privacyNotice:
        'OPHIREUM MULTIMEDIA PRODUCTION RA 10173 Data Portability Export. Sensitive secrets were redacted prior to storage and raw microphone recordings are never persisted.',
      session: safeSession,
      messages,
      checkpoints: cpRes.rows.map((r) => ({
        id: String(r.id),
        conversationSessionId: String(r.conversation_session_id),
        checkpointSequence: Number(r.checkpoint_sequence),
        summaryText: String(r.summary_text),
        extractedState: r.extracted_state || {},
        createdAt: toIso(r.created_at),
      })),
      consents: conRes.rows.map((r) => ({
        id: String(r.id),
        conversationSessionId: session.id,
        consentType: r.consent_type,
        granted: Boolean(r.granted),
        policyVersion: String(r.policy_version || '2026.1-draft'),
        recordedAt: toIso(r.recorded_at),
        withdrawnAt: r.withdrawn_at ? toIso(r.withdrawn_at) : undefined,
      })),
      memories: memRes.rows.map((r) => ({
        id: String(r.id),
        conversationSessionId: session.id,
        memoryKey: String(r.memory_key),
        memoryValueRedacted: String(r.memory_value_redacted),
        memoryScope: r.memory_scope,
        consentVerified: Boolean(r.consent_verified),
        sensitiveRedactionsApplied: Number(r.sensitive_redactions_applied || 0),
        status: rowStatus(r.status),
        createdAt: toIso(r.created_at),
        updatedAt: toIso(r.updated_at || r.created_at),
      })),
      rawAudioPersisted: false,
    };
  }
}

function rowStatus(val: unknown): 'active' | 'revoked' | 'deleted' {
  if (val === 'revoked' || val === 'deleted') return val;
  return 'active';
}
