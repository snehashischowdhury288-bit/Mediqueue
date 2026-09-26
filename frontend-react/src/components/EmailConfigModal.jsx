import React, { useState, useEffect } from 'react';
import {
  getEmailConfig,
  saveEmailConfig,
  EMAIL_PROVIDERS,
  DEFAULT_MAILTRAP_TOKEN,
  sendAutomatedPresetEmail
} from '../services/emailService';

export default function EmailConfigModal({ isOpen, onClose, activeDoctor, nextPatient }) {
  const [provider, setProvider] = useState(EMAIL_PROVIDERS.MAILTRAP);
  const [mailtrapToken, setMailtrapToken] = useState(DEFAULT_MAILTRAP_TOKEN);
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');

  const nextPatientActualEmail = (nextPatient?.patientEmail || '').trim();
  const nextPatientActualName = nextPatient?.patientName || 'Next Patient';
  const nextPatientSlot = nextPatient?.slotNumber || 2;

  const [testEmail, setTestEmail] = useState(nextPatientActualEmail);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getEmailConfig();
      setProvider(config.provider || EMAIL_PROVIDERS.MAILTRAP);
      setMailtrapToken(config.mailtrapToken || DEFAULT_MAILTRAP_TOKEN);
      setGmailUser(config.gmailUser || '');
      setGmailPass(config.gmailPass || '');
      setTestEmail(nextPatientActualEmail || '');
      setTestResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen, nextPatientActualEmail]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveEmailConfig({
      provider,
      mailtrapToken,
      mailtrapSender: nextPatientActualEmail,
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
    const targetEmail = testEmail || nextPatientActualEmail;
    if (!targetEmail || !targetEmail.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid patient email address to test.' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    // Save configuration
    saveEmailConfig({
      provider,
      mailtrapToken,
      mailtrapSender: targetEmail,
      gmailUser,
      gmailPass
    });

    const result = await sendAutomatedPresetEmail({
      alertType: 'next_patient',
      patientName: nextPatientActualName || 'Test Patient',
      patientEmail: targetEmail,
      slotNumber: nextPatientSlot,
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
                Bound dynamically to the next patient's actual registered email address
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
          {/* Active Queue Patient Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '1.5px solid #86EFAC',
            borderRadius: '14px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#16A34A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>
                <i className="fa-solid fa-user-check"></i>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Next Patient in Queue (Actual Email)
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#14532D', fontFamily: 'monospace' }}>
                  {nextPatientActualEmail || 'No patient currently registered in waiting queue'}
                </div>
              </div>
            </div>
            {nextPatientActualEmail && (
              <span style={{
                fontSize: '11.5px',
                fontWeight: 800,
                background: '#16A34A',
                color: '#FFFFFF',
                padding: '3px 10px',
                borderRadius: '8px'
              }}>
                Slot #{nextPatientSlot} • {nextPatientActualName}
              </span>
            )}
          </div>

          {/* Provider Selection Tabs */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
              Select Email Sending Engine:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  Analyses and delivers queue alerts
                </div>
              </button>

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
                  Sends physical emails to real Gmail inboxes
                </div>
              </button>
            </div>
          </div>

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
                  Sender & Recipient Address:
                </label>
                <div style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="fa-solid fa-bolt" style={{ color: '#16A34A' }}></i>
                  <span style={{ fontWeight: 800, color: '#14532D', fontFamily: 'monospace', fontSize: '13.5px' }}>
                    {nextPatientActualEmail || '(Bound dynamically to next patient in queue)'}
                  </span>
                </div>
                <p style={{ fontSize: '11.5px', color: '#14532D', margin: '8px 0 0', lineHeight: 1.4 }}>
                  ✅ <strong>Zero Mock Data:</strong> Mailtrap will strictly analyze and send emails using the <strong>next patient's actual email</strong> ({nextPatientActualEmail || 'from active queue'}).
                </p>
              </div>
            </div>
          )}

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
                  💡 <strong>Google App Password:</strong> Generate one at{' '}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: '#DC2626', textDecoration: 'underline', fontWeight: 700 }}>
                    myaccount.google.com/apppasswords
                  </a>.
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
              🧪 Send a Live Test Alert to Next Patient's Actual Email:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="Next patient actual email"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
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
                    <strong>✓ Success:</strong> {testResult.message}. Sent to: <strong>{testResult.recipient}</strong>.
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
