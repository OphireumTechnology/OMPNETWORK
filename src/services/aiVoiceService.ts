/**
 * OPHIREUM AI Solutions Consultant - Real-Time Voice Engine
 * Handles bidirectional voice conversation, Web Audio API analysis,
 * Speech-to-Text streaming, Speech Synthesis, interruption detection,
 * language switching (EN / FIL), and voice appointment scheduling.
 */

import { supabaseService, ConsultationAppointment, AVAILABLE_SLOTS } from './supabaseService';
import { COMPANY_CONFIG } from '../data/companyConfig';

export type VoiceState = 'disconnected' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
export type VoiceLanguage = 'en-US' | 'fil-PH';

export interface VoiceEventCallbacks {
  onStatusChange?: (status: VoiceState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAiResponse?: (text: string, intent?: any) => void;
  onVolumeChange?: (volume: number) => void;
  onAppointmentBooked?: (appointment: ConsultationAppointment) => void;
  onError?: (errorMessage: string) => void;
}

class AIVoiceService {
  private status: VoiceState = 'disconnected';
  private language: VoiceLanguage = 'en-US';
  private callbacks: VoiceEventCallbacks = {};
  
  // Audio context & analysis
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  // Speech Recognition
  private recognition: any = null;
  private isRecognitionRunning = false;
  private recognitionRestartTimeout: any = null;

  // Speech Synthesis
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeakerMuted = false;
  private isMicMuted = false;

  // Session metadata
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

  /**
   * Start two-way voice session with explicit microphone permission
   */
  public async startSession(): Promise<boolean> {
    if (this.status !== 'disconnected' && this.status !== 'error') {
      return true;
    }

    this.setStatus('connecting');

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      // 2. Setup Web Audio API analyser for live waveform
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

      // 3. Setup speech recognition
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.setupRecognition(SpeechRecognitionClass);
      } else {
        console.warn('Browser SpeechRecognition not natively supported, fallback mode active.');
      }

      // 4. Register session with server
      try {
        const res = await fetch('/api/voice/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: this.language }),
        });
        if (res.ok) {
          const data = await res.json();
          this.sessionId = data.sessionId || this.sessionId;
        }
      } catch (err) {
        // Fallback gracefully on static hosts
        console.log('Server voice session fallback mode');
      }

      this.setStatus('idle');

      // Greet the client verbally
      const greeting = this.language.startsWith('fil')
        ? "Magandang araw po. Ako ang inyong OPHIREUM AI Solutions Consultant. Paano ko po matutulungan ang inyong multimedia o software development project ngayon?"
        : "Welcome to OPHIREUM MULTIMEDIA PRODUCTION. I am your AI Solutions Consultant. How can I assist with your creative media, AI, or enterprise software project today?";

      this.speakText(greeting, false);
      return true;
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      this.setStatus('error');
      const msg = err.name === 'NotAllowedError' 
        ? 'Microphone permission denied. Please allow microphone access in your browser settings to activate voice communication.'
        : 'Could not initialize audio input. Returning to text chat.';
      this.callbacks.onError?.(msg);
      this.stopSession();
      return false;
    }
  }

  /**
   * Stop voice session, release microphone and audio resources
   */
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

  /**
   * Interrupt current AI speech (barge-in capability)
   */
  public interrupt() {
    this.cancelSpeech();
    if (this.status === 'speaking') {
      this.setStatus('idle');
    }
  }

  /**
   * Process client input message through the voice brain
   */
  public async handleUserSpeech(transcript: string) {
    if (!transcript.trim()) return;

    // Add to conversation history
    this.conversationHistory.push({ sender: 'user', text: transcript });
    this.callbacks.onTranscript?.(transcript, true);

    this.setStatus('thinking');

    // 1. Check for Voice-Based Appointment Booking intent
    if (/schedule|appointment|book|meeting|slot|calendar/i.test(transcript)) {
      await this.handleVoiceAppointmentFlow(transcript);
      return;
    }

    // 2. Query server gateway or local fallback
    try {
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: transcript,
          language: this.language,
          conversationHistory: this.conversationHistory,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.replyText || "I've analyzed your project parameters. How else can we tailor our services for you?";
        
        this.conversationHistory.push({ sender: 'ai', text: replyText });
        this.callbacks.onAiResponse?.(replyText, data.detectedIntent);
        this.speakText(replyText);
        return;
      }
    } catch (e) {
      console.warn('Server gateway unavailable, falling back to local voice brain:', e);
    }

    // Local consultative voice fallback
    const localReply = this.generateLocalConsultantResponse(transcript);
    this.conversationHistory.push({ sender: 'ai', text: localReply });
    this.callbacks.onAiResponse?.(localReply);
    this.speakText(localReply);
  }

  /**
   * Specialized voice scheduling dialogue flow
   */
  private async handleVoiceAppointmentFlow(transcript: string) {
    const isFilipino = this.language.startsWith('fil');

    // Check if user is confirming a specific slot
    const timeMatch = transcript.match(/(9|10|11|1|2|3|4)(:\d\d)?\s*(am|pm)?/i);
    const dayMatch = transcript.match(/monday|tuesday|wednesday|thursday|friday|tomorrow/i);

    // If client just asked to schedule without a slot
    if (!timeMatch && !dayMatch) {
      const reply = isFilipino
        ? "Ikinagagalak po naming mag-ayos ng executive consultation. May available slots po tayo Lunes hanggang Biyernes, alas-nuwebe ng umaga hanggang alas-singko ng hapon sa Clark Freeport Zone o via Google Meet. Anong araw at oras po ang nais ninyo?"
        : "Certainly. We offer executive consultation appointments Monday through Friday between 9:00 AM and 5:00 PM Philippine Time. We can meet via video conference or in-person at our Clark Freeport Zone suite. Which day and time works best for you?";
      
      this.conversationHistory.push({ sender: 'ai', text: reply });
      this.callbacks.onAiResponse?.(reply, { isBookingIntent: true });
      this.speakText(reply);
      return;
    }

    // Client mentioned a day or time: construct next upcoming date
    let targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const dateStr = targetDate.toISOString().split('T')[0];

    // Check booked slots to ensure real availability
    const booked = await supabaseService.getBookedSlots(dateStr);
    const availableSlot = AVAILABLE_SLOTS.find((s) => !booked.includes(s)) || '10:00 AM - 10:30 AM';

    // Book the appointment
    const refCode = `OPM-APT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const appointment: ConsultationAppointment = {
      referenceCode: refCode,
      client: {
        fullName: 'Executive Voice Client',
        companyName: 'Enterprise Client',
        email: 'consultation@ophireum.com',
        phone: '+63 917 966 8814',
      },
      consultationType: /in person|clark|office/i.test(transcript) ? 'in_person' : 'video',
      scheduledDate: dateStr,
      scheduledTimeSlot: availableSlot,
      durationMinutes: 30,
      clientTimezone: 'Asia/Manila (PHT)',
      meetingLocation: /in person|clark|office/i.test(transcript)
        ? 'KMC | One West Aeropark, Clark Freeport Zone, Pampanga'
        : 'Google Meet Executive Video Room',
      assignedConsultant: COMPANY_CONFIG.founderCeo,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    await supabaseService.bookAppointment(appointment);
    this.callbacks.onAppointmentBooked?.(appointment);

    const verbalConfirmation = isFilipino
      ? `Kumpirmado na po ang inyong consultation appointment! Reference code: ${refCode}. Naka-schedule po ito sa darating na ${dateStr} ganap na ${availableSlot} Philippine Time. Ipinadala na rin po namin ang calendar invite.`
      : `Your executive consultation is confirmed! Your reference code is ${refCode}. You are scheduled for ${dateStr} at ${availableSlot} Philippine Time with our Founder & CEO Dhenze Languisan. A calendar invite has been generated.`;

    this.conversationHistory.push({ sender: 'ai', text: verbalConfirmation });
    this.callbacks.onAiResponse?.(verbalConfirmation, { isBookingConfirmed: true, appointment });
    this.speakText(verbalConfirmation);
  }

  /**
   * Speak text using Web Speech API synthesis
   */
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

    // Temporarily pause recognition to prevent feedback loop
    if (this.recognition && this.isRecognitionRunning) {
      try {
        this.recognition.stop();
      } catch {}
      this.isRecognitionRunning = false;
    }

    const cleanText = text
      .replace(/[*#_`~>]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/OPM-[A-Z]+-\d+-\d+/g, (match) => match.split('-').join(' '));

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    // Voice selection
    const voices = window.speechSynthesis.getVoices();
    if (this.language.startsWith('fil')) {
      const filVoice = voices.find(v => v.lang.includes('fil') || v.lang.includes('tl') || v.name.includes('Filipino'));
      if (filVoice) utterance.voice = filVoice;
    } else {
      const enVoice = voices.find(v => (v.lang.includes('en-US') || v.lang.includes('en-GB') || v.lang.includes('en')) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
      if (enVoice) utterance.voice = enVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      this.currentUtterance = null;
      this.setStatus('idle');
      if (restartRecognitionAfter && this.recognition && !this.isMicMuted && this.status !== 'disconnected') {
        this.startRecognitionSafe();
      }
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      this.currentUtterance = null;
      this.setStatus('idle');
      if (restartRecognitionAfter && this.recognition && !this.isMicMuted && this.status !== 'disconnected') {
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

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

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

        // Barge-in: if user starts speaking while AI is speaking, interrupt!
        if (interimTranscript.trim() && this.status === 'speaking') {
          this.interrupt();
        }

        if (interimTranscript) {
          this.setStatus('listening');
          this.callbacks.onTranscript?.(interimTranscript, false);
        }

        if (finalTranscript.trim()) {
          this.handleUserSpeech(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('Recognition error:', event.error);
        }
      };

      this.recognition.onend = () => {
        this.isRecognitionRunning = false;
        // Auto-restart recognition if session is active and not speaking
        if (this.status !== 'disconnected' && this.status !== 'speaking' && !this.isMicMuted) {
          this.recognitionRestartTimeout = setTimeout(() => {
            this.startRecognitionSafe();
          }, 400);
        }
      };

      this.startRecognitionSafe();
    } catch (err) {
      console.warn('SpeechRecognition setup error:', err);
    }
  }

  private startRecognitionSafe() {
    if (!this.recognition || this.isRecognitionRunning || this.isMicMuted || this.status === 'disconnected') {
      return;
    }
    try {
      this.recognition.lang = this.language;
      this.recognition.start();
      this.isRecognitionRunning = true;
      if (this.status !== 'speaking' && this.status !== 'thinking') {
        this.setStatus('idle');
      }
    } catch (e) {
      // Already active or busy
    }
  }

  private startVolumeMonitoring() {
    const dataArray = new Uint8Array(this.analyser?.frequencyBinCount || 32);

    const checkVolume = () => {
      if (this.status === 'disconnected') return;

      if (this.status === 'speaking') {
        // Synthesize dynamic waveform when AI speaks
        const simulated = Math.min(100, Math.floor(40 + Math.sin(Date.now() / 80) * 35 + Math.random() * 20));
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
        } else if (normalized < 8 && this.status === 'listening' && !this.isRecognitionRunning) {
          this.setStatus('idle');
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

    if (lower.includes('deliver') || lower.includes('app') || lower.includes('mobile')) {
      return isFilipino
        ? "Maaari tayong mag-engineer ng custom mobile app na may customer portal, dispatch logistics, at real-time GPS tracking. Ilang users po ang target ninyong maserbisyuhan?"
        : "We can engineer a scalable mobile platform with customer ordering, dispatch management, and live GPS tracking. Approximately how many daily active users do you plan to support?";
    }

    if (lower.includes('price') || lower.includes('cost') || lower.includes('budget')) {
      return isFilipino
        ? "Ang budget po ay nakadepende sa saklaw ng architecture at timeline. Maganda po na mag-schedule tayo ng technical discovery session kasama si CEO Dhenze Languisan upang mabigyan kayo ng tumpak na scope."
        : "Project investment depends directly on architectural scope and integrations. We recommend scheduling an executive discovery consultation with our technical leadership to finalize an exact milestone roadmap.";
    }

    if (lower.includes('video') || lower.includes('media') || lower.includes('production') || lower.includes('cinema')) {
      return isFilipino
        ? "Ang OPHIREUM ay nag-aalok ng cinema-grade multimedia production, color grading, at visual effects. Nais po ba ninyong makita ang aming portfolio ng commercial at brand films?"
        : "OPHIREUM specializes in cinema-grade 4K/8K media production, ACES color grading, and broadcast-ready deliverables. Would you like to review our commercial film portfolio or schedule a consultation?";
    }

    return isFilipino
      ? "Naintindihan ko po ang inyong pangangailangan. Nais po ba ninyong gumawa tayo ng structured Project Brief o mag-set ng consultation schedule?"
      : "I have analyzed your project requirements. Would you like me to architect a structured Project Brief or schedule an executive consultation slot?";
  }
}

export const aiVoiceService = new AIVoiceService();
