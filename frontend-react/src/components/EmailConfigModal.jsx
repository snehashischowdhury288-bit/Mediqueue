import React, { useState, useEffect } from 'react';
import {
  getEmailConfig,
  saveEmailConfig,
  EMAIL_PROVIDERS,
  DEFAULT_MAILTRAP_TOKEN,
  DEFAULT_MAILTRAP_SENDER,
  sendAutomatedPresetEmail
} from '../services/emailService';

export default function EmailConfigModal({ isOpen, onClose, activeDoctor }) {
  const [provider, setProvider] = useState(EMAIL_PROVIDERS.MAILTRAP);
  const [mailtrapToken, setMailtrapToken] = useState(DEFAULT_MAILTRAP_TOKEN);
  const [mailtrapSender, setMailtrapSender] = useState(DEFAULT_MAILTRAP_SENDER);
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getEmailConfig();
      setProvider(config.provider || EMAIL_PROVIDERS.MAILTRAP);
      setMailtrapToken(config.mailtrapToken || DEFAULT_MAILTRAP_TOKEN);
      setMailtrapSender(config.mailtrapSender || DEFAULT_MAILTRAP_SENDER);
      setGmailUser(config.gmailUser || '');
      setGmailPass(config.gmailPass || '');
      setTestResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveEmailConfig({
      provider,
      mailtrapToken,
      mailtrapSender,
      gmailUser,
      gmailPass
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
      mailtrapToken,
      mailtrapSender,
      gmailUser,
      gmailPass
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
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: provider === EMAIL_PROVIDERS.GMAIL
                ? 'linear-gradient(135deg, #EA4335 0%, #B91C1C 100%)'
                : 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <i className={provider === EMAIL_PROVIDERS.GMAIL ? 'fa-brands fa-google' : 'fa-solid fa-paper-plane'}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Email Dispatch Configuration
              </h2>
              <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: '3px 0 0' }}>
                Configure how preset readiness emails are delivered to patients
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
          {/* Explanation Notice */}
          <div style={{
            background: '#F8FAFC',
            border: '1.5px solid #E2E8F0',
            borderRadius: '14px',
            padding: '14px 18px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#334155',
            lineHeight: 1.5
          }}>
            <strong style={{ color: '#0F172A', display: 'block', marginBottom: '4px' }}>
              📬 Delivering Alerts into Real Gmail Inboxes:
            </strong>
            Mailtrap Sandbox captures emails inside your Mailtrap dashboard (as shown in your screenshot).
            To receive alerts physically inside your <strong>real Gmail mailbox</strong>, choose an option below:
          </div>

          {/* Provider Selection Tabs */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
              Select Delivery Engine:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setProvider(EMAIL_PROVIDERS.GMAIL)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `2px solid ${provider === EMAIL_PROVIDERS.GMAIL ? '#EA4335' : '#E2E8F0'}`,
                  background: provider === EMAIL_PROVIDERS.GMAIL ? '#FEF2F2' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <i className="fa-brands fa-google" style={{ color: '#EA4335', fontSize: '18px' }}></i>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: provider === EMAIL_PROVIDERS.GMAIL ? '#B91C1C' : '#1E293B' }}>
                    Direct Gmail (Nodemailer)
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                  Sends physical emails straight into real Gmail inboxes!
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider(EMAIL_PROVIDERS.MAILTRAP)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `2px solid ${provider === EMAIL_PROVIDERS.MAILTRAP ? '#22C55E' : '#E2E8F0'}`,
                  background: provider === EMAIL_PROVIDERS.MAILTRAP ? '#F0FDF4' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <i className="fa-solid fa-paper-plane" style={{ color: '#22C55E', fontSize: '16px' }}></i>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: provider === EMAIL_PROVIDERS.MAILTRAP ? '#15803D' : '#1E293B' }}>
                    Mailtrap Engine
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                  Sandbox testing + Mailtrap Sending API
                </div>
              </button>
            </div>
          </div>

          {/* Direct Gmail Settings */}
          {provider === EMAIL_PROVIDERS.GMAIL && (
            <div style={{
              background: '#FEF2F2',
              border: '1.5px solid #FECACA',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#991B1B', marginBottom: '6px' }}>
                  Your Sender Gmail Address:
                </label>
                <input
                  type="email"
                  value={gmailUser}
                  onChange={e => setGmailUser(e.target.value)}
                  placeholder="e.g. yourhospital@gmail.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #FCA5A5',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#991B1B', marginBottom: '6px' }}>
                  Google App Password (16 characters):
                </label>
                <input
                  type="password"
                  value={gmailPass}
                  onChange={e => setGmailPass(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #FCA5A5',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{ fontSize: '11.5px', color: '#7F1D1D', margin: '8px 0 0', lineHeight: 1.4 }}>
                  💡 <strong>How to get an App Password (30 seconds):</strong> Go to your Google Account at{' '}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: '#DC2626', textDecoration: 'underline', fontWeight: 700 }}>
                    myaccount.google.com/apppasswords
                  </a>{' '}
                  $\rightarrow$ create an App Password named "MediQueue" $\rightarrow$ paste the 16 letters here. Every queue alert will immediately land in real Gmail inboxes!
                </p>
              </div>
            </div>
          )}

          {/* Mailtrap Settings */}
          {provider === EMAIL_PROVIDERS.MAILTRAP && (
            <div style={{
              background: '#F0FDF4',
              border: '1.5px solid #BBF7D0',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>
                  Mailtrap API Token:
                </label>
                <input
                  type="text"
                  value={mailtrapToken}
                  onChange={e => setMailtrapToken(e.target.value)}
                  placeholder="e0003d35e29d71e96224530855a6c244"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #86EFAC',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>
                  Mailtrap Sender Address:
                </label>
                <input
                  type="text"
                  value={mailtrapSender}
                  onChange={e => setMailtrapSender(e.target.value)}
                  placeholder="mailtrap@demomailtrap.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #86EFAC',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{ fontSize: '11.5px', color: '#14532D', margin: '8px 0 0', lineHeight: 1.4 }}>
                  👉 <strong>To send directly to Gmail using Mailtrap:</strong> In your Mailtrap dashboard, click the button{' '}
                  <strong style={{ background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>"Looks good? Go live"</strong>{' '}
                  (visible in your screenshot) to enable Mailtrap Email Sending to real Gmail inboxes!
                </p>
              </div>
            </div>
          )}

          {/* Test Email Section */}
          <div style={{
            borderTop: '1px solid #E2E8F0',
            paddingTop: '18px',
            marginBottom: '10px'
          }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
              🧪 Send a Live Test Alert:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="Enter patient Gmail address"
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
                  padding: '9px 18px',
                  borderRadius: '8px',
                  background: isSendingTest
                    ? '#94A3B8'
                    : provider === EMAIL_PROVIDERS.GMAIL
                    ? '#EA4335'
                    : '#22C55E',
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
                marginTop: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: testResult.success ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${testResult.success ? '#10B981' : '#EF4444'}`,
                color: testResult.success ? '#065F46' : '#991B1B',
                fontSize: '12.5px',
                lineHeight: 1.4
              }}>
                {testResult.success ? (
                  <>
                    <strong>✓ Success:</strong> {testResult.message}. Recipient: <strong>{testResult.recipient}</strong>.
                  </>
                ) : (
                  <>
                    <strong>✗ Notice:</strong> {testResult.message}
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
              <span style={{ color: '#16A34A', fontSize: '13px', fontWeight: 700 }}>
                ✓ Settings saved successfully!
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
                background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)'
              }}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
