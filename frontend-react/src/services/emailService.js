/**
 * MediQueue Automated Email Service
 * Background HTTP dispatch with zero client redirects (no mailto, no Gmail popups).
 *
 * Supported Dispatch Channels:
 * 1. EmailJS (Direct client-side delivery to arbitrary patient inboxes)
 * 2. Web3Forms (Using configured access key)
 * 3. Resend API (Direct transactional delivery)
 * 4. Firestore 'mail' collection (Firebase Trigger Email extension fallback)
 */

import { db, collection, addDoc, serverTimestamp } from '../firebase';

const DEFAULT_WEB3FORMS_KEY = '7cbd2b0b-6fba-43be-993c-471ab95e28a4';

export const EMAIL_PROVIDERS = {
  EMAILJS: 'emailjs',
  WEB3FORMS: 'web3forms',
  RESEND: 'resend'
};

// Retrieve email configuration from LocalStorage
export function getEmailConfig() {
  return {
    provider: localStorage.getItem('mq_email_provider') || EMAIL_PROVIDERS.WEB3FORMS,
    web3formsKey: localStorage.getItem('mq_web3forms_key') || DEFAULT_WEB3FORMS_KEY,
    emailjsServiceId: localStorage.getItem('mq_emailjs_service_id') || '',
    emailjsTemplateId: localStorage.getItem('mq_emailjs_template_id') || '',
    emailjsPublicKey: localStorage.getItem('mq_emailjs_public_key') || '',
    resendApiKey: localStorage.getItem('mq_resend_api_key') || ''
  };
}

// Save email configuration to LocalStorage
export function saveEmailConfig(config) {
  if (config.provider) localStorage.setItem('mq_email_provider', config.provider);
  if (config.web3formsKey !== undefined) localStorage.setItem('mq_web3forms_key', config.web3formsKey.trim());
  if (config.emailjsServiceId !== undefined) localStorage.setItem('mq_emailjs_service_id', config.emailjsServiceId.trim());
  if (config.emailjsTemplateId !== undefined) localStorage.setItem('mq_emailjs_template_id', config.emailjsTemplateId.trim());
  if (config.emailjsPublicKey !== undefined) localStorage.setItem('mq_emailjs_public_key', config.emailjsPublicKey.trim());
  if (config.resendApiKey !== undefined) localStorage.setItem('mq_resend_api_key', config.resendApiKey.trim());
}

/**
 * Generates automated preset content for hospital queue notifications
 */
export function generatePresetContent({ alertType, patientName, patientEmail, slotNumber, doctorName, roomNumber }) {
  const docName = doctorName || 'Attending Physician';
  const patName = patientName || 'Patient';
  const slot = slotNumber || 2;
  const room = roomNumber || 'Consultation Suite';

  if (alertType === 'next_patient') {
    const subject = `🚨 MediQueue Urgent Alert: You are NEXT in line for Dr. ${docName} (Slot #${slot})`;
    const plainText = `Hello ${patName},\n\nDr. ${docName} has begun consultation with the current patient. You are assigned to Slot #${slot} and are directly NEXT in line.\n\nPlease proceed immediately to the consultation door outside ${room} and keep your digital token ready.\n\nThank you,\nMediQueue Hospital Management System`;
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%); padding: 24px; color: #ffffff; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">MediQueue Emergency Summons</h1>
          <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Real-Time Clinical Queue Dispatch</p>
        </div>
        <div style="padding: 28px 24px; color: #1E293B; line-height: 1.6;">
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;">
            <strong style="color: #92400E; font-size: 15px;">📢 Immediate Attendance Required</strong>
            <p style="margin: 4px 0 0; color: #78350F; font-size: 13.5px;">You are directly NEXT in line for examination.</p>
          </div>
          <p style="font-size: 15px; margin: 0 0 16px;">Dear <strong>${patName}</strong>,</p>
          <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">
            Dr. <strong>${docName}</strong> has commenced examination of the current patient. Your priority slot is active.
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
            👉 <strong>Action Required:</strong> Please proceed immediately to the consultation door outside <strong>${room}</strong> and have your digital token ready on your mobile device.
          </p>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 18px; text-align: center; color: #94A3B8; font-size: 12px;">
            Automated notification dispatched by MediQueue Hospital Cloud System. Do not reply to this email.
          </div>
        </div>
      </div>
    `;
    return { subject, plainText, html };
  }

  // 3-turns-away notification
  const subject = `🔔 MediQueue Queue Update: You are 3 turns away from Dr. ${docName}`;
  const plainText = `Hello ${patName},\n\nDr. ${docName} has completed the previous consultation. You are now 3 turns away in the queue (Slot #${slot}).\n\nPlease arrive at the waiting area outside ${room} soon and prepare your digital token.\n\nThank you,\nMediQueue Hospital Management System`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
      <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 22px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">MediQueue Queue Progress Update</h1>
      </div>
      <div style="padding: 24px; color: #1E293B;">
        <p>Dear <strong>${patName}</strong>,</p>
        <p>You are now <strong>3 turns away</strong> from your consultation with Dr. <strong>${docName}</strong> (Assigned Slot: #${slot}).</p>
        <p>Please make your way toward <strong>${room}</strong> waiting area and verify your digital token status.</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94A3B8;">MediQueue Automated Clinical Dispatch</p>
      </div>
    </div>
  `;
  return { subject, plainText, html };
}

/**
 * Dispatches automated preset email in the background without user redirect.
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
  let dispatchResult = { success: false, provider: config.provider, message: '' };

  // 1. Also queue into Firestore 'mail' collection (triggers Firebase Trigger Email extension if present)
  try {
    const mailCol = collection(db, 'mail');
    await addDoc(mailCol, {
      to: patientEmail,
      message: {
        subject,
        text: plainText,
        html
      },
      createdAt: serverTimestamp()
    });
  } catch (firestoreErr) {
    // Non-fatal if extension or collection rules not configured
    console.warn('[EmailService] Firestore mail queue notice:', firestoreErr.message);
  }

  // 2. Dispatch via EmailJS if configured
  if (config.provider === EMAIL_PROVIDERS.EMAILJS && config.emailjsServiceId && config.emailjsTemplateId && config.emailjsPublicKey) {
    try {
      console.log(`[EmailService] Dispatching via EmailJS to ${patientEmail}...`);
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: config.emailjsServiceId,
          template_id: config.emailjsTemplateId,
          user_id: config.emailjsPublicKey,
          template_params: {
            to_email: patientEmail,
            email: patientEmail,
            patient_name: patientName || 'Patient',
            doctor_name: doctorName || 'Doctor',
            slot_number: slotNumber || 2,
            room_number: roomNumber || 'Consultation Suite',
            subject,
            message: plainText
          }
        })
      });

      if (response.ok) {
        return {
          success: true,
          provider: 'EmailJS',
          message: `Direct alert email delivered to ${patientEmail} via EmailJS`,
          recipient: patientEmail
        };
      } else {
        const errorText = await response.text();
        console.warn('[EmailService] EmailJS returned error:', errorText);
      }
    } catch (emailjsErr) {
      console.warn('[EmailService] EmailJS dispatch failed:', emailjsErr.message);
    }
  }

  // 3. Dispatch via Resend API if key is available
  if (config.provider === EMAIL_PROVIDERS.RESEND && config.resendApiKey) {
    try {
      console.log(`[EmailService] Dispatching via Resend to ${patientEmail}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'MediQueue Hospital <onboarding@resend.dev>',
          to: [patientEmail],
          subject,
          html,
          text: plainText
        })
      });

      const resData = await response.json().catch(() => null);
      if (response.ok && resData?.id) {
        return {
          success: true,
          provider: 'Resend',
          message: `Direct alert email delivered to ${patientEmail} via Resend API`,
          recipient: patientEmail
        };
      }
    } catch (resendErr) {
      console.warn('[EmailService] Resend dispatch failed:', resendErr.message);
    }
  }

  // 4. Default / Fallback: Web3Forms asynchronous HTTP POST
  const web3Key = config.web3formsKey || DEFAULT_WEB3FORMS_KEY;
  try {
    console.log(`[EmailService] Dispatching via Web3Forms (Key: ${web3Key.slice(0, 8)}...) to ${patientEmail}...`);
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        access_key: web3Key,
        to_email: patientEmail,
        email: patientEmail,
        name: patientName || 'Patient',
        from_name: 'MediQueue Hospital Dispatcher',
        subject,
        message: plainText,
        replyto: doctorEmail || 'notifications@mediqueue.clinic'
      })
    });

    const resData = await response.json().catch(() => null);
    console.log('[EmailService] Web3Forms response:', resData);

    if (response.ok && resData?.success !== false) {
      return {
        success: true,
        provider: 'Web3Forms',
        message: `Alert dispatched via Web3Forms API to ${patientEmail}`,
        recipient: patientEmail,
        isWeb3FormsNotice: true
      };
    } else {
      return {
        success: false,
        provider: 'Web3Forms',
        message: resData?.message || 'Web3Forms service rejected request'
      };
    }
  } catch (web3Err) {
    console.error('[EmailService] Web3Forms network error:', web3Err);
    return {
      success: false,
      provider: 'Web3Forms',
      message: `Network error: ${web3Err.message}`
    };
  }
}
