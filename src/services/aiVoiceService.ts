/**
 * OPHIREUM AI Solutions Consultant — Native Realtime Voice & Fallback Engine (Phase 22)
 *
 * Primary Mode:
 * - Backend-mediated WebSocket gateway (/api/voice/live) bridging to Gemini 3.8 Live API
 * - AudioWorkletNode 16kHz 16-bit PCM capture (with ScriptProcessorNode fallback)
 * - Dedicated 24kHz AudioContext gapless PCM playback queue (`nextStartTime`)
 * - Natural barge-in interruption (instant playback flush + server interrupt signal)
 * - Audio input device enumeration & switching (`enumerateDevices()`)
 * - Automatic session continuity via shared `sessionId` + `sessionToken` + reconnect
 *
 * Preserved Fallback Modes (when Gemini Live is unavailable or browser restricts WebSockets/Worklets):
 * - Web Speech API (SpeechRecognition) + MediaRecorder (/api/voice/transcribe)
 * - Backend Gemini WAV TTS (/api/voice/speak) + Browser SpeechSynthesis
 * - Full text consultation continuity
 */

import { ConsultationAppointment } from './supabaseService';
import { apiUrl } from '../lib/apiClient';

export type VoiceState =
  | 'disconnected'
  | 'connecting'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';
export type VoiceLanguage = 'en-US' | 'fil-PH';
export type VoiceTransportKind = 'gemini_live_ws' | 'fallback_http';

export interface AudioInputDeviceOption {
  deviceId: string;
  label: string;
}

export interface VoiceEventCallbacks {
  onStatusChange?: (status: VoiceState) => void;
  onTransportChange?: (transport: VoiceTransportKind) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAiResponse?: (text: string, intent?: any) => void;
  onVolumeChange?: (volume: number) => void;
  onAppointmentBooked?: (appointment: ConsultationAppointment) => void;
  onBookingRequested?: () => void;
  onDegradedNotice?: (notice: string | null) => void;
  onSessionId?: (sessionId: string, sessionToken?: string) => void;
  onError?: (errorMessage: string) => void;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function buildLiveWsUrl(): string {
  const httpPath = apiUrl('/api/voice/live');
  if (httpPath.startsWith('https://')) return `wss://${httpPath.slice(8)}`;
  if (httpPath.startsWith('http://')) return `ws://${httpPath.slice(7)}`;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${httpPath.startsWith('/') ? '' : '/'}${httpPath}`;
  }
  return 'ws://127.0.0.1:3000/api/voice/live';
}

class AIVoiceService {
  private status: VoiceState = 'disconnected';
  private transport: VoiceTransportKind = 'fallback_http';
  private language: VoiceLanguage = 'en-US';
  private callbacks: VoiceEventCallbacks = {};

  private captureAudioContext: AudioContext | null = null;
  private playbackAudioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  private activePlaybackSources = new Set<AudioBufferSourceNode>();
  private nextPlaybackTime = 0;

  private liveWs: WebSocket | null = null;
  private liveWsActive = false;
  private wsReconnectAttempts = 0;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalStop = false;

  private recognition: any = null;
  private isRecognitionRunning = false;
  private recognitionRestartTimeout: any = null;
  private recognitionReconnectAttempts = 0;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecordingClip = false;

  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speakAbortController: AbortController | null = null;

  private isSpeakerMuted = false;
  private isMicMuted = false;
  private serverGeminiAvailable = true;
  private selectedDeviceId = '';

  private sessionId = '';
  private sessionToken = '';
  private conversationHistory: Array<{ sender: 'user' | 'ai'; text: string }> = [];

  constructor() {
    this.sessionId = `opm-session-${Date.now()}`;
  }

  public setCallbacks(callbacks: VoiceEventCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getSessionToken(): string {
    return this.sessionToken;
  }

  public setSessionId(sessionId: string, sessionToken?: string) {
    if (sessionId && sessionId.trim()) {
      this.sessionId = sessionId.trim().slice(0, 80);
    }
    if (sessionToken && sessionToken.trim()) {
      this.sessionToken = sessionToken.trim();
    }
  }

  public getStatus(): VoiceState {
    return this.status;
  }

  public getTransport(): VoiceTransportKind {
    return this.transport;
  }

  public getLanguage(): VoiceLanguage {
    return this.language;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public async listAudioInputDevices(): Promise<AudioInputDeviceOption[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
        }));
    } catch {
      return [];
    }
  }

  public async setAudioInputDevice(deviceId: string): Promise<void> {
    this.selectedDeviceId = deviceId;
    if (this.status !== 'disconnected' && this.status !== 'error') {
      const currentSid = this.sessionId;
      const currentTok = this.sessionToken;
      this.stopSession();
      await this.startSession(currentSid, currentTok);
    }
  }

  public supportsNativeSpeechRecognition(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public isPushToTalkRecording(): boolean {
    return this.isRecordingClip;
  }

  public setLanguage(lang: VoiceLanguage) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public setMicMuted(muted: boolean) {
    this.isMicMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
      this.liveWs.send(JSON.stringify({ type: 'mute', muted }));
    }
    if (muted && this.status === 'listening') {
      this.setStatus('idle');
    }
  }

  public setSpeakerMuted(muted: boolean) {
    this.isSpeakerMuted = muted;
    if (muted) {
      this.cancelSpeech();
      if (this.status === 'speaking') {
        this.setStatus('idle');
      }
    }
  }

  public getIsMicMuted(): boolean {
    return this.isMicMuted;
  }

  public getIsSpeakerMuted(): boolean {
    return this.isSpeakerMuted;
  }

  public async startSession(sharedSessionId?: string, sharedSessionToken?: string): Promise<boolean> {
    if (sharedSessionId) {
      this.setSessionId(sharedSessionId, sharedSessionToken);
    }
    if (this.status !== 'disconnected' && this.status !== 'error') {
      return true;
    }

    this.intentionalStop = false;
    this.setStatus('connecting');
    this.recognitionReconnectAttempts = 0;
    this.wsReconnectAttempts = 0;

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(this.selectedDeviceId ? { deviceId: { exact: this.selectedDeviceId } } : {}),
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      this.mediaStream = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.captureAudioContext = new AudioContextClass();
        if (this.captureAudioContext.state === 'suspended') {
          await this.captureAudioContext.resume();
        }
        const source = this.captureAudioContext.createMediaStreamSource(stream);
        this.analyser = this.captureAudioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
        this.startVolumeMonitoring();
        await this.setupPcmCapturePipeline(source);

        // Dedicated 24kHz AudioContext for gapless Gemini Live PCM output playback
        try {
          this.playbackAudioContext = new AudioContextClass({ sampleRate: 24000 });
        } catch {
          this.playbackAudioContext = new AudioContextClass();
        }
      }

      // Negotiate voice session & continuity metadata over HTTP first
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.sessionToken) {
        headers['X-Session-Token'] = this.sessionToken;
      }

      try {
        const res = await fetch(apiUrl('/api/voice/session'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ language: this.language, sessionId: this.sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.sessionId) {
            this.sessionId = data.sessionId;
          }
          if (data.sessionToken) {
            this.sessionToken = data.sessionToken;
          }
          this.callbacks.onSessionId?.(this.sessionId, this.sessionToken || undefined);
          this.serverGeminiAvailable = Boolean(data.serverGeminiAvailable);
          if (!data.serverGeminiAvailable) {
            this.callbacks.onDegradedNotice?.(
              data.degradedNotice ||
                'Live Gemini audio synthesis is in catalog-grounded fallback mode; browser speech and text chat remain active.'
            );
          } else {
            this.callbacks.onDegradedNotice?.(null);
          }
        }
      } catch {
        this.serverGeminiAvailable = false;
        this.callbacks.onDegradedNotice?.(
          'Voice backend connection degraded. Using local fallback mode; text chat remains available.'
        );
      }

      // Attempt native bidirectional WebSocket (/api/voice/live) when browser supports WebSocket & Gemini is configured
      const connectedLive =
        typeof WebSocket !== 'undefined' && this.serverGeminiAvailable
          ? await this.connectLiveWebSocket()
          : false;

      if (connectedLive) {
        this.transport = 'gemini_live_ws';
        this.callbacks.onTransportChange?.('gemini_live_ws');
        this.setStatus('idle');
        return true;
      }

      // Fallback Mode: Web Speech API + MediaRecorder + Gemini WAV TTS / Browser SpeechSynthesis
      this.transport = 'fallback_http';
      this.callbacks.onTransportChange?.('fallback_http');

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.setupRecognition(SpeechRecognitionClass);
      }

      this.setStatus('idle');
      const greeting = this.language.startsWith('fil')
        ? 'Magandang araw po. Ako ang inyong OPHIREUM AI Solutions Consultant. Paano ko po matutulungan ang inyong multimedia o software development project ngayon?'
        : 'Welcome to OPHIREUM MULTIMEDIA PRODUCTION. I am your AI Solutions Consultant. How can I assist with your creative media, AI, or enterprise software project today?';

      void this.speakText(greeting, true);
      return true;
    } catch (err: any) {
      this.setStatus('error');
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings to activate voice communication.'
          : 'Could not initialize audio input. Returning to text chat.';
      this.callbacks.onError?.(msg);
      this.stopSession();
      return false;
    }
  }

  private async setupPcmCapturePipeline(source: MediaStreamAudioSourceNode): Promise<void> {
    if (!this.captureAudioContext) return;
    const ctx = this.captureAudioContext;

    // Prefer AudioWorkletNode for low-latency off-main-thread 16kHz PCM framing
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        await ctx.audioWorklet.addModule('/audio/pcm-capture-worklet.js');
        const worklet = new AudioWorkletNode(ctx, 'ophireum-pcm-capture', {
          processorOptions: { targetSampleRate: 16000 },
        });
        worklet.port.onmessage = (ev: MessageEvent) => {
          const msg = ev.data;
          if (!msg || msg.type !== 'pcm16') return;
          if (this.isMicMuted) return;
          if (typeof msg.rms === 'number' && msg.rms > 0.045 && this.status === 'speaking' && this.liveWsActive) {
            this.interrupt();
          }
          if (this.liveWsActive && this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
            this.liveWs.send(
              JSON.stringify({
                type: 'audio_chunk',
                data: arrayBufferToBase64(msg.buffer as ArrayBuffer),
                mimeType: 'audio/pcm;rate=16000',
              })
            );
          }
        };
        source.connect(worklet);
        this.workletNode = worklet;
        return;
      } catch {
        // Fall through cleanly to ScriptProcessorNode fallback
      }
    }

    // Legacy ScriptProcessorNode fallback for older browsers without AudioWorklet
    if (typeof ctx.createScriptProcessor === 'function') {
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const ratio = ctx.sampleRate / 16000;
      processor.onaudioprocess = (ev) => {
        if (this.isMicMuted || !this.liveWsActive || !this.liveWs || this.liveWs.readyState !== WebSocket.OPEN) {
          return;
        }
        const input = ev.inputBuffer.getChannelData(0);
        const outLen = Math.max(1, Math.floor(input.length / ratio));
        const pcm = new Int16Array(outLen);
        for (let i = 0; i < outLen; i += 1) {
          const s = Math.max(-1, Math.min(1, input[Math.min(input.length - 1, Math.floor(i * ratio))]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.liveWs.send(
          JSON.stringify({
            type: 'audio_chunk',
            data: arrayBufferToBase64(pcm.buffer),
            mimeType: 'audio/pcm;rate=16000',
          })
        );
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      this.scriptProcessor = processor;
    }
  }

  private connectLiveWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, 4500);

      try {
        const ws = new WebSocket(buildLiveWsUrl());
        this.liveWs = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'start',
              sessionId: this.sessionId,
              sessionToken: this.sessionToken || undefined,
              language: this.language,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
            if (msg.type === 'session_ready') {
              if (msg.sessionId) this.sessionId = msg.sessionId;
              if (msg.sessionToken) this.sessionToken = msg.sessionToken;
              this.callbacks.onSessionId?.(this.sessionId, this.sessionToken || undefined);
              this.liveWsActive = Boolean(msg.geminiLiveActive);
              if (msg.degradedNotice) {
                this.callbacks.onDegradedNotice?.(msg.degradedNotice);
              }
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve(this.liveWsActive);
              }
              return;
            }

            if (msg.type === 'audio_output' && msg.data && !this.isSpeakerMuted) {
              this.setStatus('speaking');
              this.schedulePcm24kPlayback(String(msg.data));
              return;
            }

            if (msg.type === 'interrupted') {
              this.flushPcmPlaybackQueue();
              if (this.status === 'speaking') this.setStatus('listening');
              return;
            }

            if (msg.type === 'transcript') {
              if (msg.sender === 'user') {
                this.callbacks.onTranscript?.(String(msg.text || ''), Boolean(msg.isFinal));
                if (!msg.isFinal) this.setStatus('listening');
              } else if (msg.sender === 'assistant' && msg.isFinal) {
                this.callbacks.onAiResponse?.(String(msg.text || ''));
              }
              return;
            }

            if (msg.type === 'tool_result') {
              if (msg.toolName === 'book_consultation' && msg.requiresConfirmation) {
                this.callbacks.onBookingRequested?.();
              }
              return;
            }

            if (msg.type === 'turn_complete') {
              if (this.status !== 'disconnected') {
                this.setStatus('idle');
              }
              return;
            }

            if (msg.type === 'upstream_closed' && !this.intentionalStop) {
              this.scheduleLiveReconnect();
            }
          } catch {
            // ignore malformed frame
          }
        };

        ws.onerror = () => {
          this.liveWsActive = false;
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve(false);
          }
        };

        ws.onclose = () => {
          this.liveWsActive = false;
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve(false);
          } else if (!this.intentionalStop && this.status !== 'disconnected') {
            this.scheduleLiveReconnect();
          }
        };
      } catch {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  private scheduleLiveReconnect() {
    if (this.wsReconnectAttempts >= 3 || this.intentionalStop) {
      this.transport = 'fallback_http';
      this.callbacks.onTransportChange?.('fallback_http');
      this.callbacks.onDegradedNotice?.(
        'Realtime audio socket disconnected. Switched cleanly to fallback voice & text mode.'
      );
      return;
    }
    this.wsReconnectAttempts += 1;
    const delayMs = 800 * this.wsReconnectAttempts;
    this.wsReconnectTimer = setTimeout(() => {
      void this.connectLiveWebSocket();
    }, delayMs);
  }

  private schedulePcm24kPlayback(base64Pcm: string) {
    if (!this.playbackAudioContext) return;
    const ctx = this.playbackAudioContext;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const int16 = base64ToInt16Array(base64Pcm);
    if (int16.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i += 1) {
      channelData[i] = int16[i] / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, this.nextPlaybackTime);
    this.nextPlaybackTime = startTime + audioBuffer.duration;
    this.activePlaybackSources.add(source);

    source.onended = () => {
      this.activePlaybackSources.delete(source);
      if (this.activePlaybackSources.size === 0 && this.status === 'speaking') {
        this.setStatus('idle');
      }
    };
    source.start(startTime);
  }

  private flushPcmPlaybackQueue() {
    for (const source of this.activePlaybackSources) {
      try {
        source.stop();
      } catch {
        // ignore
      }
    }
    this.activePlaybackSources.clear();
    if (this.playbackAudioContext) {
      this.nextPlaybackTime = this.playbackAudioContext.currentTime;
    } else {
      this.nextPlaybackTime = 0;
    }
  }

  public startPushToTalkCapture(): boolean {
    if (!this.mediaStream || typeof MediaRecorder === 'undefined' || this.isRecordingClip) {
      return false;
    }
    try {
      this.interrupt();
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/ogg';
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: preferredMime });
      this.mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) this.recordedChunks.push(ev.data);
      };
      this.mediaRecorder.onstop = () => {
        this.isRecordingClip = false;
        void this.transcribeRecordedClip(preferredMime);
      };
      this.mediaRecorder.start();
      this.isRecordingClip = true;
      this.setStatus('listening');
      return true;
    } catch {
      this.callbacks.onError?.('Audio clip recording is not supported in this browser; please use text chat.');
      return false;
    }
  }

  public stopPushToTalkCapture() {
    if (this.mediaRecorder && this.isRecordingClip) {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
  }

  private async transcribeRecordedClip(mimeType: string) {
    if (this.recordedChunks.length === 0) {
      this.setStatus('idle');
      return;
    }
    this.setStatus('thinking');
    try {
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const arrayBuf = await blob.arrayBuffer();
      const audioBase64 = arrayBufferToBase64(arrayBuf);
      const res = await fetch(apiUrl('/api/voice/transcribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.transcript && typeof data.transcript === 'string' && data.transcript.trim()) {
          await this.handleUserSpeech(data.transcript.trim());
          return;
        }
      }
      this.callbacks.onError?.('Server speech transcription is currently unavailable. Please type your message below.');
      this.setStatus('idle');
    } catch {
      this.callbacks.onError?.('Could not transcribe audio clip. Please continue with text chat.');
      this.setStatus('idle');
    }
  }

  public stopSession() {
    this.intentionalStop = true;
    this.cancelSpeech();

    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }

    if (this.liveWs) {
      try {
        if (this.liveWs.readyState === WebSocket.OPEN) {
          this.liveWs.send(JSON.stringify({ type: 'stop' }));
        }
        this.liveWs.close();
      } catch {
        // ignore
      }
      this.liveWs = null;
      this.liveWsActive = false;
    }

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {
        // ignore
      }
      this.scriptProcessor = null;
    }

    if (this.mediaRecorder && this.isRecordingClip) {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
      this.isRecordingClip = false;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.isRecognitionRunning = false;
    }

    if (this.recognitionRestartTimeout) {
      clearTimeout(this.recognitionRestartTimeout);
      this.recognitionRestartTimeout = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.captureAudioContext && this.captureAudioContext.state !== 'closed') {
      try {
        void this.captureAudioContext.close();
      } catch {
        // ignore
      }
      this.captureAudioContext = null;
    }

    if (this.playbackAudioContext && this.playbackAudioContext.state !== 'closed') {
      try {
        void this.playbackAudioContext.close();
      } catch {
        // ignore
      }
      this.playbackAudioContext = null;
    }

    this.setStatus('disconnected');
    this.callbacks.onVolumeChange?.(0);
  }

  public interrupt() {
    this.cancelSpeech();
    if (this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
      this.liveWs.send(JSON.stringify({ type: 'interrupt' }));
    }
    if (this.status === 'speaking') {
      this.setStatus('idle');
      if (!this.liveWsActive) {
        this.startRecognitionSafe();
      }
    }
  }

  public async handleUserSpeech(transcript: string) {
    const cleanTranscript = transcript.trim().slice(0, 2000);
    if (!cleanTranscript) return;

    if (this.liveWsActive && this.liveWs && this.liveWs.readyState === WebSocket.OPEN) {
      this.liveWs.send(
        JSON.stringify({
          type: 'text_input',
          text: cleanTranscript,
          clientMessageId: `ws-txt-${Date.now()}`,
        })
      );
      this.setStatus('thinking');
      return;
    }

    this.conversationHistory = [
      ...this.conversationHistory.slice(-7),
      { sender: 'user', text: cleanTranscript },
    ];
    this.callbacks.onTranscript?.(cleanTranscript, true);
    this.setStatus('thinking');

    if (/schedule|appointment|book|meeting|slot|calendar/i.test(cleanTranscript)) {
      const isFilipino = this.language.startsWith('fil');
      const reply = isFilipino
        ? 'Handa po akong tulungan kayong mag-schedule ng consultation. Binubuksan ko na ang verified appointment form upang mapili ninyo ang tamang petsa, oras, at mailagay ang inyong contact details.'
        : 'I can help arrange your consultation request. I am opening the verified scheduling form now so you can select your preferred slot and enter your contact details cleanly.';

      this.conversationHistory.push({ sender: 'ai', text: reply });
      this.callbacks.onAiResponse?.(reply, { isBookingIntent: true });
      this.callbacks.onBookingRequested?.();
      void this.speakText(reply);
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.sessionToken) headers['X-Session-Token'] = this.sessionToken;

      const response = await fetch(apiUrl('/api/voice/process'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: this.sessionId,
          userMessage: cleanTranscript,
          language: this.language,
          conversationHistory: this.conversationHistory.slice(-6),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sessionToken) {
          this.sessionToken = data.sessionToken;
          this.callbacks.onSessionId?.(this.sessionId, this.sessionToken);
        }
        if (typeof data.serverGeminiAvailable === 'boolean') {
          this.serverGeminiAvailable = data.serverGeminiAvailable;
        }
        const replyText =
          data.replyText ||
          "I've analyzed your project parameters. How else can we tailor our services for you?";

        this.conversationHistory = [
          ...this.conversationHistory.slice(-7),
          { sender: 'ai', text: replyText },
        ];
        this.callbacks.onAiResponse?.(replyText, data.detectedIntent);
        void this.speakText(replyText);
        return;
      }
    } catch {
      // Safe deterministic local voice reply below
    }

    const localReply = this.generateLocalConsultantResponse(cleanTranscript);
    this.conversationHistory = [
      ...this.conversationHistory.slice(-7),
      { sender: 'ai', text: localReply },
    ];
    this.callbacks.onAiResponse?.(localReply);
    void this.speakText(localReply);
  }

  public async speakText(text: string, restartRecognitionAfter = true) {
    if (this.isSpeakerMuted) {
      this.setStatus('idle');
      return;
    }

    this.cancelSpeech();
    this.setStatus('speaking');

    if (this.recognition && this.isRecognitionRunning) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.isRecognitionRunning = false;
    }

    const cleanText = text
      .replace(/[*#_`~>]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/OPM-[A-Z]+-\d+-[A-Z0-9]+/g, (match) => match.split('-').join(' '))
      .trim();

    const finishSpeaking = () => {
      if (this.status !== 'disconnected') {
        this.setStatus('idle');
      }
      if (
        restartRecognitionAfter &&
        this.recognition &&
        !this.isMicMuted &&
        this.status !== 'disconnected'
      ) {
        this.startRecognitionSafe();
      }
    };

    if (this.serverGeminiAvailable && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        this.speakAbortController = new AbortController();
        const res = await fetch(apiUrl('/api/voice/speak'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText.slice(0, 600), language: this.language }),
          signal: this.speakAbortController.signal,
        });
        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          let audioBlob: Blob | null = null;
          if (ct.includes('audio/')) {
            audioBlob = await res.blob();
          } else {
            const payload = await res.json();
            if (payload?.audioBase64) {
              const binary = atob(payload.audioBase64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
              audioBlob = new Blob([bytes], { type: payload.mimeType || 'audio/wav' });
            }
          }
          if (audioBlob) {
            const objectUrl = URL.createObjectURL(audioBlob);
            this.currentAudioUrl = objectUrl;
            const audio = new Audio(objectUrl);
            this.currentAudio = audio;
            audio.onended = () => {
              this.cleanupCurrentAudio();
              finishSpeaking();
            };
            audio.onerror = () => {
              this.cleanupCurrentAudio();
              this.speakWithBrowserSynthesis(cleanText, finishSpeaking);
            };
            await audio.play();
            return;
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    this.speakWithBrowserSynthesis(cleanText, finishSpeaking);
  }

  private speakWithBrowserSynthesis(cleanText: string, onDone: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onDone();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    if (this.language.startsWith('fil')) {
      const filVoice = voices.find(
        (v) => v.lang.includes('fil') || v.lang.includes('tl') || v.name.includes('Filipino')
      );
      if (filVoice) utterance.voice = filVoice;
    } else {
      const enVoice = voices.find(
        (v) =>
          (v.lang.includes('en-US') || v.lang.includes('en-GB') || v.lang.includes('en')) &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
      );
      if (enVoice) utterance.voice = enVoice;
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      onDone();
    };
    utterance.onerror = () => {
      this.currentUtterance = null;
      onDone();
    };

    window.speechSynthesis.speak(utterance);
  }

  private cleanupCurrentAudio() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  public cancelSpeech() {
    this.flushPcmPlaybackQueue();
    if (this.speakAbortController) {
      try {
        this.speakAbortController.abort();
      } catch {
        // ignore
      }
      this.speakAbortController = null;
    }
    this.cleanupCurrentAudio();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  private setStatus(newStatus: VoiceState) {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  private setupRecognition(SpeechRecognitionClass: any) {
    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;

      this.recognition.onstart = () => {
        this.isRecognitionRunning = true;
        this.recognitionReconnectAttempts = 0;
      };

      this.recognition.onerror = (event: any) => {
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          this.callbacks.onError?.('Speech recognition permission denied. Text fallback remains active.');
        }
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (interimTranscript.trim() && this.status === 'speaking') {
          this.interrupt();
        }

        if (interimTranscript) {
          this.setStatus('listening');
          this.callbacks.onTranscript?.(interimTranscript, false);
        }

        if (finalTranscript.trim()) {
          void this.handleUserSpeech(finalTranscript.trim());
        }
      };

      this.recognition.onend = () => {
        this.isRecognitionRunning = false;
        if (
          this.status !== 'disconnected' &&
          this.status !== 'speaking' &&
          !this.isMicMuted &&
          !this.liveWsActive &&
          this.recognitionReconnectAttempts < 8
        ) {
          this.recognitionReconnectAttempts += 1;
          const delayMs = Math.min(2500, 350 * this.recognitionReconnectAttempts);
          this.recognitionRestartTimeout = setTimeout(() => {
            this.startRecognitionSafe();
          }, delayMs);
        }
      };

      this.startRecognitionSafe();
    } catch {
      // Unsupported browser fallback (push-to-talk MediaRecorder or text chat remains active)
    }
  }

  private startRecognitionSafe() {
    if (
      !this.recognition ||
      this.isRecognitionRunning ||
      this.isMicMuted ||
      this.liveWsActive ||
      this.status === 'disconnected'
    ) {
      return;
    }
    try {
      this.recognition.lang = this.language;
      this.recognition.start();
      this.isRecognitionRunning = true;
      if (this.status !== 'speaking' && this.status !== 'thinking') {
        this.setStatus('idle');
      }
    } catch {
      // ignore invalid state error
    }
  }

  private startVolumeMonitoring() {
    const dataArray = new Uint8Array(this.analyser?.frequencyBinCount || 32);

    const checkVolume = () => {
      if (this.status === 'disconnected') return;

      if (this.status === 'speaking') {
        const simulated = Math.min(
          100,
          Math.floor(40 + Math.sin(Date.now() / 80) * 35 + Math.random() * 20)
        );
        this.callbacks.onVolumeChange?.(simulated);
      } else if (this.analyser && !this.isMicMuted) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i += 1) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 255) * 100 * 2.2));
        if (normalized > 18 && this.status === 'idle') {
          this.setStatus('listening');
        }
        this.callbacks.onVolumeChange?.(normalized);
      } else {
        this.callbacks.onVolumeChange?.(0);
      }

      this.animationFrameId = requestAnimationFrame(checkVolume);
    };

    this.animationFrameId = requestAnimationFrame(checkVolume);
  }

  private generateLocalConsultantResponse(input: string): string {
    const isFilipino = this.language.startsWith('fil');
    const lower = input.toLowerCase();

    if (lower.includes('price') || lower.includes('cost') || lower.includes('budget')) {
      return isFilipino
        ? 'Ang budget ay nakadepende sa saklaw ng architecture at integrations. Maaari tayong magbukas ng scheduling request upang makapag-usap kasama ang aming team.'
        : 'All advertised figures represent starting investments only. I recommend submitting a Project Brief or scheduling a formal consultation for an itemized proposal.';
    }

    return isFilipino
      ? 'Naintindihan ko po ang inyong pangangailangan. Nais po ba ninyong gumawa tayo ng preliminary Project Brief o magbukas ng consultation schedule form?'
      : 'I understand your project requirements. Would you like to inspect a preliminary Project Brief or open the verified consultation scheduling form?';
  }
}

export const aiVoiceService = new AIVoiceService();
