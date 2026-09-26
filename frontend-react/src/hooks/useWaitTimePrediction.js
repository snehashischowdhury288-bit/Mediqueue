/**
 * Dynamic Wait-Time Prediction Engine
 * Trained on historical consultation data directly in MediQueue.
 *
 * Requirements:
 * 1. Historical Consultation Tracking:
 *    - consultationStartTime = Date.now()
 *    - consultationEndTime = Date.now()
 *    - durationMinutes = Math.round((consultationEndTime - consultationStartTime) / 60000)
 *    - Stored in historicalConsultations tagged with doctorId & department
 *
 * 2. Dynamic Rolling-Average Prediction Model:
 *    - averageConsultationTime = (Sum of durationMinutes of completed patients today) / (Total completed patients today)
 *    - Fallback baseline (8-10 mins, default 10) if 0 completed today
 *    - Self-correcting continuously as consultations complete
 *
 * 3. Patient-Specific Wait-Time Calculation:
 *    - For every waiting patient:
 *      If patient in room:
 *        Current Patient Remaining Time = Math.max(0, averageConsultationTime - Elapsed Mins of Current Patient)
 *        Total Wait = Current Patient Remaining Time + (Remaining Waiting Patients Ahead * averageConsultationTime)
 *      If no patient in room:
 *        Total Wait = (Active Patients Ahead in Line) * averageConsultationTime
 *
 * 4. Real-time UI updates:
 *    - Patient Portal countdown badge:
 *      "Estimated Wait Time: ~[X] mins (Based on Dr. [Name]'s live consultation pace of [Y] mins/patient)"
 *    - Doctor & Admin metric cards:
 *      "Average Consultation Pace: [Y] mins/patient (Trained on [N] completed consultations today)"
 */

import { useState, useEffect, useMemo } from 'react';

/**
 * Safely parse timestamp to numeric milliseconds.
 */
export const getEpochTimestamp = (ts) => {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const num = Number(ts);
    if (!isNaN(num) && num > 100000000000) return num;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  if (ts.toDate && typeof ts.toDate === 'function') {
    return ts.toDate().getTime();
  }
  if (ts.seconds != null) {
    return ts.seconds * 1000 + (ts.nanoseconds ? Math.floor(ts.nanoseconds / 1000000) : 0);
  }
  if (ts instanceof Date) {
    return isNaN(ts.getTime()) ? null : ts.getTime();
  }
  return null;
};

/**
 * Check if a completed consultation occurred today (calendar day).
 */
export const isCompletedToday = (record) => {
  if (!record) return false;
  const now = new Date();
  const todayDateStr = now.toISOString().split('T')[0];

  if (record.date && record.date === todayDateStr) {
    return true;
  }

  const rawTime = record.consultationEndTime || record.completedAt || record.timestamp || record.createdAt;
  const timeMs = getEpochTimestamp(rawTime);
  if (!timeMs) return false;

  const d = new Date(timeMs);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

/**
 * Calculate dynamic rolling average consultation pace for a doctor based on completed consultations today.
 */
export const calculateDoctorConsultationPace = ({
  doctorId,
  doctorCode,
  historicalConsultations = [],
  appointments = [],
  analyticsLogs = [],
  fallbackBaseline = 10
}) => {
  const cleanCode = (doctorCode || '').trim().toUpperCase();
  const cleanId = doctorId || '';

  const matchesDoctor = (item) => {
    if (!item) return false;
    const itemCode = (item.doctorCode || '').trim().toUpperCase();
    const itemId = item.doctorId || '';
    if (cleanCode && itemCode && itemCode === cleanCode) return true;
    if (cleanId && itemId && itemId === cleanId) return true;
    return false;
  };

  const completedTodayList = [];
  const seenIds = new Set();

  // 1. From historicalConsultations collection
  (historicalConsultations || []).forEach(item => {
    if (matchesDoctor(item) && isCompletedToday(item)) {
      const key = item.appointmentId || item.id;
      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        if (typeof item.durationMinutes === 'number' && item.durationMinutes > 0) {
          completedTodayList.push(item);
        }
      }
    }
  });

  // 2. From appointments collection (completed)
  (appointments || []).forEach(apt => {
    if (apt.status === 'completed' && matchesDoctor(apt) && isCompletedToday(apt)) {
      const key = apt.appointmentId || apt.id;
      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        if (typeof apt.durationMinutes === 'number' && apt.durationMinutes > 0) {
          completedTodayList.push(apt);
        }
      }
    }
  });

  // 3. From analyticsLogs collection
  (analyticsLogs || []).forEach(log => {
    if (matchesDoctor(log) && isCompletedToday(log)) {
      const key = log.appointmentId || log.id;
      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        if (typeof log.durationMinutes === 'number' && log.durationMinutes > 0) {
          completedTodayList.push(log);
        }
      }
    }
  });

  const totalCompleted = completedTodayList.length;

  if (totalCompleted === 0) {
    return {
      averageConsultationTime: fallbackBaseline,
      completedTodayCount: 0,
      isTrained: false,
      sampleDurations: []
    };
  }

  const sumDuration = completedTodayList.reduce((sum, item) => sum + item.durationMinutes, 0);
  const rawAvg = sumDuration / totalCompleted;
  const averageConsultationTime = Math.round(rawAvg * 10) / 10;

  return {
    averageConsultationTime,
    completedTodayCount: totalCompleted,
    isTrained: true,
    sampleDurations: completedTodayList.map(item => item.durationMinutes)
  };
};

/**
 * Calculate individualized wait time for a patient based on active queue state and current consultation progress.
 */
export const calculatePatientWaitTime = ({
  targetAppointment,
  doctor,
  appointments = [],
  averageConsultationTime = 10,
  now = Date.now()
}) => {
  if (!targetAppointment) {
    return {
      estimatedWaitMins: 0,
      currentPatientRemainingMins: 0,
      elapsedMinsOfCurrentPatient: 0,
      waitingAheadCount: 0,
      inConsultationPatient: null,
      isCurrentlyInConsultation: false
    };
  }

  if (targetAppointment.status === 'in_consultation') {
    return {
      estimatedWaitMins: 0,
      currentPatientRemainingMins: 0,
      elapsedMinsOfCurrentPatient: 0,
      waitingAheadCount: 0,
      inConsultationPatient: targetAppointment,
      isCurrentlyInConsultation: true
    };
  }

  const docCode = (targetAppointment.doctorCode || doctor?.doctorCode || '').trim().toUpperCase();
  const docId = targetAppointment.doctorId || doctor?.doctorId || '';

  const docApts = (appointments || []).filter(a => {
    const aCode = (a.doctorCode || '').trim().toUpperCase();
    const aId = a.doctorId || '';
    const match = (docCode && aCode === docCode) || (docId && aId === docId);
    return match && (a.status === 'waiting' || a.status === 'in_consultation');
  });

  const inConsultationPatient = docApts.find(a => a.status === 'in_consultation');

  let currentPatientRemainingMins = 0;
  let elapsedMins = 0;
  if (inConsultationPatient) {
    const startMs = getEpochTimestamp(inConsultationPatient.consultationStartTime) || now;
    const elapsedMs = Math.max(0, now - startMs);
    elapsedMins = Math.floor(elapsedMs / 60000);
    currentPatientRemainingMins = Math.max(0, Math.round(averageConsultationTime - elapsedMins));
  }

  const waitingPatients = docApts
    .filter(a => a.status === 'waiting')
    .sort((a, b) => {
      const bComp = (a.batchId || 'b1').localeCompare(b.batchId || 'b1');
      if (bComp !== 0) return bComp;
      return (a.slotNumber || 0) - (b.slotNumber || 0);
    });

  const targetBatch = targetAppointment.batchId || 'b1';
  const targetSlot = targetAppointment.slotNumber || 0;
  const targetId = targetAppointment.appointmentId || targetAppointment.id;

  const waitingAheadCount = waitingPatients.filter(w => {
    const wId = w.appointmentId || w.id;
    if (wId === targetId) return false;
    const wBatch = w.batchId || 'b1';
    if (wBatch !== targetBatch) {
      return wBatch.localeCompare(targetBatch) < 0;
    }
    return (w.slotNumber || 0) < targetSlot;
  }).length;

  let totalWait = 0;
  if (inConsultationPatient) {
    totalWait = currentPatientRemainingMins + (waitingAheadCount * averageConsultationTime);
  } else {
    totalWait = waitingAheadCount * averageConsultationTime;
  }

  const estimatedWaitMins = Math.max(0, Math.round(totalWait));

  return {
    estimatedWaitMins,
    currentPatientRemainingMins,
    elapsedMinsOfCurrentPatient: elapsedMins,
    waitingAheadCount,
    inConsultationPatient,
    isCurrentlyInConsultation: false
  };
};

/**
 * Custom React Hook for dynamic wait-time prediction.
 */
export function useWaitTimePrediction({
  doctor,
  appointment,
  appointments = [],
  historicalConsultations = [],
  analyticsLogs = [],
  refreshIntervalMs = 10000
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refreshIntervalMs]);

  const pace = useMemo(() => {
    return calculateDoctorConsultationPace({
      doctorId: doctor?.doctorId,
      doctorCode: doctor?.doctorCode,
      historicalConsultations,
      appointments,
      analyticsLogs
    });
  }, [doctor?.doctorId, doctor?.doctorCode, historicalConsultations, appointments, analyticsLogs]);

  const waitPrediction = useMemo(() => {
    return calculatePatientWaitTime({
      targetAppointment: appointment,
      doctor,
      appointments,
      averageConsultationTime: pace.averageConsultationTime,
      now
    });
  }, [appointment, doctor, appointments, pace.averageConsultationTime, now]);

  return {
    ...pace,
    ...waitPrediction,
    doctorName: doctor?.name || 'Assigned Clinician',
    paceMins: pace.averageConsultationTime
  };
}
