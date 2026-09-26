/**
 * MediQueue Automated Email Service - Mailtrap Integration
 * Background HTTP dispatch with zero client redirects (no mailto, no Gmail popups).
 *
 * Primary Provider: Mailtrap (mailtrap.io)
 * Endpoint: /api/mailtrap (Serverless & Node Express Gateway on port 5000)
 */

import { db, collection, addDoc, serverTimestamp } from '../firebase';

export const DEFAULT_MAILTRAP_TOKEN = 'e0003d35e29d71e96224530855a6c244';
export const DEFAULT_MAILTRAP_SENDER = 'mailtrap@demomailtrap.com';

export const EMAIL_PROVIDERS = {
  MAILTRAP: 'mailtrap',
  EMAILJS: 'emailjs',
  RESEND: 'resend'
};

// Retrieve email configuration from LocalStorage
export function getEmailConfig() {
  return {
    provider: localStorage.getItem('mq_email_provider') || EMAIL_PROVIDERS.MAILTRAP,
    mailtrapToken: localStorage.getItem('mq_mailtrap_token') || DEFAULT_MAILTRAP_TOKEN,
    mailtrapSender: localStorage.getItem('mq_mailtrap_sender') || DEFAULT_MAILTRAP_SENDER,
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
          <p style="margin: 6px 0 0; font-size: 13.5px; opacity: 0.9;">Powered by Mailtrap Dispatcher</p>
        </div>
        <div style="padding: 28px 24px; color: #1E293B; line-height: 1.6;">
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #92400E; font-size: 15px;">📢 Immediate Attendance Required</strong>
            <p style="margin: 4px 0 0; color: #78350F; font-size: 13.5px;">You are directly NEXT in line for your consultation.</p>
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
            Automated notification dispatched via Mailtrap for MediQueue Hospital System.
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
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Dispatched via Mailtrap</p>
      </div>
      <div style="padding: 24px; color: #1E293B; line-height: 1.6;">
        <p>Dear <strong>${patName}</strong>,</p>
        <p>Dr. <strong>${docName}</strong> has completed the previous consultation. You are now <strong>3 turns away</strong> in the queue (Slot #${slot}).</p>
        <p>Please arrive at the waiting area outside <strong>${room}</strong> immediately and prepare your digital token.</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94A3B8; text-align: center;">MediQueue Automated Clinical Dispatch • Mailtrap Delivery</p>
      </div>
    </div>
  `;
  return { subject, plainText, html };
}

/**
 * Dispatches automated preset email via Mailtrap (with zero client redirects).
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

  // 1. Also queue into Firestore 'mail' collection (for logging/Firebase extensions)
  try {
    const mailCol = collection(db, 'mail');
    await addDoc(mailCol, {
      to: patientEmail,
      message: {
        subject,
        text: plainText,
        html
      },
      provider: 'mailtrap',
      createdAt: serverTimestamp()
    });
  } catch (firestoreErr) {
    console.warn('[EmailService] Firestore queue note:', firestoreErr.message);
  }

  // 2. Primary Dispatch Channel: Mailtrap (via serverless API or Node Express gateway)
  const token = config.mailtrapToken || DEFAULT_MAILTRAP_TOKEN;
  const sender = config.mailtrapSender || DEFAULT_MAILTRAP_SENDER;

  const mailtrapPayload = {
    to: patientEmail,
    patientName: patientName || 'Patient',
    subject,
    text: plainText,
    html,
    token,
    sender
  };

  // Try endpoints in sequence:
  // 1) Relative '/api/mailtrap' (proxied by Vite to port 5000 locally or Vercel serverless in production)
  // 2) Direct 'http://localhost:5000/api/mailtrap/send'
  // 3) Direct Mailtrap API sandbox fallback
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
        return {
          success: true,
          provider: 'Mailtrap',
          message: `Readiness alert sent to ${patientEmail} via Mailtrap`,
          recipient: patientEmail,
          data: resData
        };
      }
    } catch (endpointErr) {
      console.warn(`[EmailService] Failed calling ${endpoint}:`, endpointErr.message);
    }
  }

  // Fallback: If local backend and serverless are both unreachable, call Mailtrap Sandbox API directly
  try {
    console.log('[EmailService] Calling direct Mailtrap Sandbox API fallback...');
    const sandboxRes = await fetch('https://sandbox.api.mailtrap.io/api/send/4929850', {
      method: 'POST',
      headers: {
        'Api-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: sender, name: 'MediQueue Hospital System' },
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
        message: `Readiness alert sent to ${patientEmail} via Mailtrap`,
        recipient: patientEmail,
        data: sandboxData
      };
    }
  } catch (directErr) {
    console.warn('[EmailService] Direct sandbox attempt failed (likely CORS):', directErr.message);
  }

  return {
    success: false,
    provider: 'Mailtrap',
    message: 'Could not connect to Mailtrap email gateway. Please ensure backend service is running.'
  };
}
