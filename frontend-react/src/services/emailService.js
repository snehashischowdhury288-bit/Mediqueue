/**
 * MediQueue Automated Email Service - Mailtrap & Gmail Integration
 * Background HTTP dispatch with zero client redirects (no mailto, no Gmail popups).
 *
 * Supported Channels:
 * 1. Mailtrap (mailtrap.io - Sandbox & Sending API)
 * 2. Gmail SMTP Direct (Delivers physical emails into real Gmail inboxes via Nodemailer)
 */

import { db, collection, addDoc, serverTimestamp } from '../firebase';

export const DEFAULT_MAILTRAP_TOKEN = 'e0003d35e29d71e96224530855a6c244';
export const DEFAULT_MAILTRAP_SENDER = 'mailtrap@demomailtrap.com';

export const EMAIL_PROVIDERS = {
  MAILTRAP: 'mailtrap',
  GMAIL: 'gmail',
  EMAILJS: 'emailjs',
  RESEND: 'resend'
};

export const DEFAULT_GMAIL_USER = 'deyprayas3@gmail.com';

// Retrieve email configuration from LocalStorage
export function getEmailConfig() {
  return {
    provider: localStorage.getItem('mq_email_provider') || EMAIL_PROVIDERS.GMAIL,
    mailtrapToken: localStorage.getItem('mq_mailtrap_token') || DEFAULT_MAILTRAP_TOKEN,
    mailtrapSender: localStorage.getItem('mq_mailtrap_sender') || DEFAULT_MAILTRAP_SENDER,
    gmailUser: localStorage.getItem('mq_gmail_user') || DEFAULT_GMAIL_USER,
    gmailPass: localStorage.getItem('mq_gmail_pass') || '',
    emailjsServiceId: localStorage.getItem('mq_emailjs_service_id') || '',
    emailjsTemplateId: localStorage.getItem('mq_emailjs_template_id') || '',
    emailjsPublicKey: localStorage.getItem('mq_emailjs_public_key') || '',
    resendApiKey: localStorage.getItem('mq_resend_api_key') || ''
  };
}

// Save email configuration to LocalStorage
export function saveEmailConfig(config) {
  if (config.provider) localStorage.setItem('mq_email_provider', config.provider);
  if (config.mailtrapToken !== undefined) localStorage.setItem('mq_mailtrap_token', config.mailtrapToken.trim());
  if (config.mailtrapSender !== undefined) localStorage.setItem('mq_mailtrap_sender', config.mailtrapSender.trim());
  if (config.gmailUser !== undefined) localStorage.setItem('mq_gmail_user', config.gmailUser.trim());
  if (config.gmailPass !== undefined) localStorage.setItem('mq_gmail_pass', config.gmailPass.trim());
  if (config.emailjsServiceId !== undefined) localStorage.setItem('mq_emailjs_service_id', config.emailjsServiceId.trim());
  if (config.emailjsTemplateId !== undefined) localStorage.setItem('mq_emailjs_template_id', config.emailjsTemplateId.trim());
  if (config.emailjsPublicKey !== undefined) localStorage.setItem('mq_emailjs_public_key', config.emailjsPublicKey.trim());
  if (config.resendApiKey !== undefined) localStorage.setItem('mq_resend_api_key', config.resendApiKey.trim());
}

/**
 * Generates automated preset content for hospital queue notifications
 */
export function generatePresetContent({ alertType, patientName, patientEmail, slotNumber, doctorName, roomNumber }) {
  const docName = doctorName || 'your Attending Physician';
  const patName = patientName || 'Patient';
  const slot = slotNumber || 2;
  const room = roomNumber || 'Consultation Suite';

  if (alertType === 'next_patient') {
    const subject = 'MediQueue Urgent: You are the NEXT patient in line';
    const plainText = `Hello ${patName}, Dr. ${docName} is currently consulting the active patient. You are assigned to Slot #${slot} and are directly up next. Please wait immediately outside the consultation door with your digital token ready.`;
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%); padding: 24px; color: #ffffff; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">MediQueue Clinical Queue Alert</h1>
          <p style="margin: 6px 0 0; font-size: 13.5px; opacity: 0.9;">Urgent Consultation Readiness Notice</p>
        </div>
        <div style="padding: 28px 24px; color: #1E293B; line-height: 1.6;">
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #92400E; font-size: 15px;">📢 Immediate Attendance Required</strong>
            <p style="margin: 4px 0 0; color: #78350F; font-size: 13.5px;">You are directly NEXT in line for examination.</p>
          </div>
          <p style="font-size: 15px; margin: 0 0 16px;">Dear <strong>${patName}</strong>,</p>
          <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">
            Dr. <strong>${docName}</strong> is currently consulting the active patient. You are assigned to <strong>Slot #${slot}</strong> and are directly up next.
          </p>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748B; font-size: 13px;">Assigned Slot:</span>
              <strong style="color: #0284C7; font-size: 14px;">Slot #${slot}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748B; font-size: 13px;">Consulting Doctor:</span>
              <strong style="color: #1E293B; font-size: 14px;">Dr. ${docName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B; font-size: 13px;">Location:</span>
              <strong style="color: #1E293B; font-size: 14px;">${room}</strong>
            </div>
          </div>
          <p style="font-size: 14px; color: #334155; margin: 0 0 24px;">
            👉 <strong>Action Required:</strong> Please wait immediately outside the consultation door with your digital token ready.
          </p>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 18px; text-align: center; color: #94A3B8; font-size: 12px;">
            Automated notification dispatched for MediQueue Hospital System.
          </div>
        </div>
      </div>
    `;
    return { subject, plainText, html };
  }

  // 3-turns-away notification
  const subject = 'MediQueue Urgent Update: You are 3 turns away from your consultation';
  const plainText = `Hello ${patName}, Dr. ${docName} has completed the previous consultation. You are now 3 turns away in the queue. Please arrive at the waiting area outside the clinic room immediately and prepare your digital token.`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #E2E8F0;">
      <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 22px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">MediQueue Queue Progress Update</h1>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Consultation Alert</p>
      </div>
      <div style="padding: 24px; color: #1E293B; line-height: 1.6;">
        <p>Dear <strong>${patName}</strong>,</p>
        <p>Dr. <strong>${docName}</strong> has completed the previous consultation. You are now <strong>3 turns away</strong> in the queue (Slot #${slot}).</p>
        <p>Please arrive at the waiting area outside <strong>${room}</strong> immediately and prepare your digital token.</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94A3B8; text-align: center;">MediQueue Automated Clinical Dispatch</p>
      </div>
    </div>
  `;
  return { subject, plainText, html };
}

/**
 * Dispatches automated preset email (with zero client redirects).
 */
export async function sendAutomatedPresetEmail({
  alertType = 'next_patient',
  patientName,
  patientEmail,
  slotNumber,
  doctorName,
  doctorEmail,
  roomNumber
}) {
  if (!patientEmail || !patientEmail.includes('@')) {
    return {
      success: false,
      message: 'Invalid or missing patient email address'
    };
  }

  const { subject, plainText, html } = generatePresetContent({
    alertType,
    patientName,
    patientEmail,
    slotNumber,
    doctorName,
    roomNumber
  });

  const config = getEmailConfig();

  // 1. Queue into Firestore 'mail' collection
  try {
    const mailCol = collection(db, 'mail');
    await addDoc(mailCol, {
      to: patientEmail,
      message: { subject, text: plainText, html },
      provider: config.provider,
      createdAt: serverTimestamp()
    });
  } catch (firestoreErr) {
    console.warn('[EmailService] Firestore queue note:', firestoreErr.message);
  }

  // 2. Direct Gmail SMTP Dispatch (Real physical emails to Gmail app)
  if (config.provider === EMAIL_PROVIDERS.GMAIL) {
    if (!config.gmailUser || !config.gmailPass) {
      return {
        success: false,
        provider: 'Gmail',
        message: 'Gmail credentials not configured. Please open ⚙️ Email Settings, select "Direct Gmail (Nodemailer)", and enter your Gmail address & 16-character Google App Password.'
      };
    }

    const gmailEndpoints = [
      '/api/gmail',
      '/api/gmail/send',
      'http://localhost:5000/api/gmail/send',
      'https://mediqueue-beryl.vercel.app/api/gmail'
    ];

    for (const endpoint of gmailEndpoints) {
      try {
        console.log(`[EmailService] Dispatching directly to Gmail via ${endpoint}...`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: patientEmail,
            patientName: patientName || 'Patient',
            subject,
            text: plainText,
            html,
            gmailUser: config.gmailUser,
            gmailPass: config.gmailPass
          })
        });

        if (response.ok) {
          const resData = await response.json();
          return {
            success: true,
            provider: 'Gmail',
            message: `Real alert email delivered to ${patientEmail} via Gmail`,
            recipient: patientEmail,
            data: resData
          };
        } else {
          const errData = await response.json().catch(() => null);
          console.warn(`[EmailService] Gmail endpoint ${endpoint} error:`, errData);
          if (errData?.message) {
            return {
              success: false,
              provider: 'Gmail',
              message: `Gmail error: ${errData.message}`
            };
          }
        }
      } catch (err) {
        console.warn(`[EmailService] Failed calling Gmail endpoint ${endpoint}:`, err.message);
      }
    }

    return {
      success: false,
      provider: 'Gmail',
      message: 'Unable to reach Gmail email gateway. Please verify your internet connection or Google App Password in ⚙️ Settings.'
    };
  }

  // 3. Mailtrap Dispatch
  const token = config.mailtrapToken || DEFAULT_MAILTRAP_TOKEN;
  const sender = patientEmail;

  const mailtrapPayload = {
    to: patientEmail,
    patientName: patientName || 'Patient',
    subject,
    text: plainText,
    html,
    token,
    sender: patientEmail
  };

  const candidateEndpoints = [
    '/api/mailtrap',
    'http://localhost:5000/api/mailtrap/send',
    'https://mediqueue-beryl.vercel.app/api/mailtrap'
  ];

  for (const endpoint of candidateEndpoints) {
    try {
      console.log(`[EmailService] Attempting Mailtrap dispatch via ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(mailtrapPayload)
      });

      if (response.ok) {
        const resData = await response.json().catch(() => null);
        console.log('[EmailService] Mailtrap dispatch successful:', resData);
        const isSandbox = resData?.mode === 'sandbox' || resData?.inboxId;
        return {
          success: true,
          provider: 'Mailtrap',
          message: isSandbox
            ? `Captured in Mailtrap Sandbox (Inbox #4929850). To receive physical emails in your Gmail app, select Direct Gmail (Nodemailer) in ⚙️ Settings or enable Mailtrap Auto-Forwarding.`
            : `Readiness alert sent to ${patientEmail} via Mailtrap`,
          recipient: patientEmail,
          data: resData
        };
      }
    } catch (endpointErr) {
      console.warn(`[EmailService] Failed calling ${endpoint}:`, endpointErr.message);
    }
  }

  // Direct Mailtrap Sandbox API fallback
  try {
    const sandboxRes = await fetch('https://sandbox.api.mailtrap.io/api/send/4929850', {
      method: 'POST',
      headers: {
        'Api-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: patientEmail, name: patientName ? `Patient ${patientName}` : 'Patient in Line' },
        to: [{ email: patientEmail, name: patientName || 'Patient' }],
        subject,
        text: plainText,
        html,
        category: 'Queue Readiness Alert'
      })
    });

    const sandboxData = await sandboxRes.json().catch(() => null);
    if (sandboxRes.ok && sandboxData?.success !== false) {
      return {
        success: true,
        provider: 'Mailtrap',
        message: `Captured in Mailtrap Sandbox (Inbox #4929850). To receive physical emails in your Gmail app, select Direct Gmail (Nodemailer) in ⚙️ Settings or enable Mailtrap Auto-Forwarding.`,
        recipient: patientEmail,
        data: sandboxData
      };
    }
  } catch (directErr) {
    console.warn('[EmailService] Direct sandbox attempt note:', directErr.message);
  }

  return {
    success: false,
    provider: config.provider === EMAIL_PROVIDERS.GMAIL ? 'Gmail' : 'Mailtrap',
    message: 'Could not connect to email gateway. Please check your credentials in ⚙️ Settings.'
  };
}
