/**
 * OPHIREUM AI Solutions Consultant - Real-Time Voice Engine
 * Handles bidirectional voice conversation, Web Audio API VAD analysis,
 * SpeechRecognition + MediaRecorder /api/voice/transcribe fallback,
 * backend Gemini WAV TTS (/api/voice/speak) with SpeechSynthesis fallback,
 * barge-in interruption, shared chat/voice sessionId continuity,
 * and verified handoff to AppointmentBookingModal (never fabricates bookings).
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

export interface VoiceEventCallbacks {
  onStatusChange?: (status: VoiceState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAiResponse?: (text: string, intent?: any) => void;
  onVolumeChange?: (volume: number) => void;
  onAppointmentBooked?: (appointment: ConsultationAppointment) => void;
  onBookingRequested?: () => void;
  onDegradedNotice?: (notice: string | null) => void;
  onSessionId?: (sessionId: string) => void;
  onError?: (errorMessage: string) => void;
}

class AIVoiceService {
  private status: VoiceState = 'disconnected';
  private language: VoiceLanguage = 'en-US';
  private callbacks: VoiceEventCallbacks = {};

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrameId: number | null = null;

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

  private sessionId: string = '';
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

  public setSessionId(sessionId: string) {
    if (sessionId && sessionId.trim()) {
      this.sessionId = sessionId.trim().slice(0, 80);
    }
  }

  public getStatus(): VoiceState {
    return this.status;
  }

  public getLanguage(): VoiceLanguage {
    return this.language;
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

  public async startSession(sharedSessionId?: string): Promise<boolean> {
    if (sharedSessionId) {
      this.setSessionId(sharedSessionId);
    }
    if (this.status !== 'disconnected' && this.status !== 'error') {
      return true;
    }

    this.setStatus('connecting');
    this.recognitionReconnectAttempts = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
        this.startVolumeMonitoring();
      }

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.setupRecognition(SpeechRecognitionClass);
      }

      try {
        const res = await fetch(apiUrl('/api/voice/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: this.language, sessionId: this.sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.sessionId) {
            this.sessionId = data.sessionId;
            this.callbacks.onSessionId?.(this.sessionId);
          }
          this.serverGeminiAvailable = Boolean(data.serverGeminiAvailable);
          this.callbacks.onDegradedNotice?.(
            data.serverGeminiAvailable
              ? null
              : data.degradedNotice ||
                  'Live Gemini audio synthesis is in catalog-grounded fallback mode; browser speech and text chat remain active.'
          );
        }
      } catch {
        this.serverGeminiAvailable = false;
        this.callbacks.onDegradedNotice?.(
          'Voice backend connection degraded. Using local fallback mode; text chat remains available.'
        );
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

  /**
   * MediaRecorder -> /api/voice/transcribe push-to-talk fallback for browsers
   * without native Web Speech API (e.g., Firefox or certain mobile browsers).
   */
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
      } catch {}
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
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audioBase64 = btoa(binary);
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
    this.cancelSpeech();

    if (this.mediaRecorder && this.isRecordingClip) {
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.isRecordingClip = false;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
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

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.setStatus('disconnected');
    this.callbacks.onVolumeChange?.(0);
  }

  public interrupt() {
    this.cancelSpeech();
    if (this.status === 'speaking') {
      this.setStatus('idle');
      this.startRecognitionSafe();
    }
  }

  public async handleUserSpeech(transcript: string) {
    const cleanTranscript = transcript.trim().slice(0, 2000);
    if (!cleanTranscript) return;

    this.conversationHistory = [
      ...this.conversationHistory.slice(-7),
      { sender: 'user', text: cleanTranscript },
    ];
    this.callbacks.onTranscript?.(cleanTranscript, true);
    this.setStatus('thinking');

    // Never fabricate an unverified appointment via voice; route user cleanly to verified Booking Modal
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
      const response = await fetch(apiUrl('/api/voice/process'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          userMessage: cleanTranscript,
          language: this.language,
          conversationHistory: this.conversationHistory.slice(-6),
        }),
      });

      if (response.ok) {
        const data = await response.json();
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
      } catch {}
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

    // 1. Prefer backend-mediated Gemini WAV TTS (/api/voice/speak) when Gemini is available
    if (this.serverGeminiAvailable && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        this.speakAbortController = new AbortController();
        const res = await fetch(apiUrl('/api/voice/speak'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText.slice(0, 600), language: this.language }),
          signal: this.speakAbortController.signal,
        });
        if (res.ok && res.headers.get('content-type')?.includes('audio/')) {
          const audioBlob = await res.blob();
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
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
        // Gracefully fall back to browser SpeechSynthesis
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
      } catch {}
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  public cancelSpeech() {
    if (this.speakAbortController) {
      try {
        this.speakAbortController.abort();
      } catch {}
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
    } catch {}
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
        for (let i = 0; i < dataArray.length; i++) {
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
