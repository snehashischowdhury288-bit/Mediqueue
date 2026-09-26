import React, { useState } from 'react';

export default function AdminDashboard({ onExit, db, onOpenDoctorRegistration }) {
  const [patientFilter, setPatientFilter] = useState('all'); // 'all' | 'waiting' | 'in_consultation' | 'completed'
  const [purgeConfirm, setPurgeConfirm] = useState(false);

  const { doctors, appointments, analyticsLogs, purgeAllData, getAdminTelemetry } = db;
  const telemetry = getAdminTelemetry();

  const handlePurge = async () => {
    await purgeAllData();
    setPurgeConfirm(false);
  };

  const hasNoData = telemetry.isEmpty;

  // Filtered patients for the registered patients table
  const filteredPatients = appointments.filter(a => {
    if (patientFilter === 'all') return true;
    return a.status === patientFilter;
  });

  return (
    <main className="page-viewport">
      <div className="portal-main-container">

        {/* Admin Top Banner */}
        <section className="admin-banner-overview">
          <div className="admin-hero-left">
            <div className="admin-badge-avatar">
              <i className="fa-solid fa-hospital-user"></i>
            </div>
            <div className="admin-title-group">
              <div className="admin-credential-line">
                <h1 className="admin-main-name">Hospital Administrative Overview</h1>
                <span className="admin-status-badge font-mono">
                  <span className="pulse-dot-green"></span> OPD CENTRAL TELEMETRY
                </span>
              </div>
              <div className="admin-sub-line">
                Real-time throughput, active clinicians registry & patient queue monitoring synchronized with Cloud Firestore
              </div>
            </div>
          </div>

          <div className="admin-hero-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={onOpenDoctorRegistration}
              style={{ padding: '8px 14px', fontSize: '13px' }}
            >
              <i className="fa-solid fa-user-plus"></i>
              <span>Onboard Doctor</span>
            </button>

            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => setPurgeConfirm(true)}
              style={{ color: '#EF4444', borderColor: '#FCA5A5', padding: '8px 14px', fontSize: '13px' }}
              title="Reset Firestore collections"
            >
              <i className="fa-solid fa-trash-can"></i>
              <span>Purge Firestore</span>
            </button>

            <button type="button" className="btn-secondary-action" onClick={onExit} style={{ padding: '8px 14px', fontSize: '13px' }}>
              <i className="fa-solid fa-arrow-left"></i>
              <span>Exit Admin Portal</span>
            </button>
          </div>
        </section>

        {/* Empty State Banner When Zero Records */}
        {hasNoData && (
          <section
            style={{
              background: '#FFFFFF',
              border: '1.5px dashed #CBD5E1',
              borderRadius: '20px',
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', color: '#64748B' }}>
                <i className="fa-solid fa-circle-info"></i>
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', marginBottom: '2px' }}>
                  Clean Database State (Zero Fake Presets)
                </h4>
                <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0, fontWeight: 600 }}>
                  {telemetry.emptyMessage}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary-action"
              style={{ padding: '8px 16px', fontSize: '13px' }}
              onClick={onOpenDoctorRegistration}
            >
              <i className="fa-solid fa-plus"></i> Onboard First Clinician
            </button>
          </section>
        )}

        {/* Real-Time Analytics Cards Grid */}
        <section className="admin-analytics-grid">

          {/* Card 1: Total Queue Length */}
          <div className="admin-metric-card">
            <div className="admin-card-header">
              <div className="metric-icon-bubble blue">
                <i className="fa-solid fa-users-line"></i>
              </div>
              <span className="metric-label font-mono">TOTAL WAITING QUEUE</span>
            </div>
            <div className="admin-metric-number font-mono">
              {telemetry.totalQueueLength}
            </div>
            <div className="admin-metric-sub">
              Active waiting patients across all OPD departments
            </div>
            <div className="admin-breakdown-list" style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748B' }}>
                <span>In-Consultation Now:</span>
                <strong className="font-mono text-blue">{telemetry.registeredPatientsSummary?.inConsultation || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748B', marginTop: '4px' }}>
                <span>Completed Consultations:</span>
                <strong className="font-mono text-green">{telemetry.registeredPatientsSummary?.completed || 0}</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Average Wait Time */}
          <div className="admin-metric-card">
            <div className="admin-card-header">
              <div className="metric-icon-bubble amber">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <span className="metric-label font-mono">AVERAGE WAIT TIME</span>
            </div>
            <div className="admin-metric-number font-mono">
              {telemetry.overallAvgWait} mins
            </div>
            <div className="admin-metric-sub">
              Calculated dynamically from completed consultation logs in Firestore
            </div>
            <div className="admin-dept-waits">
              {telemetry.departmentsSummary.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '12.5px', padding: '8px 0' }}>
                  No active department logs.
                </div>
              ) : (
                telemetry.departmentsSummary.map(dept => (
                  <div key={dept.department} className="dept-wait-chip">
                    <span>{dept.department}</span>
                    <strong className="font-mono text-amber">
                      ~{dept.avgWaitMinutes}m
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 3: Patient Load Distribution */}
          <div className="admin-metric-card highlight-card">
            <div className="admin-card-header">
              <div className="metric-icon-bubble green">
                <i className="fa-solid fa-chart-pie"></i>
              </div>
              <span className="metric-label font-mono">PATIENT LOAD DISTRIBUTION</span>
            </div>
            <div className="admin-metric-sub" style={{ marginTop: '6px' }}>
              Real percentage distribution across active departments: (Active / Total) * 100
            </div>
            <div className="admin-load-bars-container" style={{ marginTop: '14px' }}>
              {telemetry.departmentsSummary.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '12.5px', padding: '12px 0' }}>
                  Zero active queue traffic across departments.
                </div>
              ) : (
                telemetry.departmentsSummary.map(dept => (
                  <div key={dept.department} className="load-bar-item">
                    <div className="load-bar-meta">
                      <span className="load-bar-title">
                        <i className="fa-solid fa-stethoscope" style={{ marginRight: '6px', color: '#3E69FE' }}></i>
                        {dept.department}
                      </span>
                      <span className="load-bar-val font-mono">
                        {dept.activeWaitingCount} Patients ({dept.loadPercentage}%)
                      </span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${Math.max(5, dept.loadPercentage)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

        {/* 1. Active Doctors Registry */}
        <section style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', border: '1px solid #E2E8F0', marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Active Doctors Registry ({doctors.length} Registered Clinicians)
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                Real-time clinical roster with live consultation status and waiting queues
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={onOpenDoctorRegistration}
              style={{ padding: '6px 14px', fontSize: '12.5px' }}
            >
              <i className="fa-solid fa-user-plus"></i> Add Clinician
            </button>
          </div>

          {doctors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
              <i className="fa-solid fa-user-doctor" style={{ fontSize: '32px', marginBottom: '8px', display: 'block' }}></i>
              <p>No doctors registered in Firestore yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Clinician Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Doctor Code</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Department</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>In Examination</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Waiting Queue</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.doctorsSummary.map(doc => (
                    <tr key={doc.doctorId || doc.doctorCode} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B' }}>
                        {doc.name}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#3E69FE' }}>
                        {doc.doctorCode}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {doc.department}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: doc.isAvailable !== false ? '#DCFCE7' : '#F1F5F9',
                          color: doc.isAvailable !== false ? '#15803D' : '#64748B'
                        }}>
                          {doc.isAvailable !== false ? 'ON DUTY' : 'OFFLINE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: doc.inConsultation ? '#1E293B' : '#94A3B8', fontWeight: doc.inConsultation ? 600 : 400 }}>
                        {doc.inConsultation ? (
                          <span><i className="fa-solid fa-user text-green"></i> {doc.inConsultation}</span>
                        ) : 'Idle'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                        {doc.waitingCount} Waiting
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 2. All Registered Patients Table */}
        <section style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', border: '1px solid #E2E8F0', marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                All Registered Patients ({appointments.length} Total Appointments)
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                Complete audit of waiting, in-consultation, and completed OPD patients
              </p>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'all', label: `All (${appointments.length})` },
                { id: 'waiting', label: `Waiting (${telemetry.registeredPatientsSummary?.waiting || 0})` },
                { id: 'in_consultation', label: `In Room (${telemetry.registeredPatientsSummary?.inConsultation || 0})` },
                { id: 'completed', label: `Completed (${telemetry.registeredPatientsSummary?.completed || 0})` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPatientFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: '1px solid #CBD5E1',
                    background: patientFilter === f.id ? '#3E69FE' : '#FFFFFF',
                    color: patientFilter === f.id ? '#FFFFFF' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
              <i className="fa-solid fa-hospital-user" style={{ fontSize: '32px', marginBottom: '8px', display: 'block' }}></i>
              <p>No patient records found under this filter.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Patient Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Phone / Email</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Clinician & Dept</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Batch & Slot</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Priority Tier</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(pat => (
                    <tr key={pat.appointmentId || pat.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B' }}>
                        {pat.patientName}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12.5px' }}>
                        {pat.patientPhone || pat.patientEmail || 'N/A'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600, color: '#1E293B', display: 'block' }}>{pat.department}</span>
                        <span className="font-mono text-blue" style={{ fontSize: '11px' }}>{pat.doctorCode}</span>
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
                          {pat.priorityCategory?.toUpperCase() || 'STANDARD'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`status-pill ${pat.status}`}>
                          {pat.status === 'in_consultation' ? 'In Consultation' : pat.status === 'completed' ? 'Completed' : 'Waiting'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Confirmation Modal for Database Purge */}
        {purgeConfirm && (
          <div className="modal-backdrop">
            <div className="dialog-box" style={{ maxWidth: '440px' }}>
              <div className="dialog-header">
                <h3 className="dialog-title text-red">
                  <i className="fa-solid fa-triangle-exclamation"></i> Purge Cloud Firestore
                </h3>
                <button type="button" className="btn-close-dialog" onClick={() => setPurgeConfirm(false)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="dialog-body">
                <p style={{ fontSize: '14px', color: '#1E293B', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete all documents in <strong>doctors</strong>, <strong>appointments</strong>, and <strong>analytics_logs</strong>?
                </p>
                <p style={{ fontSize: '13px', color: '#64748B' }}>
                  This will reset all hospital OPD queues and telemetry metrics to empty state.
                </p>
              </div>
              <div className="dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary-action" onClick={() => setPurgeConfirm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  style={{ background: '#EF4444', borderColor: '#EF4444' }}
                  onClick={handlePurge}
                >
                  Confirm Full Purge
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
