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
      setTestResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveEmailConfig({
      provider: EMAIL_PROVIDERS.MAILTRAP,
      mailtrapToken,
      mailtrapSender
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
      provider: EMAIL_PROVIDERS.MAILTRAP,
      mailtrapToken,
      mailtrapSender
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
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        animation: 'modalSlideUp 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
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
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.35)'
            }}>
              <i className="fa-solid fa-paper-plane"></i>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Mailtrap Email Dispatch Settings
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#22C55E',
                  color: '#FFFFFF',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  Active
                </span>
              </h2>
              <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: '3px 0 0' }}>
                Automated clinical queue readiness alerts dispatched via Mailtrap
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
        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Status Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '1.5px solid #86EFAC',
            borderRadius: '14px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#22C55E',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              flexShrink: 0
            }}>
              <i className="fa-solid fa-check"></i>
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#166534' }}>
                Mailtrap API Engine Connected
              </div>
              <div style={{ fontSize: '12px', color: '#15803D', marginTop: '2px' }}>
                Zero-redirect automated email service configured for Doctor Queue alerts.
              </div>
            </div>
          </div>

          {/* Mailtrap Credentials */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
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
                border: '1.5px solid #CBD5E1',
                fontSize: '13px',
                fontFamily: 'monospace',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Mailtrap Verified Sender Address:
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
                border: '1.5px solid #CBD5E1',
                fontSize: '13px',
                fontFamily: 'monospace',
                boxSizing: 'border-box'
              }}
            />
            <p style={{ fontSize: '11.5px', color: '#64748B', margin: '6px 0 0' }}>
              Default Mailtrap testing domain: <code>mailtrap@demomailtrap.com</code>
            </p>
          </div>

          {/* Test Email Section */}
          <div style={{
            borderTop: '1px solid #E2E8F0',
            paddingTop: '18px',
            marginBottom: '10px'
          }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
              🧪 Send a Live Test Alert via Mailtrap:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="Enter patient email address"
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
                  background: isSendingTest ? '#94A3B8' : '#22C55E',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isSendingTest || !testEmail ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                }}
              >
                {isSendingTest ? 'Sending via Mailtrap...' : 'Test Send'}
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
                    <strong>✓ Delivered via Mailtrap:</strong> {testResult.message}. You can view the full formatted email in your{' '}
                    <a
                      href="https://mailtrap.io/inboxes"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#047857', fontWeight: 800, textDecoration: 'underline' }}
                    >
                      Mailtrap Sandbox Inbox
                    </a>.
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
              <span style={{ color: '#16A34A', fontSize: '13px', fontWeight: 700 }}>
                ✓ Mailtrap settings saved!
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
              Save Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
