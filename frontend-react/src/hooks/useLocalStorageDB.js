/**
 * MediQueue - Dynamic LocalStorage Client-Side Architecture
 * Single source of truth backed solely by browser localStorage.
 * Zero hardcoded mock presets, fake doctors, or dummy patients.
 * Real-time Tab-to-Tab Synchronization via window 'storage' events.
 */

import { useState, useEffect, useCallback } from 'react';

export const STORAGE_KEYS = {
  DOCTORS: 'mediqueue_doctors',
  APPOINTMENTS: 'mediqueue_appointments',
  ANALYTICS_HISTORY: 'mediqueue_analytics_history',
  CURRENT_USER: 'mediqueue_current_user'
};

// Legacy keys to purge completely
const LEGACY_KEYS = [
  'mediqueue_doctors_v3',
  'mediqueue_appointments_v3',
  'mediqueue_patients_v3',
  'mediqueue_staff_v3',
  'mediqueue_departments_v3',
  'mediqueue_audit_logs_v3',
  'mediqueue_notifications_v3',
  'mediqueue_queue_pause_v3'
];

function readStorage(key, defaultValue = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function writeStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage:`, err);
  }
}

export function useLocalStorageDB() {
  const [doctors, setDoctors] = useState(() => readStorage(STORAGE_KEYS.DOCTORS, []));
  const [appointments, setAppointments] = useState(() => readStorage(STORAGE_KEYS.APPOINTMENTS, []));
  const [analyticsHistory, setAnalyticsHistory] = useState(() => readStorage(STORAGE_KEYS.ANALYTICS_HISTORY, []));

  // Purge any residual legacy mock data keys on initial mount
  useEffect(() => {
    LEGACY_KEYS.forEach(k => {
      if (localStorage.getItem(k) !== null) {
        localStorage.removeItem(k);
      }
    });
  }, []);

  // Reload all state collections from localStorage
  const refreshFromStorage = useCallback(() => {
    setDoctors(readStorage(STORAGE_KEYS.DOCTORS, []));
    setAppointments(readStorage(STORAGE_KEYS.APPOINTMENTS, []));
    setAnalyticsHistory(readStorage(STORAGE_KEYS.ANALYTICS_HISTORY, []));
  }, []);

  // Phase 4: Tab-to-Tab and intra-tab synchronization
  useEffect(() => {
    const handleStorageEvent = e => {
      if (
        !e.key ||
        e.key === STORAGE_KEYS.DOCTORS ||
        e.key === STORAGE_KEYS.APPOINTMENTS ||
        e.key === STORAGE_KEYS.ANALYTICS_HISTORY
      ) {
        refreshFromStorage();
      }
    };

    const handleLocalSyncEvent = () => {
      refreshFromStorage();
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('mediqueue_local_sync', handleLocalSyncEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('mediqueue_local_sync', handleLocalSyncEvent);
    };
  }, [refreshFromStorage]);

  const notifyChange = () => {
    window.dispatchEvent(new CustomEvent('mediqueue_local_sync'));
  };

  // =========================================================================
  // DOCTOR ONBOARDING & REGISTRATION
  // =========================================================================
  const registerDoctor = useCallback((docData) => {
    if (!docData.name || !docData.name.trim()) {
      throw new Error('Doctor Name is required.');
    }
    const doctorCode = (docData.doctorCode || `DOC${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();
    
    // Check if doctor code already exists
    const currentDocs = readStorage(STORAGE_KEYS.DOCTORS, []);
    const existingIndex = currentDocs.findIndex(d => d.doctorCode.toUpperCase() === doctorCode);

    const defaultBatches = [
      { batchId: 'b1', name: 'Morning Batch', startTime: '10:00', maxSlots: 5 },
      { batchId: 'b2', name: 'Evening Batch', startTime: '16:00', maxSlots: 5 }
    ];

    const newDoc = {
      doctorId: docData.doctorId || `doc_${Date.now()}`,
      doctorCode: doctorCode,
      name: docData.name.trim(),
      age: docData.age ? parseInt(docData.age, 10) : 40,
      department: (docData.department || 'General Medicine').trim(),
      batches: Array.isArray(docData.batches) && docData.batches.length > 0 ? docData.batches : defaultBatches
    };

    let updatedDocs;
    if (existingIndex >= 0) {
      updatedDocs = [...currentDocs];
      updatedDocs[existingIndex] = newDoc;
    } else {
      updatedDocs = [...currentDocs, newDoc];
    }

    writeStorage(STORAGE_KEYS.DOCTORS, updatedDocs);
    setDoctors(updatedDocs);
    notifyChange();
    return newDoc;
  }, []);

  const getDoctorByCode = useCallback((code) => {
    if (!code) return null;
    const clean = String(code).trim().toUpperCase();
    return doctors.find(d => d.doctorCode.toUpperCase() === clean || d.doctorId === code) || null;
  }, [doctors]);

  // =========================================================================
  // APPOINTMENT BOOKING & BATCH PRIORITY ENGINE
  // Strict 5-patient capacity per batch.
  // Standard -> first available slot. If Batch 1 has 5, spill over to Batch 2.
  // Priority (elderly, pregnant, emergency) -> inject into Slot 1 of current batch,
  // shift existing down by 1 position (if batch exceeds 5, push 5th into Slot 1 of next batch).
  // =========================================================================
  const bookAppointment = useCallback((booking) => {
    const { patientName, patientAge, patientPhone, patientEmail, doctorCode, priorityCategory } = booking;
    if (!patientName || !patientPhone) {
      throw new Error('Patient name and phone number are required.');
    }

    const currentDocs = readStorage(STORAGE_KEYS.DOCTORS, []);
    const targetDoc = currentDocs.find(
      d => d.doctorCode.toUpperCase() === String(doctorCode).trim().toUpperCase() || d.doctorId === doctorCode
    );

    if (!targetDoc) {
      throw new Error(`Doctor code "${doctorCode}" was not found in registered directory.`);
    }

    const allApts = readStorage(STORAGE_KEYS.APPOINTMENTS, []);
    
    // Filter active appointments for this doctor (waiting or in_consultation)
    const docActiveApts = allApts.filter(
      a => a.doctorCode.toUpperCase() === targetDoc.doctorCode.toUpperCase() &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    );

    // Normalize priority
    const pCatLower = String(priorityCategory || 'none').toLowerCase();
    let normalizedPriority = 'none';
    if (pCatLower.includes('elderly')) normalizedPriority = 'elderly';
    else if (pCatLower.includes('pregnant')) normalizedPriority = 'pregnant';
    else if (pCatLower.includes('emergency')) normalizedPriority = 'emergency';

    const isPriority = normalizedPriority !== 'none';
    let targetBatchId = 'b1';
    let assignedSlot = 1;
    let modifiedApts = [...allApts];

    if (!isPriority) {
      // Standard booking: fill Batch 1 first (up to 5), then spill over to Batch 2
      const b1Active = docActiveApts.filter(a => a.batchId === 'b1');
      if (b1Active.length < 5) {
        targetBatchId = 'b1';
        const usedSlots = new Set(b1Active.map(a => a.slotNumber));
        for (let s = 1; s <= 5; s++) {
          if (!usedSlots.has(s)) {
            assignedSlot = s;
            break;
          }
        }
        if (!assignedSlot) assignedSlot = b1Active.length + 1;
      } else {
        // Spill over to Batch 2
        targetBatchId = 'b2';
        const b2Active = docActiveApts.filter(a => a.batchId === 'b2');
        const usedSlots = new Set(b2Active.map(a => a.slotNumber));
        for (let s = 1; s <= 5; s++) {
          if (!usedSlots.has(s)) {
            assignedSlot = s;
            break;
          }
        }
        if (!assignedSlot) assignedSlot = b2Active.length + 1;
      }
    } else {
      // PRIORITY INJECTION ENGINE:
      // Inject into Slot 1 of Batch 1.
      targetBatchId = 'b1';
      assignedSlot = 1;

      // Shift existing waiting appointments in Batch 1 down by 1
      const b1Waiting = docActiveApts.filter(a => a.batchId === 'b1' && a.status === 'waiting');
      const displacedApts = [];

      modifiedApts = modifiedApts.map(apt => {
        if (
          apt.doctorCode.toUpperCase() === targetDoc.doctorCode.toUpperCase() &&
          apt.batchId === 'b1' &&
          apt.status === 'waiting'
        ) {
          const newSlot = apt.slotNumber + 1;
          if (newSlot > 5) {
            // Displaced 5th patient pushed to Batch 2 Slot 1
            displacedApts.push({ ...apt, batchId: 'b2', slotNumber: 1 });
            return null; // Will be replaced by displaced entry
          }
          return { ...apt, slotNumber: newSlot };
        }
        return apt;
      }).filter(Boolean);

      // If a patient was displaced into Batch 2, shift existing Batch 2 appointments down
      if (displacedApts.length > 0) {
        modifiedApts = modifiedApts.map(apt => {
          if (
            apt.doctorCode.toUpperCase() === targetDoc.doctorCode.toUpperCase() &&
            apt.batchId === 'b2' &&
            apt.status === 'waiting'
          ) {
            return { ...apt, slotNumber: apt.slotNumber + 1 };
          }
          return apt;
        });
        modifiedApts.push(...displacedApts);
      }
    }

    const newAppointment = {
      appointmentId: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      patientName: patientName.trim(),
      patientAge: parseInt(patientAge, 10) || 30,
      patientPhone: patientPhone.trim(),
      patientEmail: (patientEmail || '').trim(),
      doctorCode: targetDoc.doctorCode,
      department: targetDoc.department,
      batchId: targetBatchId,
      slotNumber: assignedSlot,
      priorityCategory: normalizedPriority,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      consultationStartTime: null,
      consultationEndTime: null
    };

    modifiedApts.push(newAppointment);
    writeStorage(STORAGE_KEYS.APPOINTMENTS, modifiedApts);
    setAppointments(modifiedApts);
    notifyChange();
    return newAppointment;
  }, []);

  // =========================================================================
  // DOCTOR PORTAL QUEUE OPERATIONS
  // Call Next, Complete (✅), Skip (⏭️), No-Show (❌)
  // =========================================================================
  const callNext = useCallback((doctorCode) => {
    if (!doctorCode) return null;
    const cleanCode = String(doctorCode).trim().toUpperCase();
    const allApts = readStorage(STORAGE_KEYS.APPOINTMENTS, []);

    // Filter waiting appointments for this doctor sorted by batch and slotNumber
    const waitingForDoc = allApts
      .filter(a => a.doctorCode.toUpperCase() === cleanCode && a.status === 'waiting')
      .sort((a, b) => {
        if (a.batchId !== b.batchId) return a.batchId.localeCompare(b.batchId);
        return a.slotNumber - b.slotNumber;
      });

    if (waitingForDoc.length === 0) return null;

    const targetPatient = waitingForDoc[0];
    const updatedApts = allApts.map(a => {
      if (a.appointmentId === targetPatient.appointmentId) {
        return {
          ...a,
          status: 'in_consultation',
          consultationStartTime: new Date().toISOString()
        };
      }
      return a;
    });

    writeStorage(STORAGE_KEYS.APPOINTMENTS, updatedApts);
    setAppointments(updatedApts);
    notifyChange();
    return targetPatient;
  }, []);

  const completeConsultation = useCallback((doctorCode) => {
    if (!doctorCode) return null;
    const cleanCode = String(doctorCode).trim().toUpperCase();
    const allApts = readStorage(STORAGE_KEYS.APPOINTMENTS, []);
    const allHistory = readStorage(STORAGE_KEYS.ANALYTICS_HISTORY, []);

    // Find currently in_consultation patient
    const activeConsultation = allApts.find(
      a => a.doctorCode.toUpperCase() === cleanCode && a.status === 'in_consultation'
    );

    if (!activeConsultation) return null;

    const endTime = new Date().toISOString();
    const startTime = activeConsultation.consultationStartTime || endTime;
    const diffMs = new Date(endTime) - new Date(startTime);
    const durationMinutes = Math.max(1, Math.round(diffMs / 60000)) || 8;

    // Log to mediqueue_analytics_history
    const historyRecord = {
      appointmentId: activeConsultation.appointmentId,
      department: activeConsultation.department,
      doctorCode: activeConsultation.doctorCode,
      durationMinutes: durationMinutes,
      status: 'completed',
      completedAt: endTime
    };

    const updatedHistory = [...allHistory, historyRecord];
    writeStorage(STORAGE_KEYS.ANALYTICS_HISTORY, updatedHistory);
    setAnalyticsHistory(updatedHistory);

    // Update appointment to completed and auto-promote next waiting patient
    const waitingForDoc = allApts
      .filter(a => a.doctorCode.toUpperCase() === cleanCode && a.status === 'waiting')
      .sort((a, b) => {
        if (a.batchId !== b.batchId) return a.batchId.localeCompare(b.batchId);
        return a.slotNumber - b.slotNumber;
      });

    const nextPatient = waitingForDoc.length > 0 ? waitingForDoc[0] : null;

    const updatedApts = allApts.map(a => {
      if (a.appointmentId === activeConsultation.appointmentId) {
        return {
          ...a,
          status: 'completed',
          consultationEndTime: endTime
        };
      }
      if (nextPatient && a.appointmentId === nextPatient.appointmentId) {
        return {
          ...a,
          status: 'in_consultation',
          consultationStartTime: new Date().toISOString()
        };
      }
      return a;
    });

    writeStorage(STORAGE_KEYS.APPOINTMENTS, updatedApts);
    setAppointments(updatedApts);
    notifyChange();
    return { completed: activeConsultation, promoted: nextPatient, durationMinutes };
  }, []);

  const skipPatient = useCallback((appointmentId) => {
    if (!appointmentId) return;
    const allApts = readStorage(STORAGE_KEYS.APPOINTMENTS, []);
    const target = allApts.find(a => a.appointmentId === appointmentId);
    if (!target) return;

    // Find the highest slot in target's batch for this doctor
    const batchApts = allApts.filter(
      a => a.doctorCode.toUpperCase() === target.doctorCode.toUpperCase() &&
           a.batchId === target.batchId &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    );
    const maxSlot = Math.max(...batchApts.map(a => a.slotNumber), 0);

    const updatedApts = allApts.map(a => {
      if (a.appointmentId === appointmentId) {
        return {
          ...a,
          status: 'waiting',
          slotNumber: maxSlot + 1,
          consultationStartTime: null
        };
      }
      return a;
    });

    writeStorage(STORAGE_KEYS.APPOINTMENTS, updatedApts);
    setAppointments(updatedApts);
    notifyChange();
  }, []);

  const markNoShow = useCallback((appointmentId) => {
    if (!appointmentId) return;
    const allApts = readStorage(STORAGE_KEYS.APPOINTMENTS, []);
    const updatedApts = allApts.map(a => {
      if (a.appointmentId === appointmentId) {
        return {
          ...a,
          status: 'no_show',
          consultationEndTime: new Date().toISOString()
        };
      }
      return a;
    });

    writeStorage(STORAGE_KEYS.APPOINTMENTS, updatedApts);
    setAppointments(updatedApts);
    notifyChange();
  }, []);

  // Total reset helper
  const purgeAllData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.DOCTORS);
    localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
    localStorage.removeItem(STORAGE_KEYS.ANALYTICS_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k));

    setDoctors([]);
    setAppointments([]);
    setAnalyticsHistory([]);
    notifyChange();
  }, []);

  // =========================================================================
  // DERIVED DYNAMIC ANALYTICS (ZERO FAKE PRESETS)
  // =========================================================================
  const getAdminTelemetry = useCallback(() => {
    const waitingApts = appointments.filter(a => a.status === 'waiting');
    const totalQueueLength = waitingApts.length;

    // Distinct departments from doctors + appointments
    const deptSet = new Set();
    doctors.forEach(d => deptSet.add(d.department));
    appointments.forEach(a => deptSet.add(a.department));
    const distinctDepts = Array.from(deptSet).filter(Boolean);

    // Group active count & avg wait by department
    const departmentsSummary = distinctDepts.map(dept => {
      const deptWaiting = waitingApts.filter(a => a.department === dept);
      const activeCount = deptWaiting.length;
      
      const deptHistory = analyticsHistory.filter(h => h.department === dept);
      const avgWaitMinutes = deptHistory.length > 0
        ? Math.round(deptHistory.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) / deptHistory.length)
        : 0;

      const loadPercentage = totalQueueLength > 0
        ? Math.round((activeCount / totalQueueLength) * 100)
        : 0;

      return {
        department: dept,
        activeWaitingCount: activeCount,
        avgWaitMinutes,
        loadPercentage
      };
    });

    // Overall average wait time
    const overallAvgWait = analyticsHistory.length > 0
      ? Math.round(analyticsHistory.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) / analyticsHistory.length)
      : 0;

    // Doctor specific stats
    const doctorsSummary = doctors.map(doc => {
      const docWaiting = waitingApts.filter(a => a.doctorCode.toUpperCase() === doc.doctorCode.toUpperCase());
      const inConsult = appointments.find(
        a => a.doctorCode.toUpperCase() === doc.doctorCode.toUpperCase() && a.status === 'in_consultation'
      );
      const docHistory = analyticsHistory.filter(h => h.doctorCode.toUpperCase() === doc.doctorCode.toUpperCase());
      const docAvgWait = docHistory.length > 0
        ? Math.round(docHistory.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) / docHistory.length)
        : (overallAvgWait || 10);

      return {
        ...doc,
        waitingCount: docWaiting.length,
        inConsultation: inConsult ? inConsult.patientName : null,
        avgWaitMinutes: docAvgWait
      };
    });

    const isEmpty = totalQueueLength === 0 && analyticsHistory.length === 0 && distinctDepts.length === 0;

    return {
      totalQueueLength,
      overallAvgWait,
      departmentsSummary,
      doctorsSummary,
      isEmpty,
      emptyMessage: "Queue length: 0 | Average Wait Time: 0 min | No active department traffic."
    };
  }, [doctors, appointments, analyticsHistory]);

  return {
    doctors,
    appointments,
    analyticsHistory,
    registerDoctor,
    getDoctorByCode,
    bookAppointment,
    callNext,
    completeConsultation,
    skipPatient,
    markNoShow,
    purgeAllData,
    getAdminTelemetry,
    refreshFromStorage
  };
}
