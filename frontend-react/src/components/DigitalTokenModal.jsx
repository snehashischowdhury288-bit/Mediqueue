import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function DigitalTokenModal({ appointment, doctor, onClose }) {
  if (!appointment || !doctor) return null;

  const aptId = appointment.appointmentId || appointment.id || 'apt_unknown';
  const categoryLabel = (appointment.priorityCategory || appointment.category || 'Normal');
  const payload = {
    appointmentId: aptId,
    doctorCode: doctor.doctorCode || doctor.id || 'DOC101',
    slotNumber: appointment.slotNumber,
    patientName: appointment.patientName
  };

  const payloadString = JSON.stringify(payload);

  return (
    <div className="modal-backdrop">
      <div className="dialog-box token-modal-box" style={{ maxWidth: '500px' }}>
        <div className="dialog-header">
          <h3 className="dialog-title">
            <i className="fa-solid fa-qrcode text-blue"></i> Digital OPD Token & QR Pass
          </h3>
          <button type="button" className="btn-close-dialog" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="dialog-body ticket-modal-body">
          <div className="ticket-pass-card">
            <div className="pass-top-band">
              <div className="pass-brand">
                <i className="fa-solid fa-notes-medical"></i> MediQueue Digital Token
              </div>
              <span className="pass-slot-badge font-mono">
                Slot {appointment.slotNumber} • {appointment.batchId === 'b2' ? 'Evening Batch' : 'Morning Batch'}
              </span>
            </div>

            <div className="pass-main-content">
              <div className="pass-qr-box">
                <QRCodeSVG
                  value={payloadString}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="pass-details-box">
                <div className="pass-token-num font-mono">
                  TOKEN #{aptId.slice(-6).toUpperCase()}
                </div>
                <h4 className="pass-patient-name">{appointment.patientName}</h4>
                <div className="pass-doctor-info">{doctor.name} ({doctor.doctorCode || 'DOC101'})</div>
                <div className="pass-room-info">
                  {doctor.department || doctor.specialization} • Suite 304, Wing C
                </div>
                <div className="pass-priority-tag font-mono">
                  {categoryLabel.toUpperCase()} Priority
                </div>
              </div>
            </div>

            <div className="pass-payload-footer">
              <span className="payload-caption font-mono">ENCODED QR PAYLOAD:</span>
              <div className="payload-code font-mono">{payloadString}</div>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn-primary-action" onClick={onClose}>
            <i className="fa-solid fa-circle-check"></i>
            <span>View Live Queue Position</span>
          </button>
        </div>
      </div>
    </div>
  );
}
