/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Video,
  Phone,
  Building,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Clock,
  Ban,
} from 'lucide-react';
import {
  ConsultationAppointment,
  supabaseService,
  AVAILABLE_SLOTS,
  ProjectBrief,
} from '../../services/supabaseService';
import { COMPANY_CONFIG } from '../../data/companyConfig';
import { createIdempotencyKey } from '../../lib/apiClient';

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
  const getUpcomingDates = () => {
    const dates = [];
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (dates.length < 10) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const label = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
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
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>('Asia/Manila');
  const [isCheckingSlots, setIsCheckingSlots] = useState<boolean>(false);

  const [clientName, setClientName] = useState<string>(
    initialClientData?.fullName || projectBrief?.client.fullName || ''
  );
  const [clientEmail, setClientEmail] = useState<string>(
    initialClientData?.email || projectBrief?.client.email || ''
  );
  const [clientPhone, setClientPhone] = useState<string>(
    initialClientData?.phone || projectBrief?.client.phone || ''
  );
  const [clientCompany, setClientCompany] = useState<string>(
    initialClientData?.companyName || projectBrief?.client.companyName || ''
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    appointment: ConsultationAppointment;
    managementToken?: string;
    calendarSynced: boolean;
  } | null>(null);

  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  useEffect(() => {
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [selectedDate, selectedSlot, consultationType, clientName, clientEmail, clientPhone]);

  useEffect(() => {
    if (!isOpen || !selectedDate) return;
    let isMounted = true;
    setIsCheckingSlots(true);
    setSelectedSlot('');
    setAvailabilityError(null);
    setErrorMessage(null);

    supabaseService.getBookedSlots(selectedDate).then((res) => {
      if (isMounted) {
        setBookedSlots(res.bookedSlots);
        setAvailabilityError(res.error || null);
        setIsCheckingSlots(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

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

    const res = await supabaseService.bookAppointment({
      fullName: clientName.trim(),
      email: clientEmail.trim(),
      phone: clientPhone.trim(),
      companyName: clientCompany.trim() || 'Enterprise Client',
      briefReferenceCode: projectBrief?.referenceCode,
      consultationType,
      scheduledDate: selectedDate,
      scheduledTimeSlot: selectedSlot,
      clientTimezone: timezone,
      idempotencyKey: idempotencyKeyRef.current,
    });

    setIsSubmitting(false);

    if (res.success && res.appointment) {
      setSubmittedResult({
        appointment: res.appointment,
        managementToken: res.managementToken,
        calendarSynced: Boolean(res.calendarSynced),
      });
      if (onAppointmentBooked) {
        onAppointmentBooked(res.appointment);
      }
      idempotencyKeyRef.current = createIdempotencyKey();
    } else {
      setErrorMessage(
        res.error || 'Failed to submit consultation request. Your inputs remain intact so you can retry.'
      );
    }
  };

  const handleCancelSubmitted = async () => {
    if (!submittedResult?.appointment || !submittedResult.managementToken) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    const res = await supabaseService.manageAppointment({
      referenceCode: submittedResult.appointment.referenceCode,
      action: 'cancel',
      managementToken: submittedResult.managementToken,
      email: submittedResult.appointment.client.email,
    });
    setIsSubmitting(false);
    if (res.success) {
      setSubmittedResult({
        ...submittedResult,
        appointment: { ...submittedResult.appointment, status: 'cancelled' },
      });
    } else {
      setErrorMessage(res.error || 'Could not cancel request.');
    }
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
                Server-Verified Slot Reservation with {COMPANY_CONFIG.founderCeo}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-xs text-slate-300">
          {submittedResult ? (
            <div className="py-4 text-center space-y-5">
              <div
                className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto ${
                  submittedResult.appointment.status === 'cancelled'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : submittedResult.calendarSynced
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-[#00C2C7]/15 border-[#00C2C7]/40 text-[#00C2C7]'
                }`}
              >
                {submittedResult.appointment.status === 'cancelled' ? (
                  <Ban className="w-8 h-8" />
                ) : submittedResult.calendarSynced ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <Clock className="w-8 h-8" />
                )}
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#00C2C7] uppercase block tracking-wider">
                  {submittedResult.appointment.status === 'cancelled'
                    ? 'Consultation Request Cancelled'
                    : submittedResult.calendarSynced
                    ? 'Calendar Appointment Confirmed'
                    : 'Pending Scheduling Request Recorded'}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                  Reference: {submittedResult.appointment.referenceCode}
                </h3>
                <p className="text-xs text-slate-300 mt-2 max-w-lg mx-auto leading-relaxed">
                  {submittedResult.appointment.status === 'cancelled'
                    ? 'This scheduling request has been marked cancelled and the time slot has been released.'
                    : submittedResult.calendarSynced
                    ? `Your consultation with ${submittedResult.appointment.assignedConsultant} is confirmed on our synchronized Google Calendar.`
                    : `Your scheduling request has been safely reserved in our database as a Pending Scheduling Request. An executive coordinator will send the final calendar invite and meeting link shortly (or call ${COMPANY_CONFIG.mobile} for urgent requests).`}
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-mono font-bold text-[#00C2C7] uppercase">
                    {submittedResult.appointment.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Consultation Date:</span>
                  <span className="font-bold text-white">
                    {submittedResult.appointment.scheduledDate}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Time Slot (PHT):</span>
                  <span className="font-bold text-[#00C2C7] font-mono">
                    {submittedResult.appointment.scheduledTimeSlot}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Channel:</span>
                  <span className="font-semibold text-white capitalize">
                    {submittedResult.appointment.consultationType} Consultation
                  </span>
                </div>
                {submittedResult.appointment.meetingLink && (
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Verified Meet Link:</span>
                    <a
                      href={submittedResult.appointment.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00C2C7] hover:underline truncate max-w-[200px]"
                    >
                      {submittedResult.appointment.meetingLink}
                    </a>
                  </div>
                )}
                {submittedResult.appointment.meetingLocation && (
                  <div className="py-1">
                    <span className="text-slate-400 block text-[10px]">Office Location:</span>
                    <span className="text-white">{submittedResult.appointment.meetingLocation}</span>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="max-w-md mx-auto p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {errorMessage}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                {submittedResult.appointment.status !== 'cancelled' && (
                  <a
                    href={supabaseService.generateGoogleCalendarUrl(submittedResult.appointment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] font-semibold text-xs flex items-center gap-2 transition-all"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Save Draft to Personal Calendar</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                )}

                {submittedResult.appointment.status !== 'cancelled' &&
                  submittedResult.managementToken && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleCancelSubmitted}
                      className="px-4 py-2.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Cancel Request
                    </button>
                  )}

                <button
                  onClick={() => {
                    setSubmittedResult(null);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Done & Return to Site
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmBooking} className="space-y-6">
              {/* Step 1: Channel */}
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
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Online conference (link issued upon confirmation)
                    </div>
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

              {/* Step 2: Date & Slots */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold">
                    2. Select Consultation Date & Time Slot (PHT)
                  </label>
                  <select
                    aria-label="Client Timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300"
                  >
                    <option value="Asia/Manila">Asia/Manila (UTC+8)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>

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

                {availabilityError && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{availabilityError}</span>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  {isCheckingSlots ? (
                    <div className="py-4 text-center text-slate-500 font-mono text-xs animate-pulse">
                      Querying server availability...
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
                            disabled={isBooked}
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
                            {isBooked && <span className="block text-[9px] text-rose-500 font-sans">Reserved</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Contact */}
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
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedSlot}
                  className="w-full py-3 px-5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] disabled:opacity-50 text-[#0B1220] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00C2C7]/20"
                >
                  {isSubmitting ? (
                    <span>Verifying Slot Availability & Submitting...</span>
                  ) : (
                    <>
                      <span>Submit Consultation Request</span>
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
