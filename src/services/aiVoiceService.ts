/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

/**
 * OPHIREUM AI Solutions Consultant - Real-Time Voice Engine
 * Handles bidirectional voice conversation, Web Audio API analysis,
 * Speech-to-Text streaming, Speech Synthesis, interruption detection,
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

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeakerMuted = false;
  private isMicMuted = false;

  private sessionId: string = '';
  private conversationHistory: Array<{ sender: 'user' | 'ai'; text: string }> = [];

  constructor() {
    this.sessionId = `opm-session-${Date.now()}`;
  }

  public setCallbacks(callbacks: VoiceEventCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getStatus(): VoiceState {
    return this.status;
  }

  public getLanguage(): VoiceLanguage {
    return this.language;
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
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
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

  public async startSession(): Promise<boolean> {
    if (this.status !== 'disconnected' && this.status !== 'error') {
      return true;
    }

    this.setStatus('connecting');

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
          body: JSON.stringify({ language: this.language }),
        });
        if (res.ok) {
          const data = await res.json();
          this.sessionId = data.sessionId || this.sessionId;
        }
      } catch {
        // Non-fatal telemetry/session hint
      }

      this.setStatus('idle');

      const greeting = this.language.startsWith('fil')
        ? 'Magandang araw po. Ako ang inyong OPHIREUM AI Solutions Consultant. Paano ko po matutulungan ang inyong multimedia o software development project ngayon?'
        : 'Welcome to OPHIREUM MULTIMEDIA PRODUCTION. I am your AI Solutions Consultant. How can I assist with your creative media, AI, or enterprise software project today?';

      this.speakText(greeting, false);
      return true;
    } catch (err: any) {
      this.setStatus('error');
      const msg =
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings to activate voice communication.'
          : 'Could not initialize audio input. Returning to text chat.';
      this.callbacks.onError?.(msg);
      this.stopSession();
      return false;
    }
  }

  public stopSession() {
    this.cancelSpeech();

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
      this.speakText(reply);
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/voice/process'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: cleanTranscript,
          language: this.language,
          conversationHistory: this.conversationHistory.slice(-6),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const replyText =
          data.replyText ||
          "I've analyzed your project parameters. How else can we tailor our services for you?";

        this.conversationHistory = [
          ...this.conversationHistory.slice(-7),
          { sender: 'ai', text: replyText },
        ];
        this.callbacks.onAiResponse?.(replyText, data.detectedIntent);
        this.speakText(replyText);
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
    this.speakText(localReply);
  }

  public speakText(text: string, restartRecognitionAfter = true) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.setStatus('idle');
      return;
    }

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
      .replace(/OPM-[A-Z]+-\d+-[A-Z0-9]+/g, (match) => match.split('-').join(' '));

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
      this.setStatus('idle');
      if (
        restartRecognitionAfter &&
        this.recognition &&
        !this.isMicMuted &&
        this.status !== 'disconnected'
      ) {
        this.startRecognitionSafe();
      }
    };

    utterance.onerror = () => {
      this.currentUtterance = null;
      this.setStatus('idle');
      if (
        restartRecognitionAfter &&
        this.recognition &&
        !this.isMicMuted &&
        this.status !== 'disconnected'
      ) {
        this.startRecognitionSafe();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  public cancelSpeech() {
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
        if (this.status !== 'disconnected' && this.status !== 'speaking' && !this.isMicMuted) {
          this.recognitionRestartTimeout = setTimeout(() => {
            this.startRecognitionSafe();
          }, 400);
        }
      };

      this.startRecognitionSafe();
    } catch {
      // Unsupported browser fallback
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
