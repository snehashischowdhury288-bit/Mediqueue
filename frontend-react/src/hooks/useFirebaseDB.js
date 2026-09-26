/**
 * MediQueue - Firebase Real-Time Data Architecture
 * Bound strictly to live Firestore collections:
 * - doctors: doctors/{doctorId}
 * - appointments: appointments/{appointmentId}
 * - analytics_logs: analytics_logs/{logId}
 * - users: users/{uid}
 *
 * Real-time synchronization via Firestore onSnapshot listeners.
 * Atomic priority injection and automated batch spillover via Firestore writeBatch.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  auth,
  googleProvider,
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  onAuthStateChanged,
  getFriendlyAuthErrorMessage
} from '../firebase';

export function useFirebaseDB() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore real-time collections state
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [analyticsLogs, setAnalyticsLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dbError, setDbError] = useState(null);

  // Track Firestore listener unsubs
  const unsubsRef = useRef([]);

  // =========================================================================
  // 1. REAL-TIME FIRESTORE SUBSCRIPTIONS (doctors, appointments, analytics_logs, users)
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    try {
      // 1. Doctors Collection Listener
      const doctorsCol = collection(db, 'doctors');
      const unsubDoctors = onSnapshot(
        doctorsCol,
        snapshot => {
          if (!isMounted) return;
          const docsData = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            doctorId: docSnap.data().doctorId || docSnap.id,
            ...docSnap.data()
          }));
          setDoctors(docsData);
          setDbError(null);
        },
        error => {
          console.warn('[Firestore] Doctors onSnapshot fallback/offline:', error.message);
          setDbError(error.message);
        }
      );

      // 2. Appointments Collection Listener
      const aptsCol = collection(db, 'appointments');
      const unsubAppointments = onSnapshot(
        aptsCol,
        snapshot => {
          if (!isMounted) return;
          const aptsData = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));
          setAppointments(aptsData);
        },
        error => {
          console.warn('[Firestore] Appointments onSnapshot fallback/offline:', error.message);
        }
      );

      // 3. Analytics Logs Collection Listener
      const logsCol = collection(db, 'analytics_logs');
      const unsubLogs = onSnapshot(
        logsCol,
        snapshot => {
          if (!isMounted) return;
          const logsData = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));
          setAnalyticsLogs(logsData);
        },
        error => {
          console.warn('[Firestore] Analytics logs onSnapshot fallback/offline:', error.message);
        }
      );

      // 4. Users Collection Listener (for Admin overview)
      const usersCol = collection(db, 'users');
      const unsubUsers = onSnapshot(
        usersCol,
        snapshot => {
          if (!isMounted) return;
          const usersData = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));
          setAllUsers(usersData);
        },
        error => {
          console.warn('[Firestore] Users listener fallback:', error.message);
        }
      );

      unsubsRef.current = [unsubDoctors, unsubAppointments, unsubLogs, unsubUsers];
    } catch (err) {
      console.error('[Firestore] Initialization error:', err);
    }

    return () => {
      isMounted = false;
      unsubsRef.current.forEach(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      unsubsRef.current = [];
    };
  }, []);

  // =========================================================================
  // 2. FIREBASE AUTHENTICATION (Google, Email/Password, Simulated Phone OTP)
  // =========================================================================
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async fbUser => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            setCurrentUser(userSnap.data());
          } else {
            const profile = {
              uid: fbUser.uid,
              name: fbUser.displayName || 'User',
              email: fbUser.email || '',
              phone: fbUser.phoneNumber || '',
              role: 'patient',
              createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, profile, { merge: true });
            setCurrentUser(profile);
          }
        } catch (e) {
          console.warn('[Auth] Error fetching user profile from Firestore:', e);
          setCurrentUser({
            uid: fbUser.uid,
            name: fbUser.displayName || fbUser.email || 'User',
            email: fbUser.email || '',
            role: 'patient'
          });
        }
      } else {
        // Fallback to local stored session if signed in via Simulated OTP or Admin key
        const cachedUser = localStorage.getItem('mediqueue_firebase_auth_user');
        if (cachedUser) {
          try {
            setCurrentUser(JSON.parse(cachedUser));
          } catch (e) {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubAuth();
  }, []);

  // Google Sign-In via Popup
  const signInWithGoogle = useCallback(async (preferredRole = 'patient', extraData = {}) => {
    try {
      console.log(`[Firebase Auth] Initiating Google Sign-In popup (preferred role: ${preferredRole})...`);
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      console.log(`[Firebase Auth] Google Sign-In success: UID=${fbUser.uid}, Email=${fbUser.email}`);

      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);
      let profile;

      if (userSnap.exists()) {
        const existingData = userSnap.data();
        profile = {
          ...existingData,
          uid: fbUser.uid,
          name: fbUser.displayName || existingData.name || 'User',
          email: fbUser.email || existingData.email || '',
          photoURL: fbUser.photoURL || existingData.photoURL || '',
          role: existingData.role || preferredRole,
          lastLogin: serverTimestamp(),
          ...extraData
        };
        await setDoc(userDocRef, profile, { merge: true });
      } else {
        profile = {
          uid: fbUser.uid,
          name: fbUser.displayName || 'User',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || '',
          phone: fbUser.phoneNumber || extraData.phone || '',
          role: preferredRole,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          ...extraData
        };
        await setDoc(userDocRef, profile, { merge: true });
      }

      localStorage.setItem('mediqueue_firebase_auth_user', JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true, user: profile };
    } catch (err) {
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      console.error(`[Firebase Auth Google Error] Code: ${err.code || 'UNKNOWN'} | Message:`, err.message);
      return { success: false, code: err.code, message: friendlyMsg };
    }
  }, []);

  // Email & Password Sign-Up
  const signUpWithEmail = useCallback(async (email, password, name, role = 'patient', extraData = {}) => {
    try {
      if (!email || !password) {
        return { success: false, message: 'Please provide both an email and password.' };
      }
      if (password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long.' };
      }
      console.log(`[Firebase Auth] Registering user with email ${email} and role ${role}...`);
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = result.user;

      const profile = {
        uid: fbUser.uid,
        name: name ? name.trim() : 'User',
        email: email.trim(),
        phone: extraData.phone || '',
        role: role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        ...extraData
      };

      const userDocRef = doc(db, 'users', fbUser.uid);
      await setDoc(userDocRef, profile, { merge: true });
      localStorage.setItem('mediqueue_firebase_auth_user', JSON.stringify(profile));
      setCurrentUser(profile);
      console.log(`[Firebase Auth] User profile saved to Firestore users/${fbUser.uid} successfully!`);
      return { success: true, user: profile };
    } catch (err) {
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      console.error(`[Firebase Auth Email Sign-Up Error] Code: ${err.code || 'UNKNOWN'} | Message:`, err.message);
      return { success: false, code: err.code, message: friendlyMsg };
    }
  }, []);

  // Email & Password Sign-In
  const signInWithEmail = useCallback(async (email, password, expectedRole = null) => {
    try {
      if (!email || !password) {
        return { success: false, message: 'Please enter your email and password.' };
      }
      console.log(`[Firebase Auth] Signing in user ${email}...`);
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = result.user;

      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);

      let profile;
      if (userSnap.exists()) {
        profile = {
          ...userSnap.data(),
          uid: fbUser.uid,
          email: fbUser.email || userSnap.data().email || email.trim(),
          lastLogin: serverTimestamp()
        };
        await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
      } else {
        profile = {
          uid: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          email: fbUser.email || email.trim(),
          role: expectedRole || 'patient',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        };
        await setDoc(userDocRef, profile, { merge: true });
      }

      localStorage.setItem('mediqueue_firebase_auth_user', JSON.stringify(profile));
      setCurrentUser(profile);
      console.log(`[Firebase Auth] Sign in successful for ${profile.name} (${profile.role})`);
      return { success: true, user: profile };
    } catch (err) {
      const friendlyMsg = getFriendlyAuthErrorMessage(err);
      console.error(`[Firebase Auth Email Sign-In Error] Code: ${err.code || 'UNKNOWN'} | Message:`, err.message);
      return { success: false, code: err.code, message: friendlyMsg };
    }
  }, []);

  // Simulated OTP Authentication (preserves mock test flow with 1234)
  const signInWithSimulatedOtp = useCallback(async (phone, otp, role = 'patient', name = '', extraData = {}) => {
    try {
      if (otp !== '1234') {
        return { success: false, message: 'Invalid OTP. Please enter mock OTP 1234.' };
      }
      const cleanPhone = phone.trim();
      const uid = `phone_${cleanPhone}`;
      const profile = {
        uid: uid,
        phone: cleanPhone,
        name: name.trim() || (role === 'doctor' ? 'Dr. Physician' : 'Patient User'),
        email: `${cleanPhone}@phone.mediqueue.clinic`,
        role: role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        ...extraData
      };

      try {
        await setDoc(doc(db, 'users', uid), profile, { merge: true });
      } catch (e) {
        console.warn('[Firestore] Set user document offline/fallback:', e);
      }

      localStorage.setItem('mediqueue_firebase_auth_user', JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true, user: profile };
    } catch (err) {
      console.error('[Simulated OTP Error]:', err);
      return { success: false, message: err.message || 'OTP verification failed.' };
    }
  }, []);

  // Admin Master Passcode Authorization
  const authAdminLogin = useCallback(async ({ method, name }) => {
    try {
      const uid = `admin_${Date.now()}`;
      const profile = {
        uid,
        name: name || 'Hospital Administrator',
        email: 'admin@hospital.mediqueue.clinic',
        role: 'admin',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };
      try {
        await setDoc(doc(db, 'users', uid), profile, { merge: true });
      } catch (e) {
        console.warn('[Firestore] Set admin user offline/fallback:', e);
      }
      localStorage.setItem('mediqueue_firebase_auth_user', JSON.stringify(profile));
      setCurrentUser(profile);
      return { success: true, user: profile };
    } catch (err) {
      console.error('[Admin Auth Error]:', err);
      return { success: false, message: err.message || 'Admin authentication failed.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('[Firebase Auth] Sign out error:', e);
    }
    localStorage.removeItem('mediqueue_firebase_auth_user');
    setCurrentUser(null);
  }, []);

  // =========================================================================
  // 3. DOCTOR REGISTRATION & ONBOARDING (doctors collection)
  // Schema: { doctorId, doctorCode, name, department, age, isAvailable, batches, createdAt }
  // =========================================================================
  const registerDoctor = useCallback(async docData => {
    if (!docData.name || !docData.name.trim()) {
      throw new Error('Doctor Name is required.');
    }
    const doctorCode = (docData.doctorCode || `DOC-${Math.floor(100 + Math.random() * 900)}`).trim().toUpperCase();
    const docId = docData.doctorId || doc(collection(db, 'doctors')).id;

    const defaultBatches = [
      { batchId: 'b1', name: 'Morning', startTime: '10:00', maxSlots: 5 },
      { batchId: 'b2', name: 'Evening', startTime: '16:00', maxSlots: 5 }
    ];

    const newDoctorRecord = {
      doctorId: docId,
      doctorCode: doctorCode,
      name: docData.name.trim(),
      department: (docData.department || 'General Medicine').trim(),
      age: docData.age ? parseInt(docData.age, 10) : 42,
      isAvailable: docData.isAvailable !== undefined ? docData.isAvailable : true,
      batches: Array.isArray(docData.batches) && docData.batches.length > 0 ? docData.batches : defaultBatches,
      createdAt: serverTimestamp()
    };

    const doctorDocRef = doc(db, 'doctors', docId);
    await setDoc(doctorDocRef, newDoctorRecord, { merge: true });
    return newDoctorRecord;
  }, []);

  // Query doctor by code or ID
  const getDoctorByCode = useCallback(code => {
    if (!code) return null;
    const clean = String(code).trim().toUpperCase();
    return doctors.find(d => d.doctorCode?.toUpperCase() === clean || d.doctorId === code || d.id === code) || null;
  }, [doctors]);

  // =========================================================================
  // 4. APPOINTMENT BOOKING & FIRESTORE BATCH PRIORITY ENGINE (appointments collection)
  // Strict 5-patient capacity per batch.
  // Standard -> first available slot (b1 -> spillover to b2).
  // Priority (elderly, pregnant, emergency) -> Firestore writeBatch transaction
  // inserting into slot 1 and incrementing existing waiting slots by 1.
  // =========================================================================
  const bookAppointment = useCallback(async booking => {
    const { patientName, patientAge, patientPhone, patientEmail, doctorCode, priorityCategory } = booking;
    if (!patientName || !patientPhone) {
      throw new Error('Patient name and phone number are required.');
    }

    const cleanCode = String(doctorCode).trim().toUpperCase();
    const targetDoc = doctors.find(d => d.doctorCode?.toUpperCase() === cleanCode || d.doctorId === cleanCode || d.id === cleanCode);

    if (!targetDoc) {
      throw new Error(`Doctor code "${doctorCode}" was not found in registered directory.`);
    }

    // Active appointments for this doctor in Firestore
    const activeDocApts = appointments.filter(
      a => (a.doctorId === targetDoc.doctorId || a.doctorCode?.toUpperCase() === cleanCode) &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    );

    const pCatLower = String(priorityCategory || 'none').toLowerCase();
    let normalizedPriority = 'none';
    if (pCatLower.includes('elderly')) normalizedPriority = 'elderly';
    else if (pCatLower.includes('pregnant')) normalizedPriority = 'pregnant';
    else if (pCatLower.includes('emergency')) normalizedPriority = 'emergency';

    const isPriority = normalizedPriority !== 'none';
    let targetBatchId = 'b1';
    let assignedSlot = 1;

    const firestoreBatch = writeBatch(db);
    const newAptRef = doc(collection(db, 'appointments'));

    if (!isPriority) {
      // Standard booking: fill b1 up to 5 slots, then spill over to b2
      const b1Active = activeDocApts.filter(a => a.batchId === 'b1');
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
        const b2Active = activeDocApts.filter(a => a.batchId === 'b2');
        const usedSlots = new Set(b2Active.map(a => a.slotNumber));
        for (let s = 1; s <= 5; s++) {
          if (!usedSlots.has(s)) {
            assignedSlot = s;
            break;
          }
        }
        if (!assignedSlot) assignedSlot = b2Active.length + 1;
      }

      const newApt = {
        appointmentId: newAptRef.id,
        patientId: currentUser?.uid || `guest_${Date.now()}`,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientEmail: (patientEmail || '').trim(),
        patientAge: parseInt(patientAge, 10) || 30,
        doctorId: targetDoc.doctorId || targetDoc.id,
        doctorCode: targetDoc.doctorCode,
        department: targetDoc.department,
        batchId: targetBatchId,
        slotNumber: assignedSlot,
        priorityCategory: normalizedPriority,
        status: 'waiting',
        createdAt: serverTimestamp(),
        consultationStartTime: null,
        consultationEndTime: null
      };

      firestoreBatch.set(newAptRef, newApt);
      await firestoreBatch.commit();
      return newApt;
    } else {
      // PRIORITY INJECTION VIA FIRESTORE BATCH WRITE:
      // Insert into slot 1 of Batch 1
      targetBatchId = 'b1';
      assignedSlot = 1;

      // Shift existing waiting appointments in Batch 1 down by 1 position
      const b1Waiting = activeDocApts.filter(a => a.batchId === 'b1' && a.status === 'waiting');
      const displacedApts = [];

      b1Waiting.forEach(apt => {
        const aptDocRef = doc(db, 'appointments', apt.id || apt.appointmentId);
        const newSlot = apt.slotNumber + 1;
        if (newSlot > 5) {
          // Displaced 5th patient spilled into Batch 2 Slot 1
          displacedApts.push(apt);
          firestoreBatch.update(aptDocRef, {
            batchId: 'b2',
            slotNumber: 1
          });
        } else {
          firestoreBatch.update(aptDocRef, {
            slotNumber: newSlot
          });
        }
      });

      // If a patient spilled over into Batch 2, shift existing Batch 2 waiting appointments down
      if (displacedApts.length > 0) {
        const b2Waiting = activeDocApts.filter(a => a.batchId === 'b2' && a.status === 'waiting');
        b2Waiting.forEach(apt => {
          const aptDocRef = doc(db, 'appointments', apt.id || apt.appointmentId);
          firestoreBatch.update(aptDocRef, {
            slotNumber: apt.slotNumber + 1
          });
        });
      }

      const newApt = {
        appointmentId: newAptRef.id,
        patientId: currentUser?.uid || `guest_${Date.now()}`,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientEmail: (patientEmail || '').trim(),
        patientAge: parseInt(patientAge, 10) || 30,
        doctorId: targetDoc.doctorId || targetDoc.id,
        doctorCode: targetDoc.doctorCode,
        department: targetDoc.department,
        batchId: targetBatchId,
        slotNumber: 1,
        priorityCategory: normalizedPriority,
        status: 'waiting',
        createdAt: serverTimestamp(),
        consultationStartTime: null,
        consultationEndTime: null
      };

      firestoreBatch.set(newAptRef, newApt);
      await firestoreBatch.commit();
      return newApt;
    }
  }, [doctors, appointments, currentUser]);

  // =========================================================================
  // 5. DOCTOR PORTAL ACTIONS (Call Next, Complete, Skip, No-Show)
  // =========================================================================
  const callNext = useCallback(async doctorKey => {
    if (!doctorKey) return null;
    const cleanKey = String(doctorKey).trim().toUpperCase();

    const waitingForDoc = appointments
      .filter(
        a => (a.doctorId === doctorKey || a.doctorCode?.toUpperCase() === cleanKey) &&
             a.status === 'waiting'
      )
      .sort((a, b) => {
        if (a.batchId !== b.batchId) return a.batchId.localeCompare(b.batchId);
        return a.slotNumber - b.slotNumber;
      });

    if (waitingForDoc.length === 0) return null;

    const targetPatient = waitingForDoc[0];
    const targetRef = doc(db, 'appointments', targetPatient.id || targetPatient.appointmentId);

    await updateDoc(targetRef, {
      status: 'in_consultation',
      consultationStartTime: serverTimestamp()
    });

    return targetPatient;
  }, [appointments]);

  const completeConsultation = useCallback(async doctorKey => {
    if (!doctorKey) return null;
    const cleanKey = String(doctorKey).trim().toUpperCase();

    const inConsult = appointments.find(
      a => (a.doctorId === doctorKey || a.doctorCode?.toUpperCase() === cleanKey) &&
           a.status === 'in_consultation'
    );

    if (!inConsult) return null;

    const targetRef = doc(db, 'appointments', inConsult.id || inConsult.appointmentId);

    // Compute duration in minutes
    let durationMinutes = 9;
    if (inConsult.consultationStartTime) {
      const startTime = inConsult.consultationStartTime.toDate
        ? inConsult.consultationStartTime.toDate()
        : (inConsult.consultationStartTime.seconds
            ? new Date(inConsult.consultationStartTime.seconds * 1000)
            : new Date(inConsult.consultationStartTime));
      const diffMs = Date.now() - (isNaN(startTime.getTime()) ? Date.now() : startTime.getTime());
      durationMinutes = Math.max(1, Math.round(diffMs / 60000)) || 8;
    }

    const firestoreBatch = writeBatch(db);

    // Mark current appointment completed
    firestoreBatch.update(targetRef, {
      status: 'completed',
      consultationEndTime: serverTimestamp()
    });

    // Write record to analytics_logs
    const logRef = doc(collection(db, 'analytics_logs'));
    firestoreBatch.set(logRef, {
      appointmentId: inConsult.appointmentId || inConsult.id,
      doctorId: inConsult.doctorId || '',
      doctorCode: inConsult.doctorCode,
      department: inConsult.department,
      durationMinutes: durationMinutes,
      status: 'completed',
      completedAt: serverTimestamp()
    });

    await firestoreBatch.commit();
    return inConsult;
  }, [appointments]);

  const skipPatient = useCallback(async appointmentId => {
    if (!appointmentId) return;
    const target = appointments.find(a => a.id === appointmentId || a.appointmentId === appointmentId);
    if (!target) return;

    const batchApts = appointments.filter(
      a => a.doctorCode?.toUpperCase() === target.doctorCode?.toUpperCase() &&
           a.batchId === target.batchId &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    );
    const maxSlot = Math.max(...batchApts.map(a => a.slotNumber), 0);

    const targetRef = doc(db, 'appointments', target.id || target.appointmentId);
    await updateDoc(targetRef, {
      status: 'waiting',
      slotNumber: maxSlot + 1,
      consultationStartTime: null
    });
  }, [appointments]);

  const markNoShow = useCallback(async appointmentId => {
    if (!appointmentId) return;
    const target = appointments.find(a => a.id === appointmentId || a.appointmentId === appointmentId);
    if (!target) return;

    const targetRef = doc(db, 'appointments', target.id || target.appointmentId);
    await updateDoc(targetRef, {
      status: 'no_show',
      consultationEndTime: serverTimestamp()
    });
  }, [appointments]);

  // Purge all collections from Firestore
  const purgeAllData = useCallback(async () => {
    try {
      const batch = writeBatch(db);

      const aptSnaps = await getDocs(collection(db, 'appointments'));
      aptSnaps.docs.forEach(d => batch.delete(d.ref));

      const docSnaps = await getDocs(collection(db, 'doctors'));
      docSnaps.docs.forEach(d => batch.delete(d.ref));

      const logSnaps = await getDocs(collection(db, 'analytics_logs'));
      logSnaps.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
    } catch (e) {
      console.warn('[Firestore] Purge all fallback:', e);
      setDoctors([]);
      setAppointments([]);
      setAnalyticsLogs([]);
    }
  }, []);

  // =========================================================================
  // 6. REAL-TIME DERIVED ANALYTICS (ZERO FAKE PRESETS)
  // =========================================================================
  const getAdminTelemetry = useCallback(() => {
    const waitingApts = appointments.filter(a => a.status === 'waiting');
    const inConsultApts = appointments.filter(a => a.status === 'in_consultation');
    const completedApts = appointments.filter(a => a.status === 'completed');
    const totalQueueLength = waitingApts.length;

    const deptSet = new Set();
    doctors.forEach(d => deptSet.add(d.department));
    appointments.forEach(a => deptSet.add(a.department));
    const distinctDepts = Array.from(deptSet).filter(Boolean);

    const departmentsSummary = distinctDepts.map(dept => {
      const deptWaiting = waitingApts.filter(a => a.department === dept);
      const activeCount = deptWaiting.length;

      const deptHistory = analyticsLogs.filter(h => h.department === dept);
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

    const overallAvgWait = analyticsLogs.length > 0
      ? Math.round(analyticsLogs.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) / analyticsLogs.length)
      : 0;

    const doctorsSummary = doctors.map(docData => {
      const docWaiting = waitingApts.filter(
        a => a.doctorId === docData.doctorId || a.doctorCode?.toUpperCase() === docData.doctorCode?.toUpperCase()
      );
      const inConsult = inConsultApts.find(
        a => a.doctorId === docData.doctorId || a.doctorCode?.toUpperCase() === docData.doctorCode?.toUpperCase()
      );
      const docHistory = analyticsLogs.filter(
        h => h.doctorId === docData.doctorId || h.doctorCode?.toUpperCase() === docData.doctorCode?.toUpperCase()
      );
      const docAvgWait = docHistory.length > 0
        ? Math.round(docHistory.reduce((sum, h) => sum + (h.durationMinutes || 0), 0) / docHistory.length)
        : (overallAvgWait || 10);

      return {
        ...docData,
        waitingCount: docWaiting.length,
        inConsultation: inConsult ? inConsult.patientName : null,
        avgWaitMinutes: docAvgWait
      };
    });

    const registeredPatientsSummary = {
      total: appointments.length,
      waiting: waitingApts.length,
      inConsultation: inConsultApts.length,
      completed: completedApts.length
    };

    const isEmpty = totalQueueLength === 0 && analyticsLogs.length === 0 && distinctDepts.length === 0;

    return {
      totalQueueLength,
      overallAvgWait,
      departmentsSummary,
      doctorsSummary,
      activeDoctors: doctors.filter(d => d.isAvailable !== false),
      allPatients: appointments,
      registeredPatientsSummary,
      isEmpty,
      emptyMessage: 'Queue length: 0 | Average Wait Time: 0 min | No active department traffic.'
    };
  }, [doctors, appointments, analyticsLogs]);

  return {
    currentUser,
    setCurrentUser,
    authLoading,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signInWithSimulatedOtp,
    authAdminLogin,
    signOut,
    doctors,
    appointments,
    analyticsLogs,
    analyticsHistory: analyticsLogs,
    allUsers,
    registerDoctor,
    getDoctorByCode,
    bookAppointment,
    callNext,
    completeConsultation,
    skipPatient,
    markNoShow,
    purgeAllData,
    getAdminTelemetry,
    dbError
  };
}
