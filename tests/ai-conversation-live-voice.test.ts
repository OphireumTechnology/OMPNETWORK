import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import WebSocket from 'ws';
import { createApp } from '../src/server/app';
import { LocalPortalRepository } from '../src/server/portal/localPortalRepository';
import {
  InMemoryAiConversationStore,
  createSharedConversationBacking,
  createAiConversationStore,
  type SharedConversationMemoryBacking,
} from '../src/server/ai/conversationService';
import {
  CentralKnowledgeService,
  EmbeddingProviderUnavailableError,
  GEMINI_EMBEDDING_MODEL,
  PRODUCTION_EMBEDDING_DIMENSIONS,
} from '../src/server/ai/knowledgeService';
import { InMemoryTestDatabase } from './_testDb';
import { AIVoiceService, type VoiceLifecycleState } from '../src/services/aiVoiceService';

function listenOnEphemeralPort(
  app: ReturnType<typeof createApp>['app'],
  attachLiveVoice: ReturnType<typeof createApp>['attachLiveVoice']
): Promise<{ server: Server; port: number; closeVoice: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      const voiceGateway = attachLiveVoice(server);
      resolve({ server, port, closeVoice: voiceGateway.close });
    });
  });
}

describe('Phases 21–24: Persistent AI Conversations, Realtime Live Voice WebSocket, Receptionist Tools & Production RAG', () => {
  let sharedBacking: SharedConversationMemoryBacking;
  let db: InMemoryTestDatabase;
  let portalRepo: LocalPortalRepository;
  let replica1: { server: Server; port: number; closeVoice: () => Promise<void>; baseUrl: string };
  let replica2: { server: Server; port: number; closeVoice: () => Promise<void>; baseUrl: string };
  const origEnv = { ...process.env };

  before(async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.ADMIN_BOOTSTRAP_EMAIL = 'admin-ai@ophireum.test';
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'AdminStrongPassword!2026';
    process.env.ADMIN_SESSION_SECRET = 'phase21-test-session-secret-minimum-32-chars';

    sharedBacking = createSharedConversationBacking();
    db = new InMemoryTestDatabase();
    portalRepo = new LocalPortalRepository({ persistDir: null });

    // Simulate two independent backend replicas sharing the same persistent backing store
    const app1 = createApp({
      db,
      portalRepo,
      geminiClient: null,
      rateLimitMaxOverride: 500,
      conversationStore: new InMemoryAiConversationStore({ backing: sharedBacking, replicaId: 'replica-1' }),
    });
    const app2 = createApp({
      db,
      portalRepo,
      geminiClient: null,
      rateLimitMaxOverride: 500,
      conversationStore: new InMemoryAiConversationStore({ backing: sharedBacking, replicaId: 'replica-2' }),
    });

    const r1 = await listenOnEphemeralPort(app1.app, app1.attachLiveVoice);
    const r2 = await listenOnEphemeralPort(app2.app, app2.attachLiveVoice);
    replica1 = { ...r1, baseUrl: `http://127.0.0.1:${r1.port}` };
    replica2 = { ...r2, baseUrl: `http://127.0.0.1:${r2.port}` };
  });

  after(async () => {
    await replica1.closeVoice();
    await replica2.closeVoice();
    await new Promise<void>((resolve) => replica1.server.close(() => resolve()));
    await new Promise<void>((resolve) => replica2.server.close(() => resolve()));
    process.env = origEnv;
  });

  it('Phase 21: persists chat & voice history across replicas, enforces X-Session-Token ownership, deduplication, optimistic concurrency, checkpoints, and deletion', async () => {
    const sessionId = `cross-replica-${Date.now()}`;

    // 1. Start conversation on Replica 1
    const chat1 = await fetch(`${replica1.baseUrl}/api/consultant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        clientMessageId: 'msg-unique-1',
        userMessage: 'We need a corporate website and branding package.',
        language: 'en-US',
      }),
    });
    assert.equal(chat1.status, 200);
    const data1 = await chat1.json();
    assert.equal(data1.sessionId, sessionId);
    assert.ok(data1.sessionToken && data1.sessionToken.length >= 24);
    assert.ok(data1.sessionVersion >= 2);
    const token = data1.sessionToken as string;

    // 2. Unauthorized caller (missing or wrong X-Session-Token) MUST be rejected with 403
    const unauthRead = await fetch(`${replica2.baseUrl}/api/consultant/session/${sessionId}`);
    assert.equal(unauthRead.status, 403);

    const wrongTokenRead = await fetch(`${replica2.baseUrl}/api/consultant/session/${sessionId}`, {
      headers: { 'X-Session-Token': 'wrong-token-attempt-1234567890' },
    });
    assert.equal(wrongTokenRead.status, 403);

    // 3. Continue conversation on Replica 2 (simulates load balancer switch / Railway restart)
    const readOnReplica2 = await fetch(`${replica2.baseUrl}/api/consultant/session/${sessionId}`, {
      headers: { 'X-Session-Token': token },
    });
    assert.equal(readOnReplica2.status, 200);
    const hist2 = await readOnReplica2.json();
    assert.ok(hist2.turns.length >= 2);
    assert.equal(hist2.turns[0].text, 'We need a corporate website and branding package.');

    // 4. Stale expectedVersion triggers 409 Optimistic Concurrency Conflict
    const staleWrite = await fetch(`${replica2.baseUrl}/api/consultant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      body: JSON.stringify({
        sessionId,
        clientMessageId: 'msg-stale-2',
        expectedVersion: 1,
        userMessage: 'Follow-up with stale version',
      }),
    });
    assert.equal(staleWrite.status, 409);

    // 5. Duplicate clientMessageId is deduplicated without duplicating user rows
    const dupWrite = await fetch(`${replica2.baseUrl}/api/consultant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      body: JSON.stringify({
        sessionId,
        clientMessageId: 'msg-unique-1',
        userMessage: 'We need a corporate website and branding package.',
      }),
    });
    assert.equal(dupWrite.status, 200);

    // 6. Create checkpoint summary on Replica 2
    const cpRes = await fetch(`${replica2.baseUrl}/api/consultant/session/${sessionId}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
      body: JSON.stringify({
        summaryText: 'Prospect interested in corporate web & branding.',
        extractedState: { interest: 'web-branding', budget: '$5,000' },
      }),
    });
    assert.equal(cpRes.status, 200);
    const cpJson = await cpRes.json();
    assert.equal(cpJson.ok, true);
    assert.ok(cpJson.data.checkpointId);
    assert.ok(typeof cpJson.data.summary === 'string' && cpJson.data.summary.length > 0);

    // 7. Authorized DELETE removes session from Replica 1 & Replica 2
    const delRes = await fetch(`${replica1.baseUrl}/api/consultant/session/${sessionId}`, {
      method: 'DELETE',
      headers: { 'X-Session-Token': token },
    });
    assert.equal(delRes.status, 200);

    const afterDel = await fetch(`${replica2.baseUrl}/api/consultant/session/${sessionId}`, {
      headers: { 'X-Session-Token': token },
    });
    assert.equal(afterDel.status, 410);
  });

  it('Phase 21: fails closed in NODE_ENV=production if Supabase is unavailable for conversation persistence', () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      assert.throws(() => createAiConversationStore(), /SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/i);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedUrl) process.env.SUPABASE_URL = savedUrl;
      if (savedKey) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });

  it('Phase 22: serves realtime WebSocket /api/voice/live protocol (handshake, ping, text_input, audio_chunk without raw audio persistence, interrupt, mute, stop)', async () => {
    const sessionId = `ws-live-${Date.now()}`;
    const wsUrl = `ws://127.0.0.1:${replica1.port}/api/voice/live`;

    const received: Array<Record<string, any>> = [];
    let sessionToken = '';

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket live voice test timed out'));
      }, 8000);

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'start', sessionId, language: 'en-US' }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        received.push(msg);

        if (msg.type === 'session_ready') {
          sessionToken = msg.sessionToken;
          ws.send(JSON.stringify({ type: 'ping' }));
        } else if (msg.type === 'pong') {
          // Send simulated 16kHz PCM audio chunk (must NOT be persisted as raw audio)
          const fakePcm = Buffer.alloc(640, 0).toString('base64');
          ws.send(JSON.stringify({ type: 'audio_chunk', data: fakePcm, mimeType: 'audio/pcm;rate=16000' }));
          ws.send(JSON.stringify({ type: 'mute', muted: true }));
          ws.send(JSON.stringify({ type: 'interrupt' }));
          ws.send(JSON.stringify({ type: 'text_input', text: 'What website and brand design services do you offer?' }));
        } else if (msg.type === 'turn_complete') {
          ws.send(JSON.stringify({ type: 'stop' }));
        } else if (msg.type === 'stopped') {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      });
    });

    const ready = received.find((m) => m.type === 'session_ready');
    assert.ok(ready, 'Expected session_ready message');
    assert.equal(ready.sessionId, sessionId);
    assert.equal(ready.geminiLiveActive, false, 'Must honestly report degraded mode when GEMINI_API_KEY is unset');
    assert.ok(received.some((m) => m.type === 'pong'));
    assert.ok(received.some((m) => m.type === 'interrupted'));
    assert.ok(received.some((m) => m.type === 'transcript' && m.sender === 'assistant'));
    assert.ok(received.some((m) => m.type === 'stopped'));

    // Verify transcript persisted to shared conversation store across Replica 2 & zero raw audio stored
    const histRes = await fetch(`${replica2.baseUrl}/api/consultant/session/${sessionId}`, {
      headers: { 'X-Session-Token': sessionToken },
    });
    assert.equal(histRes.status, 200);
    const histJson = await histRes.json();
    assert.ok(histJson.turns.some((m: any) => m.text.includes('What website and brand design services do you offer?')));
    for (const msgs of sharedBacking.messagesBySessionId.values()) {
      for (const m of msgs) {
        assert.equal(m.containsRawAudio, false);
      }
    }
    for (const vs of sharedBacking.voiceSessions.values()) {
      assert.equal(vs.rawAudioPersisted, false);
    }
  });

  it('Phase 23: executes authorized receptionist business workflows with strict confirmation gates and customer authentication', async () => {
    // Register a customer so we can test authenticated order/project/ticket tools
    const reg = await fetch(`${replica1.baseUrl}/api/portal/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Maya',
        lastName: 'Santos',
        email: 'maya.receptionist@client.test',
        password: 'ClientStrongPassword!2026',
      }),
    });
    assert.equal(reg.status, 201);
    const regJson = await reg.json();
    const customerToken = regJson.token as string;

    const callTool = async (toolName: string, args: Record<string, unknown>, bearer?: string) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      const res = await fetch(`${replica1.baseUrl}/api/consultant/tools/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ toolName, args }),
      });
      return res.json();
    };

    // 1. Discover real catalog services (never fabricated)
    const disc = await callTool('discover_services', { query: 'brand website', limit: 3 });
    assert.equal(disc.ok, true);
    assert.ok(disc.data.matches.length >= 1);

    // 2. Indicative quotation preparation
    const quote = await callTool('prepare_indicative_quotation', {
      serviceIds: [disc.data.matches[0].id],
      currency: 'USD',
    });
    assert.equal(quote.ok, true);
    assert.equal(quote.data.quotation.status, 'indicative_estimate_non_binding');
    assert.equal(quote.data.quotation.items.length, 1);

    // 3. Consultation booking WITHOUT explicit confirmation MUST be blocked
    const unconfirmedBook = await callTool('book_consultation', {
      fullName: 'Maya Santos',
      email: 'maya.receptionist@client.test',
      date: '2026-12-15',
      timeSlot: '10:00 AM - 10:30 AM',
      notes: 'Brand Identity inquiry',
      userConfirmed: false,
    });
    assert.equal(unconfirmedBook.ok, false);
    assert.equal(unconfirmedBook.requiresConfirmation, true);

    // 4. Consultation booking WITH explicit userConfirmed: true persists a real appointment
    const confirmedBook = await callTool('book_consultation', {
      fullName: 'Maya Santos',
      email: 'maya.receptionist@client.test',
      date: '2026-12-15',
      timeSlot: '10:00 AM - 10:30 AM',
      notes: 'Brand Identity inquiry',
      userConfirmed: true,
    });
    assert.equal(confirmedBook.ok, true);
    assert.ok(confirmedBook.data.referenceCode);
    const apptRef = confirmedBook.data.referenceCode as string;

    // 5. Reschedule requires confirmation, then updates persisted DB record
    const unconfirmedResched = await callTool('reschedule_consultation', {
      referenceCode: apptRef,
      email: 'maya.receptionist@client.test',
      newDate: '2026-12-18',
      newTimeSlot: '02:30 PM - 03:00 PM',
      userConfirmed: false,
    });
    assert.equal(unconfirmedResched.ok, false);
    assert.equal(unconfirmedResched.requiresConfirmation, true);

    const confirmedResched = await callTool('reschedule_consultation', {
      referenceCode: apptRef,
      email: 'maya.receptionist@client.test',
      newDate: '2026-12-18',
      newTimeSlot: '02:30 PM - 03:00 PM',
      userConfirmed: true,
    });
    assert.equal(confirmedResched.ok, true);
    assert.equal(confirmedResched.data.scheduledDate, '2026-12-18');

    // 6. Cancel with confirmation updates persisted DB record
    const confirmedCancel = await callTool('cancel_consultation', {
      referenceCode: apptRef,
      email: 'maya.receptionist@client.test',
      reason: 'Schedule shifted',
      userConfirmed: true,
    });
    assert.equal(confirmedCancel.ok, true);
    assert.equal(confirmedCancel.data.status, 'cancelled');

    // 7. Authenticated order inquiry blocks anonymous callers and succeeds for logged-in customer
    const anonOrders = await callTool('get_my_orders', {});
    assert.equal(anonOrders.ok, false);

    const authOrders = await callTool('get_my_orders', {}, customerToken);
    assert.equal(authOrders.ok, true);
    assert.ok(Array.isArray(authOrders.data.orders));

    // 8. Support ticket creation requires authentication + explicit userConfirmed: true
    const unconfirmedTicket = await callTool(
      'create_support_ticket',
      {
        category: 'General Inquiry',
        subject: 'Need brand guidelines timeline',
        message: 'Please advise on turnaround time.',
        userConfirmed: false,
      },
      customerToken
    );
    assert.equal(unconfirmedTicket.ok, false);
    assert.equal(unconfirmedTicket.requiresConfirmation, true);

    const confirmedTicket = await callTool(
      'create_support_ticket',
      {
        category: 'General Inquiry',
        subject: 'Need brand guidelines timeline',
        message: 'Please advise on turnaround time.',
        userConfirmed: true,
      },
      customerToken
    );
    assert.equal(confirmedTicket.ok, true);
    assert.ok(confirmedTicket.data.ticketId);

    // 9. Human escalation records audit & returns official contact path
    const escalation = await callTool('escalate_to_human', {
      clientName: 'Maya Santos',
      clientContact: 'maya.receptionist@client.test',
      reason: 'Custom multi-country enterprise MSA legal review',
    });
    assert.equal(escalation.ok, true);
  });

  it('Phase 24: enforces strict production embedding guard (no silent hash fallback), metadata filtering, confidence bands, and tenant isolation', async () => {
    assert.equal(GEMINI_EMBEDDING_MODEL, 'gemini-embedding-2');
    assert.equal(PRODUCTION_EMBEDDING_DIMENSIONS, 768);

    // 1. Strict production mode without Gemini client MUST throw EmbeddingProviderUnavailableError (never silently use hash embeddings)
    const prodKb = new CentralKnowledgeService({
      aiClient: null,
      strictProductionEmbeddings: true,
    });
    await assert.rejects(
      prodKb.search({
        query: 'OPHIREUM payment reference policy',
        actorRole: 'public',
        tenantScope: 'public',
      }),
      (err: unknown) => err instanceof EmbeddingProviderUnavailableError && err.statusCode === 503
    );

    // 2. Development/test mode supports metadata category filtering, confidence bands, versioning, deletion propagation & cross-tenant isolation
    const devKb = new CentralKnowledgeService({
      aiClient: null,
      strictProductionEmbeddings: false,
    });

    const { document: docA } = await devKb.ingestDocument({
      title: 'Tenant Alpha Confidential Brief',
      category: 'contracts',
      tenantScope: 'customer:alpha',
      sourceRef: 'vault:alpha-msa',
      allowedRoles: ['customer', 'super_admin'],
      content: 'Tenant Alpha exclusive milestone schedule and confidential NDA clauses for Q4 broadcast campaign.',
      uploadedBy: 'admin@ophireum.test',
      autoApprove: true,
    });
    assert.equal(docA.version, 1);

    // Customer Beta MUST NOT retrieve Customer Alpha's confidential document
    const betaHits = await devKb.search({
      query: 'Tenant Alpha exclusive milestone schedule NDA',
      actorRole: 'customer',
      tenantScope: 'customer:beta',
      category: 'contracts',
    });
    assert.equal(
      betaHits.some((h) => h.documentId === docA.id),
      false,
      'Customer Beta must never retrieve Customer Alpha confidential knowledge'
    );

    // Customer Alpha retrieves own document with category filter & valid confidence band
    const alphaHits = await devKb.search({
      query: 'Tenant Alpha exclusive milestone schedule NDA',
      actorRole: 'customer',
      tenantScope: 'customer:alpha',
      category: 'contracts',
    });
    assert.ok(alphaHits.some((h) => h.documentId === docA.id));
    assert.ok(['high', 'medium', 'low'].includes(alphaHits[0].confidence));
    assert.equal(alphaHits[0].documentVersion, 1);

    // Document deletion propagates immediately to search index
    const deleted = await devKb.deleteDocument(docA.id);
    assert.equal(deleted, true);
    const afterDelete = await devKb.search({
      query: 'Tenant Alpha exclusive milestone schedule NDA',
      actorRole: 'customer',
      tenantScope: 'customer:alpha',
      category: 'contracts',
    });
    assert.equal(
      afterDelete.some((h) => h.documentId === docA.id),
      false,
      'Deleted document chunks must not be returned'
    );
  });

  it('Recovery 11.0: AIVoiceService prevents duplicate concurrent starts, stops leaked MediaStream tracks on stale getUserMedia, and enforces deterministic lifecycle transitions', async () => {
    const origNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let resolvePendingMic: ((stream: any) => void) | null = null;
    let getUserMediaCalls = 0;
    let trackStopped = false;

    const fakeStream = {
      getTracks: () => [
        {
          stop: () => {
            trackStopped = true;
          },
        },
      ],
      getAudioTracks: () => [{ enabled: true, stop: () => { trackStopped = true; } }],
    };

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: () => {
            getUserMediaCalls += 1;
            return new Promise((resolve) => {
              resolvePendingMic = resolve;
            });
          },
        },
      },
    });

    try {
      const voice = new AIVoiceService();
      const states: VoiceLifecycleState[] = [];
      voice.setCallbacks({
        onLifecycleChange: (s) => states.push(s),
      });

      assert.equal(voice.getLifecycleState(), 'IDLE');

      // Launch startSession and trigger a concurrent duplicate call while getUserMedia is pending
      const firstStart = voice.startSession('voice-race-test');
      const duplicateStart = await voice.startSession('voice-race-test');
      assert.equal(duplicateStart, true);
      assert.equal(getUserMediaCalls, 1, 'Concurrent duplicate startSession must not invoke getUserMedia twice');
      assert.ok(states.includes('REQUESTING_PERMISSION'));

      // Terminate session BEFORE getUserMedia resolves
      voice.stopSession();
      assert.equal(voice.getStatus(), 'disconnected');
      assert.equal(voice.getLifecycleState(), 'IDLE');
      assert.ok(states.includes('ENDING'));
      assert.ok(states.includes('ENDED'));

      // Now resolve the stale getUserMedia callback — terminated session MUST NOT restart and MUST stop tracks
      assert.ok(resolvePendingMic, 'Expected pending getUserMedia resolver');
      resolvePendingMic(fakeStream);
      const started = await firstStart;
      assert.equal(started, false, 'Terminated voice session must ignore stale getUserMedia resolution');
      assert.equal(trackStopped, true, 'Late MediaStream tracks must be stopped immediately to avoid mic leaks');
      assert.equal(voice.getStatus(), 'disconnected');
      assert.equal(voice.getLifecycleState(), 'IDLE');
    } finally {
      if (origNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', origNavigatorDescriptor);
      } else {
        delete (globalThis as Record<string, unknown>).navigator;
      }
    }
  });

  it('Recovery 12.0: AIVoiceService completes full IDLE->REQUESTING_PERMISSION->INITIALIZING->CONNECTING->CONNECTED->LISTENING->MUTED->LISTENING->ENDING->ENDED lifecycle with real track toggling and WebKit AudioContext fault resilience', async () => {
    const origNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const origWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const origFetch = globalThis.fetch;

    const track = {
      kind: 'audio',
      enabled: true,
      readyState: 'live' as 'live' | 'ended',
      stop() {
        this.readyState = 'ended';
        this.enabled = false;
      },
    };
    const fakeStream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    };

    let denyNextMic = false;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async () => {
            if (denyNextMic) {
              const err = new Error('Permission denied');
              err.name = 'NotAllowedError';
              throw err;
            }
            return fakeStream;
          },
        },
      },
    });

    // Simulate WebKit headless AudioContext where resume() hangs and createMediaStreamSource throws InvalidStateError
    class HangingWebKitAudioContext {
      state = 'suspended';
      resume() {
        return new Promise<void>(() => {
          // Intentionally never resolves (mirrors headless Linux WebKit without ALSA/PulseAudio sink)
        });
      }
      createMediaStreamSource() {
        const err = new Error('MediaStream has no playable audio destination');
        err.name = 'InvalidStateError';
        throw err;
      }
      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        isSecureContext: true,
        location: { hostname: '127.0.0.1', protocol: 'http:', host: '127.0.0.1:3000' },
        AudioContext: HangingWebKitAudioContext,
      },
    });

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        sessionId: 'webkit-lifecycle-session',
        sessionToken: 'webkit-lifecycle-token-12345678901234567890',
        serverGeminiAvailable: false,
      }),
    })) as unknown as typeof fetch;

    try {
      const voice = new AIVoiceService();
      const transitions: VoiceLifecycleState[] = [];
      voice.setCallbacks({
        onLifecycleChange: (s) => transitions.push(s),
      });

      assert.equal(voice.getLifecycleState(), 'IDLE');
      const started = await voice.startSession('webkit-lifecycle-session');
      assert.equal(started, true, 'Session must remain active when getUserMedia succeeds even if WebKit AudioContext fails');
      assert.equal(voice.hasActiveAudioTrack(), true);
      assert.equal(voice.isAudioTrackEnabled(), true);
      assert.equal(track.enabled, true);

      // Mute -> verify actual track.enabled flips to false and lifecycle transitions to MUTED
      voice.setMicMuted(true);
      assert.equal(track.enabled, false);
      assert.equal(voice.isAudioTrackEnabled(), false);
      assert.equal(voice.getLifecycleState(), 'MUTED');
      assert.notEqual(voice.getStatus(), 'disconnected');

      // Unmute -> verify actual track.enabled flips back to true and lifecycle returns to LISTENING
      voice.setMicMuted(false);
      assert.equal(track.enabled, true);
      assert.equal(voice.isAudioTrackEnabled(), true);
      assert.equal(voice.getLifecycleState(), 'LISTENING');

      // Stop -> verify ENDING -> ENDED -> IDLE and track.stop() executed
      voice.stopSession();
      assert.equal(track.readyState, 'ended');
      assert.equal(voice.getStatus(), 'disconnected');
      assert.equal(voice.getLifecycleState(), 'IDLE');

      // Verify exact lifecycle sequence milestone progression
      const requiredSequence: VoiceLifecycleState[] = [
        'REQUESTING_PERMISSION',
        'INITIALIZING',
        'CONNECTING',
        'CONNECTED',
        'LISTENING',
        'MUTED',
        'LISTENING',
        'ENDING',
        'ENDED',
      ];
      let cursor = -1;
      for (const expected of requiredSequence) {
        const nextIdx = transitions.indexOf(expected, cursor + 1);
        assert.ok(
          nextIdx > cursor,
          `Expected lifecycle transition ${expected} after index ${cursor}; actual transitions: ${transitions.join(' -> ')}`
        );
        cursor = nextIdx;
      }

      // Verify permission denial fails honestly (never fabricates connected state)
      denyNextMic = true;
      const deniedResult = await voice.startSession('webkit-denied-session');
      assert.equal(deniedResult, false);
      assert.equal(voice.getStatus(), 'disconnected');
    } finally {
      globalThis.fetch = origFetch;
      if (origNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', origNavigatorDescriptor);
      } else {
        delete (globalThis as Record<string, unknown>).navigator;
      }
      if (origWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', origWindowDescriptor);
      } else {
        delete (globalThis as Record<string, unknown>).window;
      }
    }
  });
});
