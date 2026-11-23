/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import crypto from 'crypto';
import { logStructured } from '../logger';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

export interface CalendarCreateResult {
  synced: boolean;
  calendarSyncStatus: 'synced' | 'failed' | 'unconfigured';
  eventId?: string;
  meetingLink?: string;
  error?: string;
}

export class GoogleCalendarService {
  private readonly calendarId: string;
  private readonly credentials: ServiceAccountCredentials | null;

  constructor(calendarId?: string, serviceAccountJson?: string) {
    this.calendarId = (calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? '').trim();
    const rawJson = (serviceAccountJson ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '').trim();
    let parsed: ServiceAccountCredentials | null = null;
    if (rawJson && this.calendarId) {
      try {
        const candidate = JSON.parse(rawJson);
        if (candidate?.client_email && candidate?.private_key) {
          parsed = {
            client_email: String(candidate.client_email),
            private_key: String(candidate.private_key),
          };
        }
      } catch {
        parsed = null;
      }
    }
    this.credentials = parsed;
  }

  public isConfigured(): boolean {
    return Boolean(this.calendarId && this.credentials);
  }

  private async getAccessToken(): Promise<string> {
    if (!this.credentials) {
      throw new Error('Google Calendar service account credentials not configured.');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: this.credentials.client_email,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    ).toString('base64url');

    const signatureInput = `${header}.${claimSet}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(this.credentials.private_key, 'base64url');
    const assertion = `${signatureInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData?.error_description || 'Failed to obtain Google OAuth access token');
    }
    return String(tokenData.access_token);
  }

  public async createConsultationEvent(params: {
    referenceCode: string;
    fullName: string;
    email: string;
    companyName: string;
    consultationType: 'video' | 'phone' | 'in_person';
    scheduledDate: string;
    scheduledTimeSlot: string;
    clientTimezone: string;
    location?: string;
    correlationId?: string;
  }): Promise<CalendarCreateResult> {
    if (!this.isConfigured()) {
      return {
        synced: false,
        calendarSyncStatus: 'unconfigured',
        error: 'Google Calendar credentials are not configured; recording as pending scheduling request.',
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      const [startTimeStr] = params.scheduledTimeSlot.split(' - ');
      const [timePart, period] = startTimeStr.trim().split(' ');
      const [h, m] = timePart.split(':').map(Number);
      let hours = h;
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      // Manila / PHT (+08:00) authoritative slot window
      const hh = String(hours).padStart(2, '0');
      const mm = String(m || 0).padStart(2, '0');
      const startIso = `${params.scheduledDate}T${hh}:${mm}:00+08:00`;
      const endDate = new Date(new Date(startIso).getTime() + 30 * 60 * 1000);

      const eventBody: Record<string, unknown> = {
        summary: `OPHIREUM Executive Consultation (${params.referenceCode}) - ${params.companyName}`,
        description: `Client: ${params.fullName} (${params.email})\nChannel: ${params.consultationType}\nClient Timezone: ${params.clientTimezone}\nRef: ${params.referenceCode}`,
        start: { dateTime: startIso, timeZone: 'Asia/Manila' },
        end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Manila' },
        attendees: [{ email: params.email, displayName: params.fullName }],
        location: params.location,
      };

      if (params.consultationType === 'video') {
        eventBody.conferenceData = {
          createRequest: {
            requestId: params.referenceCode,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          this.calendarId
        )}/events?conferenceDataVersion=1`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventBody),
        }
      );

      const calData = await calRes.json().catch(() => ({}));
      if (!calRes.ok) {
        logStructured('warn', 'google_calendar_sync_failed', {
          correlationId: params.correlationId,
          referenceCode: params.referenceCode,
          status: calRes.status,
          error: calData?.error?.message,
        });
        return {
          synced: false,
          calendarSyncStatus: 'failed',
          error: calData?.error?.message || `Google Calendar API HTTP ${calRes.status}`,
        };
      }

      return {
        synced: true,
        calendarSyncStatus: 'synced',
        eventId: calData.id,
        meetingLink: calData.hangoutLink || calData.htmlLink || undefined,
      };
    } catch (err: any) {
      logStructured('error', 'google_calendar_exception', {
        correlationId: params.correlationId,
        referenceCode: params.referenceCode,
        error: err?.message,
      });
      return {
        synced: false,
        calendarSyncStatus: 'failed',
        error: err?.message || 'Google Calendar integration error',
      };
    }
  }
}
