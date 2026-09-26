import React, { useState, useEffect } from 'react';
import { getEmailConfig, saveEmailConfig, EMAIL_PROVIDERS, sendAutomatedPresetEmail } from '../services/emailService';

export default function EmailConfigModal({ isOpen, onClose, activeDoctor }) {
  const [provider, setProvider] = useState(EMAIL_PROVIDERS.WEB3FORMS);
  const [web3formsKey, setWeb3formsKey] = useState('');
  const [emailjsServiceId, setEmailjsServiceId] = useState('');
  const [emailjsTemplateId, setEmailjsTemplateId] = useState('');
  const [emailjsPublicKey, setEmailjsPublicKey] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getEmailConfig();
      setProvider(config.provider || EMAIL_PROVIDERS.WEB3FORMS);
      setWeb3formsKey(config.web3formsKey || '');
      setEmailjsServiceId(config.emailjsServiceId || '');
      setEmailjsTemplateId(config.emailjsTemplateId || '');
      setEmailjsPublicKey(config.emailjsPublicKey || '');
      setResendApiKey(config.resendApiKey || '');
      setTestResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveEmailConfig({
      provider,
      web3formsKey,
      emailjsServiceId,
      emailjsTemplateId,
      emailjsPublicKey,
      resendApiKey
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid email address to test.' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    // Save temporary config for testing
    saveEmailConfig({
      provider,
      web3formsKey,
      emailjsServiceId,
      emailjsTemplateId,
      emailjsPublicKey,
      resendApiKey
    });

    const result = await sendAutomatedPresetEmail({
      alertType: 'next_patient',
      patientName: 'Test Patient (You)',
      patientEmail: testEmail,
      slotNumber: 2,
      doctorName: activeDoctor?.name || 'Dr. Anya Sharma',
      doctorEmail: activeDoctor?.email || 'doctor@mediqueue.clinic',
      roomNumber: activeDoctor?.room || 'Suite 304, Wing C'
    });

    setIsSendingTest(false);
    setTestResult(result);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        maxWidth: '580px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        animation: 'modalSlideUp 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(14, 165, 233, 0.2)',
              color: '#38BDF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}>
              <i className="fa-solid fa-envelope-circle-check"></i>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Automated Email Dispatch Settings</h2>
              <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: '2px 0 0' }}>
                Preset background emails sent directly to patients without redirecting to Gmail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Important Diagnostic Notice */}
          <div style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#0369A1',
            lineHeight: 1.5
          }}>
            <strong style={{ display: 'block', color: '#0284C7', marginBottom: '4px', fontSize: '13.5px' }}>
              ℹ️ How Direct Email Delivery Works:
            </strong>
            When you click <strong>"📢 Alert Next Patient"</strong>, a preset alert is dispatched via HTTP in the background (no window redirect, no mailto).
            Web3Forms free keys send form submissions to the <em>account owner who created the key</em>. To send directly to your personal email or arbitrary patient inboxes, select your provider below:
          </div>

          {/* Provider Selection Tabs */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              Select Active Email Dispatch Channel:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setProvider(EMAIL_PROVIDERS.WEB3FORMS)}
                style={{
                  padding: '12px 10px',
                  borderRadius: '12px',
                  border: `2px solid ${provider === EMAIL_PROVIDERS.WEB3FORMS ? '#0284C7' : '#E2E8F0'}`,
                  background: provider === EMAIL_PROVIDERS.WEB3FORMS ? '#F0F9FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>⚡</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: provider === EMAIL_PROVIDERS.WEB3FORMS ? '#0284C7' : '#475569' }}>
                  Web3Forms
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Zero-Config / API Key</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider(EMAIL_PROVIDERS.EMAILJS)}
                style={{
                  padding: '12px 10px',
                  borderRadius: '12px',
                  border: `2px solid ${provider === EMAIL_PROVIDERS.EMAILJS ? '#0284C7' : '#E2E8F0'}`,
                  background: provider === EMAIL_PROVIDERS.EMAILJS ? '#F0F9FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>📬</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: provider === EMAIL_PROVIDERS.EMAILJS ? '#0284C7' : '#475569' }}>
                  EmailJS
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Direct to Patient Inbox</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider(EMAIL_PROVIDERS.RESEND)}
                style={{
                  padding: '12px 10px',
                  borderRadius: '12px',
                  border: `2px solid ${provider === EMAIL_PROVIDERS.RESEND ? '#0284C7' : '#E2E8F0'}`,
                  background: provider === EMAIL_PROVIDERS.RESEND ? '#F0F9FF' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>🚀</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: provider === EMAIL_PROVIDERS.RESEND ? '#0284C7' : '#475569' }}>
                  Resend API
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Hospital Transactional</div>
              </button>
            </div>
          </div>

          {/* Web3Forms Configuration Fields */}
          {provider === EMAIL_PROVIDERS.WEB3FORMS && (
            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Web3Forms Access Key:
              </label>
              <input
                type="text"
                value={web3formsKey}
                onChange={e => setWeb3formsKey(e.target.value)}
                placeholder="7cbd2b0b-6fba-43be-993c-471ab95e28a4"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: '11.5px', color: '#64748B', margin: '8px 0 0', lineHeight: 1.4 }}>
                💡 <strong>Tip for testing:</strong> Enter your own free Web3Forms access key from{' '}
                <a href="https://web3forms.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0284C7', textDecoration: 'underline' }}>
                  web3forms.com
                </a>{' '}
                (takes 5 seconds, just enter your email) so all notifications immediately land directly in your personal email inbox!
              </p>
            </div>
          )}

          {/* EmailJS Configuration Fields */}
          {provider === EMAIL_PROVIDERS.EMAILJS && (
            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  EmailJS Service ID:
                </label>
                <input
                  type="text"
                  value={emailjsServiceId}
                  onChange={e => setEmailjsServiceId(e.target.value)}
                  placeholder="e.g. service_mediqueue"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  EmailJS Template ID:
                </label>
                <input
                  type="text"
                  value={emailjsTemplateId}
                  onChange={e => setEmailjsTemplateId(e.target.value)}
                  placeholder="e.g. template_queue_alert"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  EmailJS Public Key (User ID):
                </label>
                <input
                  type="text"
                  value={emailjsPublicKey}
                  onChange={e => setEmailjsPublicKey(e.target.value)}
                  placeholder="e.g. user_abcdef12345"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <p style={{ fontSize: '11.5px', color: '#64748B', margin: '8px 0 0', lineHeight: 1.4 }}>
                Sends directly to whatever patient email address is registered (Slot #2, #3, etc.) without server configuration.
              </p>
            </div>
          )}

          {/* Resend Configuration Fields */}
          {provider === EMAIL_PROVIDERS.RESEND && (
            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Resend API Key:
              </label>
              <input
                type="password"
                value={resendApiKey}
                onChange={e => setResendApiKey(e.target.value)}
                placeholder="re_123456789..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '11.5px', color: '#64748B', margin: '8px 0 0' }}>
                Transactional email delivery through Resend cloud infrastructure.
              </p>
            </div>
          )}

          {/* Test Preset Email Section */}
          <div style={{
            borderTop: '1px solid #E2E8F0',
            paddingTop: '18px',
            marginBottom: '16px'
          }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
              🧪 Send a Test Preset Email to Your Mailbox:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="Enter your personal email to test"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isSendingTest || !testEmail}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  background: isSendingTest ? '#94A3B8' : '#0284C7',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isSendingTest || !testEmail ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {isSendingTest ? 'Sending...' : 'Send Test Alert'}
              </button>
            </div>

            {testResult && (
              <div style={{
                marginTop: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: testResult.success ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${testResult.success ? '#10B981' : '#EF4444'}`,
                color: testResult.success ? '#065F46' : '#991B1B',
                fontSize: '12.5px',
                lineHeight: 1.4
              }}>
                {testResult.success ? (
                  <>
                    <strong>✓ Success:</strong> {testResult.message}. Please check your inbox (and spam folder) at <strong>{testResult.recipient}</strong>.
                  </>
                ) : (
                  <>
                    <strong>✗ Failed:</strong> {testResult.message}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          background: '#F8FAFC',
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {savedSuccess && (
              <span style={{ color: '#10B981', fontSize: '13px', fontWeight: 700 }}>
                ✓ Settings saved!
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
