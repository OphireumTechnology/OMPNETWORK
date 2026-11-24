import { DatabaseRepository, SolutionRequestRecord, AppointmentRecord, EmailOutboxRecord } from '../db/types';
import { escapeHtml } from '../validation';
import { logStructured } from '../logger';
import { COMPANY_CONFIG } from '../../data/companyConfig';
import { BRAND_ASSETS } from '../../data/brandAssets';

function renderOfficialEmailHeader(subtitle: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-bottom:1px solid #1E293B;padding-bottom:16px;margin-bottom:20px;">
      <tr>
        <td width="56" valign="middle" style="padding-right:12px;">
          <img
            src="${escapeHtml(BRAND_ASSETS.hostedPrimaryLogoUrl)}"
            alt="${escapeHtml(BRAND_ASSETS.altText)}"
            width="48"
            height="48"
            style="display:block;width:48px;height:48px;border-radius:9999px;border:1.5px solid #D4AF37;object-fit:cover;background:#ffffff;"
          />
        </td>
        <td valign="middle">
          <div style="font-size:16px;font-weight:700;letter-spacing:0.04em;color:#FFFFFF;margin:0;">OPHIREUM MULTIMEDIA PRODUCTION</div>
          <div style="font-size:12px;color:#00C2C7;margin-top:2px;">${escapeHtml(subtitle)}</div>
        </td>
      </tr>
    </table>
  `;
}

export interface EmailSendResult {
  status: 'sent' | 'failed' | 'unconfigured';
  providerReference?: string;
  error?: string;
}

export interface EmailTransport {
  readonly isConfigured: boolean;
  send(params: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey?: string;
  }): Promise<EmailSendResult>;
}

export class ResendEmailTransport implements EmailTransport {
  private readonly apiKey: string;
  public readonly isConfigured: boolean;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey ?? process.env.RESEND_API_KEY ?? '').trim();
    this.isConfigured = Boolean(this.apiKey && !this.apiKey.includes('your_') && this.apiKey.length >= 10);
  }

  async send(params: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey?: string;
  }): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        status: 'unconfigured',
        error: 'RESEND_API_KEY is not configured on the server.',
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: params.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          status: 'failed',
          error: payload?.message || payload?.error || `Resend API error HTTP ${response.status}`,
        };
      }

      return {
        status: 'sent',
        providerReference: typeof payload?.id === 'string' ? payload.id : undefined,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        error: err?.message || 'Network failure calling email provider',
      };
    }
  }
}

export class TransactionalEmailService {
  private readonly fromAddress: string;
  private readonly adminInbox: string;

  constructor(
    private readonly db: DatabaseRepository,
    private readonly transport: EmailTransport = new ResendEmailTransport()
  ) {
    this.fromAddress =
      process.env.EMAIL_FROM || 'Ophireum Multimedia Production <no-reply@ophireummultimedia.com>';
    this.adminInbox =
      process.env.ADMIN_NOTIFICATION_EMAIL || 'ophireum.multimedia@gmail.com';
  }

  public isConfigured(): boolean {
    return this.transport.isConfigured;
  }

  private async dispatchOutboxItem(item: EmailOutboxRecord, correlationId?: string): Promise<EmailOutboxRecord['status']> {
    const attemptNumber = item.deliveryAttempts + 1;
    const result = await this.transport.send({
      to: item.recipientEmail,
      from: this.fromAddress,
      subject: item.subject,
      html: item.htmlBody,
      text: item.textBody,
      idempotencyKey: item.dedupeKey,
    });

    if (result.status === 'sent') {
      await this.db.updateOutboxStatus(item.id, {
        status: 'sent',
        providerReference: result.providerReference,
        deliveryAttempts: attemptNumber,
        sentAt: new Date().toISOString(),
        nextRetryAt: null,
      });
      logStructured('info', 'email_dispatched', {
        correlationId,
        entityType: item.entityType,
        entityReference: item.entityReference,
        notificationType: item.notificationType,
        recipientEmail: item.recipientEmail,
        providerReference: result.providerReference,
      });
      return 'sent';
    }

    if (result.status === 'unconfigured') {
      await this.db.updateOutboxStatus(item.id, {
        status: 'unconfigured',
        deliveryAttempts: attemptNumber,
        lastError: result.error,
        nextRetryAt: null,
      });
      logStructured('warn', 'email_dispatch_skipped_unconfigured', {
        correlationId,
        entityType: item.entityType,
        entityReference: item.entityReference,
        notificationType: item.notificationType,
      });
      return 'unconfigured';
    }

    const backoffMinutes = Math.min(60, Math.pow(2, attemptNumber));
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
    await this.db.updateOutboxStatus(item.id, {
      status: 'failed',
      deliveryAttempts: attemptNumber,
      lastError: result.error,
      nextRetryAt,
    });
    logStructured('error', 'email_dispatch_failed', {
      correlationId,
      entityType: item.entityType,
      entityReference: item.entityReference,
      notificationType: item.notificationType,
      attemptNumber,
      error: result.error,
    });
    return 'failed';
  }

  public async enqueueAndSendSolutionRequestEmails(
    requestRecord: SolutionRequestRecord,
    correlationId?: string
  ): Promise<{
    customerStatus: EmailOutboxRecord['status'];
    adminStatus: EmailOutboxRecord['status'];
    overallStatus: 'sent' | 'failed' | 'unconfigured';
  }> {
    const safeName = escapeHtml(requestRecord.fullName);
    const safeOrg = escapeHtml(requestRecord.company);
    const safeEmail = escapeHtml(requestRecord.email);
    const safePhone = escapeHtml(requestRecord.contactNumber);
    const safeNotes = escapeHtml(requestRecord.projectDescription);
    const safeTimeline = escapeHtml(requestRecord.targetTimeline || 'To be confirmed');

    const serviceRowsHtml =
      requestRecord.selectedServices.length > 0
        ? requestRecord.selectedServices
            .map(
              (s) =>
                `<li><strong>${escapeHtml(s.title)}</strong> — Starting at $${Number(
                  s.startingUsd
                ).toLocaleString('en-US')}${
                  s.monthlyUsd ? ` + $${Number(s.monthlyUsd).toLocaleString('en-US')}/mo` : ''
                }</li>`
            )
            .join('')
        : `<li><strong>${escapeHtml(requestRecord.serviceTitle)}</strong></li>`;

    const servicesText =
      requestRecord.selectedServices.length > 0
        ? requestRecord.selectedServices
            .map(
              (s) =>
                `- ${s.title}: Starting at $${Number(s.startingUsd).toLocaleString('en-US')}${
                  s.monthlyUsd ? ` + $${Number(s.monthlyUsd).toLocaleString('en-US')}/mo` : ''
                }`
            )
            .join('\n')
        : `- ${requestRecord.serviceTitle}`;

    // 1. Customer Confirmation Email
    const customerSubject = `Ophireum Solution Request Received [${requestRecord.referenceCode}]`;
    const customerText = [
      `Dear ${requestRecord.fullName},`,
      '',
      `We have received your custom solution request under ${requestRecord.company} with reference ${requestRecord.referenceCode}.`,
      '',
      'Selected Services & Options:',
      servicesText,
      '',
      `Preliminary Starting Estimate: $${requestRecord.estimatedOneTimeStartingUsd.toLocaleString('en-US')} USD${
        requestRecord.estimatedMonthlyStartingUsd > 0
          ? ` + $${requestRecord.estimatedMonthlyStartingUsd.toLocaleString('en-US')}/month`
          : ''
      }`,
      `Target Timeline: ${requestRecord.targetTimeline || 'To be confirmed'}`,
      '',
      'Important Notice: All figures represent preliminary starting estimates only and do not constitute a binding quotation or contract until finalized by our engineering and executive team.',
      '',
      `Direct Executive Contact: ${COMPANY_CONFIG.founderCeo} · ${COMPANY_CONFIG.mobile}`,
      `Office: ${COMPANY_CONFIG.address.fullFormatted}`,
    ].join('\n');

    const customerHtml = `
      <div style="font-family:Inter,Arial,sans-serif;background:#0B1220;color:#E2E8F0;padding:24px;border-radius:12px;">
        ${renderOfficialEmailHeader('Official Solution Request Confirmation')}
        <p>Dear ${safeName},</p>
        <p>Your preliminary project summary has been registered with reference <strong>${escapeHtml(requestRecord.referenceCode)}</strong>.</p>
        <h4 style="color:#fff;">Selected Services</h4>
        <ul>${serviceRowsHtml}</ul>
        <p><strong>Preliminary Starting Investment:</strong> $${requestRecord.estimatedOneTimeStartingUsd.toLocaleString('en-US')} USD${
          requestRecord.estimatedMonthlyStartingUsd > 0
            ? ` + $${requestRecord.estimatedMonthlyStartingUsd.toLocaleString('en-US')}/month`
            : ''
        }</p>
        <p><strong>Target Timeline:</strong> ${safeTimeline}</p>
        <p style="font-size:12px;color:#94A3B8;border-top:1px solid #1E293B;padding-top:12px;">
          Note: All displayed figures represent preliminary starting estimates only and require formal engineering scoping before binding quotation.<br/>
          Questions? Contact ${escapeHtml(COMPANY_CONFIG.founderCeo)} at ${escapeHtml(COMPANY_CONFIG.mobile)}.
        </p>
      </div>
    `;

    const customerOutbox = await this.db.createOutboxRecord({
      dedupeKey: `sol-cust-${requestRecord.referenceCode}`,
      entityType: 'solution_request',
      entityReference: requestRecord.referenceCode,
      recipientEmail: requestRecord.email,
      notificationType: 'customer_confirmation',
      subject: customerSubject,
      htmlBody: customerHtml,
      textBody: customerText,
    });

    const customerStatus =
      customerOutbox.record.status === 'sent'
        ? 'sent'
        : await this.dispatchOutboxItem(customerOutbox.record, correlationId);

    // 2. Admin Notification Email
    const adminSubject = `[New Solution Request] ${requestRecord.referenceCode} — ${requestRecord.company}`;
    const adminText = [
      `Reference Code: ${requestRecord.referenceCode}`,
      `Submitted: ${requestRecord.createdAt}`,
      `Client: ${requestRecord.fullName} (${requestRecord.email} | ${requestRecord.contactNumber})`,
      `Organization: ${requestRecord.company}`,
      `Target Timeline: ${requestRecord.targetTimeline || 'Not specified'}`,
      `Preliminary Starting Estimate: $${requestRecord.estimatedOneTimeStartingUsd.toLocaleString('en-US')} USD (+ $${requestRecord.estimatedMonthlyStartingUsd.toLocaleString('en-US')}/mo)`,
      '',
      'Selected Services:',
      servicesText,
      '',
      'Project Notes:',
      requestRecord.projectDescription,
    ].join('\n');

    const adminHtml = `
      <div style="font-family:Inter,Arial,sans-serif;background:#0F172A;color:#E2E8F0;padding:24px;border-radius:12px;">
        ${renderOfficialEmailHeader(`New Client Solution Request: ${requestRecord.referenceCode}`)}
        <p><strong>Name:</strong> ${safeName}<br/>
        <strong>Email:</strong> ${safeEmail}<br/>
        <strong>Phone:</strong> ${safePhone}<br/>
        <strong>Organization:</strong> ${safeOrg}<br/>
        <strong>Timeline:</strong> ${safeTimeline}<br/>
        <strong>Submitted:</strong> ${escapeHtml(requestRecord.createdAt)}</p>
        <h4>Selected Services</h4>
        <ul>${serviceRowsHtml}</ul>
        <p><strong>Preliminary Server Estimate:</strong> $${requestRecord.estimatedOneTimeStartingUsd.toLocaleString('en-US')} USD${
          requestRecord.estimatedMonthlyStartingUsd > 0
            ? ` + $${requestRecord.estimatedMonthlyStartingUsd.toLocaleString('en-US')}/mo`
            : ''
        }</p>
        <h4>Requirements Notes</h4>
        <p style="white-space:pre-line;background:#1E293B;padding:12px;border-radius:8px;">${safeNotes}</p>
      </div>
    `;

    const adminOutbox = await this.db.createOutboxRecord({
      dedupeKey: `sol-adm-${requestRecord.referenceCode}`,
      entityType: 'solution_request',
      entityReference: requestRecord.referenceCode,
      recipientEmail: this.adminInbox,
      notificationType: 'admin_alert',
      subject: adminSubject,
      htmlBody: adminHtml,
      textBody: adminText,
    });

    const adminStatus =
      adminOutbox.record.status === 'sent'
        ? 'sent'
        : await this.dispatchOutboxItem(adminOutbox.record, correlationId);

    const overallStatus: 'sent' | 'failed' | 'unconfigured' =
      customerStatus === 'sent' && adminStatus === 'sent'
        ? 'sent'
        : customerStatus === 'unconfigured' || adminStatus === 'unconfigured'
        ? 'unconfigured'
        : 'failed';

    await this.db.updateSolutionRequestEmailStatus(requestRecord.referenceCode, overallStatus);

    return { customerStatus, adminStatus, overallStatus };
  }

  public async enqueueAndSendAppointmentEmails(
    appointment: AppointmentRecord,
    correlationId?: string
  ): Promise<{
    customerStatus: EmailOutboxRecord['status'];
    adminStatus: EmailOutboxRecord['status'];
  }> {
    const isConfirmedCalendar = appointment.status === 'confirmed';
    const statusLabel = isConfirmedCalendar
      ? 'Calendar Appointment Confirmed'
      : 'Pending Scheduling Request';

    const subject = `Ophireum Consultation (${statusLabel}) [${appointment.referenceCode}]`;
    const htmlBody = `
      <div style="font-family:Inter,Arial,sans-serif;background:#0B1220;color:#E2E8F0;padding:24px;border-radius:12px;">
        ${renderOfficialEmailHeader(statusLabel)}
        <p>Reference Code: <strong>${escapeHtml(appointment.referenceCode)}</strong></p>
        <p>Client: ${escapeHtml(appointment.fullName)} (${escapeHtml(appointment.companyName)})<br/>
        Date: ${escapeHtml(appointment.scheduledDate)}<br/>
        Time Slot: ${escapeHtml(appointment.scheduledTimeSlot)} (${escapeHtml(appointment.clientTimezone)})<br/>
        Channel: ${escapeHtml(appointment.consultationType)}</p>
        ${
          appointment.meetingLink
            ? `<p>Meeting Link: <a href="${escapeHtml(appointment.meetingLink)}">${escapeHtml(appointment.meetingLink)}</a></p>`
            : `<p>A coordinator will confirm calendar invitation details with you shortly.</p>`
        }
      </div>
    `;
    const textBody = [
      `${statusLabel}: ${appointment.referenceCode}`,
      `Client: ${appointment.fullName} (${appointment.companyName})`,
      `Date: ${appointment.scheduledDate} | Slot: ${appointment.scheduledTimeSlot} (${appointment.clientTimezone})`,
      `Channel: ${appointment.consultationType}`,
      appointment.meetingLink ? `Meeting Link: ${appointment.meetingLink}` : 'Meeting link / final confirmation will be issued upon calendar review.',
    ].join('\n');

    const custOutbox = await this.db.createOutboxRecord({
      dedupeKey: `apt-cust-${appointment.referenceCode}`,
      entityType: 'appointment',
      entityReference: appointment.referenceCode,
      recipientEmail: appointment.email,
      notificationType: 'appointment_request',
      subject,
      htmlBody,
      textBody,
    });
    const customerStatus =
      custOutbox.record.status === 'sent'
        ? 'sent'
        : await this.dispatchOutboxItem(custOutbox.record, correlationId);

    const admOutbox = await this.db.createOutboxRecord({
      dedupeKey: `apt-adm-${appointment.referenceCode}`,
      entityType: 'appointment',
      entityReference: appointment.referenceCode,
      recipientEmail: this.adminInbox,
      notificationType: 'admin_alert',
      subject: `[Consultation Request] ${appointment.referenceCode} — ${appointment.scheduledDate} ${appointment.scheduledTimeSlot}`,
      htmlBody,
      textBody,
    });
    const adminStatus =
      admOutbox.record.status === 'sent'
        ? 'sent'
        : await this.dispatchOutboxItem(admOutbox.record, correlationId);

    return { customerStatus, adminStatus };
  }

  public async processRetryQueue(limit = 20): Promise<number> {
    const items = await this.db.listRetryableOutbox(limit);
    let processed = 0;
    for (const item of items) {
      await this.dispatchOutboxItem(item);
      processed += 1;
    }
    return processed;
  }
}
