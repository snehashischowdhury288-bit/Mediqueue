import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import DigitalTokenModal from './DigitalTokenModal';

export default function PatientPortal({
  user,
  doctors,
  selectedDoctor,
  onSelectDoctor,
  db,
  myAppointment,
  onBookAppointment,
  onOpenDoctorRegistration
}) {
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedService, setSelectedService] = useState('Cardiology');
  const [typedDoctorCode, setTypedDoctorCode] = useState('');
  const [codeLookupError, setCodeLookupError] = useState(null);
  const [turnAlertDismissed, setTurnAlertDismissed] = useState(false);

  // Booking Form State
  const [patName, setPatName] = useState(user?.name || '');
  const [patAge, setAge] = useState(user?.age || '32');
  const [patPhone, setPhone] = useState(user?.phone || '');
  const [patEmail, setEmail] = useState(user?.email || 'patient@example.com');
  const [priorityCategory, setPriorityCategory] = useState(user?.priorityCategory || 'none');

  const { appointments, analyticsHistory } = db;

  // Sync selected doctor based on department if none selected
  useEffect(() => {
    if (doctors && doctors.length > 0) {
      if (!selectedDoctor) {
        const match = doctors.find(d => d.department?.toLowerCase() === selectedService.toLowerCase()) || doctors[0];
        onSelectDoctor(match);
      }
    }
  }, [doctors, selectedDoctor, selectedService, onSelectDoctor]);

  // Active appointments for selected doctor
  const docCode = selectedDoctor?.doctorCode?.toUpperCase() || '';
  const docId = selectedDoctor?.doctorId || selectedDoctor?.uid || '';

  const activeQueue = appointments
    .filter(
      a => (a.doctorId === docId || a.doctorCode?.toUpperCase() === docCode) &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    )
    .sort((a, b) => {
      if (a.batchId !== b.batchId) return a.batchId.localeCompare(b.batchId);
      return a.slotNumber - b.slotNumber;
    });

  const inConsultation = activeQueue.find(a => a.status === 'in_consultation');

  // Find user's active appointment for this doctor or across appointments
  const currentApt = myAppointment || appointments.find(
    a => (a.status === 'waiting' || a.status === 'in_consultation') &&
         ((user?.phone && a.patientPhone === user.phone) ||
          (user?.email && a.patientEmail?.toLowerCase() === user.email.toLowerCase()) ||
          (user?.uid && a.patientId === user.uid))
  );

  // Calculate live queue position:
  const currentBatchId = currentApt ? currentApt.batchId : 'b1';
  const batchApts = activeQueue.filter(a => a.batchId === currentBatchId);

  const patientsAhead = currentApt
    ? currentApt.status === 'in_consultation'
      ? 0
      : batchApts.filter(a => a.status === 'waiting' && a.slotNumber < currentApt.slotNumber).length
    : 0;

  // Dynamic Estimated Wait Time:
  const deptHistory = (analyticsHistory || []).filter(h => h.department === selectedDoctor?.department);
  const avgDuration = deptHistory.length > 0
    ? Math.round(deptHistory.reduce((s, h) => s + (h.durationMinutes || 0), 0) / deptHistory.length)
    : 10;

  const estWaitTimeMinutes = currentApt?.status === 'in_consultation' ? 0 : patientsAhead * (avgDuration || 10);

  // Alert Trigger: If Patients Ahead === 3, fire both In-App banner and Web3Forms notification
  const is3TurnsAway = currentApt && currentApt.status === 'waiting' && patientsAhead === 3;

  useEffect(() => {
    if (is3TurnsAway && !turnAlertDismissed) {
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: 'SIMULATED_KEY',
          subject: 'MediQueue Turn Alert: 3 Turns Away!',
          message: `Attention ${currentApt.patientName}: You are 3 turns away from your consultation with Dr. ${selectedDoctor?.name}. Please head to the consultation suite.`
        })
      }).catch(() => {});
    }
  }, [is3TurnsAway, turnAlertDismissed, currentApt, selectedDoctor]);

  const handleLookupDoctorCode = e => {
    e.preventDefault();
    if (!typedDoctorCode.trim()) return;
    const found = db.getDoctorByCode(typedDoctorCode.trim());
    if (found) {
      onSelectDoctor(found);
      setSelectedService(found.department || 'Cardiology');
      setCodeLookupError(null);
      setTypedDoctorCode('');
    } else {
      setCodeLookupError(`No doctor registered with code "${typedDoctorCode.trim().toUpperCase()}".`);
    }
  };

  const handleBookingSubmit = async e => {
    e.preventDefault();
    if (!selectedDoctor) return;

    await onBookAppointment({
      doctorId: selectedDoctor.doctorId,
      doctorCode: selectedDoctor.doctorCode,
      patientName: patName,
      patientAge: parseInt(patAge, 10),
      patientPhone: patPhone,
      patientEmail: patEmail,
      priorityCategory
    });

    setShowBookingModal(false);
  };

  const qrPayload = currentApt && selectedDoctor ? {
    appointmentId: currentApt.appointmentId || currentApt.id,
    doctorCode: selectedDoctor.doctorCode,
    slotNumber: currentApt.slotNumber,
    patientName: currentApt.patientName,
    department: selectedDoctor.department
  } : null;

  // Real doctors in Firestore matching selected service
  const serviceDoctors = (doctors || []).filter(
    d => d.department?.toLowerCase() === selectedService.toLowerCase()
  );

  return (
    <main className="page-viewport">
      <div className="portal-main-container">

        {/* Patient Hero Banner */}
        <section className="patient-hero-banner">
          <div className="patient-hero-content">
            <span className="hero-kicker font-mono">
              <i className="fa-solid fa-hospital-user"></i> SMART OPD QUEUE • PATIENT PORTAL
            </span>
            <h1 className="pat-greeting-title">Hello, {user?.name || 'Patient'}!</h1>
            <p className="pat-greeting-sub">
              Your consultation is registered with real-time Firestore synchronization & priority allocation.
            </p>
          </div>

          {/* Quick Doctor Code Lookup */}
          <div className="doctor-switcher-container">
            <form onSubmit={handleLookupDoctorCode} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Doctor Code (e.g. DOC-404)"
                value={typedDoctorCode}
                onChange={e => setTypedDoctorCode(e.target.value.toUpperCase())}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase'
                }}
              />
              <button type="submit" className="btn-secondary-action" style={{ padding: '8px 14px', fontSize: '12.5px' }}>
                <i className="fa-solid fa-magnifying-glass"></i> Find Doctor
              </button>
            </form>
            {codeLookupError && (
              <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                {codeLookupError}
              </span>
            )}
          </div>
        </section>

        {/* 1. Real Department / Service Selection */}
        <section style={{ margin: '20px 0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', letterSpacing: '0.5px' }}>
              SELECT CLINICAL SERVICE / DEPARTMENT:
            </span>
            <span style={{ fontSize: '12px', color: '#3E69FE', fontWeight: 600 }}>
              {doctors.length} Total Clinicians Registered
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 'Cardiology', icon: 'fa-heart-pulse' },
              { id: 'Neurology', icon: 'fa-brain' },
              { id: 'Odontology', icon: 'fa-tooth' },
              { id: 'General Medicine', icon: 'fa-stethoscope' },
              { id: 'Pediatrics', icon: 'fa-baby' }
            ].map(svc => {
              const isSelected = selectedService === svc.id;
              const count = (doctors || []).filter(d => d.department?.toLowerCase() === svc.id.toLowerCase()).length;
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => {
                    setSelectedService(svc.id);
                    const match = doctors.find(d => d.department?.toLowerCase() === svc.id.toLowerCase());
                    if (match) onSelectDoctor(match);
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '14px',
                    border: isSelected ? '2px solid #3E69FE' : '1px solid #E2E8F0',
                    background: isSelected ? '#EFF6FF' : '#FFFFFF',
                    color: isSelected ? '#1E40AF' : '#475569',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 4px 12px rgba(62,105,254,0.15)' : 'none'
                  }}
                >
                  <i className={`fa-solid ${svc.icon}`}></i>
                  <span>{svc.id}</span>
                  <span style={{
                    fontSize: '11px',
                    background: isSelected ? '#3E69FE' : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : '#64748B',
                    padding: '2px 6px',
                    borderRadius: '8px'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Real Doctors in Selected Department */}
          <div style={{ marginTop: '16px', background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '10px' }}>
              AUTHENTIC CLINICIANS IN {selectedService.toUpperCase()}:
            </span>

            {serviceDoctors.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: '13px', color: '#94A3B8' }}>
                  No doctors currently registered under <strong>{selectedService}</strong> in Firestore.
                </span>
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={onOpenDoctorRegistration}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  <i className="fa-solid fa-user-plus"></i> Onboard Doctor
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {serviceDoctors.map(doc => {
                  const isSelected = selectedDoctor?.doctorCode === doc.doctorCode;
                  return (
                    <div
                      key={doc.doctorId || doc.doctorCode}
                      onClick={() => onSelectDoctor(doc)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #3E69FE' : '1px solid #CBD5E1',
                        background: isSelected ? '#EFF6FF' : '#F8FAFC',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#3E69FE', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {doc.name.charAt(0)}
                      </div>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: '#1E293B', display: 'block' }}>{doc.name}</strong>
                        <span className="font-mono text-blue" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                          Code: {doc.doctorCode} • Age {doc.age || 40}
                        </span>
                      </div>
                      {isSelected && (
                        <i className="fa-solid fa-circle-check text-blue" style={{ marginLeft: '4px' }}></i>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 3-Turns-Away Notification Banner */}
        {is3TurnsAway && !turnAlertDismissed && (
          <section className="patient-turn-alert-banner">
            <div className="alert-icon-col">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div className="alert-content-col">
              <div className="alert-kicker font-mono">
                <i className="fa-solid fa-bell"></i> URGENT QUEUE UPDATE • 3 TURNS AWAY
              </div>
              <h3 className="alert-heading">
                Attention: You are 3 turns away from your consultation. Please approach the waiting area.
              </h3>
              <p className="alert-message">
                Your consultation with <strong>{selectedDoctor?.name}</strong> in{' '}
                <strong>{selectedDoctor?.department}</strong> is coming up shortly.
              </p>
            </div>
            <button
              type="button"
              className="btn-dismiss-alert"
              onClick={() => setTurnAlertDismissed(true)}
              title="Acknowledge Alert"
            >
              <i className="fa-solid fa-check"></i>
            </button>
          </section>
        )}

        {/* Empty State UI When No Active Booking */}
        {!currentApt && (
          <section
            style={{
              background: '#FFFFFF',
              border: '1.5px dashed #CBD5E1',
              borderRadius: '20px',
              padding: '36px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px'
            }}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#64748B' }}>
              <i className="fa-regular fa-calendar-xmark"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B' }}>
              No active bookings found. Book an appointment below.
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748B', maxWidth: '440px', lineHeight: 1.5 }}>
              Select an attending doctor from <strong>{selectedService}</strong> and reserve an OPD slot with real-time priority shift.
            </p>
            {selectedDoctor ? (
              <button
                type="button"
                className="btn-primary-action"
                style={{ marginTop: '8px' }}
                onClick={() => setShowBookingModal(true)}
              >
                <i className="fa-solid fa-ticket"></i> Book Slot with {selectedDoctor.name} ({selectedDoctor.doctorCode})
              </button>
            ) : (
              <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600 }}>
                Please select or register a doctor first.
              </span>
            )}
          </section>
        )}

        {/* Active Consultation & Queue Metric Cards */}
        <section className="patient-status-grid">

          {/* Card 1: Live Queue Position & Wait Time */}
          <div className="status-metric-card primary">
            <div className="sm-card-header">
              <span className="sm-badge">
                <span className="pulse-dot-green"></span> LIVE QUEUE POSITION
              </span>
              <span className="sm-batch-tag font-mono">
                {currentApt ? (currentApt.batchId === 'b2' ? 'Evening Batch' : 'Morning Batch') : 'Morning Batch'}
              </span>
            </div>

            <div className="sm-card-body">
              <div className="big-rank-row">
                <span className="big-rank font-mono">
                  {currentApt
                    ? currentApt.status === 'in_consultation'
                      ? 'NOW'
                      : `${patientsAhead}`
                    : 'OPEN'}
                </span>
                <span className="big-rank-sub">
                  {currentApt
                    ? currentApt.status === 'in_consultation'
                      ? 'IN CONSULTATION'
                      : patientsAhead === 0
                      ? 'NEXT IN LINE'
                      : 'PATIENTS AHEAD'
                    : 'READY TO BOOK'}
                </span>
              </div>

              <div className="slot-display-tag font-mono">
                {currentApt
                  ? `Assigned Slot: Slot ${currentApt.slotNumber}`
                  : `Next Available: Slot ${((activeQueue.length) % 5) + 1}`}
              </div>

              <div className="wait-calc-box">
                <i className="fa-regular fa-clock"></i>
                <span>
                  Estimated Wait Time:{' '}
                  <strong className="font-mono text-blue">
                    {currentApt?.status === 'in_consultation'
                      ? '0 min (In Examination Room)'
                      : `~${estWaitTimeMinutes} mins (${patientsAhead} ahead * ${avgDuration || 10}m)`}
                  </strong>
                </span>
              </div>
            </div>

            <div className="sm-card-footer">
              <div className="live-consult-indicator">
                {currentApt ? (
                  currentApt.status === 'in_consultation' ? (
                    <span>
                      <i className="fa-solid fa-door-open text-green"></i> Please enter consultation suite now.
                    </span>
                  ) : (
                    <span>
                      <i className="fa-solid fa-circle-check text-green"></i> Token active with Dr. {selectedDoctor?.name}
                    </span>
                  )
                ) : (
                  <button
                    className="btn-primary-action"
                    style={{ padding: '8px 18px', fontSize: '13px' }}
                    onClick={() => setShowBookingModal(true)}
                    disabled={!selectedDoctor}
                  >
                    <i className="fa-solid fa-ticket"></i> Book Slot with {selectedDoctor?.name || 'Doctor'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Batch Capacity (Strict 5 per batch) */}
          <div className="status-metric-card">
            <div className="sm-card-header">
              <span className="sm-title">BATCH CAPACITY (MAX 5 PER BATCH)</span>
              <span className="sm-counter font-mono">{batchApts.length} / 5 Filled</span>
            </div>

            <div className="batch-slots-visual">
              {[1, 2, 3, 4, 5].map(slot => {
                const apt = batchApts.find(a => a.slotNumber === slot);
                const isMe = apt && (apt.appointmentId === currentApt?.appointmentId || apt.id === currentApt?.id);
                const isPriority = apt && ['elderly', 'pregnant', 'emergency'].includes(apt.priorityCategory);

                return (
                  <div
                    key={slot}
                    className={`batch-slot-node ${apt ? 'filled' : ''} ${isMe ? 'current' : ''} ${
                      isPriority ? 'priority' : ''
                    }`}
                  >
                    <span className="slot-label font-mono">SLOT {slot}</span>
                    <span className="slot-patient-name">
                      {apt ? (isMe ? `${apt.patientName} (You)` : apt.patientName) : 'Open'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="batch-rules-caption">
              <i className="fa-solid fa-shield-heart text-blue"></i>
              <span>
                Priority bookings (Elderly, Pregnant, Emergency) are dynamically inserted at{' '}
                <strong>Slot 1</strong> with automated batch spillover.
              </span>
            </div>
          </div>

          {/* Card 3: Digital Token (QR Code) */}
          {currentApt && qrPayload && (
            <div className="status-metric-card qr-token-card">
              <div className="sm-card-header">
                <span className="sm-badge">
                  <i className="fa-solid fa-qrcode text-blue"></i> DIGITAL TOKEN PASS
                </span>
                <span className="sm-batch-tag font-mono">
                  TOKEN #{(currentApt.appointmentId || currentApt.id).slice(-6).toUpperCase()}
                </span>
              </div>

              <div className="sm-card-body token-body-center">
                <div className="qr-canvas-wrapper">
                  <QRCodeSVG
                    value={JSON.stringify(qrPayload)}
                    size={110}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="token-payload-meta">
                  <div className="token-slot-line font-mono">
                    Slot {currentApt.slotNumber} • {currentApt.batchId === 'b2' ? 'Evening Batch' : 'Morning Batch'}
                  </div>
                  <div className="token-scan-hint font-mono">
                    <i className="fa-solid fa-barcode"></i> Scannable Token Pass
                  </div>
                </div>
              </div>

              <div className="sm-card-footer">
                <button
                  type="button"
                  className="btn-view-pass"
                  onClick={() => setShowTokenModal(true)}
                >
                  <i className="fa-solid fa-expand"></i>
                  <span>View Full Token Pass</span>
                </button>
              </div>
            </div>
          )}

        </section>

        {/* Current Batch Roster Table */}
        <section className="queue-roster-section">
          <div className="section-header-row">
            <div>
              <h3 className="sec-title">Current Batch Queue Roster (Dr. {selectedDoctor?.name || 'Selected Doctor'})</h3>
              <p className="sec-sub">Live monitoring of consulting suite and queue slots</p>
            </div>
            <span className="badge-live-stream font-mono">
              <span className="pulse-dot-green"></span> LIVE QUEUE
            </span>
          </div>

          <div className="roster-table-container">
            {batchApts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                <p>No waiting patients registered in this batch yet.</p>
              </div>
            ) : (
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Patient Name</th>
                    <th>Priority Category</th>
                    <th>Status</th>
                    <th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {batchApts.map(apt => {
                    const isMe = apt && (apt.appointmentId === currentApt?.appointmentId || apt.id === currentApt?.id);
                    return (
                      <tr key={apt.appointmentId || apt.id} className={isMe ? 'highlight-row' : ''}>
                        <td className="font-mono"><strong>Slot {apt.slotNumber}</strong></td>
                        <td>{apt.patientName} {isMe && <span className="badge-you font-mono">YOU</span>}</td>
                        <td>
                          <span className={`priority-tag ${apt.priorityCategory || 'none'}`}>
                            {apt.priorityCategory?.toUpperCase() || 'STANDARD'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${apt.status}`}>
                            {apt.status === 'in_consultation' ? 'In Consultation' : 'Waiting'}
                          </span>
                        </td>
                        <td className="font-mono">{apt.batchId === 'b2' ? 'Evening' : 'Morning'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Booking Dialog Modal */}
        {showBookingModal && (
          <div className="modal-backdrop">
            <div className="dialog-box">
              <div className="dialog-header">
                <h3 className="dialog-title">
                  <i className="fa-solid fa-calendar-plus text-blue"></i> Book OPD Consultation Slot
                </h3>
                <button type="button" className="btn-close-dialog" onClick={() => setShowBookingModal(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <form onSubmit={handleBookingSubmit}>
                <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#EFF6FF', padding: '12px 14px', borderRadius: '10px', fontSize: '13px', color: '#1E40AF' }}>
                    <i className="fa-solid fa-user-doctor"></i> Attending Clinician:{' '}
                    <strong>{selectedDoctor?.name}</strong> ({selectedDoctor?.department} • Code: {selectedDoctor?.doctorCode})
                  </div>

                  <div className="form-group">
                    <label>Patient Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={patName}
                      onChange={e => setPatName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>Age</label>
                      <input
                        type="number"
                        className="form-input"
                        value={patAge}
                        onChange={e => setAge(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Priority Tier *</label>
                      <select
                        className="form-input"
                        value={priorityCategory}
                        onChange={e => setPriorityCategory(e.target.value)}
                      >
                        <option value="none">None (Standard Queue)</option>
                        <option value="elderly">Elderly (60+ Years)</option>
                        <option value="pregnant">Pregnant Woman</option>
                        <option value="emergency">Emergency Case</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Mobile Number *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={patPhone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      value={patEmail}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px' }}>
                  <button type="button" className="btn-secondary-action" onClick={() => setShowBookingModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary-action">
                    <i className="fa-solid fa-check"></i> Confirm Reservation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Digital Token Modal */}
        {showTokenModal && currentApt && selectedDoctor && (
          <DigitalTokenModal
            appointment={currentApt}
            doctor={selectedDoctor}
            qrPayload={qrPayload}
            onClose={() => setShowTokenModal(false)}
          />
        )}

      </div>
    </main>
  );
}
