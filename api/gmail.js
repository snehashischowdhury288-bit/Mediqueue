/**
 * MediQueue - Direct Gmail Email Dispatch Serverless Function (Vercel)
 * Sends physical emails straight into real Gmail inboxes via Nodemailer.
 */
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const {
      to,
      patientName = 'Patient',
      subject = 'MediQueue Urgent: You are the NEXT patient in line',
      text,
      html,
      gmailUser = process.env.GMAIL_USER,
      gmailPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD
    } = req.body || {};

    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid recipient email required' });
    }

    if (!gmailUser || !gmailPass) {
      return res.status(400).json({
        success: false,
        message: 'Gmail User or Google App Password missing. Configure in Email Settings or set GMAIL_USER / GMAIL_PASS environment variables.'
      });
    }

    console.log(`[Gmail Serverless] Sending real physical email to ${to} via ${gmailUser}...`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser.trim(),
        pass: gmailPass.replace(/\s+/g, '') // remove spaces from 16-character Google App Password
      }
    });

    const info = await transporter.sendMail({
      from: `"MediQueue Clinical System" <${gmailUser.trim()}>`,
      to,
      subject,
      text,
      html
    });

    console.log('[Gmail Serverless] Delivered successfully:', info.messageId);
    return res.status(200).json({
      success: true,
      mode: 'gmail_direct',
      message: `Real alert email delivered to ${to} via Gmail`,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('[Gmail Serverless Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to dispatch email via Gmail'
    });
  }
}
