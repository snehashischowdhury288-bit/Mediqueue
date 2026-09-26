import React, { useState, useEffect, useCallback } from 'react';
import { useFirebaseDB } from './hooks/useFirebaseDB';
import PatientAuth from './components/PatientAuth';
import DoctorAuth from './components/DoctorAuth';
import AdminAuth from './components/AdminAuth';
import PatientPortal from './components/PatientPortal';
import DoctorPortal from './components/DoctorPortal';
import AdminDashboard from './components/AdminDashboard';
import DoctorRegisterModal from './components/DoctorRegisterModal';

// Path to view mapper
const pathToView = path => {
  const clean = path.replace(/\/$/, '');
  if (clean === '/auth/patient') return 'auth-patient';
  if (clean === '/auth/doctor') return 'auth-doctor';
  if (clean === '/auth/admin') return 'auth-admin';
  if (clean === '/patient' || clean === '/patient/dashboard') return 'patient';
  if (clean === '/doctor' || clean === '/doctor/dashboard') return 'doctor';
  if (clean === '/admin' || clean === '/admin/dashboard') return 'admin';
  return 'landing';
};

const viewToPath = {
  landing: '/',
  'auth-patient': '/auth/patient',
  'auth-doctor': '/auth/doctor',
  'auth-admin': '/auth/admin',
  patient: '/patient',
  doctor: '/doctor',
  admin: '/admin'
};

export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      return pathToView(window.location.pathname);
    }
    return 'landing';
  });

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [myAppointment, setMyAppointment] = useState(null);
  const [showDocRegModal, setShowDocRegModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Live Firebase Real-Time Data Layer
  const db = useFirebaseDB();
  const {
    currentUser,
    setCurrentUser,
    doctors,
    bookAppointment,
    registerDoctor,
    purgeAllData,
    signOut
  } = db;

  const navigateTo = useCallback(view => {
    setCurrentView(view);
    const targetPath = viewToPath[view] || '/';
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, []);

  // Listen to browser forward/backward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(pathToView(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-select doctor based on real logged-in clinician credentials
  useEffect(() => {
    if (!doctors || doctors.length === 0) {
      if (currentUser && currentUser.role === 'doctor') {
        setSelectedDoctor({
          doctorId: currentUser.uid,
          name: currentUser.name || 'Doctor',
          email: currentUser.email || '',
          doctorCode: currentUser.doctorCode || 'DOC-288',
          department: currentUser.department || 'Cardiology',
          age: currentUser.age || 42,
          isAvailable: true
        });
      } else {
        setSelectedDoctor(null);
      }
      return;
    }

    // 1. If logged-in user is a Doctor, strictly bind to their own real doctor record
    if (currentUser && (currentUser.role === 'doctor' || currentView === 'doctor')) {
      const myDoctor = doctors.find(
        d => (currentUser.uid && d.doctorId === currentUser.uid) ||
             (currentUser.email && d.email && d.email.toLowerCase() === currentUser.email.toLowerCase()) ||
             (currentUser.doctorCode && d.doctorCode?.toUpperCase() === currentUser.doctorCode.toUpperCase()) ||
             (currentUser.name && d.name && d.name.toLowerCase() === currentUser.name.toLowerCase())
      );

      if (myDoctor) {
        if (!selectedDoctor || selectedDoctor.doctorId !== myDoctor.doctorId || selectedDoctor.doctorCode !== myDoctor.doctorCode) {
          setSelectedDoctor(myDoctor);
        }
        return;
      }

      // If user has doctor role but no record in doctors collection yet, auto-register them with their real login info
      if (currentUser.role === 'doctor') {
        const uniqueCode = currentUser.doctorCode || `DOC-${Math.floor(100 + Math.random() * 899)}`;
        registerDoctor({
          doctorId: currentUser.uid,
          doctorCode: uniqueCode,
          name: currentUser.name || 'Doctor',
          email: currentUser.email || '',
          department: currentUser.department || 'General Medicine',
          age: currentUser.age || 40,
          isAvailable: true
        }).then(newDoc => {
          setSelectedDoctor(newDoc);
        }).catch(err => console.warn('Could not auto-register doctor record:', err));
        return;
      }
    }

    // 2. If already selected a valid doctor, preserve it
    if (selectedDoctor && doctors.some(d => d.doctorCode === selectedDoctor.doctorCode || d.doctorId === selectedDoctor.doctorId)) {
      return;
    }

    // 3. Fallback for Patient / Admin viewing doctor list
    setSelectedDoctor(doctors[0]);
  }, [doctors, selectedDoctor, currentUser, currentView, registerDoctor]);

  const showToast = msg => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auth Success Callbacks with strict role verification and immediate portal redirection
  const handlePatientAuthSuccess = userProfile => {
    setCurrentUser(userProfile);
    const role = (userProfile.role || '').toLowerCase();
    if (role === 'doctor') {
      navigateTo('doctor');
      showToast(`Welcome Dr. ${userProfile.name}! Redirected to Doctor Dashboard.`);
    } else if (role === 'admin') {
      navigateTo('admin');
      showToast(`Welcome Administrator! Redirected to Admin Console.`);
    } else {
      navigateTo('patient');
      showToast(`Welcome ${userProfile.name || 'Patient'} to Patient Portal!`);
    }
  };

  const handleDoctorAuthSuccess = (userProfile, doctorRecord) => {
    setCurrentUser(userProfile);
    if (doctorRecord) {
      setSelectedDoctor(doctorRecord);
    }
    const role = (userProfile.role || '').toLowerCase();
    if (role === 'admin') {
      navigateTo('admin');
      showToast(`Welcome Administrator! Redirected to Admin Console.`);
    } else if (role === 'patient') {
      navigateTo('patient');
      showToast(`Signed in as Patient account. Redirecting to Patient Portal.`);
    } else {
      navigateTo('doctor');
      showToast(`Welcome Dr. ${userProfile.name || doctorRecord?.name || 'Doctor'} to Doctor Suite!`);
    }
  };

  const handleAdminAuthSuccess = userProfile => {
    setCurrentUser(userProfile);
    const role = (userProfile.role || '').toLowerCase();
    if (role === 'doctor') {
      navigateTo('doctor');
      showToast(`Signed in as Clinician. Redirecting to Doctor Suite.`);
    } else if (role === 'patient') {
      navigateTo('patient');
      showToast(`Signed in as Patient. Redirecting to Patient Portal.`);
    } else {
      navigateTo('admin');
      showToast('Welcome to Hospital Administration Console!');
    }
  };

  const handleSignOutUser = async () => {
    await signOut();
    navigateTo('landing');
    showToast('Signed out successfully.');
  };

  // Appointment Booking
  const handleBookAppointment = async bookingData => {
    try {
      const newApt = await bookAppointment(bookingData);
      setMyAppointment(newApt);
      showToast(`Slot ${newApt.slotNumber} (${newApt.batchId === 'b2' ? 'Evening' : 'Morning'}) booked in Firestore!`);
    } catch (err) {
      showToast(err.message || 'Failed to book appointment slot.');
    }
  };

  const handleRegisterDoctorComplete = newDoc => {
    setShowDocRegModal(false);
    if (newDoc) {
      setSelectedDoctor(newDoc);
      showToast(`Dr. ${newDoc.name} registered to Firestore (Code: ${newDoc.doctorCode})!`);
    }
  };

  return (
    <div className="app-root-container">

      {/* Universal Top App Bar */}
      <header className="app-top-nav">
        <div className="nav-wrapper">
          <div className="brand-group" onClick={() => navigateTo('landing')}>
            <div className="brand-badge-logo">
              <i className="fa-solid fa-notes-medical"></i>
            </div>
            <div className="brand-text">
              <span className="brand-name">MediQueue</span>
              <span className="brand-dept-tag">SMART OPD HEALTHCARE</span>
            </div>
          </div>

          <div className="nav-utility-bar">
            {/* User Session Chip */}
            {currentUser && (
              <div className="auth-session-chip">
                <span className="chip-avatar">{currentUser.name?.charAt(0) || 'U'}</span>
                <span className="chip-label">
                  {currentUser.name} <small style={{ opacity: 0.75 }}>({currentUser.role?.toUpperCase()})</small>
                </span>
                <button
                  type="button"
                  className="btn-chip-signout"
                  onClick={handleSignOutUser}
                  title="Sign Out"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 1. ROOT ENTRY: CLEAN PORTAL SELECTION HUB (ZERO AUTH FORMS ON HUB)   */}
      {/* ===================================================================== */}
      {currentView === 'landing' && (
        <main className="page-viewport">
          <div className="landing-auth-container" style={{ maxWidth: '1080px', margin: '0 auto' }}>
            <div className="landing-hero-center">
              <h1 className="hero-title">Select Your MediQueue Portal</h1>
              <p className="hero-desc">
                Decoupled role-based access for Patients, Doctors, and Hospital Administration with instant Cloud Firestore synchronization.
              </p>
            </div>

            {/* Three Primary Role Cards */}
            <div className="portal-choices-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '32px' }}>

              {/* Card 1: Patient Portal */}
              <div
                className="portal-choice-card"
                onClick={() => navigateTo('auth-patient')}
                style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
              >
                <div className="card-icon-bubble blue">
                  <img src="/heart.gif" alt="Patient Portal" className="card-icon-gif" />
                </div>
                <h2 className="choice-title">Patient Portal</h2>
                <p className="choice-desc">
                  Real-time queue tracking, clinical department selection, 5-slot dynamic batch capacity, and 3-turns-away alerts.
                </p>
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#3E69FE', fontWeight: 700, fontSize: '14px' }}>
                  <span>Patient Login & Registration</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </div>
              </div>

              {/* Card 2: Doctor Portal */}
              <div
                className="portal-choice-card"
                onClick={() => navigateTo('auth-doctor')}
                style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
              >
                <div className="card-icon-bubble dark">
                  <img src="/doctor.gif" alt="Doctor Portal" className="card-icon-gif" />
                </div>
                <h2 className="choice-title">Doctor Portal</h2>
                <p className="choice-desc">
                  In-suite clinician control panel: Call Patient, Complete (✅), instant queue advancement, and Cured Patients History.
                </p>
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1E293B', fontWeight: 700, fontSize: '14px' }}>
                  <span>Doctor Login & Onboarding</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </div>
              </div>

              {/* Card 3: Admin Portal */}
              <div
                className="portal-choice-card"
                onClick={() => navigateTo('auth-admin')}
                style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
              >
                <div className="card-icon-bubble purple">
                  <img src="/admin.gif" alt="Admin Portal" className="card-icon-gif" />
                </div>
                <h2 className="choice-title">Admin Portal</h2>
                <p className="choice-desc">
                  Centralized OPD telemetry: Active Doctors Registry, All Registered Patients audit, and live department queue metrics.
                </p>
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#7C3AED', fontWeight: 700, fontSize: '14px' }}>
                  <span>Admin Login & Telemetry</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </div>
              </div>

            </div>

            {/* Active User Quick Access Banner */}
            {currentUser && (
              <div style={{
                marginTop: '36px',
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '20px 24px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#3E69FE' }}>
                    <i className="fa-solid fa-circle-user"></i>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                      Active Session: {currentUser.name}
                    </h4>
                    <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                      Authenticated as <strong>{currentUser.role?.toUpperCase()}</strong> ({currentUser.email || currentUser.phone || 'Firebase User'})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => {
                      if (currentUser.role === 'doctor') navigateTo('doctor');
                      else if (currentUser.role === 'admin') navigateTo('admin');
                      else navigateTo('patient');
                    }}
                  >
                    <i className="fa-solid fa-arrow-right"></i>
                    <span>Continue to {currentUser.role?.toUpperCase()} Suite</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={handleSignOutUser}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 2. DEDICATED AUTHENTICATION SCREENS BY ROLE                           */}
      {/* ===================================================================== */}
      {currentView === 'auth-patient' && (
        <PatientAuth
          onBack={() => navigateTo('landing')}
          onAuthSuccess={handlePatientAuthSuccess}
          db={db}
          showToast={showToast}
        />
      )}

      {currentView === 'auth-doctor' && (
        <DoctorAuth
          onBack={() => navigateTo('landing')}
          onAuthSuccess={handleDoctorAuthSuccess}
          db={db}
          showToast={showToast}
        />
      )}

      {currentView === 'auth-admin' && (
        <AdminAuth
          onBack={() => navigateTo('landing')}
          onAuthSuccess={handleAdminAuthSuccess}
          db={db}
          showToast={showToast}
        />
      )}

      {/* ===================================================================== */}
      {/* 3. DEDICATED PORTAL DASHBOARDS                                        */}
      {/* ===================================================================== */}
      {currentView === 'patient' && (
        <PatientPortal
          user={currentUser}
          doctors={doctors}
          selectedDoctor={selectedDoctor}
          onSelectDoctor={setSelectedDoctor}
          db={db}
          myAppointment={myAppointment}
          onBookAppointment={handleBookAppointment}
          onOpenDoctorRegistration={() => setShowDocRegModal(true)}
        />
      )}

      {currentView === 'doctor' && (
        <DoctorPortal
          doctor={selectedDoctor}
          doctors={doctors}
          onSelectDoctor={setSelectedDoctor}
          db={db}
          user={currentUser}
          onOpenDoctorRegistration={() => setShowDocRegModal(true)}
        />
      )}

      {currentView === 'admin' && (
        <AdminDashboard
          onExit={() => navigateTo('landing')}
          db={db}
          onOpenDoctorRegistration={() => setShowDocRegModal(true)}
        />
      )}

      {/* Doctor Registration Modal */}
      {showDocRegModal && (
        <DoctorRegisterModal
          onRegister={registerDoctor}
          onClose={handleRegisterDoctorComplete}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-popup">
          <i className="fa-solid fa-circle-check toast-icon"></i>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
