import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, X, Send, Sparkles, Calendar, FileText, Phone, Minimize2, 
  Maximize2, RotateCcw, ChevronRight, CheckCircle2, Shield, User, Building,
  Clock, MapPin, MessageSquareText
} from 'lucide-react';
import { COMPANY_CONFIG } from '../../data/companyConfig';
import { 
  aiConsultantService, 
  ChatMessage, 
  ConsultationState, 
  INITIAL_CONSULTATION_STATE,
  PROJECT_CATEGORIES 
} from '../../services/aiConsultantService';
import { supabaseService, ProjectBrief, ConsultationAppointment } from '../../services/supabaseService';
import { ProjectBriefModal } from './ProjectBriefModal';
import { AppointmentBookingModal } from './AppointmentBookingModal';

export const AIConsultantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUnreadNotice, setHasUnreadNotice] = useState(true);

  // Modals for Brief & Booking
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [currentBrief, setCurrentBrief] = useState<ProjectBrief | null>(null);

  // Human Escalation Modal
  const [isEscalationModalOpen, setIsEscalationModalOpen] = useState(false);

  // Conversation State
  const [state, setState] = useState<ConsultationState>(() => {
    try {
      const saved = localStorage.getItem('opm_consultant_state');
      return saved ? JSON.parse(saved) : INITIAL_CONSULTATION_STATE;
    } catch {
      return INITIAL_CONSULTATION_STATE;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('opm_consultant_messages');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'ai',
        text: `Welcome to OPHIREUM MULTIMEDIA PRODUCTION. I am your AI Solutions Consultant. Whether you require cinema-grade multimedia production, enterprise software, AI automation pipelines, or full-scale web platforms, I'm here to understand your requirements, architect a tailored preliminary brief, and schedule your executive consultation. Which area best matches your project?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: 'welcome',
        quickReplies: [
          'Website & Web Platforms',
          'Enterprise Software Development',
          'AI Solutions & Automation',
          'Multimedia & Cinema Production',
        ],
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isTyping]);

  // Persist conversation
  useEffect(() => {
    try {
      localStorage.setItem('opm_consultant_messages', JSON.stringify(messages));
      localStorage.setItem('opm_consultant_state', JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }, [messages, state]);

  // Sync brief if available in state
  useEffect(() => {
    if (state.generatedBrief) {
      setCurrentBrief(state.generatedBrief);
    }
  }, [state.generatedBrief]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isTyping) return;

    const userMsgId = `usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Check for human escalation keywords
      if (/speak to human|talk to human|call ceo|dhenze|founder|phone number|call now/i.test(text)) {
        setTimeout(() => {
          setIsTyping(false);
          const aiEscalateMsg: ChatMessage = {
            id: `ai-esc-${Date.now()}`,
            sender: 'ai',
            text: `You can reach our Founder & CEO, Dhenze Languisan directly at ${COMPANY_CONFIG.mobile}, or visit our executive production suite at KMC | One West Aeropark, Clark Freeport Zone. Would you like to review direct executive contact options or schedule a structured consultation meeting?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedAction: 'talk_to_human',
            quickReplies: ['Direct Executive Contact', 'Schedule Consultation'],
          };
          setMessages((prev) => [...prev, aiEscalateMsg]);
        }, 600);
        return;
      }

      // Check if user wants to review brief or schedule appointment
      if (/review brief|view brief|see brief|project brief/i.test(text)) {
        setTimeout(() => {
          setIsTyping(false);
          if (state.generatedBrief) {
            setCurrentBrief(state.generatedBrief);
            setIsBriefModalOpen(true);
          } else {
            const draftBrief = supabaseService.generateDefaultBrief(state.requirements.category || 'Enterprise Digital Platform', {
              fullName: state.client.fullName || 'Prospective Enterprise Client',
              companyName: state.client.companyName || 'Enterprise Partner',
              email: state.client.email || 'partner@enterprise.com',
            });
            setCurrentBrief(draftBrief);
            setIsBriefModalOpen(true);
          }
        }, 500);
        return;
      }

      if (/schedule|book appointment|set meeting|consultation slot/i.test(text)) {
        setTimeout(() => {
          setIsTyping(false);
          setIsBookingModalOpen(true);
        }, 500);
        return;
      }

      // Standard consultative pipeline
      const { aiMessage, updatedState } = await aiConsultantService.processUserMessage(text, state, messages);
      
      // Simulate realistic consulting response delay
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, aiMessage]);
        setState(updatedState);
        if (updatedState.generatedBrief) {
          setCurrentBrief(updatedState.generatedBrief);
        }
      }, 700);

    } catch (err) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'I apologize for the transient disruption. Our solution architects are ready to assist. You may also schedule a direct consultation slot or speak with executive management.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: ['Schedule Consultation', 'Direct Executive Contact'],
        },
      ]);
    }
  };

  const handleQuickReply = (reply: string) => {
    if (reply === 'Review Project Brief') {
      if (currentBrief || state.generatedBrief) {
        setIsBriefModalOpen(true);
      } else {
        const brief = supabaseService.generateDefaultBrief(state.requirements.category || 'Website & Web Platforms', state.client);
        setCurrentBrief(brief);
        setIsBriefModalOpen(true);
      }
      return;
    }

    if (reply === 'Schedule Consultation') {
      setIsBookingModalOpen(true);
      return;
    }

    if (reply === 'Direct Executive Contact' || reply === 'Speak with Dhenze Languisan (CEO)') {
      setIsEscalationModalOpen(true);
      return;
    }

    handleSendMessage(reply);
  };

  const handleResetConversation = () => {
    if (confirm('Start a new consultation discovery session?')) {
      localStorage.removeItem('opm_consultant_messages');
      localStorage.removeItem('opm_consultant_state');
      setState(INITIAL_CONSULTATION_STATE);
      setCurrentBrief(null);
      setMessages([
        {
          id: `msg-welcome-reset-${Date.now()}`,
          sender: 'ai',
          text: `Consultation session reset. Welcome to OPHIREUM MULTIMEDIA PRODUCTION. How can our engineering and creative team elevate your project today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          stage: 'welcome',
          quickReplies: [
            'Website & Web Platforms',
            'Enterprise Software Development',
            'AI Solutions & Automation',
            'Multimedia & Cinema Production',
          ],
        },
      ]);
    }
  };

  // Stage progress calculation
  const getStageStep = () => {
    switch (state.currentStage) {
      case 'welcome': return 1;
      case 'category': return 1;
      case 'problem': return 2;
      case 'features': return 2;
      case 'client_info': return 3;
      case 'recommendation': return 3;
      case 'brief_ready': return 4;
      case 'scheduling': return 4;
      case 'confirmed': return 4;
      default: return 1;
    }
  };

  return (
    <>
      {/* =========================================================================
          FLOATING LAUNCHER BUTTON (Bottom-Right)
          ========================================================================= */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          {/* Subtle Callout Bubble */}
          {hasUnreadNotice && (
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-[#111827] border border-[#00C2C7]/30 text-xs text-slate-200 rounded-xl shadow-2xl animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-[#00C2C7] animate-ping" />
              <span>Have a project? <strong>Consult with AI Solutions</strong></span>
              <button 
                onClick={(e) => { e.stopPropagation(); setHasUnreadNotice(false); }}
                className="text-slate-500 hover:text-slate-300 ml-1 cursor-pointer"
                aria-label="Dismiss notice"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
              setHasUnreadNotice(false);
            }}
            className="group relative flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-[#111827] via-[#1a2336] to-[#0d1627] text-white rounded-2xl border border-[#00C2C7]/50 shadow-[0_10px_30px_rgba(0,194,199,0.25)] hover:shadow-[0_15px_35px_rgba(0,194,199,0.4)] transition-all duration-300 hover:scale-105 cursor-pointer"
            aria-label="Open AI Solutions Consultant"
          >
            {/* Outer Glow Ring */}
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#00C2C7] via-[#D4AF37] to-[#00C2C7] opacity-25 group-hover:opacity-60 blur transition duration-300" />

            <div className="relative flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#0B1220] border border-[#00C2C7]/40 flex items-center justify-center p-1.5 shadow-inner">
                <img
                  src={COMPANY_CONFIG.logoUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>

              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white tracking-wide uppercase">AI Consultant</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C2C7]" />
                </div>
                <p className="text-[10px] font-mono text-[#00C2C7]">OPHIREUM SOLUTIONS</p>
              </div>

              <div className="w-8 h-8 rounded-lg bg-[#00C2C7]/10 flex items-center justify-center text-[#00C2C7] border border-[#00C2C7]/20 group-hover:bg-[#00C2C7] group-hover:text-[#0B1220] transition-colors">
                <Bot className="w-4 h-4" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* =========================================================================
          EXPANDABLE CHAT PANEL
          ========================================================================= */}
      {isOpen && (
        <div 
          className={`fixed right-3 sm:right-6 bottom-3 sm:bottom-6 z-50 bg-[#0B1220] border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isMinimized 
              ? 'w-80 h-16' 
              : 'w-[calc(100vw-24px)] sm:w-[440px] md:w-[480px] h-[calc(100vh-60px)] sm:h-[650px] max-h-[85vh]'
          }`}
        >
          {/* Top Header */}
          <div className="px-4 py-3 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-2 select-none">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-xl p-0.5 bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-slate-400">
                <img
                  src={COMPANY_CONFIG.logoUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-contain rounded-[10px] bg-[#111827]"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#111827]" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-white tracking-wide">OPHIREUM AI Solutions</h3>
                  <span className="text-[9px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-1.5 py-0.5 rounded border border-[#00C2C7]/30">
                    ONLINE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Executive Discovery & Scope Architect</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetConversation}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title={isMinimized ? 'Expand' : 'Minimize'}
                aria-label={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Stage Progress Bar */}
              <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#00C2C7] uppercase font-bold">Discovery Phase</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((step) => {
                      const active = step <= getStageStep();
                      return (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            active ? 'w-6 bg-[#00C2C7]' : 'w-2 bg-slate-700'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentBrief && (
                    <button
                      onClick={() => setIsBriefModalOpen(true)}
                      className="text-[10px] font-mono text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Brief</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsBookingModalOpen(true)}
                    className="text-[10px] font-mono text-[#00C2C7] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Book</span>
                  </button>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => {
                  const isAi = msg.sender === 'ai';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-start gap-2 max-w-[88%]">
                        {isAi && (
                          <div className="w-6 h-6 rounded-lg bg-[#111827] border border-cyan-500/40 flex-shrink-0 flex items-center justify-center text-[#00C2C7] mt-0.5">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div>
                          <div
                            className={`p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${
                              isAi
                                ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-sm'
                                : 'bg-gradient-to-r from-[#00C2C7] to-[#009b9f] text-[#0B1220] font-medium rounded-tr-sm shadow-md'
                            }`}
                          >
                            {msg.text}
                          </div>

                          <div
                            className={`mt-1 flex items-center gap-2 text-[10px] font-mono ${
                              isAi ? 'text-slate-500' : 'text-slate-400 justify-end'
                            }`}
                          >
                            <span>{msg.timestamp}</span>
                            {isAi && <span>· OPHIREUM AI Core</span>}
                          </div>

                          {/* Action Buttons for AI message if available */}
                          {isAi && msg.suggestedAction === 'schedule_meeting' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => setIsBriefModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                                <span>Inspect Project Brief</span>
                              </button>
                              <button
                                onClick={() => setIsBookingModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-[#00C2C7] hover:bg-[#00d8de] text-[#0B1220] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Schedule Consultation</span>
                              </button>
                            </div>
                          )}

                          {isAi && msg.suggestedAction === 'talk_to_human' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => setIsEscalationModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#e4be46] text-[#0B1220] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>Contact CEO Dhenze Languisan</span>
                              </button>
                              <button
                                onClick={() => setIsBookingModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5 text-[#00C2C7]" />
                                <span>Book Calendar Slot</span>
                              </button>
                            </div>
                          )}

                          {/* Quick replies */}
                          {isAi && msg.quickReplies && msg.quickReplies.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {msg.quickReplies.map((reply, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleQuickReply(reply)}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-[#00C2C7]/20 hover:border-[#00C2C7]/50 text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer"
                                >
                                  {reply}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                    <div className="w-6 h-6 rounded-lg bg-[#111827] border border-cyan-500/40 flex items-center justify-center text-[#00C2C7]">
                      <Bot className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <span className="flex items-center gap-1">
                      <span>Synthesizing technical response</span>
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce delay-100">.</span>
                      <span className="animate-bounce delay-200">.</span>
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Navigation Utility Strip */}
              <div className="px-4 py-2 bg-[#111827]/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                  <Shield className="w-3 h-3 text-[#00C2C7]" />
                  <span>Confidential NDA Scope Protection</span>
                </span>
                <button
                  onClick={() => setIsEscalationModalOpen(true)}
                  className="text-[10px] font-mono text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-3 h-3" />
                  <span>Direct Escalation</span>
                </button>
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-[#111827] border-t border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Describe your project, features, or ask a question..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isTyping}
                    className="p-2.5 rounded-xl bg-[#00C2C7] hover:bg-[#00d8de] text-[#0B1220] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          STRUCTURED PROJECT BRIEF MODAL
          ========================================================================= */}
      <ProjectBriefModal
        isOpen={isBriefModalOpen}
        onClose={() => setIsBriefModalOpen(false)}
        brief={currentBrief}
        onScheduleConsultation={() => {
          setIsBriefModalOpen(false);
          setIsBookingModalOpen(true);
        }}
      />

      {/* =========================================================================
          SMART APPOINTMENT BOOKING MODAL
          ========================================================================= */}
      <AppointmentBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        projectBrief={currentBrief}
        initialClientData={state.client}
        onAppointmentBooked={(appointment: ConsultationAppointment) => {
          setState((prev) => ({
            ...prev,
            currentStage: 'confirmed',
            scheduledAppointment: appointment,
          }));
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-confirmed-${Date.now()}`,
              sender: 'ai',
              text: `Your consultation appointment has been scheduled!\n\n• Confirmation Ref: ${appointment.referenceCode}\n• Date & Time: ${appointment.scheduledDate} at ${appointment.scheduledTimeSlot} (${appointment.clientTimezone})\n• Consultation Mode: ${appointment.consultationType.toUpperCase()}\n\nOur team has dispatched an executive calendar invite to ${appointment.client.email}. You can also download or sync this appointment to Google Calendar.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              stage: 'schedule',
              suggestedAction: 'talk_to_human',
              quickReplies: ['Direct Executive Contact'],
            },
          ]);
        }}
      />

      {/* =========================================================================
          EXECUTIVE ESCALATION MODAL (Founder & CEO Direct Channel)
          ========================================================================= */}
      {isEscalationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#0B1220] border border-[#00C2C7]/40 rounded-2xl shadow-2xl overflow-hidden p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#111827] border border-[#D4AF37]/40 p-1 flex items-center justify-center">
                  <img
                    src={COMPANY_CONFIG.logoUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Executive Escalation Channel</h3>
                  <p className="text-xs text-slate-400">Direct leadership communication</p>
                </div>
              </div>
              <button
                onClick={() => setIsEscalationModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-wider">Founder & Chief Executive Officer</span>
                    <h4 className="text-base font-bold text-white mt-0.5">{COMPANY_CONFIG.founderCeo}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Direct executive oversight for high-value media productions, enterprise contracts, and proprietary technology architecture.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/30">
                    EXECUTIVE SUITE
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#00C2C7]" />
                      <span>Direct Mobile / WhatsApp:</span>
                    </span>
                    <a
                      href={`tel:${COMPANY_CONFIG.mobile.replace(/\s+/g, '')}`}
                      className="font-mono text-white font-bold hover:text-[#00C2C7] transition-colors"
                    >
                      {COMPANY_CONFIG.mobile}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-[#00C2C7]" />
                      <span>Executive Suite:</span>
                    </span>
                    <span className="text-slate-300 font-medium">KMC | One West Aeropark</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#00C2C7]" />
                      <span>Freeport Location:</span>
                    </span>
                    <span className="text-slate-300">Clark Freeport Zone, Pampanga</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`tel:${COMPANY_CONFIG.mobile.replace(/\s+/g, '')}`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00C2C7] to-[#009b9f] text-[#0B1220] font-bold text-xs text-center flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition-all cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call {COMPANY_CONFIG.mobile}</span>
                </a>
                <button
                  onClick={() => {
                    setIsEscalationModalOpen(false);
                    setIsBookingModalOpen(true);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-[#00C2C7]" />
                  <span>Book Formal Calendar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
