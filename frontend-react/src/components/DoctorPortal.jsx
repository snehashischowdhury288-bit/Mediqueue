import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calculateDoctorConsultationPace } from '../hooks/useWaitTimePrediction';
import { sendAutomatedPresetEmail } from '../services/emailService';
import EmailConfigModal from './EmailConfigModal';

const WEB3FORMS_ACCESS_KEY = '7cbd2b0b-6fba-43be-993c-471ab95e28a4';

export default function DoctorPortal({ doctor, doctors, onSelectDoctor, db, user }) {
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'history'
  const [selectedBatchId, setSelectedBatchId] = useState('b1'); // 'b1' (Morning) | 'b2' (Evening)
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [emailAlertBanner, setEmailAlertBanner] = useState(null);
  const [manualAlertToast, setManualAlertToast] = useState(null);
  const [isSendingManualAlert, setIsSendingManualAlert] = useState(false);
  const [manualAlertSentSet, setManualAlertSentSet] = useState(new Set());
  const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(false);
  const sentAlertsRef = useRef(new Set());

  const { appointments, callNext, completeConsultation, skipPatient, markNoShow, markNotificationSent, triggerUrgentNextAlert } = db;

  // Resolve active doctor strictly prioritizing real logged-in clinician credentials
  const activeDoctor = doctor || (
    user && user.role === 'doctor' ? {
      doctorId: user.uid,
      name: user.name || 'Doctor',
      email: user.email || '',
      doctorCode: user.doctorCode || 'DOC-288',
      department: user.department || 'Cardiology',
      age: user.age || 42,
      isAvailable: true
    } : (doctors && doctors[0])
  );

  // Filter strictly by the logged-in doctor's doctorId or doctorCode
  const currentDocCode = activeDoctor?.doctorCode?.toUpperCase() || '';
  const currentDocId = activeDoctor?.doctorId || activeDoctor?.uid || '';

  // All active appointments for this doctor (waiting or in_consultation)
  const allActiveDoctorApts = appointments
    .filter(
      a => (a.doctorId === currentDocId || a.doctorCode?.toUpperCase() === currentDocCode) &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    )
    .sort((a, b) => {
      if (a.batchId !== b.batchId) return (a.batchId || 'b1').localeCompare(b.batchId || 'b1');
      return (a.slotNumber || 0) - (b.slotNumber || 0);
    });

  // Current patient in consultation across any batch
  const inConsultation = allActiveDoctorApts.find(a => a.status === 'in_consultation');

  // If in consultation, automatically align selected batch to current consulting batch
  useEffect(() => {
    if (inConsultation?.batchId) {
      setSelectedBatchId(inConsultation.batchId);
    }
  }, [inConsultation?.batchId]);

  // Appointments in the currently selected batch
  const batchAppointments = allActiveDoctorApts.filter(
    a => (a.batchId || 'b1') === selectedBatchId
  );

  const waitingPatients = allActiveDoctorApts.filter(a => a.status === 'waiting');
  const batchWaitingPatients = batchAppointments.filter(a => a.status === 'waiting');

  // Upcoming waiting patients for this doctor in current batch or sequence
  const currentBatchId = inConsultation?.batchId || selectedBatchId || 'b1';

  const waitingBatchPatients = allActiveDoctorApts
    .filter(a => a.status === 'waiting' && (a.batchId || 'b1') === currentBatchId)
    .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

  // The patient immediately following the currently active patient in the batch queue (e.g. Slot #2 if Slot #1 is seen)
  const nextPatientInLine = waitingBatchPatients[0] || waitingPatients[0] || null;
  const nextPatientEmail = (nextPatientInLine?.patientEmail || '').trim();
  const hasNextPatientEmail = Boolean(nextPatientEmail && nextPatientEmail.includes('@'));
  const nextPatientKey = nextPatientInLine ? (nextPatientInLine.id || nextPatientInLine.appointmentId) : null;
  const isAlertSent = Boolean(nextPatientKey && manualAlertSentSet.has(nextPatientKey));
  const canAlertNext = Boolean(inConsultation && nextPatientInLine && hasNextPatientEmail);

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

  // Dynamic Consultation Pace Model trained on historical data
  const paceData = calculateDoctorConsultationPace({
    doctorId: currentDocId,
    doctorCode: currentDocCode,
    historicalConsultations: db.historicalConsultations || [],
    appointments,
    analyticsLogs: db.analyticsLogs || []
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

  // =========================================================================
  // AUTOMATED "3 TURNS AWAY" WEB3FORMS NOTIFICATION WORKFLOW
  // Access Key: 7cbd2b0b-6fba-43be-993c-471ab95e28a4
  // Endpoint: https://api.web3forms.com/submit
  // Trigger: Evaluated dynamically whenever a consultation completes or advances
  // =========================================================================

  const sendThreeTurnsEmail = useCallback(async (patient, clinicianName) => {
    if (!patient) return false;
    const patientEmail = (patient.patientEmail || '').trim();
    if (!patientEmail || !patientEmail.includes('@')) {
      console.warn('[EmailService] Cannot send 3-turns alert: patient email missing or invalid:', patient);
      return false;
    }

    const aptId = patient.id || patient.appointmentId;
    if (patient.notificationSent || sentAlertsRef.current.has(aptId)) {
      return false;
    }

    // Immediately record locally to prevent race condition or duplicate bursts
    sentAlertsRef.current.add(aptId);

    const docDisplayName = clinicianName || activeDoctor?.name || 'your Clinician';
    const patientDisplayName = patient.patientName || 'Patient';

    console.log(`[EmailService] Dispatching automated preset 3-turns alert to ${patientEmail} for ${patientDisplayName}...`);

    try {
      const result = await sendAutomatedPresetEmail({
        alertType: 'three_turns',
        patientName: patientDisplayName,
        patientEmail: patientEmail,
        slotNumber: patient.slotNumber,
        doctorName: docDisplayName,
        doctorEmail: activeDoctor?.email,
        roomNumber: activeDoctor?.room || 'Consultation Suite'
      });

      // Persist notificationSent flag to Firestore to prevent duplicate alerts
      if (markNotificationSent) {
        await markNotificationSent(aptId);
      }

      // Visual confirmation banner on Doctor Portal
      setEmailAlertBanner({
        patientName: patientDisplayName,
        email: patientEmail,
        slotNumber: patient.slotNumber,
        provider: result.provider,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      // Auto-hide confirmation banner after 8 seconds
      setTimeout(() => {
        setEmailAlertBanner(curr => (curr?.patientName === patientDisplayName ? null : curr));
      }, 8000);

      return true;
    } catch (err) {
      console.error('[EmailService] Error submitting 3-turns notification:', err);
      if (markNotificationSent) {
        await markNotificationSent(aptId);
      }
      return false;
    }
  }, [activeDoctor?.name, activeDoctor?.email, activeDoctor?.room, markNotificationSent]);

  // Evaluates queue distance and triggers the 3-turns-away alert
  const evaluateThreeTurnsThreshold = useCallback((currentApts, targetBatch) => {
    const bId = targetBatch || selectedBatchId || 'b1';
    const docCode = currentDocCode;
    const docId = currentDocId;

    // Filter appointments for the active clinician and active batch
    const batchList = currentApts
      .filter(
        a => (a.doctorId === docId || a.doctorCode?.toUpperCase() === docCode) &&
             (a.batchId || 'b1') === bId
      )
      .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

    const activeApt = batchList.find(a => a.status === 'in_consultation');
    const waitingApts = batchList.filter(a => a.status === 'waiting');

    if (waitingApts.length === 0) return null;

    // Distance Calculation:
    // If active consultation exists (Turn 1):
    // - waitingApts[0] is Turn 2
    // - waitingApts[1] is Turn 3 (3 turns away!)
    //   e.g. When patient #3 is active, patient #5 (slot 5 - slot 3 === 2, waiting[1]) is 3 turns away!
    // If no active consultation yet (idle suite right after completion):
    // - waitingApts[0] is Turn 1
    // - waitingApts[1] is Turn 2
    // - waitingApts[2] is Turn 3 (3 turns away!)
    let targetPatient = null;
    if (activeApt) {
      targetPatient = waitingApts.find(w => (w.slotNumber - activeApt.slotNumber === 2)) || waitingApts[1];
    } else {
      targetPatient = waitingApts[2];
    }

    if (targetPatient) {
      const aptKey = targetPatient.id || targetPatient.appointmentId;
      if (!targetPatient.notificationSent && !sentAlertsRef.current.has(aptKey)) {
        console.log(`[3-Turns Trigger] Candidate identified: ${targetPatient.patientName} (Slot #${targetPatient.slotNumber})`);
        sendThreeTurnsEmail(targetPatient, activeDoctor?.name);
      }
    }
  }, [currentDocCode, currentDocId, selectedBatchId, sendThreeTurnsEmail, activeDoctor?.name]);

  // Reactive Queue Watcher: Trigger evaluation whenever an appointment status updates to "completed"
  const prevCompletedCount = useRef(completedPatients.length);

  useEffect(() => {
    if (completedPatients.length > prevCompletedCount.current) {
      console.log('[Queue State Event] Completed consultation detected. Evaluating 3-turns threshold...');
      evaluateThreeTurnsThreshold(appointments, selectedBatchId);
    }
    prevCompletedCount.current = completedPatients.length;
  }, [completedPatients.length, appointments, selectedBatchId, evaluateThreeTurnsThreshold]);

  // Action Handlers
  const handleCompleteConsultation = async () => {
    if (!inConsultation) return;
    const batchId = inConsultation.batchId || selectedBatchId || 'b1';

    await completeConsultation(activeDoctor?.doctorId || activeDoctor?.doctorCode);

    // Promptly evaluate upcoming queue distance
    setTimeout(() => {
      evaluateThreeTurnsThreshold(appointments, batchId);
    }, 400);
  };

  const handleCallNext = async () => {
    await callNext(activeDoctor?.doctorId || activeDoctor?.doctorCode);
    setTimeout(() => {
      evaluateThreeTurnsThreshold(appointments, selectedBatchId);
    }, 400);
  };

  // On-demand manual "Alert Next Patient" handler: sends automated preset email in background (zero redirect)
  const handleManualAlertNext = async () => {
    if (!canAlertNext || !nextPatientInLine || isSendingManualAlert || isAlertSent) return;

    setIsSendingManualAlert(true);
    setManualAlertToast(null);

    const targetPatientName = nextPatientInLine.patientName || 'Patient';
    const targetSlotNumber = nextPatientInLine.slotNumber || 2;
    const doctorDisplayName = activeDoctor?.name || 'Doctor';
    const doctorRoom = activeDoctor?.room || 'Consultation Suite';

    console.log(`[EmailService] Triggering manual automated preset alert to next patient: ${nextPatientEmail}...`);

    // 1. Immediately push high-priority in-app alert directly to patient portal in Firestore
    if (triggerUrgentNextAlert && nextPatientKey) {
      await triggerUrgentNextAlert(nextPatientKey, {
        doctorName: doctorDisplayName,
        slotNumber: targetSlotNumber,
        message: `Hello ${targetPatientName}, Dr. ${doctorDisplayName} has begun consultation with the current patient. You are assigned to Slot #${targetSlotNumber} and are directly NEXT in line. Please proceed immediately to the consultation door outside ${doctorRoom} and keep your digital token ready.`,
        triggeredAt: Date.now()
      });
    }

    // 2. Dispatch automated preset email in the background without user redirect
    try {
      const result = await sendAutomatedPresetEmail({
        alertType: 'next_patient',
        patientName: targetPatientName,
        patientEmail: nextPatientEmail,
        slotNumber: targetSlotNumber,
        doctorName: doctorDisplayName,
        doctorEmail: activeDoctor?.email || 'notifications@mediqueue.clinic',
        roomNumber: doctorRoom
      });

      if (result.success) {
        setManualAlertSentSet(prev => new Set([...prev, nextPatientKey]));
        setManualAlertToast({
          type: 'success',
          patientName: targetPatientName,
          email: nextPatientEmail,
          slotNumber: targetSlotNumber,
          provider: result.provider,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          notice: result.isWeb3FormsNotice
            ? 'Dispatched via Web3Forms API. (Tip: Click ⚙️ Email Settings to configure direct EmailJS / your personal key)'
            : `Delivered via ${result.provider} directly to patient inbox.`
        });
      } else {
        setManualAlertToast({
          type: 'error',
          message: `Dispatch notice: ${result.message}`
        });
      }
    } catch (err) {
      console.error('[EmailService] Manual alert network error:', err);
      setManualAlertToast({
        type: 'error',
        message: `Network error: ${err.message}`
      });
    } finally {
      setIsSendingManualAlert(false);
      setTimeout(() => {
        setManualAlertToast(curr => (curr?.type === 'success' ? null : curr));
      }, 10000);
    }
  };

  // Helper to format priority badge
  const renderPriorityBadge = priorityCategory => {
    const cat = (priorityCategory || 'none').toLowerCase();
    if (cat.includes('elderly')) {
      return (
        <span className="priority-badge-chip elderly font-mono">
          <i className="fa-solid fa-person-cane"></i> ELDERLY (60+)
        </span>
      );
    }
    if (cat.includes('pregnant')) {
      return (
        <span className="priority-badge-chip pregnant font-mono">
          <i className="fa-solid fa-person-pregnant"></i> PREGNANT
        </span>
      );
    }
    if (cat.includes('emergency')) {
      return (
        <span className="priority-badge-chip emergency font-mono">
          <i className="fa-solid fa-truck-medical"></i> EMERGENCY
        </span>
      );
    }
    return (
      <span className="priority-badge-chip standard font-mono">
        <i className="fa-solid fa-user"></i> STANDARD
      </span>
    );
  };

  // 5-Slot visual mapping for the active batch
  const fixedSlots = [1, 2, 3, 4, 5];

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

  const batchDisplayName = selectedBatchId === 'b2' ? 'Evening Batch (16:00 - 19:00)' : 'Morning Batch (10:00 - 13:00)';
  const occupiedSlotsCount = batchAppointments.length;
  const occupancyPercent = Math.round((occupiedSlotsCount / 5) * 100);

  return (
    <main className="page-viewport">
      <div className="portal-main-container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 20px' }}>

        {/* Top Doctor Profile Banner */}
        <section className="doctor-banner-overview" style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '24px 28px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                <i className="fa-solid fa-user-doctor"></i>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {activeDoctor?.name?.startsWith('Dr.') ? activeDoctor.name : `Dr. ${activeDoctor?.name || 'Practitioner'}`}
                  </h1>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: '#DCFCE7',
                    color: '#15803D',
                    border: '1px solid #86EFAC'
                  }}>
                    <span className="pulse-dot-green"></span> ON DUTY • CLINIC ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  <span>{activeDoctor?.department || 'General Medicine'}</span> • Code: <strong className="font-mono text-blue">{activeDoctor?.doctorCode}</strong> • {activeDoctor?.email ? <span>{activeDoctor.email} • </span> : ''}Experience: {activeDoctor?.age || 42} Yrs
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {doctors && doctors.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Switch:</span>
                  <select
                    className="doctor-switcher-select"
                    value={activeDoctor?.doctorCode || ''}
                    onChange={e => {
                      const d = doctors.find(doc => doc.doctorCode === e.target.value);
                      if (d) onSelectDoctor(d);
                    }}
                    style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1' }}
                  >
                    {doctors.map(d => (
                      <option key={d.doctorId} value={d.doctorCode}>
                        {d.name} {d.doctorId === user?.uid || (user?.email && d.email === user.email) ? '(You)' : ''} ({d.doctorCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Dynamic Wait-Time Prediction Engine Live Metric Card */}
        <section className="doctor-prediction-metric-banner" style={{
          background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
          border: '1.5px solid #BFDBFE',
          borderRadius: '16px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(62, 105, 254, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#3E69FE',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 10px rgba(62, 105, 254, 0.25)'
            }}>
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-mono" style={{ fontSize: '11px', fontWeight: 800, color: '#3E69FE', letterSpacing: '0.5px' }}>
                  AI WAIT-TIME PREDICTION MODEL
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: paceData.isTrained ? '#DCFCE7' : '#FEF3C7',
                  color: paceData.isTrained ? '#15803D' : '#B45309'
                }}>
                  {paceData.isTrained ? '● Trained Rolling Average' : '○ Initial Baseline (10m)'}
                </span>
              </div>
              <h4 style={{ margin: '3px 0 0', fontSize: '15px', fontWeight: 800, color: '#1E293B' }}>
                Average Consultation Pace: <span className="font-mono text-blue">{paceData.averageConsultationTime} mins/patient</span>{' '}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
                  (Trained on {paceData.completedTodayCount} completed consultation{paceData.completedTodayCount === 1 ? '' : 's'} today)
                </span>
              </h4>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 700, display: 'block' }}>
                TOTAL ESTIMATED QUEUE CLEAR TIME
              </span>
              <strong className="font-mono text-blue" style={{ fontSize: '16px' }}>
                ~{Math.round(waitingPatients.length * paceData.averageConsultationTime)} mins ({waitingPatients.length} Waiting)
              </strong>
            </div>
          </div>
        </section>

        {/* Doctor Portal Tabs: Active Queue vs Cured History */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
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
            <span>Consultation & 5-Slot Batch Queue</span>
            <span style={{ background: activeTab === 'queue' ? 'rgba(255,255,255,0.25)' : '#F1F5F9', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>
              {allActiveDoctorApts.length}
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

        {/* Tab 1: Live Consultation & 5-Slot Batch Suite */}
        {activeTab === 'queue' && (
          <div className="doctor-suite-wrapper">

            {/* ========================================================================= */}
            {/* 1. ACTIVE CONSULTATION SHOWCASE (CLEARLY SEPARATED HERO CARD)            */}
            {/* ========================================================================= */}
            <section className={`consult-hero-card ${inConsultation ? 'is-active-exam' : ''}`}>
              <div className="consult-hero-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {inConsultation ? (
                    <span className="consult-status-badge in-exam">
                      <span className="pulse-dot-green"></span> IN-EXAMINATION • ACTIVE CONSULTATION
                    </span>
                  ) : (
                    <span className="consult-status-badge idle">
                      <i className="fa-solid fa-stethoscope"></i> CONSULTATION SUITE IDLE
                    </span>
                  )}
                  <span className="font-mono" style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                    {inConsultation ? `Slot ${inConsultation.slotNumber} • ${inConsultation.batchId === 'b2' ? 'Evening Batch' : 'Morning Batch'}` : 'Room 102 Ready'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="font-mono text-blue" style={{ fontSize: '12px', fontWeight: 700 }}>
                    <i className="fa-solid fa-bolt"></i> Real-time Cloud Sync
                  </span>
                </div>
              </div>

              {/* Consultation Body */}
              {inConsultation ? (
                <div className="consult-patient-details-grid">
                  <div className="patient-exam-avatar green-theme">
                    {inConsultation.patientName?.charAt(0)?.toUpperCase() || 'P'}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2 className="patient-meta-name">
                        {inConsultation.patientName}
                      </h2>
                      {renderPriorityBadge(inConsultation.priorityCategory)}
                    </div>

                    <div className="patient-meta-subrow" style={{ marginTop: '8px' }}>
                      <span style={{ background: '#F1F5F9', padding: '4px 10px', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'monospace', color: '#334155' }}>
                        <i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i>{inConsultation.patientPhone || 'No Phone'}
                      </span>
                      <span style={{ background: '#F1F5F9', padding: '4px 10px', borderRadius: '8px', fontSize: '12.5px', color: '#334155' }}>
                        Age: <strong>{inConsultation.patientAge || '32'}</strong>
                      </span>
                      <span style={{ background: '#EFF6FF', padding: '4px 10px', borderRadius: '8px', fontSize: '12.5px', color: '#2563EB', fontWeight: 600 }}>
                        <i className="fa-solid fa-hospital-user" style={{ marginRight: '6px' }}></i>Slot #{inConsultation.slotNumber}
                      </span>
                      {inConsultation.patientEmail && (
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          {inConsultation.patientEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stopwatch Timer */}
                  <div className="consult-stopwatch-display">
                    <span className="stopwatch-title">CONSULTATION TIME</span>
                    <div className="stopwatch-time">{formatTimer(timerSeconds)}</div>
                    <small style={{ fontSize: '11px', color: '#64748B' }}>Auto-logging to analytics</small>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '36px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '24px',
                  flexWrap: 'wrap',
                  textAlign: 'left'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#EFF6FF',
                    color: '#3E69FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px'
                  }}>
                    <i className="fa-solid fa-stethoscope"></i>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                      No Patient Currently in Consultation Room
                    </h3>
                    <p style={{ fontSize: '13.5px', color: '#64748B', margin: '4px 0 0' }}>
                      Click <strong>"Call Next Patient"</strong> to summon the next patient according to priority scheduling.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Controls Bar */}
              <div className="exam-actions-row">
                {/* On-Demand "Alert Next Patient" Action Button (In Circled Area) */}
                <button
                  type="button"
                  className={`btn-alert-next-patient ${isAlertSent ? 'sent' : ''}`}
                  onClick={handleManualAlertNext}
                  disabled={!canAlertNext || isSendingManualAlert || isAlertSent}
                  title={
                    !inConsultation
                      ? 'Active consultation must be in progress to alert next patient'
                      : !nextPatientInLine
                      ? 'No upcoming waiting patient in line'
                      : !hasNextPatientEmail
                      ? `Next patient (${nextPatientInLine.patientName}) has no email address registered`
                      : isAlertSent
                      ? `Readiness alert already dispatched to ${nextPatientInLine.patientName}`
                      : `Send immediate readiness notification to ${nextPatientInLine.patientName} (Slot #${nextPatientInLine.slotNumber})`
                  }
                >
                  {isSendingManualAlert ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Sending Alert...</span>
                    </>
                  ) : isAlertSent ? (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>Alert Sent ✓</span>
                    </>
                  ) : (
                    <>
                      <span>📢</span>
                      <span>Alert Next Patient</span>
                      {nextPatientInLine && inConsultation && (
                        <span className="font-mono" style={{
                          fontSize: '11px',
                          background: canAlertNext ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                          padding: '2px 7px',
                          borderRadius: '8px',
                          marginLeft: '4px'
                        }}>
                          Slot #{nextPatientInLine.slotNumber}
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Email Dispatch Settings Button */}
                <button
                  type="button"
                  onClick={() => setIsEmailConfigOpen(true)}
                  title="Configure Email Dispatch Channel (EmailJS / Web3Forms / Resend) & Send Live Test"
                  style={{
                    background: '#F1F5F9',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <i className="fa-solid fa-gear"></i>
                  <span>Email Settings</span>
                </button>

                {inConsultation ? (
                  <>
                    <button
                      type="button"
                      className="btn-complete-exam"
                      onClick={handleCompleteConsultation}
                      title="Mark consultation completed and record cured patient"
                    >
                      <i className="fa-solid fa-circle-check"></i>
                      <span>Complete (✅)</span>
                    </button>

                    <button
                      type="button"
                      className="btn-skip-exam"
                      onClick={() => skipPatient(inConsultation.appointmentId || inConsultation.id)}
                      title="Move patient to tail of the current batch queue"
                    >
                      <i className="fa-solid fa-forward-step"></i>
                      <span>Skip (⏭️)</span>
                    </button>

                    <button
                      type="button"
                      className="btn-noshow-exam"
                      onClick={() => markNoShow(inConsultation.appointmentId || inConsultation.id)}
                      title="Mark patient as absent / no show"
                    >
                      <i className="fa-solid fa-user-xmark"></i>
                      <span>No-Show (❌)</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-call-next-hero"
                    onClick={handleCallNext}
                    disabled={waitingPatients.length === 0}
                  >
                    <i className="fa-solid fa-bell"></i>
                    <span>Call Next Patient ({waitingPatients.length} Waiting in Queue)</span>
                  </button>
                )}
              </div>
            </section>

            {/* Toast Feedback Banner for On-Demand "Alert Next Patient" Web3Forms Alert */}
            {manualAlertToast && (
              <div className="manual-alert-banner" style={{
                background: manualAlertToast.type === 'success'
                  ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)'
                  : 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                border: `1.5px solid ${manualAlertToast.type === 'success' ? '#10B981' : '#EF4444'}`,
                borderRadius: '16px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                boxShadow: `0 4px 14px ${manualAlertToast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                animation: 'fadeInDown 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: manualAlertToast.type === 'success' ? '#10B981' : '#EF4444',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '17px'
                  }}>
                    <i className={manualAlertToast.type === 'success' ? 'fa-solid fa-bullhorn' : 'fa-solid fa-triangle-exclamation'}></i>
                  </div>
                  <div>
                    <div style={{
                      fontWeight: 800,
                      color: manualAlertToast.type === 'success' ? '#065F46' : '#991B1B',
                      fontSize: '14px'
                    }}>
                      {manualAlertToast.type === 'success'
                        ? `Immediate readiness email sent to ${manualAlertToast.patientName} (${manualAlertToast.email})`
                        : 'Error Dispatching Alert Email'}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: manualAlertToast.type === 'success' ? '#047857' : '#B91C1C'
                    }}>
                      {manualAlertToast.type === 'success'
                        ? `Assigned to Slot #${manualAlertToast.slotNumber} • Dispatched at ${manualAlertToast.time}. ${manualAlertToast.notice || ''}`
                        : manualAlertToast.message}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManualAlertToast(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: manualAlertToast.type === 'success' ? '#065F46' : '#991B1B',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                  title="Dismiss notification banner"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}

            {/* Confirmation Banner for Automated 3-Turns-Away Web3Forms Alert */}
            {emailAlertBanner && (
              <div className="email-alert-banner" style={{
                background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                border: '1.5px solid #10B981',
                borderRadius: '16px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.15)',
                animation: 'fadeInDown 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#10B981',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '17px'
                  }}>
                    <i className="fa-solid fa-paper-plane"></i>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#065F46', fontSize: '14px' }}>
                      Automated "3-turns-away" email alert sent to {emailAlertBanner.patientName} (Slot #{emailAlertBanner.slotNumber})
                    </div>
                    <div style={{ fontSize: '12px', color: '#047857' }}>
                      Recipient: <strong>{emailAlertBanner.email}</strong> • Dispatched via Web3Forms Cloud at {emailAlertBanner.time}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailAlertBanner(null)}
                  style={{ background: 'transparent', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '16px' }}
                  title="Dismiss notification banner"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 2. ALL 5 BATCH SLOTS VISUAL GRID (STRUCTURED ROW/GRID LAYOUT)            */}
            {/* ========================================================================= */}
            <section className="slots-container-card">
              <div className="slots-header-bar">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Active Batch Slots
                    </h3>
                    <span style={{
                      background: '#EFF6FF',
                      color: '#2563EB',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      fontFamily: 'monospace'
                    }}>
                      FIXED 5-PATIENT CAPACITY
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                    Visual slot arrangement for <strong>{batchDisplayName}</strong> • {occupiedSlotsCount}/5 Booked ({occupancyPercent}% Load)
                  </p>
                </div>

                {/* Batch Selector Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="batch-toggle-group">
                    <button
                      type="button"
                      className={`batch-toggle-btn ${selectedBatchId === 'b1' ? 'active' : ''}`}
                      onClick={() => setSelectedBatchId('b1')}
                    >
                      <i className="fa-solid fa-sun" style={{ marginRight: '6px' }}></i>
                      Morning Batch
                    </button>
                    <button
                      type="button"
                      className={`batch-toggle-btn ${selectedBatchId === 'b2' ? 'active' : ''}`}
                      onClick={() => setSelectedBatchId('b2')}
                    >
                      <i className="fa-solid fa-moon" style={{ marginRight: '6px' }}></i>
                      Evening Batch
                    </button>
                  </div>
                </div>
              </div>

              {/* The 5 Fixed Appointment Slots Grid */}
              <div className="slots-grid-5-col">
                {fixedSlots.map(slotNum => {
                  const appointmentOnSlot = batchAppointments.find(a => a.slotNumber === slotNum);
                  const isCurrentInExam = appointmentOnSlot && appointmentOnSlot.status === 'in_consultation';
                  const isWaiting = appointmentOnSlot && appointmentOnSlot.status === 'waiting';

                  if (isCurrentInExam) {
                    return (
                      <div key={slotNum} className="slot-spot-card occupied-consulting">
                        <div>
                          <div className="slot-top-row">
                            <span className="slot-tag green font-mono">
                              SLOT {slotNum}
                            </span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              color: '#15803D'
                            }}>
                              <span className="pulse-dot-green" style={{ width: '6px', height: '6px' }}></span> IN EXAM
                            </span>
                          </div>

                          <h4 className="slot-patient-name" title={appointmentOnSlot.patientName}>
                            {appointmentOnSlot.patientName}
                          </h4>
                          <span className="slot-patient-contact">
                            {appointmentOnSlot.patientPhone || 'No Phone'}
                          </span>

                          <div style={{ marginTop: '8px' }}>
                            {renderPriorityBadge(appointmentOnSlot.priorityCategory)}
                          </div>
                        </div>

                        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #BBF7D0' }}>
                          <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa-solid fa-user-check"></i> Examining in Suite
                          </span>
                        </div>
                      </div>
                    );
                  }

                  if (isWaiting) {
                    const isPriorityPatient = ['elderly', 'pregnant', 'emergency'].some(cat =>
                      (appointmentOnSlot.priorityCategory || '').toLowerCase().includes(cat)
                    );

                    return (
                      <div key={slotNum} className={`slot-spot-card occupied-waiting ${isPriorityPatient ? 'priority-highlight' : ''}`}>
                        <div>
                          <div className="slot-top-row">
                            <span className={`slot-tag ${isPriorityPatient ? 'amber' : 'blue'} font-mono`}>
                              SLOT {slotNum}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {isPriorityPatient && (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  background: '#FEF3C7',
                                  color: '#B45309',
                                  border: '1px solid #FCD34D',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  <i className="fa-solid fa-bolt"></i> PRIORITY
                                </span>
                              )}
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#64748B',
                                background: '#F1F5F9',
                                padding: '2px 6px',
                                borderRadius: '6px'
                              }}>
                                WAITING
                              </span>
                            </div>
                          </div>

                          <h4 className="slot-patient-name" title={appointmentOnSlot.patientName}>
                            {appointmentOnSlot.patientName}
                          </h4>
                          <span className="slot-patient-contact">
                            {appointmentOnSlot.patientPhone || 'No Phone'}
                          </span>

                          <div style={{ marginTop: '8px' }}>
                            {renderPriorityBadge(appointmentOnSlot.priorityCategory)}
                          </div>
                        </div>

                        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '11.5px', color: '#3E69FE', fontWeight: 700 }}>
                            <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>In Queue Line
                          </span>
                          {appointmentOnSlot.notificationSent && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 800,
                              color: '#059669',
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <i className="fa-solid fa-envelope-circle-check"></i> Alert Sent
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Empty Slot Placeholder
                  return (
                    <div key={slotNum} className="slot-spot-card available-empty">
                      <div className="slot-top-row">
                        <span className="slot-tag muted font-mono">
                          SLOT {slotNum}
                        </span>
                        <span style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 700 }}>
                          OPEN
                        </span>
                      </div>

                      <div className="slot-empty-content">
                        <i className="fa-regular fa-calendar-plus slot-empty-icon"></i>
                        <span className="slot-empty-title">Available / Empty Slot</span>
                        <span className="slot-empty-hint">Open for OPD booking</span>
                      </div>

                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', textAlign: 'center' }}>
                        <span style={{ fontSize: '10.5px', color: '#94A3B8', fontFamily: 'monospace' }}>
                          Unassigned Spot
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Real-time Priority Shift Notice */}
              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                background: '#F8FAFC',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{ fontSize: '12.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: '#3E69FE' }}></i>
                  <span><strong>Atomic Priority Shift:</strong> High priority patients (Elderly, Pregnant, Emergency) are dynamically inserted at Slot 1 with batch overflow spilling into Batch 2.</span>
                </span>
                <span className="font-mono text-blue" style={{ fontSize: '11.5px', fontWeight: 700 }}>
                  Firestore onSnapshot Active
                </span>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* 3. SEQUENCE WAITING QUEUE LIST                                            */}
            {/* ========================================================================= */}
            <section style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '24px 28px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                    Waiting Queue Line ({batchWaitingPatients.length} in this batch)
                  </h4>
                </div>
                <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                  Chronological Order of Examination
                </span>
              </div>

              {batchWaitingPatients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8' }}>
                  <i className="fa-regular fa-circle-check" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', color: '#CBD5E1' }}></i>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>All waiting slots in {batchDisplayName} are clear or empty.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {batchWaitingPatients.map((pat, idx) => (
                    <div
                      key={pat.appointmentId || pat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: '14px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: '#EFF6FF',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'monospace',
                          fontWeight: 800,
                          fontSize: '13px'
                        }}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '14.5px', color: '#1E293B' }}>{pat.patientName}</strong>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>
                              Slot {pat.slotNumber}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                            {pat.patientPhone || 'No Phone'} • Age: {pat.patientAge || '32'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {renderPriorityBadge(pat.priorityCategory)}

                        {!inConsultation && idx === 0 && (
                          <button
                            type="button"
                            className="btn-call-next-primary"
                            onClick={() => callNext(doctor.doctorId || doctor.doctorCode)}
                            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px' }}
                          >
                            <i className="fa-solid fa-bell"></i> Call Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}

        {/* Tab 2: Cured / Completed History */}
        {activeTab === 'history' && (
          <section className="cured-history-section" style={{ background: '#FFFFFF', borderRadius: '24px', padding: '28px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Completed & Cured Clinical Records
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                  Patients successfully examined and treated by Dr. {doctor.name}
                </p>
              </div>
              <span className="font-mono text-green" style={{ fontSize: '14px', fontWeight: 800, background: '#DCFCE7', padding: '6px 14px', borderRadius: '10px', border: '1px solid #86EFAC' }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>Total Cured: {completedPatients.length} Patients
              </span>
            </div>

            {completedPatients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '56px 20px', color: '#94A3B8' }}>
                <i className="fa-solid fa-file-medical" style={{ fontSize: '44px', marginBottom: '14px', display: 'block', color: '#CBD5E1' }}></i>
                <h4 style={{ fontSize: '16px', color: '#475569', margin: '0 0 6px 0' }}>No completed consultations logged yet today.</h4>
                <p style={{ fontSize: '13px', margin: 0 }}>Mark patients as completed from the live queue to record examination history.</p>
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
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1E293B' }}>
                            {pat.patientName}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#64748B' }}>
                            {pat.patientPhone || 'N/A'}
                          </td>
                          <td style={{ padding: '14px 16px', fontFamily: 'monospace' }}>
                            Slot {pat.slotNumber} ({pat.batchId === 'b2' ? 'Evening' : 'Morning'})
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {renderPriorityBadge(pat.priorityCategory)}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-circle-check"></i> Cured / Done
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#64748B', fontFamily: 'monospace' }}>
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

        {/* Automated Email Configuration & Testing Modal */}
        <EmailConfigModal
          isOpen={isEmailConfigOpen}
          onClose={() => setIsEmailConfigOpen(false)}
          activeDoctor={activeDoctor}
        />

      </div>
    </main>
  );
}
