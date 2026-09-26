import React, { useState, useEffect } from 'react';

export default function DoctorPortal({ doctor, doctors, onSelectDoctor, db, onOpenDoctorRegistration }) {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'history'
  const [timerSeconds, setTimerSeconds] = useState(0);

  const { appointments, callNext, completeConsultation, skipPatient, markNoShow } = db;

  // Filter strictly by the logged-in doctor's doctorId or doctorCode
  const currentDocCode = doctor?.doctorCode?.toUpperCase() || '';
  const currentDocId = doctor?.doctorId || doctor?.uid || '';

  const activeQueue = appointments
    .filter(
      a => (a.doctorId === currentDocId || a.doctorCode?.toUpperCase() === currentDocCode) &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    )
    .sort((a, b) => {
      if (a.batchId !== b.batchId) return a.batchId.localeCompare(b.batchId);
      return a.slotNumber - b.slotNumber;
    });

  const inConsultation = activeQueue.find(a => a.status === 'in_consultation');
  const waitingPatients = activeQueue.filter(a => a.status === 'waiting');

  // Cured / Completed Patients for this specific doctor
  const completedPatients = appointments
    .filter(
      a => (a.doctorId === currentDocId || a.doctorCode?.toUpperCase() === currentDocCode) &&
           a.status === 'completed'
    )
    .sort((a, b) => {
      const timeA = a.consultationEndTime?.toDate ? a.consultationEndTime.toDate() : new Date(a.consultationEndTime || 0);
      const timeB = b.consultationEndTime?.toDate ? b.consultationEndTime.toDate() : new Date(b.consultationEndTime || 0);
      return timeB - timeA;
    });

  // Stopwatch timer for active consultation
  useEffect(() => {
    let interval = null;
    if (inConsultation) {
      if (inConsultation.consultationStartTime) {
        const startTime = inConsultation.consultationStartTime.toDate
          ? inConsultation.consultationStartTime.toDate()
          : (inConsultation.consultationStartTime.seconds
              ? new Date(inConsultation.consultationStartTime.seconds * 1000)
              : new Date(inConsultation.consultationStartTime));
        const elapsed = Math.floor((Date.now() - (isNaN(startTime.getTime()) ? Date.now() : startTime.getTime())) / 1000);
        setTimerSeconds(Math.max(0, elapsed));
      } else {
        setTimerSeconds(0);
      }
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [inConsultation]);

  const formatTimer = secs => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const activeBatchName = activeQueue[0]?.batchId === 'b2' ? 'Evening Batch' : 'Morning Batch';

  // If no doctor selected
  if (!doctor) {
    return (
      <main className="page-viewport">
        <div className="portal-main-container">
          <section
            style={{
              background: '#FFFFFF',
              border: '1.5px dashed #CBD5E1',
              borderRadius: '24px',
              padding: '48px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              margin: '40px auto',
              maxWidth: '600px'
            }}
          >
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#3E69FE' }}>
              <i className="fa-solid fa-user-doctor"></i>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1E293B' }}>
              No Doctor Profile Selected
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6 }}>
              There are currently no clinicians registered in the system. Please onboard your clinical profile to activate your live queue suite.
            </p>
            <button
              type="button"
              className="btn-primary-action"
              style={{ marginTop: '10px' }}
              onClick={onOpenDoctorRegistration}
            >
              <i className="fa-solid fa-plus"></i> Register Doctor Profile
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-viewport">
      <div className="portal-main-container">

        {/* Doctor Top Banner */}
        <section className="doctor-banner-overview">
          <div className="doc-hero-left">
            <div className="doc-badge-avatar">
              <i className="fa-solid fa-user-doctor"></i>
            </div>
            <div className="doc-title-group">
              <div className="doc-credential-line">
                <h1 className="doc-main-name">{doctor.name}</h1>
                <span className="doc-active-badge font-mono" style={{ background: doctor.isAvailable !== false ? '#DCFCE7' : '#F1F5F9', color: doctor.isAvailable !== false ? '#15803D' : '#64748B' }}>
                  <span className="pulse-dot-green"></span> {doctor.isAvailable !== false ? 'ON DUTY • CLINIC ACTIVE' : 'OFFLINE'}
                </span>
              </div>
              <div className="doc-sub-line">
                {doctor.department} • Code: <strong className="font-mono text-blue">{doctor.doctorCode}</strong> • Age/Exp: {doctor.age || 42} Yrs
              </div>
            </div>
          </div>

          <div className="doc-hero-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {doctors && doctors.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>SWITCH CLINICIAN:</span>
                <select
                  className="doctor-switcher-select"
                  value={doctor.doctorCode}
                  onChange={e => {
                    const d = doctors.find(doc => doc.doctorCode === e.target.value);
                    if (d) onSelectDoctor(d);
                  }}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  {doctors.map(d => (
                    <option key={d.doctorId} value={d.doctorCode}>
                      {d.name} ({d.doctorCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn-secondary-action"
              onClick={onOpenDoctorRegistration}
              style={{ padding: '8px 14px', fontSize: '13px' }}
            >
              <i className="fa-solid fa-user-plus"></i>
              <span>New Clinician</span>
            </button>
          </div>
        </section>

        {/* Doctor Suite Tabs: Active Queue vs Cured History */}
        <div style={{ display: 'flex', gap: '12px', margin: '24px 0 16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
          <button
            type="button"
            className={`btn-filter-pill ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14px',
              background: activeTab === 'queue' ? '#3E69FE' : '#FFFFFF',
              color: activeTab === 'queue' ? '#FFFFFF' : '#475569',
              border: '1px solid #CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-users-line"></i>
            <span>Live Consultation Queue</span>
            <span style={{ background: activeTab === 'queue' ? 'rgba(255,255,255,0.25)' : '#F1F5F9', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>
              {activeQueue.length}
            </span>
          </button>

          <button
            type="button"
            className={`btn-filter-pill ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14px',
              background: activeTab === 'history' ? '#10B981' : '#FFFFFF',
              color: activeTab === 'history' ? '#FFFFFF' : '#475569',
              border: '1px solid #CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-circle-check"></i>
            <span>Cured / Completed History</span>
            <span style={{ background: activeTab === 'history' ? 'rgba(255,255,255,0.25)' : '#F1F5F9', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>
              {completedPatients.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Live Consultation Suite */}
        {activeTab === 'queue' && (
          <>
            {/* Consultation Suite Action Cards Grid */}
            <section className="doctor-action-grid">

              {/* Card 1: Currently In Consultation */}
              <div className="doc-panel-card consult-active-card">
                <div className="doc-card-header">
                  <span className="sm-badge pulse-badge">
                    <span className="pulse-dot-green"></span> IN-EXAMINATION
                  </span>
                  <span className="doc-batch-label font-mono">
                    {inConsultation ? `Slot ${inConsultation.slotNumber} • ${activeBatchName}` : activeBatchName}
                  </span>
                </div>

                <div className="doc-card-body">
                  {inConsultation ? (
                    <div className="consulting-patient-profile">
                      <div className="patient-avatar-large">
                        {inConsultation.patientName?.charAt(0) || 'P'}
                      </div>
                      <div className="patient-identity-block">
                        <h2 className="consult-patient-name">{inConsultation.patientName}</h2>
                        <div className="patient-tags-row">
                          <span className="tag-detail font-mono">Age: {inConsultation.patientAge || '32'}</span>
                          <span className="tag-detail font-mono">Phone: {inConsultation.patientPhone}</span>
                          {inConsultation.priorityCategory && inConsultation.priorityCategory !== 'none' && (
                            <span className="priority-badge-pill font-mono">
                              <i className="fa-solid fa-star"></i> {inConsultation.priorityCategory.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Live Consultation Timer */}
                      <div className="consultation-stopwatch-box">
                        <div className="timer-label font-mono">CONSULTATION DURATION</div>
                        <div className="timer-digits font-mono">{formatTimer(timerSeconds)}</div>
                        <small className="timer-hint">Auto-logged to Firestore analytics</small>
                      </div>
                    </div>
                  ) : (
                    <div className="no-active-consultation-state">
                      <div className="empty-icon-wrap">
                        <i className="fa-solid fa-stethoscope"></i>
                      </div>
                      <h3>No Patient in Consultation Suite</h3>
                      <p>Click "Call Next Patient" below to summon the highest priority patient from the waiting queue.</p>
                    </div>
                  )}
                </div>

                <div className="doc-card-footer">
                  {inConsultation ? (
                    <div className="consult-actions-bar">
                      <button
                        type="button"
                        className="btn-complete-consultation"
                        onClick={() => completeConsultation(doctor.doctorId || doctor.doctorCode)}
                        title="Mark consultation finished and log analytics"
                      >
                        <i className="fa-solid fa-circle-check"></i>
                        <span>Complete (✅)</span>
                      </button>

                      <button
                        type="button"
                        className="btn-skip-consultation"
                        onClick={() => skipPatient(inConsultation.appointmentId || inConsultation.id)}
                        title="Move to tail of current batch"
                      >
                        <i className="fa-solid fa-forward-step"></i>
                        <span>Skip (⏭️)</span>
                      </button>

                      <button
                        type="button"
                        className="btn-noshow-consultation"
                        onClick={() => markNoShow(inConsultation.appointmentId || inConsultation.id)}
                        title="Mark as absent / no show"
                      >
                        <i className="fa-solid fa-user-xmark"></i>
                        <span>No-Show (❌)</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-call-next-primary"
                      onClick={() => callNext(doctor.doctorId || doctor.doctorCode)}
                      disabled={waitingPatients.length === 0}
                    >
                      <i className="fa-solid fa-bell"></i>
                      <span>Call Next Patient ({waitingPatients.length} waiting)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2: Next in Line Waiting Patients */}
              <div className="doc-panel-card">
                <div className="doc-card-header">
                  <span className="sm-title">NEXT IN LINE (WAITING QUEUE)</span>
                  <span className="doc-counter font-mono">{waitingPatients.length} Waiting</span>
                </div>

                <div className="doc-card-body">
                  {waitingPatients.length === 0 ? (
                    <div className="empty-waiting-queue">
                      <i className="fa-regular fa-calendar-check"></i>
                      <p>All waiting queue slots for Dr. {doctor.name} have been served or are empty.</p>
                    </div>
                  ) : (
                    <div className="waiting-patient-list">
                      {waitingPatients.map((pat, idx) => (
                        <div key={pat.appointmentId || pat.id} className="waiting-patient-item">
                          <div className="waiting-rank-col font-mono">
                            <span className="rank-num">#{idx + 1}</span>
                            <span className="slot-sub">Slot {pat.slotNumber}</span>
                          </div>
                          <div className="waiting-info-col">
                            <span className="waiting-name">{pat.patientName}</span>
                            <span className="waiting-meta font-mono">
                              {pat.patientPhone} • Batch: {pat.batchId === 'b2' ? 'Evening' : 'Morning'}
                            </span>
                          </div>
                          <div className="waiting-action-col">
                            {pat.priorityCategory && pat.priorityCategory !== 'none' ? (
                              <span className="priority-mini-pill font-mono">
                                {pat.priorityCategory.toUpperCase()}
                              </span>
                            ) : (
                              <span className="standard-mini-pill font-mono">STANDARD</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="doc-card-footer">
                  <span className="waiting-footer-note font-mono">
                    <i className="fa-solid fa-clock-rotate-left"></i> Real-time priority shift active in Firestore
                  </span>
                </div>
              </div>

            </section>
          </>
        )}

        {/* Tab 2: Cured / Completed History */}
        {activeTab === 'history' && (
          <section className="cured-history-section" style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Completed Consultation Records
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                  Patients successfully examined and treated by Dr. {doctor.name}
                </p>
              </div>
              <span className="font-mono text-green" style={{ fontSize: '14px', fontWeight: 700 }}>
                Total Cured: {completedPatients.length} Patients
              </span>
            </div>

            {completedPatients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                <i className="fa-solid fa-file-medical" style={{ fontSize: '40px', marginBottom: '12px', display: 'block' }}></i>
                <h4>No completed consultations logged yet today.</h4>
                <p style={{ fontSize: '13px' }}>Mark patients as completed from the live queue to record examination history.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Patient Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Contact</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Batch & Slot</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Priority Tier</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Completed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedPatients.map(pat => {
                      const endTime = pat.consultationEndTime?.toDate
                        ? pat.consultationEndTime.toDate().toLocaleTimeString()
                        : 'Recently';
                      return (
                        <tr key={pat.appointmentId || pat.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B' }}>
                            {pat.patientName}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748B' }}>
                            {pat.patientPhone || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                            Slot {pat.slotNumber} ({pat.batchId === 'b2' ? 'Evening' : 'Morning'})
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: pat.priorityCategory && pat.priorityCategory !== 'none' ? '#FEF3C7' : '#F1F5F9',
                              color: pat.priorityCategory && pat.priorityCategory !== 'none' ? '#B45309' : '#64748B'
                            }}>
                              {pat.priorityCategory?.toUpperCase() || 'NONE'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-circle-check"></i> Completed
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748B', fontFamily: 'monospace' }}>
                            {endTime}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
