import React, { useState, useEffect } from 'react';

export default function DoctorPortal({ doctor, doctors, onSelectDoctor, db, onOpenDoctorRegistration }) {
  const [timerSeconds, setTimerSeconds] = useState(0);

  const { appointments, callNext, completeConsultation, skipPatient, markNoShow } = db;

  // Filter strictly by the logged-in doctor's doctorCode where status === "waiting" or status === "in_consultation"
  const currentDocCode = doctor?.doctorCode?.toUpperCase() || '';
  const activeQueue = appointments
    .filter(
      a => a.doctorCode?.toUpperCase() === currentDocCode &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    )
    .sort((a, b) => {
      if (a.batchId !== b.batchId) return a.batchId.localeCompare(b.batchId);
      return a.slotNumber - b.slotNumber;
    });

  const inConsultation = activeQueue.find(a => a.status === 'in_consultation');
  const waitingPatients = activeQueue.filter(a => a.status === 'waiting');

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

  // If no doctor selected or directory is empty
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
                <span className="doc-active-badge font-mono">
                  <span className="pulse-dot-green"></span> CLINIC ACTIVE
                </span>
              </div>
              <div className="doc-sub-line">
                {doctor.department} • Code: <strong className="font-mono text-blue">{doctor.doctorCode}</strong> • Age {doctor.age || 42}
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
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              <i className="fa-solid fa-user-plus"></i> Add Doctor
            </button>

            <div className="doc-quick-stat">
              <span className="stat-label font-mono">SCHEDULED IN QUEUE</span>
              <span className="stat-num font-mono">{activeQueue.length}</span>
            </div>
            <div className="doc-quick-stat">
              <span className="stat-label font-mono">CURRENT BATCH</span>
              <span className="stat-num font-mono" style={{ fontSize: '15px' }}>
                {activeBatchName}
              </span>
            </div>
          </div>
        </section>

        {/* Active Patient In-Consultation Card with 4 Actions (Phase 3 Requirement 2) */}
        <section className="active-consultation-section">
          <div className="active-patient-card">
            <div className="ap-header">
              <div className="ap-badge-group">
                <span className="badge-in-room font-mono">
                  <span className="pulse-dot-green"></span> ACTIVE IN CONSULTING ROOM
                </span>
                <span className="badge-room-timer font-mono">
                  <i className="fa-regular fa-clock"></i> {formatTimer(timerSeconds)}
                </span>
              </div>
              <span className="ap-slot-chip font-mono">
                {inConsultation ? `Slot ${inConsultation.slotNumber} • ${inConsultation.batchId === 'b2' ? 'Evening' : 'Morning'}` : 'Slot --'}
              </span>
            </div>

            <div className="ap-body">
              <div className="ap-avatar-circle">
                <i className="fa-solid fa-user-injured"></i>
              </div>
              <div className="ap-info-col">
                <h2 className="ap-patient-name">
                  {inConsultation ? inConsultation.patientName : 'No Patient in Consultation'}
                </h2>
                <div className="ap-demographics font-mono">
                  {inConsultation
                    ? `Age ${inConsultation.patientAge} • Priority: ${inConsultation.priorityCategory.toUpperCase()} • Phone: ${inConsultation.patientPhone}`
                    : 'Queue is waiting. Use Call Next to activate the next patient.'}
                </div>
              </div>
            </div>

            {/* Doctor 4 Control Buttons */}
            <div className="ap-action-bar">
              {/* 1. Call Next */}
              <button
                type="button"
                className="btn-doc-control call"
                onClick={() => {
                  callNext(doctor.doctorCode);
                  setTimerSeconds(0);
                }}
                disabled={waitingPatients.length === 0}
                title="Activates and highlights the next patient in line"
              >
                <i className="fa-solid fa-bullhorn"></i>
                <span>Call Next</span>
              </button>

              {/* 2. Consultation Complete (✅) */}
              <button
                type="button"
                className="btn-doc-control done"
                onClick={() => {
                  completeConsultation(doctor.doctorCode);
                  setTimerSeconds(0);
                }}
                disabled={!inConsultation}
                title="Marks consultation finished, calculates duration, pushes to analytics, and advances queue"
              >
                <i className="fa-solid fa-circle-check"></i>
                <span>Complete (✅)</span>
              </button>

              {/* 3. Skip (⏭️) */}
              <button
                type="button"
                className="btn-doc-control skip"
                onClick={() => {
                  if (inConsultation) {
                    skipPatient(inConsultation.appointmentId);
                    setTimerSeconds(0);
                  }
                }}
                disabled={!inConsultation}
                title="Moves current patient to the bottom of the batch"
              >
                <i className="fa-solid fa-forward-step"></i>
                <span>Skip (⏭️)</span>
              </button>

              {/* 4. Mark No-Show (❌) */}
              <button
                type="button"
                className="btn-doc-control noshow"
                onClick={() => {
                  if (inConsultation) {
                    markNoShow(inConsultation.appointmentId);
                    setTimerSeconds(0);
                  }
                }}
                disabled={!inConsultation}
                title="Flags appointment as No-Show and removes from live queue"
              >
                <i className="fa-solid fa-circle-xmark"></i>
                <span>No-Show (❌)</span>
              </button>
            </div>
          </div>
        </section>

        {/* Doctor Queue Table with Phase 1 Requirement 3 Empty State */}
        <section className="queue-roster-section">
          <div className="section-header-row">
            <div>
              <h3 className="sec-title">Live Consulting Queue</h3>
              <p className="sec-sub">Patients for Dr. {doctor.name} ({doctor.doctorCode}) via dynamic localStorage synchronization</p>
            </div>
            <span className="badge-live-stream font-mono">
              <span className="pulse-dot-green"></span> {waitingPatients.length} WAITING
            </span>
          </div>

          <div className="queue-table-wrapper">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>SLOT / BATCH</th>
                  <th>PATIENT NAME</th>
                  <th>AGE</th>
                  <th>PHONE</th>
                  <th>PRIORITY</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {activeQueue.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#94A3B8', padding: '36px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#64748B' }}>
                        No patients waiting in current batch.
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '4px' }}>
                        When patients book using doctor code <strong>{doctor.doctorCode}</strong>, they will instantly appear here.
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeQueue.map(apt => {
                    const isConsulting = apt.status === 'in_consultation';
                    return (
                      <tr
                        key={apt.appointmentId}
                        style={isConsulting ? { backgroundColor: 'rgba(62, 105, 254, 0.05)' } : {}}
                      >
                        <td className="font-mono">
                          <strong>Slot {apt.slotNumber}</strong>
                          <br />
                          <small style={{ color: '#64748B' }}>{apt.batchId === 'b2' ? 'Evening Batch' : 'Morning Batch'}</small>
                        </td>
                        <td>
                          <strong>{apt.patientName}</strong>
                        </td>
                        <td>{apt.patientAge}</td>
                        <td className="font-mono">{apt.patientPhone}</td>
                        <td>
                          <span className={`badge-priority ${apt.priorityCategory}`}>
                            {apt.priorityCategory.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge-status ${
                              isConsulting ? 'consulting' : apt.status === 'completed' ? 'completed' : 'waiting'
                            }`}
                          >
                            {isConsulting ? 'In-Consultation' : 'WAITING'}
                          </span>
                        </td>
                        <td>
                          <div className="doctor-row-actions">
                            {isConsulting ? (
                              <>
                                <button
                                  type="button"
                                  className="row-mini-btn done"
                                  onClick={() => completeConsultation(doctor.doctorCode)}
                                  title="Complete consultation and log analytics"
                                >
                                  <i className="fa-solid fa-check"></i> Done (✅)
                                </button>
                                <button
                                  type="button"
                                  className="row-mini-btn skip"
                                  onClick={() => skipPatient(apt.appointmentId)}
                                  title="Skip to batch end"
                                >
                                  <i className="fa-solid fa-forward-step"></i> Skip
                                </button>
                                <button
                                  type="button"
                                  className="row-mini-btn noshow"
                                  onClick={() => markNoShow(apt.appointmentId)}
                                  title="Flag No-Show"
                                >
                                  <i className="fa-solid fa-circle-xmark"></i> No-Show
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="row-mini-btn call"
                                  onClick={() => callNext(doctor.doctorCode)}
                                  title="Call into consultation suite"
                                >
                                  <i className="fa-solid fa-bullhorn"></i> Call
                                </button>
                                <button
                                  type="button"
                                  className="row-mini-btn skip"
                                  onClick={() => skipPatient(apt.appointmentId)}
                                  title="Skip to batch end"
                                >
                                  <i className="fa-solid fa-forward-step"></i> Skip
                                </button>
                                <button
                                  type="button"
                                  className="row-mini-btn noshow"
                                  onClick={() => markNoShow(apt.appointmentId)}
                                  title="Flag No-Show"
                                >
                                  <i className="fa-solid fa-circle-xmark"></i> No-Show
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}
