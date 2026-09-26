/**
 * MediQueue - Mailtrap Email Dispatch Serverless Function (Vercel)
 * Direct Mailtrap integration with sandbox/production fallback.
 */

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
      patientName,
      subject,
      text,
      html,
      token = process.env.MAILTRAP_TOKEN || 'e0003d35e29d71e96224530855a6c244',
      sender
    } = req.body || {};

    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid recipient email required' });
    }

    if (!token) {
      return res.status(400).json({ success: false, message: 'Mailtrap API token required' });
    }

    // Set sender to the next patient's actual real email address (no fake demomailtrap.com mock data)
    const effectiveSender = (sender && !sender.includes('demomailtrap.com')) ? sender : to;
    const effectiveSenderName = patientName ? `Patient ${patientName}` : 'Patient in Line';

    // 1. Try Mailtrap Production Sending API
    try {
      const prodRes = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: { email: effectiveSender, name: effectiveSenderName },
          to: [{ email: to, name: patientName || 'Patient' }],
          subject,
          text,
          html,
          category: 'Queue Readiness Alert'
        })
      });

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        return res.status(200).json({
          success: true,
          mode: 'production',
          message: `Readiness alert sent to ${to} via Mailtrap`,
          data: prodData
        });
      }
    } catch (prodErr) {
      console.warn('[Mailtrap] Production endpoint bypass:', prodErr.message);
    }

    // 2. Discover Mailtrap Sandbox Inbox
    let inboxId = 4929850;
    try {
      const inboxesRes = await fetch('https://mailtrap.io/api/inboxes', {
        headers: { 'Api-Token': token }
      });
      if (inboxesRes.ok) {
        const inboxes = await inboxesRes.json();
        if (inboxes && inboxes.length > 0 && inboxes[0].id) {
          inboxId = inboxes[0].id;
        }
      }
    } catch (inboxErr) {
      console.warn('[Mailtrap] Inbox discovery notice:', inboxErr.message);
    }

    // 3. Dispatch through Mailtrap Sandbox API
    const sandboxRes = await fetch(`https://sandbox.api.mailtrap.io/api/send/${inboxId}`, {
      method: 'POST',
      headers: {
        'Api-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: effectiveSender, name: effectiveSenderName },
        to: [{ email: to, name: patientName || 'Patient' }],
        subject,
        text,
        html,
        category: 'Queue Readiness Alert'
      })
    });

    const sandboxData = await sandboxRes.json().catch(() => null);

    if (sandboxRes.ok && sandboxData?.success !== false) {
      return res.status(200).json({
        success: true,
        mode: 'sandbox',
        inboxId,
        message: `Readiness alert sent to ${to} via Mailtrap`,
        data: sandboxData
      });
    } else {
      const errorMsg = sandboxData?.errors ? JSON.stringify(sandboxData.errors) : (sandboxData?.message || 'Mailtrap dispatch failed');
      return res.status(502).json({
        success: false,
        message: errorMsg
      });
    }
  } catch (error) {
    console.error('[Mailtrap API Error]:', error);
    return res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`
    });
  }
}
