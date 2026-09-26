/**
 * MediQueue - Frontend API Client
 * Talks to Node.js Gateway on http://localhost:5000
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function sendOtp(phone) {
  const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  return res.json();
}

export async function verifyOtp(phone, otp, role, name) {
  const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, role, name })
  });
  return res.json();
}

export async function getDoctors() {
  const res = await fetch(`${API_BASE_URL}/api/doctors`);
  return res.json();
}

export async function getQueueStatus(doctorId) {
  const res = await fetch(`${API_BASE_URL}/api/queue/status/${doctorId}`);
  return res.json();
}

export async function getAdminMetrics() {
  const res = await fetch(`${API_BASE_URL}/api/admin/metrics`);
  return res.json();
}

export async function populateDemoScenario() {
  const res = await fetch(`${API_BASE_URL}/api/demo/populate`, {
    method: 'POST'
  });
  return res.json();
}
