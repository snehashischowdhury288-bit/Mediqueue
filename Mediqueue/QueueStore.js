/**
 * MediQueue - Centralized Reactive State Store & Queue Management Engine
 * State persistence with localStorage and real-time reactive updates.
 * Supports Patient, Doctor, Staff, and Central Hospital Administration.
 */

const QueueStore = (function () {
  const STORAGE_KEYS = {
    DOCTORS: 'mediqueue_doctors',
    APPOINTMENTS: 'mediqueue_appointments',
    ANALYTICS_HISTORY: 'mediqueue_analytics_history',
    CURRENT_USER: 'mediqueue_current_user',
    PATIENTS: 'mediqueue_patients',
    STAFF: 'mediqueue_staff',
    DEPARTMENTS: 'mediqueue_departments',
    AUDIT_LOGS: 'mediqueue_audit_logs',
    NOTIFICATIONS: 'mediqueue_notifications',
    QUEUE_PAUSE: 'mediqueue_queue_pause'
  };

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

  let doctors = [];
  let appointments = [];
  let analyticsHistory = [];
  let patients = [];
  let staff = [];
  let departments = [];
  let auditLogs = [];
  let notifications = [];
  let queuePauseState = {};
  let currentUser = null;
  let listeners = [];

  // =========================================================================
  // INITIALIZATION & PERSISTENCE
  // =========================================================================
  function init() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Purge legacy mock data keys
        LEGACY_KEYS.forEach(k => localStorage.removeItem(k));

        const storedDoctors = localStorage.getItem(STORAGE_KEYS.DOCTORS);
        const storedAppointments = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
        const storedAnalytics = localStorage.getItem(STORAGE_KEYS.ANALYTICS_HISTORY);
        const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        const storedPatients = localStorage.getItem(STORAGE_KEYS.PATIENTS);
        const storedStaff = localStorage.getItem(STORAGE_KEYS.STAFF);
        const storedDepartments = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
        const storedLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
        const storedNotifs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
        const storedPause = localStorage.getItem(STORAGE_KEYS.QUEUE_PAUSE);

        doctors = storedDoctors ? JSON.parse(storedDoctors) : [];
        appointments = storedAppointments ? JSON.parse(storedAppointments) : [];
        analyticsHistory = storedAnalytics ? JSON.parse(storedAnalytics) : [];
        currentUser = storedUser ? JSON.parse(storedUser) : null;
        patients = storedPatients ? JSON.parse(storedPatients) : [];
        staff = storedStaff ? JSON.parse(storedStaff) : [];
        departments = storedDepartments ? JSON.parse(storedDepartments) : [];
        auditLogs = storedLogs ? JSON.parse(storedLogs) : [];
        notifications = storedNotifs ? JSON.parse(storedNotifs) : [];
        queuePauseState = storedPause ? JSON.parse(storedPause) : {};
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
      resetMemoryState();
    }

    // Zero hardcoded presets on startup: initialize with empty state structures []
  }

  // Phase 4: Tab-to-Tab Synchronization
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (
        !e.key ||
        e.key === STORAGE_KEYS.DOCTORS ||
        e.key === STORAGE_KEYS.APPOINTMENTS ||
        e.key === STORAGE_KEYS.ANALYTICS_HISTORY
      ) {
        init();
        notifyLocalOnly();
      }
    });

    window.addEventListener('mediqueue_local_sync', () => {
      init();
      notifyLocalOnly();
    });
  }

  function resetMemoryState() {
    doctors = [];
    appointments = [];
    analyticsHistory = [];
    patients = [];
    staff = [];
    departments = [];
    auditLogs = [];
    notifications = [];
    queuePauseState = {};
    currentUser = null;
  }

  function saveDoctors() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
    }
    notify();
  }

  function saveAppointments() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    }
    notify();
  }

  function savePatients() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    }
    notify();
  }

  function saveStaff() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
    }
    notify();
  }

  function saveDepartments() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
    }
    notify();
  }

  function saveAuditLogs() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
    }
    notify();
  }

  function saveNotifications() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
    notify();
  }

  function savePauseState() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.QUEUE_PAUSE, JSON.stringify(queuePauseState));
    }
    notify();
  }

  function saveCurrentUser() {
    if (typeof localStorage !== 'undefined') {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    }
    notify();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter(l => l !== fn);
    };
  }

  function saveAnalyticsHistory() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ANALYTICS_HISTORY, JSON.stringify(analyticsHistory));
    }
    notify();
  }

  function notifyLocalOnly() {
    listeners.forEach(fn => {
      try {
        fn({
          doctors,
          appointments,
          analyticsHistory,
          patients,
          staff,
          departments,
          auditLogs,
          notifications,
          currentUser
        });
      } catch (err) {
        console.error('Error in QueueStore listener:', err);
      }
    });
  }

  function notify() {
    notifyLocalOnly();
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mediqueue_local_sync'));
      } catch (e) {}
    }
  }

  // =========================================================================
  // DOCTOR REPOSITORY
  // =========================================================================
  function getDoctors() {
    return [...doctors];
  }

  function getDoctorById(id) {
    if (!id) return null;
    const clean = String(id).trim();
    return doctors.find(d => d.id === clean || (d.privateCode && d.privateCode.toUpperCase() === clean.toUpperCase())) || null;
  }

  function addDoctor(docData) {
    if (!docData.name || !docData.name.trim()) {
      throw new Error('Doctor Full Name is required.');
    }

    const newDoctor = {
      id: docData.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: docData.name.trim(),
      age: docData.age || '',
      experience: docData.experience || 'Specialist Consultant',
      specialization: (docData.specialization || 'General Physician').trim(),
      department: (docData.department || docData.specialization || 'General Medicine').trim(),
      room: docData.room ? docData.room.trim() : 'Suite 304, Wing C',
      email: docData.email ? docData.email.trim().toLowerCase() : '',
      phone: docData.phone || '9876543200',
      availability: docData.availability || 'Available Today',
      status: docData.status || 'Active',
      avgConsultDuration: docData.avgConsultDuration || 10,
      createdAt: docData.createdAt || Date.now()
    };

    const idx = doctors.findIndex(d => d.id === newDoctor.id);
    if (idx !== -1) {
      doctors[idx] = newDoctor;
    } else {
      doctors.push(newDoctor);
    }

    saveDoctors();
    return newDoctor;
  }

  function updateDoctor(id, updates) {
    const idx = doctors.findIndex(d => d.id === id);
    if (idx !== -1) {
      doctors[idx] = { ...doctors[idx], ...updates };
      saveDoctors();
      addAuditLog('Admin updated doctor', 'Admin User', doctors[idx].name, `Updated doctor profile attributes`);
      return doctors[idx];
    }
    return null;
  }

  function toggleDoctorStatus(id) {
    const doc = doctors.find(d => d.id === id);
    if (doc) {
      doc.status = doc.status === 'Active' ? 'Inactive' : 'Active';
      saveDoctors();
      addAuditLog('Admin changed doctor status', 'Admin User', doc.name, `Status set to ${doc.status}`);
      return doc;
    }
    return null;
  }

  // Dedicated Doctor Assignment: Immediately reflects across system
  function assignDoctorToDepartment(doctorId, departmentName) {
    const doc = doctors.find(d => d.id === doctorId);
    if (!doc) throw new Error('Doctor not found.');

    const oldDept = doc.department || doc.specialization;
    doc.department = departmentName;

    // Harmonize specialization with department name if appropriate
    if (departmentName.includes('Cardio')) doc.specialization = 'Cardiologist';
    else if (departmentName.includes('Neuro')) doc.specialization = 'Neurologist';
    else if (departmentName.includes('Odonto') || departmentName.includes('Dental')) doc.specialization = 'Odontologist';
    else if (departmentName.includes('Pediat')) doc.specialization = 'Pediatrician';
    else if (departmentName.includes('Ortho')) doc.specialization = 'Orthopedic Surgeon';
    else if (departmentName.includes('Derma')) doc.specialization = 'Dermatologist';
    else if (departmentName.includes('General')) doc.specialization = 'General Physician';
    else doc.specialization = departmentName;

    saveDoctors();

    // Update departmental assignedDoctors list
    departments.forEach(dept => {
      if (dept.name === departmentName) {
        if (!dept.assignedDoctors) dept.assignedDoctors = [];
        if (!dept.assignedDoctors.includes(doc.id)) dept.assignedDoctors.push(doc.id);
      } else {
        if (dept.assignedDoctors) {
          dept.assignedDoctors = dept.assignedDoctors.filter(id => id !== doc.id);
        }
      }
    });
    saveDepartments();

    addAuditLog('Admin assigned doctor', 'Admin User', doc.name, `Reassigned from ${oldDept} to ${departmentName}`);
    return doc;
  }

  // =========================================================================
  // QUEUE & APPOINTMENT LOGIC (5-per-Batch & Priority Shifting)
  // =========================================================================
  function getAppointments(doctorId) {
    if (!doctorId) {
      return [...appointments].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }
    const clean = String(doctorId).trim();
    return appointments
      .filter(a => a.doctorId === clean || (a.doctorCode && a.doctorCode.toUpperCase() === clean.toUpperCase()))
      .sort((a, b) => (a.globalIndex || 0) - (b.globalIndex || 0));
  }

  function getActiveAppointments(doctorId) {
    return getAppointments(doctorId).filter(a => a.status !== 'Completed' && a.status !== 'No-Show');
  }

  function getInConsultationAppointment(doctorId) {
    return getAppointments(doctorId).find(a => a.status === 'In-Consultation') || null;
  }

  function addAppointment(patientData) {
    const doctor = getDoctorById(patientData.doctorId || patientData.doctorCode);
    if (!doctor) {
      throw new Error('Please choose a registered doctor to book consultation.');
    }

    const isPriority = ['Elderly', 'Pregnant Woman', 'Pregnant', 'Emergency', 'Approved Clinical Priority'].includes(patientData.category);
    const doctorApts = getAppointments(doctor.id);
    const nonActive = doctorApts.filter(a => a.status === 'Completed' || a.status === 'No-Show');
    const active = doctorApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');

    // Ensure master patient record exists
    let patientRecord = patients.find(p => p.phone === patientData.patientPhone || (patientData.patientId && p.id === patientData.patientId));
    if (!patientRecord) {
      patientRecord = registerPatient({
        name: patientData.patientName,
        phone: patientData.patientPhone,
        age: patientData.patientAge,
        gender: patientData.gender || 'Not Specified',
        category: patientData.category || 'Normal',
        source: patientData.source || 'PATIENT PORTAL'
      });
    }

    const newApt = {
      id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      patientId: patientRecord.id,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorRoom: doctor.room,
      doctorSpecialization: doctor.specialization,
      department: doctor.department || doctor.specialization,
      patientName: patientData.patientName.trim(),
      patientAge: patientData.patientAge,
      patientPhone: patientData.patientPhone.trim(),
      patientEmail: (patientData.patientEmail || '').trim().toLowerCase(),
      gender: patientData.gender || patientRecord.gender || 'Not Specified',
      category: patientData.category || 'Normal',
      source: patientData.source || patientRecord.source || 'PATIENT PORTAL',
      createdAt: Date.now(),
      notified3Away: false,
      status: 'Waiting'
    };

    const deptPrefix = (doctor.department || doctor.specialization || 'OPD').charAt(0).toUpperCase();

    if (!isPriority) {
      const globalIdx = active.length + 1;
      const batchNum = Math.floor((globalIdx - 1) / 5) + 1;
      const slotNum = ((globalIdx - 1) % 5) + 1;

      newApt.batchNumber = batchNum;
      newApt.batchName = batchNum === 1 ? 'Morning Batch (Batch 1)' : (batchNum === 2 ? 'Evening Batch (Batch 2)' : `Batch ${batchNum}`);
      newApt.slotNumber = slotNum;
      newApt.globalIndex = globalIdx;
      newApt.tokenNumber = `${deptPrefix}-${String(globalIdx).padStart(3, '0')}`;
      newApt.status = active.length === 0 ? 'In-Consultation' : 'Waiting';
      active.push(newApt);
    } else {
      const hasInConsultation = active.length > 0 && active[0].status === 'In-Consultation';
      const insertIndex = hasInConsultation ? 1 : 0;

      newApt.status = active.length === 0 ? 'In-Consultation' : 'Waiting';
      active.splice(insertIndex, 0, newApt);

      active.forEach((apt, i) => {
        const gIdx = i + 1;
        const bNum = Math.floor((gIdx - 1) / 5) + 1;
        const sNum = ((gIdx - 1) % 5) + 1;
        apt.globalIndex = gIdx;
        apt.batchNumber = bNum;
        apt.batchName = bNum === 1 ? 'Morning Batch (Batch 1)' : (bNum === 2 ? 'Evening Batch (Batch 2)' : `Batch ${bNum}`);
        apt.slotNumber = sNum;
        apt.tokenNumber = `${deptPrefix}-${String(gIdx).padStart(3, '0')}`;
      });
    }

    const otherDoctorsApts = appointments.filter(a => a.doctorId !== doctor.id && (!a.doctorCode || a.doctorCode !== doctor.id));
    appointments = [...otherDoctorsApts, ...nonActive, ...active];

    saveAppointments();

    addNotification({
      patientName: newApt.patientName,
      patientEmail: newApt.patientEmail,
      type: 'Appointment Confirmed',
      message: `Token ${newApt.tokenNumber} (Slot ${newApt.slotNumber}) booked with ${doctor.name} (${newApt.department}).`,
      channel: 'In-App',
      status: 'SENT ✓'
    });

    addAuditLog('Appointment Created', newApt.source, newApt.patientName, `Token ${newApt.tokenNumber}, assigned to ${doctor.name}`);

    checkAndTrigger3TurnAlerts(active);

    return newApt;
  }

  function checkAndTrigger3TurnAlerts(activeList) {
    if (!activeList || activeList.length === 0) return;
    activeList.forEach((apt, idx) => {
      if (apt.status === 'Waiting' && idx === 3 && !apt.notified3Away) {
        apt.notified3Away = true;
        addNotification({
          patientName: apt.patientName,
          patientEmail: apt.patientEmail,
          type: '3 Turns Away',
          message: 'Your turn is approaching. You are approximately 3 patients away.',
          channel: 'WhatsApp',
          status: 'SENT ✓'
        });
        addAuditLog('3-Turns Away Alert Dispatched', 'Automated Notification Engine', apt.patientName, `Token: ${apt.tokenNumber || 'Token'}`);
      }
    });
  }

  // Doctor Action 1: Call Next Patient in Line
  function callNext(doctorId) {
    const doctor = getDoctorById(doctorId);
    if (!doctor) return null;

    const doctorApts = getAppointments(doctor.id);
    const active = doctorApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');

    if (active.length === 0) return null;

    const nextWaiting = active.find(a => a.status === 'Waiting');
    if (!nextWaiting) return active[0];

    const currentInConsultation = active.find(a => a.status === 'In-Consultation');
    if (currentInConsultation) {
      currentInConsultation.status = 'Completed';
      currentInConsultation.completedAt = Date.now();
    }

    nextWaiting.status = 'In-Consultation';
    nextWaiting.consultationStartedAt = Date.now();

    saveAppointments();

    addNotification({
      patientName: nextWaiting.patientName,
      patientEmail: nextWaiting.patientEmail,
      type: 'Patient Called',
      message: `Dr. ${doctor.name} is calling you into ${doctor.room}.`,
      channel: 'In-App',
      status: 'SENT ✓'
    });

    addAuditLog('Patient Called', 'Clinical Staff / Doctor', nextWaiting.patientName, `Entered consultation with Dr. ${doctor.name}`);

    checkAndTrigger3TurnAlerts(active);

    return nextWaiting;
  }

  // Doctor Action 2: Consultation Complete (✅)
  function completeConsultation(doctorId) {
    const doctor = getDoctorById(doctorId);
    if (!doctor) return null;

    const doctorApts = getAppointments(doctor.id);
    const active = doctorApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');

    if (active.length === 0) return { message: 'No active appointments to complete.' };

    const current = active.find(a => a.status === 'In-Consultation') || active[0];
    current.status = 'Completed';
    current.completedAt = Date.now();

    const startMs = current.consultationStartedAt || (current.completedAt - 600000);
    const durationMinutes = Math.max(1, Math.round((current.completedAt - startMs) / 60000)) || 8;
    analyticsHistory.push({
      appointmentId: current.appointmentId || current.id,
      department: current.department || doctor.department || doctor.specialization,
      doctorCode: doctor.doctorCode || doctor.id,
      durationMinutes: durationMinutes,
      status: 'completed',
      completedAt: new Date(current.completedAt).toISOString()
    });
    saveAnalyticsHistory();

    const remainingActive = active.filter(a => a.id !== current.id && a.status !== 'Completed' && a.status !== 'No-Show');

    let nextInLine = null;
    if (remainingActive.length > 0) {
      nextInLine = remainingActive[0];
      nextInLine.status = 'In-Consultation';
      nextInLine.consultationStartedAt = Date.now();
    }

    saveAppointments();

    addNotification({
      patientName: current.patientName,
      patientEmail: current.patientEmail,
      type: 'Consultation Completed',
      message: `Your examination with ${doctor.name} is completed. Thank you for choosing MediQueue.`,
      channel: 'SMS',
      status: 'SENT ✓'
    });

    addAuditLog('Consultation Finished', 'Doctor / Admin', current.patientName, `Completed by Dr. ${doctor.name}`);

    checkAndTrigger3TurnAlerts(remainingActive);

    return { completedPatient: current, nextPatient: nextInLine };
  }

  // Doctor Action 3: Skip (⏭️)
  function skipPatient(appointmentId) {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return null;

    const doctorId = apt.doctorId;
    const doctorApts = getAppointments(doctorId);
    const nonActive = doctorApts.filter(a => a.status === 'Completed' || a.status === 'No-Show');
    const active = doctorApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');

    const currentIndex = active.findIndex(a => a.id === apt.id);
    if (currentIndex === -1) return null;

    active.splice(currentIndex, 1);

    const targetBatch = apt.batchNumber || 1;
    let lastBatchIndex = -1;
    for (let i = 0; i < active.length; i++) {
      if (active[i].batchNumber === targetBatch) lastBatchIndex = i;
    }

    if (lastBatchIndex !== -1) {
      active.splice(lastBatchIndex + 1, 0, apt);
    } else {
      active.push(apt);
    }

    if (apt.status === 'In-Consultation') {
      apt.status = 'Waiting';
      if (active.length > 0) {
        active[0].status = 'In-Consultation';
        active[0].consultationStartedAt = Date.now();
      }
    }

    active.forEach((a, i) => {
      const gIdx = i + 1;
      const bNum = Math.floor((gIdx - 1) / 5) + 1;
      const sNum = ((gIdx - 1) % 5) + 1;
      a.globalIndex = gIdx;
      a.batchNumber = bNum;
      a.batchName = bNum === 1 ? 'Morning Batch (Batch 1)' : (bNum === 2 ? 'Evening Batch (Batch 2)' : `Batch ${bNum}`);
      a.slotNumber = sNum;
    });

    const otherDoctorsApts = appointments.filter(a => a.doctorId !== doctorId && (!a.doctorCode || a.doctorCode !== doctorId));
    appointments = [...otherDoctorsApts, ...nonActive, ...active];

    saveAppointments();
    addAuditLog('Admin/Doctor skipped patient', 'Operator', apt.patientName, `Moved to end of batch ${apt.batchNumber}`);
    return apt;
  }

  // Doctor Action 4: Mark No-Show (❌)
  function markNoShow(appointmentId) {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return null;

    const doctorId = apt.doctorId;
    apt.status = 'No-Show';
    apt.noShowAt = Date.now();

    const doctorApts = getAppointments(doctorId);
    const nonActive = doctorApts.filter(a => a.status === 'Completed' || a.status === 'No-Show');
    const active = doctorApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');

    const hasInConsultation = active.some(a => a.status === 'In-Consultation');
    if (!hasInConsultation && active.length > 0) {
      active[0].status = 'In-Consultation';
      active[0].consultationStartedAt = Date.now();
    }

    active.forEach((a, i) => {
      const gIdx = i + 1;
      const bNum = Math.floor((gIdx - 1) / 5) + 1;
      const sNum = ((gIdx - 1) % 5) + 1;
      a.globalIndex = gIdx;
      a.batchNumber = bNum;
      a.batchName = bNum === 1 ? 'Morning Batch (Batch 1)' : (bNum === 2 ? 'Evening Batch (Batch 2)' : `Batch ${bNum}`);
      a.slotNumber = sNum;
    });

    const otherDoctorsApts = appointments.filter(a => a.doctorId !== doctorId && (!a.doctorCode || a.doctorCode !== doctorId));
    appointments = [...otherDoctorsApts, ...nonActive, ...active];

    saveAppointments();
    addAuditLog('Patient marked No-Show', 'Operator', apt.patientName, `Removed from live queue`);
    return apt;
  }

  function callPatient(appointmentId) {
    const apt = appointments.find(a => a.id === appointmentId);
    if (!apt) return null;

    appointments
      .filter(a => (a.doctorId === apt.doctorId || (a.doctorCode && a.doctorCode === apt.doctorCode)) && a.status === 'In-Consultation' && a.id !== apt.id)
      .forEach(a => { a.status = 'Waiting'; });

    apt.status = 'In-Consultation';
    apt.consultationStartedAt = Date.now();

    saveAppointments();
    addAuditLog('Patient direct call', 'Staff', apt.patientName, `Active in consulting suite`);
    return apt;
  }

  // Queue Pause & Resume (Requirement 9)
  function pauseQueue(doctorId) {
    queuePauseState[doctorId] = true;
    savePauseState();
    const doc = getDoctorById(doctorId);
    addAuditLog('Admin paused queue', 'Admin User', doc ? doc.name : doctorId, 'Queue temporarily held');
  }

  function resumeQueue(doctorId) {
    queuePauseState[doctorId] = false;
    savePauseState();
    const doc = getDoctorById(doctorId);
    addAuditLog('Admin resumed queue', 'Admin User', doc ? doc.name : doctorId, 'Queue unpaused and operational');
  }

  function isQueuePaused(doctorId) {
    return !!queuePauseState[doctorId];
  }

  // =========================================================================
  // MASTER PATIENT MANAGEMENT (Requirement 2 & 3)
  // =========================================================================
  function getPatients() {
    return [...patients];
  }

  function getPatientById(id) {
    return patients.find(p => p.id === id) || null;
  }

  function registerPatient(patientData) {
    if (!patientData.name || !patientData.phone) {
      throw new Error('Patient Name and Mobile Number are required.');
    }

    const patientCount = patients.length + 1;
    const patientId = patientData.id || `PAT-2026-${String(patientCount).padStart(4, '0')}`;

    const newPatient = {
      id: patientId,
      name: patientData.name.trim(),
      phone: patientData.phone.trim(),
      age: parseInt(patientData.age, 10) || 30,
      gender: patientData.gender || 'Not Specified',
      address: patientData.address || 'Standard City Resident',
      emergencyContact: patientData.emergencyContact || 'Family Member',
      category: patientData.category || 'Normal',
      source: patientData.source || 'STAFF',
      registeredAt: patientData.registeredAt || Date.now(),
      status: 'Active'
    };

    const existingIdx = patients.findIndex(p => p.id === newPatient.id || p.phone === newPatient.phone);
    if (existingIdx !== -1) {
      patients[existingIdx] = { ...patients[existingIdx], ...newPatient };
    } else {
      patients.push(newPatient);
    }

    savePatients();
    addAuditLog('Admin registered patient', 'Admin / Staff', newPatient.name, `Assigned ID ${newPatient.id}`);
    return newPatient;
  }

  function updatePatient(id, updates) {
    const idx = patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      patients[idx] = { ...patients[idx], ...updates };
      savePatients();
      addAuditLog('Admin updated patient profile', 'Admin User', patients[idx].name, 'Modified demographic details');
      return patients[idx];
    }
    return null;
  }

  // =========================================================================
  // STAFF MANAGEMENT (Requirement 6)
  // =========================================================================
  function getStaff() {
    return [...staff];
  }

  function addStaff(staffData) {
    const staffCount = staff.length + 1;
    const newStaff = {
      id: staffData.id || `STF-0${staffCount}`,
      name: staffData.name.trim(),
      role: staffData.role || 'Receptionist',
      department: staffData.department || 'General Medicine',
      mobile: staffData.mobile || '9876543100',
      status: staffData.status || 'Active',
      shift: staffData.shift || 'Morning Shift'
    };

    const idx = staff.findIndex(s => s.id === newStaff.id);
    if (idx !== -1) staff[idx] = newStaff;
    else staff.push(newStaff);

    saveStaff();
    addAuditLog('Admin added staff', 'Admin User', newStaff.name, `Role: ${newStaff.role}, Dept: ${newStaff.department}`);
    return newStaff;
  }

  function toggleStaffStatus(id) {
    const stf = staff.find(s => s.id === id);
    if (stf) {
      stf.status = stf.status === 'Active' ? 'Inactive' : 'Active';
      saveStaff();
      addAuditLog('Admin changed staff status', 'Admin User', stf.name, `Status set to ${stf.status}`);
      return stf;
    }
    return null;
  }

  // =========================================================================
  // DEPARTMENT MANAGEMENT (Requirement 7)
  // =========================================================================
  function getDepartments() {
    return [...departments];
  }

  function addDepartment(deptData) {
    const newDept = {
      id: deptData.id || `dept_${Date.now()}`,
      name: deptData.name.trim(),
      code: deptData.code || deptData.name.slice(0, 3).toUpperCase(),
      icon: deptData.icon || 'fa-stethoscope',
      room: deptData.room || 'OPD Wing',
      status: deptData.status || 'Active',
      assignedDoctors: deptData.assignedDoctors || []
    };

    const idx = departments.findIndex(d => d.name.toLowerCase() === newDept.name.toLowerCase());
    if (idx !== -1) departments[idx] = newDept;
    else departments.push(newDept);

    saveDepartments();
    addAuditLog('Admin created department', 'Admin User', newDept.name, `Code: ${newDept.code}`);
    return newDept;
  }

  function toggleDepartmentStatus(id) {
    const dept = departments.find(d => d.id === id);
    if (dept) {
      dept.status = dept.status === 'Active' ? 'Inactive' : 'Active';
      saveDepartments();
      addAuditLog('Admin changed department status', 'Admin User', dept.name, `Status set to ${dept.status}`);
      return dept;
    }
    return null;
  }

  // =========================================================================
  // AUDIT LOGS & NOTIFICATIONS (Requirement 14 & 19)
  // =========================================================================
  function getAuditLogs() {
    return [...auditLogs];
  }

  function addAuditLog(action, performedBy, target, details) {
    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      action,
      performedBy: performedBy || 'Admin User',
      target: target || 'System',
      timestamp: Date.now(),
      details: details || ''
    };
    auditLogs.unshift(logItem);
    if (auditLogs.length > 80) auditLogs.pop();
    saveAuditLogs();
    return logItem;
  }

  function getNotifications() {
    return [...notifications];
  }

  function addNotification(notifData) {
    const notif = {
      id: `notif_${Date.now()}`,
      patientName: notifData.patientName,
      patientEmail: notifData.patientEmail || '',
      type: notifData.type || 'Queue Update',
      message: notifData.message,
      channel: notifData.channel || 'In-App',
      timestamp: Date.now(),
      status: notifData.status || 'SENT ✓'
    };
    notifications.unshift(notif);
    if (notifications.length > 50) notifications.pop();
    saveNotifications();
    return notif;
  }

  // =========================================================================
  // SESSION & DATA RESET
  // =========================================================================
  function getCurrentUser() {
    return currentUser ? { ...currentUser } : null;
  }

  function setCurrentUser(user) {
    currentUser = user ? { ...user } : null;
    saveCurrentUser();
  }

  function clearAllData() {
    resetMemoryState();
    if (typeof localStorage !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
    }
    notify();
  }

  // =========================================================================
  // COMPREHENSIVE MULTI-DEPARTMENT DEMO DATASET (Requirement 21)
  // 7 Departments, Multiple Doctors, Staff, 30+ Realistic Patients
  // =========================================================================
  function populateDemoScenario() {
    clearAllData();

    // 1. Departments
    const depts = [
      { id: 'dept_gm', name: 'General Medicine', code: 'GEN', icon: 'fa-user-doctor', room: 'Suite 201, Wing A', status: 'Active' },
      { id: 'dept_cardio', name: 'Cardiology', code: 'CAR', icon: 'fa-heart-pulse', room: 'Suite 304, Wing C', status: 'Active' },
      { id: 'dept_neuro', name: 'Neurology', code: 'NEU', icon: 'fa-brain', room: 'Suite 412, Neuro Wing', status: 'Active' },
      { id: 'dept_odonto', name: 'Odontology', code: 'ODO', icon: 'fa-tooth', room: 'Dental Suite 102, Ground Floor', status: 'Active' },
      { id: 'dept_ortho', name: 'Orthopedics', code: 'ORT', icon: 'fa-bone', room: 'Suite 308, Wing B', status: 'Active' },
      { id: 'dept_pedia', name: 'Pediatrics', code: 'PED', icon: 'fa-baby', room: 'Suite 108, Pediatric Care', status: 'Active' },
      { id: 'dept_derma', name: 'Dermatology', code: 'DER', icon: 'fa-hand-dots', room: 'Suite 215, Wing A', status: 'Active' }
    ];
    departments = depts;

    // 2. Doctors
    const doc1 = addDoctor({
      id: 'doc_anya',
      name: 'Dr. Anya Sharma',
      age: 38,
      experience: 'Senior Consultant • 14 Yrs',
      specialization: 'Cardiologist',
      department: 'Cardiology',
      room: 'Suite 304, Wing C',
      email: 'anya.sharma@mediqueue.clinic',
      phone: '9876543201',
      availability: 'On-Duty • Morning Batch'
    });

    const doc2 = addDoctor({
      id: 'doc_marcus',
      name: 'Dr. Marcus Vance',
      age: 46,
      experience: 'Chief Neurologist • 16 Yrs',
      specialization: 'Neurologist',
      department: 'Neurology',
      room: 'Suite 412, Neuro Wing',
      email: 'marcus.vance@mediqueue.clinic',
      phone: '9876543202',
      availability: 'On-Duty • Full Day'
    });

    const doc3 = addDoctor({
      id: 'doc_sophie',
      name: 'Dr. Sophie Chen',
      age: 35,
      experience: 'Oral Surgeon • 11 Yrs',
      specialization: 'Odontologist',
      department: 'Odontology',
      room: 'Dental Suite 102, Ground Floor',
      email: 'sophie.chen@mediqueue.clinic',
      phone: '9876543203',
      availability: 'On-Duty • Morning Batch'
    });

    const doc4 = addDoctor({
      id: 'doc_hamza',
      name: 'Dr. Hamza Malik',
      age: 44,
      experience: 'Internal Medicine • 9 Yrs',
      specialization: 'General Physician',
      department: 'General Medicine',
      room: 'Suite 201, Wing A',
      email: 'hamza.malik@mediqueue.clinic',
      phone: '9876543204',
      availability: 'On-Duty • Afternoon Batch'
    });

    const doc5 = addDoctor({
      id: 'doc_alina',
      name: 'Dr. Alina Davis',
      age: 34,
      experience: 'Child Specialist • 12 Yrs',
      specialization: 'Pediatrician',
      department: 'Pediatrics',
      room: 'Suite 108, Pediatric Care',
      email: 'alina.davis@mediqueue.clinic',
      phone: '9876543205',
      availability: 'On-Duty • Morning Batch'
    });

    // Link doctors to departments
    departments[0].assignedDoctors = [doc4.id];
    departments[1].assignedDoctors = [doc1.id];
    departments[2].assignedDoctors = [doc2.id];
    departments[3].assignedDoctors = [doc3.id];
    departments[5].assignedDoctors = [doc5.id];

    // 3. Clinical & Administrative Staff
    staff = [
      { id: 'STF-01', name: 'Rajesh Verma', role: 'OPD Coordinator', department: 'General Medicine', mobile: '9876543101', status: 'Active', shift: 'Morning Shift' },
      { id: 'STF-02', name: 'Sister Priya Nair', role: 'Triage Nurse', department: 'Cardiology', mobile: '9876543102', status: 'Active', shift: 'Morning Shift' },
      { id: 'STF-03', name: 'Sunita Menon', role: 'Kiosk Receptionist', department: 'Central Reception', mobile: '9876543103', status: 'Active', shift: 'Full Day' },
      { id: 'STF-04', name: 'Kavita Das', role: 'Triage Nurse', department: 'Neurology', mobile: '9876543104', status: 'Active', shift: 'Morning Shift' },
      { id: 'STF-05', name: 'Anil Kapoor', role: 'Helpdesk Executive', department: 'Central Reception', mobile: '9876543105', status: 'Active', shift: 'Evening Shift' },
      { id: 'STF-06', name: 'Meera Iyer', role: 'Clinical Assistant', department: 'Odontology', mobile: '9876543106', status: 'Active', shift: 'Morning Shift' }
    ];

    // 4. Over 30 Realistic Patients across Departments
    const patientSeeds = [
      // Cardiology (10 Patients)
      { name: 'David Kim', phone: '9876543210', age: 52, gender: 'Male', doc: 'doc_anya', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Amara Miller', phone: '9876543211', age: 29, gender: 'Female', doc: 'doc_anya', cat: 'Pregnant Woman', src: 'PATIENT PORTAL' },
      { name: 'Liam Chen', phone: '9876543212', age: 44, gender: 'Male', doc: 'doc_anya', cat: 'Normal', src: 'KIOSK' },
      { name: 'Sarah Jenkins', phone: '9876543213', age: 35, gender: 'Female', doc: 'doc_anya', cat: 'Normal', src: 'STAFF' },
      { name: 'Robert Kowalski', phone: '9876543214', age: 76, gender: 'Male', doc: 'doc_anya', cat: 'Elderly', src: 'STAFF' },
      { name: 'Elena Rostova', phone: '9876543215', age: 40, gender: 'Female', doc: 'doc_anya', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Siddharth Rao', phone: '9876543241', age: 61, gender: 'Male', doc: 'doc_anya', cat: 'Elderly', src: 'KIOSK' },
      { name: 'Fatima Al-Sayed', phone: '9876543242', age: 31, gender: 'Female', doc: 'doc_anya', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'George Taylor', phone: '9876543243', age: 68, gender: 'Male', doc: 'doc_anya', cat: 'Emergency', src: 'STAFF' },
      { name: 'Pooja Hegde', phone: '9876543244', age: 26, gender: 'Female', doc: 'doc_anya', cat: 'Normal', src: 'KIOSK' },

      // Neurology (8 Patients)
      { name: 'Chloe Bennett', phone: '9876543216', age: 33, gender: 'Female', doc: 'doc_marcus', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Noah Patel', phone: '9876543217', age: 48, gender: 'Male', doc: 'doc_marcus', cat: 'Normal', src: 'STAFF' },
      { name: 'Grace Hopper', phone: '9876543218', age: 72, gender: 'Female', doc: 'doc_marcus', cat: 'Elderly', src: 'STAFF' },
      { name: 'Vikram Seth', phone: '9876543245', age: 55, gender: 'Male', doc: 'doc_marcus', cat: 'Normal', src: 'KIOSK' },
      { name: 'Zoya Akhtar', phone: '9876543246', age: 29, gender: 'Female', doc: 'doc_marcus', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Arthur Pendelton', phone: '9876543247', age: 81, gender: 'Male', doc: 'doc_marcus', cat: 'Elderly', src: 'STAFF' },
      { name: 'Nandini Roy', phone: '9876543248', age: 37, gender: 'Female', doc: 'doc_marcus', cat: 'Normal', src: 'KIOSK' },
      { name: 'Aarav Malhotra', phone: '9876543249', age: 19, gender: 'Male', doc: 'doc_marcus', cat: 'Normal', src: 'PATIENT PORTAL' },

      // Odontology (6 Patients)
      { name: 'Maya Lin', phone: '9876543219', age: 27, gender: 'Female', doc: 'doc_sophie', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'James Wilson', phone: '9876543220', age: 39, gender: 'Male', doc: 'doc_sophie', cat: 'Emergency', src: 'STAFF' },
      { name: 'Natasha Roman', phone: '9876543250', age: 34, gender: 'Female', doc: 'doc_sophie', cat: 'Normal', src: 'KIOSK' },
      { name: 'Kunal Deshmukh', phone: '9876543251', age: 42, gender: 'Male', doc: 'doc_sophie', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Ananya Roy', phone: '9876543252', age: 23, gender: 'Female', doc: 'doc_sophie', cat: 'Normal', src: 'STAFF' },
      { name: 'Carlos Mendez', phone: '9876543253', age: 50, gender: 'Male', doc: 'doc_sophie', cat: 'Normal', src: 'KIOSK' },

      // General Medicine (6 Patients)
      { name: 'Rohan Sharma', phone: '9876543254', age: 36, gender: 'Male', doc: 'doc_hamza', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Sneha Kulkarni', phone: '9876543255', age: 67, gender: 'Female', doc: 'doc_hamza', cat: 'Elderly', src: 'STAFF' },
      { name: 'Mohit Chawla', phone: '9876543256', age: 28, gender: 'Male', doc: 'doc_hamza', cat: 'Normal', src: 'KIOSK' },
      { name: 'Aparna Sen', phone: '9876543257', age: 45, gender: 'Female', doc: 'doc_hamza', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Harish Bajaj', phone: '9876543258', age: 74, gender: 'Male', doc: 'doc_hamza', cat: 'Elderly', src: 'STAFF' },
      { name: 'Deepa Krishnan', phone: '9876543259', age: 32, gender: 'Female', doc: 'doc_hamza', cat: 'Normal', src: 'KIOSK' },

      // Pediatrics (4 Patients)
      { name: 'Baby Aarush (Parent: Neha)', phone: '9876543260', age: 4, gender: 'Male', doc: 'doc_alina', cat: 'Normal', src: 'PATIENT PORTAL' },
      { name: 'Anvi Mehta (Parent: Ritu)', phone: '9876543261', age: 7, gender: 'Female', doc: 'doc_alina', cat: 'Emergency', src: 'STAFF' },
      { name: 'Ishaan Verma (Parent: Alok)', phone: '9876543262', age: 2, gender: 'Male', doc: 'doc_alina', cat: 'Normal', src: 'KIOSK' },
      { name: 'Myra Khan (Parent: Sana)', phone: '9876543263', age: 5, gender: 'Female', doc: 'doc_alina', cat: 'Normal', src: 'PATIENT PORTAL' }
    ];

    patientSeeds.forEach(seed => {
      addAppointment({
        doctorId: seed.doc,
        patientName: seed.name,
        patientAge: seed.age,
        patientPhone: seed.phone,
        patientEmail: `${seed.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@example.com`,
        gender: seed.gender,
        category: seed.cat,
        source: seed.src
      });
    });

    // Seed realistic audit log history
    auditLogs = [
      { id: 'log_01', action: 'System Initialized', performedBy: 'Super Admin', target: 'MediQueue System', timestamp: Date.now() - 3600000, details: 'Initialized 7 clinical departments and OPD queues' },
      { id: 'log_02', action: 'Doctor Assigned', performedBy: 'Admin User', target: 'Dr. Anya Sharma', timestamp: Date.now() - 3200000, details: 'Assigned to Cardiology Department (Suite 304)' },
      { id: 'log_03', action: 'Doctor Assigned', performedBy: 'Admin User', target: 'Dr. Marcus Vance', timestamp: Date.now() - 2800000, details: 'Assigned to Neurology Department (Suite 412)' },
      { id: 'log_04', action: 'Doctor Assigned', performedBy: 'Admin User', target: 'Dr. Sophie Chen', timestamp: Date.now() - 2400000, details: 'Assigned to Odontology Department (Suite 102)' },
      { id: 'log_05', action: 'Staff Assigned', performedBy: 'Admin User', target: 'Sister Priya Nair', timestamp: Date.now() - 2000000, details: 'Assigned as Triage Nurse to Cardiology' },
      { id: 'log_06', action: 'Priority Insertion', performedBy: 'Triage System', target: 'Robert Kowalski', timestamp: Date.now() - 1400000, details: 'Elderly patient dynamically allocated to Slot 1 priority' },
      { id: 'log_07', action: '3-Turns-Away Triggered', performedBy: 'Automated Engine', target: 'Sarah Jenkins', timestamp: Date.now() - 800000, details: 'Distance equals 3 turns; in-app banner and Web3Forms notification dispatched' }
    ];

    saveDepartments();
    saveStaff();
    saveAuditLogs();

    return doc1;
  }

  // Auto-initialize
  init();

  return {
    init,
    subscribe,
    getDoctors,
    getDoctorById,
    addDoctor,
    updateDoctor,
    toggleDoctorStatus,
    assignDoctorToDepartment,
    getAppointments,
    getActiveAppointments,
    getInConsultationAppointment,
    addAppointment,
    callNext,
    completeConsultation,
    skipPatient,
    markNoShow,
    callPatient,
    pauseQueue,
    resumeQueue,
    isQueuePaused,
    getPatients,
    getPatientById,
    registerPatient,
    updatePatient,
    getStaff,
    addStaff,
    toggleStaffStatus,
    getDepartments,
    addDepartment,
    toggleDepartmentStatus,
    getAuditLogs,
    addAuditLog,
    getNotifications,
    addNotification,
    getCurrentUser,
    setCurrentUser,
    clearAllData,
    populateDemoScenario,
    saveAppointments,
    getAnalyticsHistory: () => [...analyticsHistory]
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QueueStore;
}
if (typeof window !== 'undefined') {
  window.QueueStore = QueueStore;
}
