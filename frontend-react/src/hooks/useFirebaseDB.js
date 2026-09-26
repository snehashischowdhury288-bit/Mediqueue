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
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  onAuthStateChanged,
  getFriendlyAuthErrorMessage
} from '../firebase';
import {
  calculateDoctorConsultationPace,
  calculatePatientWaitTime,
  getEpochTimestamp,
  isCompletedToday
} from './useWaitTimePrediction';

export function useFirebaseDB() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore real-time collections state
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [analyticsLogs, setAnalyticsLogs] = useState([]);
  const [historicalConsultations, setHistoricalConsultations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dbError, setDbError] = useState(null);

  // Track Firestore listener unsubs
  const unsubsRef = useRef([]);

  // =========================================================================
  // 1. REAL-TIME FIRESTORE SUBSCRIPTIONS (doctors, appointments, analytics_logs, historicalConsultations, users)
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

      // 4. Historical Consultations Listener (Wait-Time Prediction Model Training Data)
      const histCol = collection(db, 'historicalConsultations');
      const unsubHist = onSnapshot(
        histCol,
        snapshot => {
          if (!isMounted) return;
          const histData = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));
          setHistoricalConsultations(histData);
        },
        error => {
          console.warn('[Firestore] historicalConsultations fallback/offline:', error.message);
        }
      );

      // 5. Users Collection Listener (for Admin overview)
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

      unsubsRef.current = [unsubDoctors, unsubAppointments, unsubLogs, unsubHist, unsubUsers];
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

    // Check for redirect result on page return (if popup was blocked or redirect was used)
    getRedirectResult(auth)
      .then(async result => {
        if (result && result.user) {
          const fbUser = result.user;
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);
          let profile;
          const savedRole = localStorage.getItem('mediqueue_pending_auth_role') || 'patient';
          if (userSnap.exists()) {
            profile = { ...userSnap.data(), lastLogin: serverTimestamp() };
            await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
          } else {
            profile = {
              uid: fbUser.uid,
              name: fbUser.displayName || 'User',
              email: fbUser.email || '',
              photoURL: fbUser.photoURL || '',
              role: savedRole,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp()
            };
            await setDoc(userDocRef, profile, { merge: true });
          }
          localStorage.removeItem('mediqueue_pending_auth_role');
          localStorage.setItem('mediqueue_firebase_auth_user', JSON.stringify(profile));
          setCurrentUser(profile);
          console.log('[Firebase Auth] Successfully processed Google redirect sign-in for:', profile.name);
        }
      })
      .catch(err => {
        console.warn('[Firebase Auth] Redirect result error:', err.code, err.message);
      });

    return () => unsubAuth();
  }, []);

  // Google Sign-In via Popup (with automatic Redirect fallback if popup is blocked)
  const signInWithGoogle = useCallback(async (preferredRole = 'patient', extraData = {}, forceRedirect = false) => {
    try {
      console.log(`[Firebase Auth] Initiating Google Sign-In (preferred role: ${preferredRole}, forceRedirect: ${forceRedirect})...`);

      if (forceRedirect) {
        localStorage.setItem('mediqueue_pending_auth_role', preferredRole);
        await signInWithRedirect(auth, googleProvider);
        return { success: true, redirecting: true };
      }

      let result;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr) {
        console.warn(`[Firebase Auth] Popup error (code: ${popupErr.code}):`, popupErr.message);
        // If popup was blocked by browser or environment restrictions, fall back to redirect
        if (popupErr.code === 'auth/popup-blocked') {
          console.log('[Firebase Auth] Popup was blocked by browser. Automatically falling back to signInWithRedirect...');
          localStorage.setItem('mediqueue_pending_auth_role', preferredRole);
          await signInWithRedirect(auth, googleProvider);
          return { success: true, redirecting: true };
        }
        throw popupErr;
      }

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
  const isPriorityCheck = category => {
    if (!category) return false;
    const str = String(category).trim().toLowerCase();
    return str.includes('elderly') || str.includes('pregnant') || str.includes('emergency');
  };

  const normalizePriority = category => {
    if (!category) return 'none';
    const str = String(category).trim().toLowerCase();
    if (str.includes('elderly')) return 'elderly';
    if (str.includes('pregnant')) return 'pregnant';
    if (str.includes('emergency')) return 'emergency';
    return 'none';
  };

  // =========================================================================
  // 4. APPOINTMENT BOOKING & DYNAMIC PRIORITY PREEMPTION ENGINE
  // Priority: Elderly, Pregnant Woman, Emergency Patient
  // Preemption: Immediately takes Slot 1 (or nearest top non-priority slot).
  // Cascade: Non-priority patients demote down (Slot 1 -> Slot 2 -> Slot 3...).
  // Spillover: If displacement pushes 5th patient out, moves to Batch 2 Slot 1.
  // Atomic: Executed via Firestore writeBatch for synchronous consistency.
  // =========================================================================
  const bookAppointment = useCallback(async booking => {
    const { patientName, patientAge, patientPhone, patientEmail, doctorCode, priorityCategory } = booking;
    if (!patientName || !patientPhone) {
      throw new Error('Patient name and phone number are required.');
    }

    const cleanCode = String(doctorCode).trim().toUpperCase();
    const targetDoc = doctors.find(
      d => d.doctorCode?.toUpperCase() === cleanCode || d.doctorId === cleanCode || d.id === cleanCode
    );

    if (!targetDoc) {
      throw new Error(`Doctor code "${doctorCode}" was not found in registered directory.`);
    }

    const docId = targetDoc.doctorId || targetDoc.id;
    const normalized = normalizePriority(priorityCategory);
    const isIncomingPriority = isPriorityCheck(normalized);

    // Active appointments for this doctor in Firestore
    const activeDocApts = appointments.filter(
      a => (a.doctorId === docId || a.doctorCode?.toUpperCase() === cleanCode) &&
           (a.status === 'waiting' || a.status === 'in_consultation')
    );

    const firestoreBatch = writeBatch(db);
    const newAptRef = doc(collection(db, 'appointments'));

    let targetBatchId = 'b1';
    let assignedSlot = 1;

    if (!isIncomingPriority) {
      // -------------------------------------------------------------------
      // 1. STANDARD PATIENT (Normal / Non-Priority):
      // Assigns to the first open slot in Batch 1 (slots 1..5).
      // Spills over to Batch 2 if Batch 1 is full.
      // -------------------------------------------------------------------
      const b1Active = activeDocApts.filter(a => (a.batchId || 'b1') === 'b1');
      const b1Occupied = new Set(b1Active.map(a => a.slotNumber));

      let openSlot = null;
      for (let s = 1; s <= 5; s++) {
        if (!b1Occupied.has(s)) {
          openSlot = s;
          break;
        }
      }

      if (openSlot !== null) {
        targetBatchId = 'b1';
        assignedSlot = openSlot;
      } else {
        targetBatchId = 'b2';
        const b2Active = activeDocApts.filter(a => a.batchId === 'b2');
        const b2Occupied = new Set(b2Active.map(a => a.slotNumber));
        let openSlotB2 = null;
        for (let s = 1; s <= 5; s++) {
          if (!b2Occupied.has(s)) {
            openSlotB2 = s;
            break;
          }
        }
        assignedSlot = openSlotB2 !== null ? openSlotB2 : b2Active.length + 1;
      }

      const newApt = {
        appointmentId: newAptRef.id,
        patientId: currentUser?.uid || `guest_${Date.now()}`,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientEmail: (patientEmail || '').trim(),
        patientAge: parseInt(patientAge, 10) || 30,
        doctorId: docId,
        doctorCode: targetDoc.doctorCode,
        department: targetDoc.department,
        batchId: targetBatchId,
        slotNumber: assignedSlot,
        priorityCategory: normalized,
        status: 'waiting',
        createdAt: serverTimestamp(),
        consultationStartTime: null,
        consultationEndTime: null
      };

      firestoreBatch.set(newAptRef, newApt);
      await firestoreBatch.commit();

      // Instant optimistic local update
      setAppointments(prev => [...prev, { ...newApt, id: newAptRef.id }]);
      return newApt;

    } else {
      // -------------------------------------------------------------------
      // 2. DYNAMIC PRIORITY PREEMPTION (Elderly, Pregnant, Emergency):
      // - Preempt Slot 1 if occupied by a waiting non-priority patient.
      // - If Slot 1 already has a Priority patient, assign nearest top slot
      //   (e.g., Slot 2), displacing the first non-priority patient below.
      // - Cascade demotion: Slot 1 -> 2 -> 3 -> 4 -> 5.
      // - If displacement pushes 5th patient out, move to Batch 2 Slot 1.
      // -------------------------------------------------------------------
      targetBatchId = 'b1';
      const b1Active = activeDocApts
        .filter(a => (a.batchId || 'b1') === 'b1')
        .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

      let preemptSlot = null;
      let shouldDisplace = false;

      // Scan Batch 1 slots from Slot 1 up to Slot 5
      for (let s = 1; s <= 5; s++) {
        const aptAtSlot = b1Active.find(a => a.slotNumber === s);

        if (!aptAtSlot) {
          // Nearest top slot is open: take it directly without displacement
          preemptSlot = s;
          shouldDisplace = false;
          break;
        }

        if (aptAtSlot.status === 'in_consultation') {
          // Cannot displace a patient currently inside the consultation suite
          continue;
        }

        // Slot is waiting: check if it already belongs to an existing priority patient
        if (isPriorityCheck(aptAtSlot.priorityCategory)) {
          // Do not displace existing Elderly, Pregnant, or Emergency patient
          continue;
        }

        // Non-priority waiting patient found at top: PREEMPT AND DISPLACE!
        preemptSlot = s;
        shouldDisplace = true;
        break;
      }

      // Edge case: All 5 slots in Batch 1 are already occupied by priority or active patients
      if (preemptSlot === null) {
        targetBatchId = 'b2';
        const b2Active = activeDocApts
          .filter(a => a.batchId === 'b2')
          .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

        for (let s = 1; s <= 5; s++) {
          const aptAtSlot = b2Active.find(a => a.slotNumber === s);
          if (!aptAtSlot) {
            preemptSlot = s;
            shouldDisplace = false;
            break;
          }
          if (aptAtSlot.status === 'in_consultation') continue;
          if (isPriorityCheck(aptAtSlot.priorityCategory)) continue;

          preemptSlot = s;
          shouldDisplace = true;
          break;
        }

        if (preemptSlot === null) {
          preemptSlot = 1;
          shouldDisplace = true;
        }
      }

      assignedSlot = preemptSlot;

      const b1ShiftMap = new Map();
      const b2ShiftMap = new Map();
      let displacedSpilloverPatient = null;

      if (shouldDisplace && targetBatchId === 'b1') {
        // Cascade demote waiting patients at or after preemptSlot in Batch 1
        const b1WaitingToShift = b1Active.filter(
          a => a.status === 'waiting' && a.slotNumber >= preemptSlot
        );

        b1WaitingToShift.forEach(apt => {
          const aptId = apt.id || apt.appointmentId;
          const newSlot = apt.slotNumber + 1;
          const aptRef = doc(db, 'appointments', aptId);

          if (newSlot > 5) {
            // Displaced 5th patient is pushed out of Batch 1 -> move to Batch 2 Slot 1
            displacedSpilloverPatient = { ...apt, id: aptId, batchId: 'b2', slotNumber: 1 };
            firestoreBatch.update(aptRef, {
              batchId: 'b2',
              slotNumber: 1
            });
          } else {
            b1ShiftMap.set(aptId, newSlot);
            firestoreBatch.update(aptRef, {
              slotNumber: newSlot
            });
          }
        });

        // If a displaced patient moved to Batch 2 Slot 1, cascade shift existing Batch 2 waiting patients
        if (displacedSpilloverPatient) {
          const b2Waiting = activeDocApts
            .filter(a => a.batchId === 'b2' && a.status === 'waiting')
            .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

          b2Waiting.forEach(apt => {
            const aptId = apt.id || apt.appointmentId;
            const newSlot = apt.slotNumber + 1;
            const aptRef = doc(db, 'appointments', aptId);
            b2ShiftMap.set(aptId, newSlot);
            firestoreBatch.update(aptRef, {
              slotNumber: newSlot
            });
          });
        }
      } else if (shouldDisplace && targetBatchId === 'b2') {
        // Preemption inside Batch 2
        const b2WaitingToShift = activeDocApts.filter(
          a => a.batchId === 'b2' && a.status === 'waiting' && a.slotNumber >= preemptSlot
        );
        b2WaitingToShift.forEach(apt => {
          const aptId = apt.id || apt.appointmentId;
          const newSlot = apt.slotNumber + 1;
          const aptRef = doc(db, 'appointments', aptId);
          b2ShiftMap.set(aptId, newSlot);
          firestoreBatch.update(aptRef, {
            slotNumber: newSlot
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
        doctorId: docId,
        doctorCode: targetDoc.doctorCode,
        department: targetDoc.department,
        batchId: targetBatchId,
        slotNumber: assignedSlot,
        priorityCategory: normalized,
        status: 'waiting',
        createdAt: serverTimestamp(),
        consultationStartTime: null,
        consultationEndTime: null
      };

      firestoreBatch.set(newAptRef, newApt);
      await firestoreBatch.commit();

      // Immediate synchronous local state update for zero-latency UI re-render
      setAppointments(prev => {
        const updated = prev.map(a => {
          const aId = a.id || a.appointmentId;
          if (displacedSpilloverPatient && (aId === displacedSpilloverPatient.id || aId === displacedSpilloverPatient.appointmentId)) {
            return { ...a, batchId: 'b2', slotNumber: 1 };
          }
          if (b1ShiftMap.has(aId)) {
            return { ...a, slotNumber: b1ShiftMap.get(aId) };
          }
          if (b2ShiftMap.has(aId)) {
            return { ...a, slotNumber: b2ShiftMap.get(aId) };
          }
          return a;
        });
        return [...updated, { ...newApt, id: newAptRef.id }];
      });

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
    const consultationStartTime = Date.now();

    // Optimistically update local appointments state for 0ms reactivity
    setAppointments(prev => prev.map(a => {
      const aId = a.id || a.appointmentId;
      const tId = targetPatient.id || targetPatient.appointmentId;
      if (aId === tId) {
        return { ...a, status: 'in_consultation', consultationStartTime };
      }
      return a;
    }));

    try {
      await updateDoc(targetRef, {
        status: 'in_consultation',
        consultationStartTime: consultationStartTime
      });
    } catch (err) {
      console.warn('[Firestore] Error updating consultationStartTime in callNext:', err);
    }

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

    // Exact timestamps according to specification:
    // consultationStartTime = stored start timestamp
    // consultationEndTime = Date.now()
    const consultationEndTime = Date.now();
    const startTimeMs = getEpochTimestamp(inConsult.consultationStartTime) || (consultationEndTime - 10 * 60000);

    // durationMinutes = Math.round((consultationEndTime - consultationStartTime) / 60000)
    const rawElapsedMinutes = Math.round((consultationEndTime - startTimeMs) / 60000);
    // Ensure durationMinutes is at least 1 min for fast testing cycles
    const durationMinutes = Math.max(1, rawElapsedMinutes);

    const historyRecord = {
      appointmentId: inConsult.appointmentId || inConsult.id,
      doctorId: inConsult.doctorId || '',
      doctorCode: inConsult.doctorCode || cleanKey,
      department: inConsult.department || '',
      patientName: inConsult.patientName || '',
      consultationStartTime: startTimeMs,
      consultationEndTime: consultationEndTime,
      durationMinutes: durationMinutes,
      date: new Date(consultationEndTime).toISOString().split('T')[0]
    };

    // Optimistically update local state for instantaneous prediction model retraining
    setHistoricalConsultations(prev => [...prev, historyRecord]);
    setAppointments(prev => prev.map(a => {
      const aId = a.id || a.appointmentId;
      const tId = inConsult.id || inConsult.appointmentId;
      if (aId === tId) {
        return {
          ...a,
          status: 'completed',
          consultationStartTime: startTimeMs,
          consultationEndTime,
          durationMinutes
        };
      }
      return a;
    }));

    try {
      const firestoreBatch = writeBatch(db);

      // Mark current appointment completed with exact timestamps and duration
      firestoreBatch.update(targetRef, {
        status: 'completed',
        consultationStartTime: startTimeMs,
        consultationEndTime: consultationEndTime,
        durationMinutes: durationMinutes
      });

      // Save into historicalConsultations collection tagged with specific doctorId and department
      const histRef = doc(collection(db, 'historicalConsultations'));
      firestoreBatch.set(histRef, {
        ...historyRecord,
        createdAt: serverTimestamp()
      });

      // Write record to analytics_logs
      const logRef = doc(collection(db, 'analytics_logs'));
      firestoreBatch.set(logRef, {
        appointmentId: inConsult.appointmentId || inConsult.id,
        doctorId: inConsult.doctorId || '',
        doctorCode: inConsult.doctorCode || cleanKey,
        department: inConsult.department || '',
        durationMinutes: durationMinutes,
        status: 'completed',
        completedAt: serverTimestamp()
      });

      await firestoreBatch.commit();
    } catch (err) {
      console.warn('[Firestore] Error committing completeConsultation batch:', err);
    }

    return { ...inConsult, durationMinutes, consultationEndTime };
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

  // Mark notificationSent: true on appointment to prevent duplicate alerts
  const markNotificationSent = useCallback(async appointmentId => {
    if (!appointmentId) return;
    setAppointments(prev => prev.map(a => {
      if (a.id === appointmentId || a.appointmentId === appointmentId) {
        return { ...a, notificationSent: true };
      }
      return a;
    }));

    try {
      const aptDocRef = doc(db, 'appointments', appointmentId);
      await updateDoc(aptDocRef, {
        notificationSent: true,
        notificationSentAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('[Firestore] Failed to persist notificationSent:', err);
    }
  }, []);

  // Dispatch direct "Next Patient in Line" summons alert to Firestore appointment
  const triggerUrgentNextAlert = useCallback(async (appointmentId, alertData) => {
    if (!appointmentId) return;
    setAppointments(prev => prev.map(a => {
      if (a.id === appointmentId || a.appointmentId === appointmentId) {
        return { ...a, urgentNextAlert: alertData };
      }
      return a;
    }));

    try {
      const aptDocRef = doc(db, 'appointments', appointmentId);
      await updateDoc(aptDocRef, {
        urgentNextAlert: {
          ...alertData,
          triggeredAt: serverTimestamp()
        }
      });
    } catch (err) {
      console.warn('[Firestore] Failed to persist urgentNextAlert:', err);
    }
  }, []);

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

      const histSnaps = await getDocs(collection(db, 'historicalConsultations'));
      histSnaps.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
    } catch (e) {
      console.warn('[Firestore] Purge all fallback:', e);
      setDoctors([]);
      setAppointments([]);
      setAnalyticsLogs([]);
      setHistoricalConsultations([]);
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

    // Overall dynamic consultation pace across all clinicians today
    const overallPaceData = calculateDoctorConsultationPace({
      historicalConsultations,
      appointments,
      analyticsLogs
    });

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

      const docPace = calculateDoctorConsultationPace({
        doctorId: docData.doctorId,
        doctorCode: docData.doctorCode,
        historicalConsultations,
        appointments,
        analyticsLogs
      });

      return {
        ...docData,
        waitingCount: docWaiting.length,
        inConsultation: inConsult ? inConsult.patientName : null,
        avgWaitMinutes: docAvgWait,
        consultationPace: docPace.averageConsultationTime,
        trainedTodayCount: docPace.completedTodayCount
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
      overallConsultationPace: overallPaceData.averageConsultationTime,
      overallTrainedConsultationsToday: overallPaceData.completedTodayCount,
      departmentsSummary,
      doctorsSummary,
      activeDoctors: doctors.filter(d => d.isAvailable !== false),
      allPatients: appointments,
      registeredPatientsSummary,
      isEmpty,
      emptyMessage: 'Queue length: 0 | Average Wait Time: 0 min | No active department traffic.'
    };
  }, [doctors, appointments, analyticsLogs, historicalConsultations]);

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
    historicalConsultations,
    allUsers,
    registerDoctor,
    getDoctorByCode,
    bookAppointment,
    callNext,
    completeConsultation,
    skipPatient,
    markNoShow,
    markNotificationSent,
    triggerUrgentNextAlert,
    purgeAllData,
    getAdminTelemetry,
    calculateDoctorConsultationPace,
    calculatePatientWaitTime,
    dbError
  };
}
