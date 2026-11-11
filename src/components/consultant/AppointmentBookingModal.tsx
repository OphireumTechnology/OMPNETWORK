import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, Video, Phone, Building, CheckCircle2, 
  AlertCircle, Shield, Globe, ExternalLink, ArrowRight, User
} from 'lucide-react';
import { 
  ConsultationAppointment, 
  supabaseService, 
  AVAILABLE_SLOTS, 
  ProjectBrief 
} from '../../services/supabaseService';
import { COMPANY_CONFIG } from '../../data/companyConfig';

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectBrief?: ProjectBrief | null;
  initialClientData?: {
    fullName: string;
    email: string;
    phone: string;
    companyName: string;
  };
  onAppointmentBooked?: (appointment: ConsultationAppointment) => void;
}

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  isOpen,
  onClose,
  projectBrief,
  initialClientData,
  onAppointmentBooked,
}) => {
  if (!isOpen) return null;

  // Next 10 business days for booking
  const getUpcomingDates = () => {
    const dates = [];
    let d = new Date();
    d.setDate(d.getDate() + 1); // Start from tomorrow

    while (dates.length < 10) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) { // Exclude weekends
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        dates.push({ dateStr, label });
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const dates = getUpcomingDates();

  const [consultationType, setConsultationType] = useState<'video' | 'phone' | 'in_person'>('video');
  const [selectedDate, setSelectedDate] = useState<string>(dates[0]?.dateStr || '');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<string>('Asia/Manila (UTC+8)');
  const [isCheckingSlots, setIsCheckingSlots] = useState<boolean>(false);

  // Client Details Form
  const [clientName, setClientName] = useState<string>(initialClientData?.fullName || projectBrief?.client.fullName || '');
  const [clientEmail, setClientEmail] = useState<string>(initialClientData?.email || projectBrief?.client.email || '');
  const [clientPhone, setClientPhone] = useState<string>(initialClientData?.phone || projectBrief?.client.phone || '');
  const [clientCompany, setClientCompany] = useState<string>(initialClientData?.companyName || projectBrief?.client.companyName || '');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<ConsultationAppointment | null>(null);

  // Load booked slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    let isMounted = true;
    setIsCheckingSlots(true);
    setSelectedSlot('');
    setErrorMessage(null);

    supabaseService.getBookedSlots(selectedDate)
      .then((slots) => {
        if (!isMounted) return;
        setBookedSlots(slots);
        setIsCheckingSlots(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setBookedSlots([]);
        setSelectedSlot('');
        setIsCheckingSlots(false);
        setErrorMessage('Verified calendar availability is currently unavailable. Please contact OPHIREUM to arrange a consultation.');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim()) {
      setErrorMessage('Please complete your name, email, and contact phone number.');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      setErrorMessage('Please choose a consultation date and available time slot.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const refCode = `OPM-APT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    // A real meeting link must be created by the authorized calendar provider after booking.
    const meetingLink = undefined;
    const meetingLocation = consultationType === 'in_person' ? COMPANY_CONFIG.address.fullFormatted : undefined;

    const newAppointment: ConsultationAppointment = {
      referenceCode: refCode,
      client: {
        fullName: clientName,
        email: clientEmail,
        phone: clientPhone,
        companyName: clientCompany || 'Enterprise Client',
      },
      briefReferenceCode: projectBrief?.referenceCode,
      consultationType,
      scheduledDate: selectedDate,
      scheduledTimeSlot: selectedSlot,
      durationMinutes: 30,
      clientTimezone: timezone,
      meetingLink,
      meetingLocation,
      assignedConsultant: `${COMPANY_CONFIG.founderCeo} (Founder & CEO)`,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    const res = await supabaseService.bookAppointment(newAppointment);

    setIsSubmitting(false);

    if (res.success) {
      setConfirmedAppointment(res.appointment);
      if (onAppointmentBooked) {
        onAppointmentBooked(res.appointment);
      }
    } else {
      setErrorMessage(res.error || 'Failed to reserve appointment slot. Please try another time.');
    }
  };

  // Google Calendar Link generator
  const getGoogleCalendarUrl = (apt: ConsultationAppointment) => {
    const title = encodeURIComponent(`OPHIREUM Consultation: ${apt.client.companyName || apt.client.fullName}`);
    const details = encodeURIComponent(`OPHIREUM Executive Solutions Consultation\nRef: ${apt.referenceCode}\nType: ${apt.consultationType}\nAssigned: ${apt.assignedConsultant}\nLocation/Link: ${apt.meetingLink || apt.meetingLocation || apt.client.phone}`);
    const location = encodeURIComponent(apt.meetingLink || apt.meetingLocation || 'Telephone Consultation');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#0B1220] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00C2C7]/15 border border-[#00C2C7]/30 flex items-center justify-center text-[#00C2C7]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Schedule Executive Consultation
              </h3>
              <p className="text-[11px] text-slate-400">
                Direct Appointment Booking with {COMPANY_CONFIG.founderCeo} · Synchronized Availability
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-xs text-slate-300">
          
          {confirmedAppointment ? (
            /* Booking Confirmation Screen */
            <div className="py-6 text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#00C2C7] uppercase block tracking-wider">
                  Appointment Confirmed
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                  Reference: {confirmedAppointment.referenceCode}
                </h3>
                <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
                  Your consultation with <span className="text-white font-semibold">{confirmedAppointment.assignedConsultant}</span> has been confirmed on our official calendar.
                </p>
              </div>

              {/* Appointment summary card */}
              <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Consultation Date:</span>
                  <span className="font-bold text-white">{confirmedAppointment.scheduledDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Time Slot:</span>
                  <span className="font-bold text-[#00C2C7] font-mono">{confirmedAppointment.scheduledTimeSlot}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Consultation Channel:</span>
                  <span className="font-semibold text-white capitalize">{confirmedAppointment.consultationType} Consultation</span>
                </div>
                {confirmedAppointment.meetingLink && (
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Google Meet:</span>
                    <a href={confirmedAppointment.meetingLink} target="_blank" rel="noopener noreferrer" className="text-[#00C2C7] hover:underline truncate max-w-[200px]">
                      {confirmedAppointment.meetingLink}
                    </a>
                  </div>
                )}
                {confirmedAppointment.meetingLocation && (
                  <div className="py-1">
                    <span className="text-slate-400 block text-[10px]">Office Location:</span>
                    <span className="text-white">{confirmedAppointment.meetingLocation}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={getGoogleCalendarUrl(confirmedAppointment)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] font-semibold text-xs flex items-center gap-2 transition-all"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Add to Google Calendar</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>

                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Done & Return to Site
                </button>
              </div>

            </div>
          ) : (
            /* Booking Form */
            <form onSubmit={handleConfirmBooking} className="space-y-6">
              
              {/* Step 1: Consultation Channel */}
              <div className="space-y-2">
                <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold">
                  1. Select Consultation Channel
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setConsultationType('video')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      consultationType === 'video'
                        ? 'bg-[#00C2C7]/10 border-[#00C2C7] text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Video className="w-4 h-4 text-[#00C2C7] mb-1.5" />
                    <div className="font-bold text-white text-xs">Video Call</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Google Meet conference</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultationType('phone')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      consultationType === 'phone'
                        ? 'bg-[#00C2C7]/10 border-[#00C2C7] text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Phone className="w-4 h-4 text-[#D4AF37] mb-1.5" />
                    <div className="font-bold text-white text-xs">Phone Call</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">+63 Direct executive line</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultationType('in_person')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      consultationType === 'in_person'
                        ? 'bg-[#00C2C7]/10 border-[#00C2C7] text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building className="w-4 h-4 text-[#C0C7D1] mb-1.5" />
                    <div className="font-bold text-white text-xs">In-Person</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">One West Aeropark, Clark</div>
                  </button>
                </div>
              </div>

              {/* Step 2: Date & Available Slots Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold">
                    2. Select Consultation Date & Time Slot
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    Timezone: {timezone}
                  </span>
                </div>

                {/* Dates Horizontal Picker */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {dates.map((d) => (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(d.dateStr)}
                      className={`px-3 py-2 rounded-lg border text-xs font-mono shrink-0 transition-all cursor-pointer ${
                        selectedDate === d.dateStr
                          ? 'bg-[#00C2C7] text-[#0B1220] font-bold border-[#00C2C7]'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Slots Grid */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  {isCheckingSlots ? (
                    <div className="py-4 text-center text-slate-500 font-mono text-xs animate-pulse">
                      Checking consultation scheduling service...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {AVAILABLE_SLOTS.map((slot) => {
                        const isBooked = bookedSlots.includes(slot);
                        const isSelected = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={true}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-2 rounded-lg border text-center font-mono text-[11px] transition-all cursor-pointer ${
                              isBooked
                                ? 'bg-slate-950/50 border-slate-800/50 text-slate-600 cursor-not-allowed line-through'
                                : isSelected
                                ? 'bg-[#00C2C7] text-[#0B1220] font-bold border-[#00C2C7] shadow-sm'
                                : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-[#00C2C7]/50'
                            }`}
                          >
                            {slot.split(' - ')[0]}
                            {isBooked && <span className="block text-[9px] text-rose-500 font-sans">Booked</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Client Contact Details */}
              <div className="space-y-3">
                <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold">
                  3. Contact & Confirmation Information
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">Full Legal Name *</span>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Maria Santos"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#00C2C7]"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">Corporate or Personal Email *</span>
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="e.g. maria@company.com"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#00C2C7]"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">Contact Phone / Mobile *</span>
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#00C2C7]"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">Company / Organization</span>
                    <input
                      type="text"
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                      placeholder="e.g. Apex Industrial Systems"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#00C2C7]"
                    />
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedSlot}
                  className="w-full py-3 px-5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] disabled:opacity-50 text-[#0B1220] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00C2C7]/20"
                >
                  {isSubmitting ? (
                    <span>Verifying Calendar & Booking...</span>
                  ) : (
                    <>
                      <span>Confirm & Reserve Appointment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};
