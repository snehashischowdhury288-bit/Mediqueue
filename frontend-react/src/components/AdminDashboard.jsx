import React, { useState } from 'react';

export default function AdminDashboard({ onExit, db, onOpenDoctorRegistration }) {
  const [purgeConfirm, setPurgeConfirm] = useState(false);

  const { doctors, appointments, analyticsHistory, purgeAllData, getAdminTelemetry } = db;
  const telemetry = getAdminTelemetry();

  const handlePurge = () => {
    purgeAllData();
    setPurgeConfirm(false);
  };

  const hasNoData = telemetry.isEmpty;

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
                Real-time throughput, multi-department queue lengths, and clinical load distribution derived from localStorage
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
              <span>Add Doctor</span>
            </button>

            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => setPurgeConfirm(true)}
              style={{ color: '#EF4444', borderColor: '#FCA5A5', padding: '8px 14px', fontSize: '13px' }}
              title="Reset all localStorage data structures to zero"
            >
              <i className="fa-solid fa-trash-can"></i>
              <span>Purge All Data</span>
            </button>

            <button type="button" className="btn-secondary-action" onClick={onExit} style={{ padding: '8px 14px', fontSize: '13px' }}>
              <i className="fa-solid fa-arrow-left"></i>
              <span>Exit Admin View</span>
            </button>
          </div>
        </section>

        {/* Phase 1 Requirement 3: Empty State Banner When Zero Records */}
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

        {/* Real-Time Analytics Cards Grid (Phase 3 Requirement 4) */}
        <section className="admin-analytics-grid">

          {/* Card 1: Total Queue Length */}
          <div className="admin-metric-card">
            <div className="admin-card-header">
              <div className="metric-icon-bubble blue">
                <i className="fa-solid fa-users-line"></i>
              </div>
              <span className="metric-label font-mono">TOTAL QUEUE LENGTH</span>
            </div>
            <div className="admin-metric-number font-mono">
              {telemetry.totalQueueLength}
            </div>
            <div className="admin-metric-sub">
              Active waiting patients across all OPD departments
            </div>
            <div className="admin-breakdown-list">
              {telemetry.doctorsSummary.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '12.5px', padding: '8px 0' }}>
                  No doctors registered yet.
                </div>
              ) : (
                telemetry.doctorsSummary.map(doc => (
                  <div key={doc.doctorId} className="admin-doctor-row">
                    <span className="admin-doc-info">
                      <strong>{doc.name}</strong> <small style={{ color: '#64748B' }}>({doc.doctorCode})</small>
                    </span>
                    <span className="admin-doc-count font-mono">{doc.waitingCount} waiting</span>
                  </div>
                ))
              )}
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
              Calculated dynamically from completed consultation logs in mediqueue_analytics_history
            </div>
            <div className="admin-dept-waits">
              {telemetry.departmentsSummary.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: '12.5px', padding: '8px 0' }}>
                  No active department traffic.
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
                    <div className="load-bar-track">
                      <div
                        className="load-bar-fill"
                        style={{
                          width: `${Math.max(dept.loadPercentage, dept.activeWaitingCount > 0 ? 8 : 0)}%`,
                          background: '#3E69FE'
                        }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

        {/* Departmental OPD Telemetry & Specialist Roster Table */}
        <section className="admin-table-section">
          <div className="section-header-row">
            <div>
              <h3 className="sec-title">Departmental OPD Telemetry & Specialist Roster</h3>
              <p className="sec-sub">Live monitoring derived directly from localStorage collections</p>
            </div>
            <span className="badge-live-stream font-mono">
              <span className="pulse-dot-green"></span> LIVE CLINIC MONITOR
            </span>
          </div>

          <div className="queue-table-wrapper">
            <table className="roster-table admin-table">
              <thead>
                <tr>
                  <th>DEPARTMENT</th>
                  <th>SPECIALIST PRACTITIONER</th>
                  <th>CODE</th>
                  <th>ACTIVE QUEUE</th>
                  <th>IN CONSULTATION</th>
                  <th>AVG WAIT</th>
                  <th>LOAD STATUS</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.doctorsSummary.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#94A3B8', padding: '32px' }}>
                      No doctors currently registered in mediqueue_doctors.
                    </td>
                  </tr>
                ) : (
                  telemetry.doctorsSummary.map(doc => {
                    let statusLabel = 'Optimal';
                    let statusClass = 'waiting';

                    if (doc.waitingCount >= 4) {
                      statusLabel = 'High Congestion';
                      statusClass = 'noshow';
                    } else if (doc.waitingCount >= 2) {
                      statusLabel = 'Active Flow';
                      statusClass = 'consulting';
                    } else if (doc.waitingCount === 0) {
                      statusLabel = 'Available';
                      statusClass = 'completed';
                    }

                    return (
                      <tr key={doc.doctorId}>
                        <td>
                          <strong>{doc.department}</strong>
                        </td>
                        <td>
                          <strong>{doc.name}</strong>
                          <br />
                          <small style={{ color: '#64748B' }}>Age {doc.age || 40}</small>
                        </td>
                        <td className="font-mono">
                          <strong className="text-blue">{doc.doctorCode}</strong>
                        </td>
                        <td>
                          <span
                            className="badge-status waiting font-mono"
                            style={{ fontSize: '13px', fontWeight: 700 }}
                          >
                            {doc.waitingCount} waiting
                          </span>
                        </td>
                        <td>
                          {doc.inConsultation ? (
                            <span className="badge-status consulting">
                              <i className="fa-solid fa-stethoscope"></i> {doc.inConsultation}
                            </span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                              Available (Ready)
                            </span>
                          )}
                        </td>
                        <td className="font-mono">
                          <strong>{doc.avgWaitMinutes} mins</strong>
                        </td>
                        <td>
                          <span className={`badge-status ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal: Confirm Purge */}
        {purgeConfirm && (
          <div className="modal-backdrop">
            <div className="dialog-box" style={{ maxWidth: '440px' }}>
              <div className="dialog-header">
                <h3 className="dialog-title" style={{ color: '#EF4444' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i> Purge All LocalStorage Collections?
                </h3>
                <button
                  type="button"
                  className="btn-close-dialog"
                  onClick={() => setPurgeConfirm(false)}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="dialog-body">
                <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.5 }}>
                  This will immediately reset all data structures to empty arrays:
                </p>
                <ul style={{ fontSize: '13px', color: '#1E293B', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><code>mediqueue_doctors</code> → <code>[]</code></li>
                  <li><code>mediqueue_appointments</code> → <code>[]</code></li>
                  <li><code>mediqueue_analytics_history</code> → <code>[]</code></li>
                </ul>
              </div>
              <div className="dialog-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setPurgeConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  style={{ background: '#EF4444' }}
                  onClick={handlePurge}
                >
                  Confirm Purge
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
