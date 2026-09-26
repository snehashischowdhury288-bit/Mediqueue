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

  // Auto-select doctor if none selected
  useEffect(() => {
    if (doctors.length > 0) {
      if (!selectedDoctor || !doctors.some(d => d.doctorCode === selectedDoctor.doctorCode)) {
        setSelectedDoctor(doctors[0]);
      }
    } else {
      setSelectedDoctor(null);
    }
  }, [doctors, selectedDoctor]);

  const showToast = msg => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auth Success Callbacks
  const handlePatientAuthSuccess = userProfile => {
    setCurrentUser(userProfile);
    navigateTo('patient');
  };

  const handleDoctorAuthSuccess = (userProfile, doctorRecord) => {
    setCurrentUser(userProfile);
    if (doctorRecord) {
      setSelectedDoctor(doctorRecord);
    }
    navigateTo('doctor');
  };

  const handleAdminAuthSuccess = userProfile => {
    setCurrentUser(userProfile);
    navigateTo('admin');
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
              <span className="brand-dept-tag">FIREBASE REAL-TIME CLOUD OPD</span>
            </div>
          </div>

          <div className="nav-utility-bar">
            {/* Direct Portal Selection Hub button */}
            {currentView !== 'landing' && (
              <button
                type="button"
                className="btn-demo-scenario"
                onClick={() => navigateTo('landing')}
                title="Return to Portal Selection Hub"
              >
                <i className="fa-solid fa-table-cells-large"></i>
                <span>Portal Hub</span>
              </button>
            )}

            {/* Doctor Onboarding Action */}
            <button
              type="button"
              className="btn-demo-scenario"
              onClick={() => setShowDocRegModal(true)}
              title="Onboard a new clinician to Firestore"
            >
              <i className="fa-solid fa-user-plus"></i>
              <span>Doctor Onboarding</span>
            </button>

            {/* Purge / Reset to Zero */}
            <button
              type="button"
              className="btn-demo-scenario"
              onClick={async () => {
                if (window.confirm('Reset all Firestore collections (doctors, appointments, analytics_logs) to zero?')) {
                  await purgeAllData();
                  showToast('Firestore purged. All collections reset.');
                }
              }}
              title="Reset Firestore collections"
              style={{ color: '#EF4444', borderColor: '#FCA5A5' }}
            >
              <i className="fa-solid fa-trash-can"></i>
              <span>Purge Data</span>
            </button>

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
              <span className="hero-kicker font-mono">
                <i className="fa-solid fa-fire text-amber"></i> FIREBASE REAL-TIME CLOUD OPD ARCHITECTURE
              </span>
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
