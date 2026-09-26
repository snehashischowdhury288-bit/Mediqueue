import React from 'react';

export default function OtpModal({ phone, onAutoFill, onClose }) {
  if (!phone) return null;

  return (
    <div className="modal-backdrop">
      <div className="dialog-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
        <div className="dialog-header" style={{ justifyContent: 'center', background: '#F8FAFC' }}>
          <h3 className="dialog-title" style={{ fontSize: '16px' }}>
            <i className="fa-solid fa-shield-halved text-blue"></i> Simulated SMS Gateway
          </h3>
          <button type="button" className="btn-close-dialog" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '24px' }}>
          <div style={{ fontSize: '40px', color: '#3E69FE', marginBottom: '10px' }}>
            <i className="fa-solid fa-comment-sms"></i>
          </div>
          <p style={{ fontSize: '13.5px', color: '#64748B', marginBottom: '14px' }}>
            MediQueue OTP dispatched to <strong className="font-mono text-dark">+91 {phone}</strong>
          </p>

          <div
            style={{
              background: 'rgba(62, 105, 254, 0.06)',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '18px',
              border: '1.5px dashed #3E69FE'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#3E69FE',
                display: 'block',
                marginBottom: '4px',
                letterSpacing: '0.5px'
              }}
            >
              YOUR SIMULATED OTP CODE
            </span>
            <span
              className="font-mono"
              style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '8px', color: '#1E293B' }}
            >
              1234
            </span>
          </div>

          <button
            type="button"
            className="btn-primary-action"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onAutoFill}
          >
            <i className="fa-solid fa-paste"></i>
            <span>Auto-Fill "1234" & Proceed</span>
          </button>
        </div>
      </div>
    </div>
  );
}
