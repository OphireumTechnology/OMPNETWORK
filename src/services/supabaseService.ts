import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-ompnetwork-id')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface ClientProfile {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  industry?: string;
  location?: string;
}

export interface ProjectRequirements {
  id?: string;
  category: string;
  businessProblem: string;
  targetUsers?: string;
  keyFeatures: string[];
  existingSystems?: string;
  thirdPartyIntegrations?: string[];
  budgetPreference: string;
  targetTimeline: string;
  specialRequirements?: string;
}

export interface ProjectBrief {
  id?: string;
  referenceCode: string;
  client: ClientProfile;
  requirements: ProjectRequirements;
  technicalArchitecture: {
    recommendedModules: string[];
    suggestedStack: string[];
    infrastructure: string;
    securityMeasures: string[];
  };
  commercialDiscovery: {
    budgetPreference: string;
    timelinePreference: string;
    suggestedPhases: string[];
    consultationAgenda: string[];
  };
  createdAt: string;
  status: 'draft' | 'reviewed_by_client' | 'confirmed';
}

export interface ConsultationAppointment {
  id?: string;
  referenceCode: string;
  client: ClientProfile;
  briefReferenceCode?: string;
  consultationType: 'video' | 'phone' | 'in_person';
  scheduledDate: string; // YYYY-MM-DD
  scheduledTimeSlot: string; // e.g. "10:00 AM - 10:30 AM"
  durationMinutes: number;
  clientTimezone: string;
  meetingLink?: string;
  meetingLocation?: string;
  assignedConsultant: string;
  status: 'confirmed' | 'rescheduled' | 'cancelled';
  createdAt: string;
}

// Local Storage Keys for offline / static hosting reliability
const STORAGE_KEYS = {
  BRIEFS: 'opm_project_briefs',
  APPOINTMENTS: 'opm_consultation_appointments',
  INQUIRIES: 'opm_inquiries',
};

// Available consultation slots generator (Monday - Friday, 9:00 AM - 5:00 PM PST)
export const AVAILABLE_SLOTS = [
  '09:00 AM - 09:30 AM',
  '10:00 AM - 10:30 AM',
  '11:00 AM - 11:30 AM',
  '01:30 PM - 02:00 PM',
  '02:30 PM - 03:00 PM',
  '03:30 PM - 04:00 PM',
  '04:30 PM - 05:00 PM',
];

export const supabaseService = {
  // Check if a slot is already booked on a date
  async getBookedSlots(dateStr: string): Promise<string[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('consultation_appointments')
          .select('scheduled_time_slot')
          .eq('scheduled_date', dateStr)
          .eq('status', 'confirmed');
        if (!error && data) {
          return data.map((d: any) => d.scheduled_time_slot);
        }
      } catch (err) {
        console.warn('Supabase query error, using local store:', err);
      }
    }

    // Local storage fallback
    const all = this.getLocalAppointments();
    return all
      .filter((a) => a.scheduledDate === dateStr && a.status === 'confirmed')
      .map((a) => a.scheduledTimeSlot);
  },

  // Save Project Brief
  async saveProjectBrief(brief: ProjectBrief): Promise<ProjectBrief> {
    if (supabase) {
      try {
        await supabase.from('project_briefs').insert({
          reference_code: brief.referenceCode,
          title: `${brief.requirements.category} Project Specification`,
          summary: brief.requirements.businessProblem,
          technical_architecture: brief.technicalArchitecture,
          commercial_discovery: brief.commercialDiscovery,
          status: brief.status,
        });
      } catch (err) {
        console.warn('Supabase brief save failed:', err);
      }
    }

    // Persist locally
    const briefs = this.getLocalBriefs();
    briefs.unshift(brief);
    localStorage.setItem(STORAGE_KEYS.BRIEFS, JSON.stringify(briefs));
    return brief;
  },

  // Book Consultation Appointment
  async bookAppointment(appointment: ConsultationAppointment): Promise<{ success: boolean; appointment: ConsultationAppointment; error?: string }> {
    // Fail closed: local browser storage is not a shared reservation system.
    // A production booking must be committed by a trusted backend with an
    // atomic uniqueness constraint and verified calendar integration.
    return {
      success: false,
      appointment,
      error: 'Online appointment confirmation is temporarily unavailable. Please contact OPHIREUM directly to arrange a consultation.',
    };
  },

  generateGoogleCalendarUrl(appointment: ConsultationAppointment): string {
    const title = encodeURIComponent(`OPHIREUM Consultation: ${appointment.referenceCode}`);
    const details = encodeURIComponent(
      `Executive Consultation with OPHIREUM MULTIMEDIA PRODUCTION.\nReference Code: ${appointment.referenceCode}\nMode: ${appointment.consultationType.toUpperCase()}\nClient: ${appointment.client.fullName} (${appointment.client.companyName})\nLead: ${appointment.assignedConsultant}\nLocation: ${appointment.meetingLocation || appointment.meetingLink || 'KMC One West Aeropark, Clark Freeport Zone'}`
    );
    const location = encodeURIComponent(appointment.meetingLocation || 'Clark Freeport Zone, Pampanga / Google Meet');
    
    // Parse scheduled date and time slot
    try {
      const [startTimeStr] = appointment.scheduledTimeSlot.split(' - ');
      const [time, period] = startTimeStr.trim().split(' ');
      const [h, m] = time.split(':').map(Number);
      let hours = h;
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const [yyyy, mm, dd] = appointment.scheduledDate.split('-').map(Number);
      const startDt = new Date(Date.UTC(yyyy, mm - 1, dd, hours, m));
      const endDt = new Date(startDt.getTime() + appointment.durationMinutes * 60 * 1000);

      const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
      const datesParam = `${fmt(startDt)}/${fmt(endDt)}`;

      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${datesParam}`;
    } catch {
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    }
  },

  generateDefaultBrief(category: string, client?: Partial<ClientProfile>): ProjectBrief {
    const refCode = `OPM-BRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      referenceCode: refCode,
      client: {
        fullName: client?.fullName || 'Prospective Enterprise Client',
        email: client?.email || 'client@enterprise.com',
        phone: client?.phone || '+63 9XX XXX XXXX',
        companyName: client?.companyName || 'Enterprise Partner',
        industry: client?.industry || 'Technology & Digital Media',
        location: client?.location || 'Clark Freeport Zone / Metro Manila',
      },
      requirements: {
        category: category || 'Enterprise Digital Platform',
        businessProblem: 'Comprehensive digital capability expansion and workflow modernization.',
        keyFeatures: [
          'Enterprise RBAC & Authentication Architecture',
          'Automated AI Processing & Solution Pipeline',
          'Resilient Multi-Cloud Database Replication',
          'Production-Grade Responsive Interface & Dashboard',
        ],
        budgetPreference: 'Enterprise Tier / Flexible',
        targetTimeline: 'Standard 4 to 8 Week Implementation',
      },
      technicalArchitecture: {
        recommendedModules: [
          'User Management & Multi-Tenant Access Control',
          'Distributed Cloud API & Event Engine',
          'Real-Time Status & Progress Dashboard',
          'Automated GitHub Actions CI/CD Pipeline',
        ],
        suggestedStack: ['React 19', 'TypeScript', 'Node.js', 'PostgreSQL / Supabase', '@google/genai SDK'],
        infrastructure: 'Dedicated Cloud Run & Cloud SQL with automated failover and daily snapshots.',
        securityMeasures: [
          'Row-Level Security (RLS) enforcement',
          'JWT & MFA privilege isolation',
          'Zero-hallucination verification gates',
        ],
      },
      commercialDiscovery: {
        budgetPreference: 'Subject to milestone discovery',
        timelinePreference: 'Standard staged rollout',
        suggestedPhases: [
          'Phase 1: Architecture Review & Technical Spec',
          'Phase 2: Prototype Development & Core Integration',
          'Phase 3: QA Verification & Security Audit',
          'Phase 4: Production Deployment & SLA Handover',
        ],
        consultationAgenda: [
          'Deep dive into operational workflows',
          'Review existing technical assets and dependencies',
          'Formal scope finalization and milestone roadmap',
        ],
      },
      createdAt: new Date().toISOString(),
      status: 'draft',
    };
  },

  getLocalBriefs(): ProjectBrief[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.BRIEFS) || '[]');
    } catch {
      return [];
    }
  },

  getLocalAppointments(): ConsultationAppointment[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
    } catch {
      return [];
    }
  },
};

export type AppointmentRecord = ConsultationAppointment;

