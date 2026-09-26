import React, { useState, useEffect } from 'react';
import { useFirebaseDB } from './hooks/useFirebaseDB';
import PatientPortal from './components/PatientPortal';
import DoctorPortal from './components/DoctorPortal';
import AdminDashboard from './components/AdminDashboard';
import OtpModal from './components/OtpModal';
import DoctorRegisterModal from './components/DoctorRegisterModal';

export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'patient' | 'doctor' | 'admin'
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [myAppointment, setMyAppointment] = useState(null);

  // Authentication Mode & Form States (Phase 2)
  const [selectedRole, setSelectedRole] = useState('patient'); // 'patient' | 'doctor'
  const [authTab, setAuthTab] = useState('otp'); // 'otp' | 'email'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showDocRegModal, setShowDocRegModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Email/Password Auth Form
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Live Firebase Real-Time Data Layer
  const db = useFirebaseDB();
  const {
    currentUser,
    setCurrentUser,
    doctors,
    bookAppointment,
    registerDoctor,
    purgeAllData,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithSimulatedOtp,
    signOut,
    dbError
  } = db;

  // Auto-select first registered doctor if available and none selected
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

  // =========================================================================
  // 1. MOBILE PHONE + SIMULATED OTP 1234 FLOW
  // =========================================================================
  const handleGetOtp = () => {
    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }
    setShowOtpModal(true);
    showToast('Simulated SMS OTP 1234 dispatched.');
  };

  const handleAutoFillOtp = async () => {
    setOtp('1234');
    setShowOtpModal(false);
    await handleVerifyOtp('1234');
  };

  const handleVerifyOtp = async otpToVerify => {
    const code = otpToVerify || otp;
    if (code !== '1234') {
      showToast('Invalid OTP. Please enter mock OTP 1234.');
      return;
    }

    setIsSubmittingAuth(true);
    const userName = selectedRole === 'doctor'
      ? (selectedDoctor ? selectedDoctor.name : 'Dr. Clinician')
      : 'Patient User';

    const res = await signInWithSimulatedOtp(phone, code, selectedRole, userName);
    setIsSubmittingAuth(false);

    if (res.success) {
      showToast('OTP verified! Synchronized with Firestore.');
      routeUserByRole(selectedRole);
    } else {
      showToast(res.message || 'Verification failed.');
    }
  };

  // =========================================================================
  // 2. GOOGLE AUTHENTICATION FLOW
  // =========================================================================
  const handleGoogleSignIn = async () => {
    setIsSubmittingAuth(true);
    showToast('Connecting to Google Authentication...');
    const res = await signInWithGoogle(selectedRole);
    setIsSubmittingAuth(false);

    if (res.success) {
      showToast(`Welcome, ${res.user.name}! Firebase profile active.`);
      routeUserByRole(selectedRole);
    } else {
      showToast(res.message || 'Google sign-in was cancelled.');
    }
  };

  // =========================================================================
  // 3. EMAIL & PASSWORD AUTHENTICATION FLOW
  // =========================================================================
  const handleEmailAuthSubmit = async e => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      showToast('Email and password are required.');
      return;
    }

    setIsSubmittingAuth(true);
    if (isRegistering) {
      const res = await signUpWithEmail(authEmail.trim(), authPassword, authName.trim(), selectedRole);
      setIsSubmittingAuth(false);
      if (res.success) {
        showToast('Account registered! Saved to Firestore users collection.');
        routeUserByRole(selectedRole);
      } else {
        showToast(res.message || 'Sign-up failed.');
      }
    } else {
      const res = await signInWithEmail(authEmail.trim(), authPassword);
      setIsSubmittingAuth(false);
      if (res.success) {
        showToast('Signed in successfully with Firebase.');
        routeUserByRole(selectedRole);
      } else {
        showToast(res.message || 'Invalid email or password.');
      }
    }
  };

  const routeUserByRole = role => {
    if (role === 'doctor') {
      if (doctors.length === 0) {
        setShowDocRegModal(true);
      } else {
        setCurrentView('doctor');
      }
    } else {
      setCurrentView('patient');
    }
  };

  // Book appointment handler
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
      if (selectedRole === 'doctor' && currentView === 'landing') {
        setCurrentView('doctor');
      }
    }
  };

  const handleSignOutUser = async () => {
    await signOut();
    setCurrentView('landing');
    showToast('Signed out successfully.');
  };

  return (
    <div className="app-root-container">

      {/* Universal Top App Bar */}
      <header className="app-top-nav">
        <div className="nav-wrapper">
          <div className="brand-group" onClick={() => setCurrentView('landing')}>
            <div className="brand-badge-logo">
              <i className="fa-solid fa-notes-medical"></i>
            </div>
            <div className="brand-text">
              <span className="brand-name">MediQueue</span>
              <span className="brand-dept-tag">FIREBASE REAL-TIME CLOUD OPD</span>
            </div>
          </div>

          <div className="nav-utility-bar">
            {/* Admin View Toggle */}
            <button
              type="button"
              className="btn-demo-scenario admin-nav-btn"
              onClick={() => setCurrentView('admin')}
              title="Hospital Administrative Overview"
            >
              <i className="fa-solid fa-chart-pie"></i>
              <span>Admin View</span>
            </button>

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
                <span className="chip-label">{currentUser.name}</span>
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

      {/* Main View Router */}
      {currentView === 'landing' && (
        <main className="page-viewport">
          <div className="landing-auth-container">
            <div className="landing-hero-center">
              <span className="hero-kicker">
                <i className="fa-solid fa-fire text-amber"></i> FIREBASE AUTH & FIRESTORE REAL-TIME BACKEND
              </span>
              <h1 className="hero-title">Select Your MediQueue Portal</h1>
              <p className="hero-desc">
                Live Cloud Firestore synchronization across Patient, Doctor, and Admin portals with zero local mock state.
              </p>
            </div>

            {/* Role Cards */}
            <div className="portal-choices-row">
              {/* Choice 1: Patient Portal */}
              <div
                className={`portal-choice-card ${selectedRole === 'patient' ? 'selected' : ''}`}
                onClick={() => setSelectedRole('patient')}
              >
                <div className="card-icon-bubble blue">
                  <img src="/heart.gif" alt="Patient Portal" className="card-icon-gif" />
                </div>
                <h2 className="choice-title">Patient Portal</h2>
                <p className="choice-desc">
                  Real-time queue tracking, priority allocation, dynamic wait times, and 3-patients-away automated alerts.
                </p>
              </div>

              {/* Choice 2: Doctor Portal */}
              <div
                className={`portal-choice-card ${selectedRole === 'doctor' ? 'selected' : ''}`}
                onClick={() => setSelectedRole('doctor')}
              >
                <div className="card-icon-bubble dark">
                  <img src="/doctor.gif" alt="Doctor Portal" className="card-icon-gif" />
                </div>
                <h2 className="choice-title">Doctor Portal</h2>
                <p className="choice-desc">
                  In-suite control panel: Call Next, Complete (✅), Skip (⏭️), and Mark No-Show (❌) with duration analytics.
                </p>
              </div>

              {/* Choice 3: Admin Portal */}
              <div
                className="portal-choice-card"
                onClick={() => setCurrentView('admin')}
              >
                <div className="card-icon-bubble purple">
                  <img src="/admin.gif" alt="Admin Portal" className="card-icon-gif" />
                </div>
                <h2 className="choice-title">Admin Portal</h2>
                <p className="choice-desc">
                  Centralized OPD telemetry, wait times, department queues, and live hospital monitoring derived dynamically.
                </p>
              </div>
            </div>

            {/* Already Authenticated Active User Banner */}
            {currentUser ? (
              <div className="auth-dialog-card" style={{ maxWidth: '480px', margin: '24px auto 0', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#3E69FE' }}>
                    <i className="fa-solid fa-circle-user"></i>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: '0 0 4px' }}>
                      Logged in as {currentUser.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                      {currentUser.email || currentUser.phone} • Profile: <strong>{currentUser.role?.toUpperCase() || 'PATIENT'}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px', width: '100%' }}>
                    <button
                      type="button"
                      className="btn-primary-action"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => routeUserByRole(selectedRole)}
                    >
                      <i className="fa-solid fa-arrow-right"></i>
                      <span>Enter {selectedRole === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-action"
                      style={{ padding: '0 16px' }}
                      onClick={handleSignOutUser}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Phase 2: Multi-Option Firebase Authentication Card */
              <div className="auth-dialog-card" style={{ maxWidth: '480px', margin: '24px auto 0' }}>
                <div className="auth-dialog-header">
                  <div className="auth-role-tag">
                    <i className="fa-solid fa-shield-halved text-blue" style={{ marginRight: '8px' }}></i>
                    {selectedRole === 'doctor' ? 'Doctor Access' : 'Patient Registration'}
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                    Select your preferred Firebase authentication method:
                  </p>
                </div>

                {/* Auth Mode Tabs (Mobile OTP vs Email/Password) */}
                <div className="auth-mode-tabs">
                  <button
                    type="button"
                    className={`auth-mode-btn ${authTab === 'otp' ? 'active' : ''}`}
                    onClick={() => setAuthTab('otp')}
                  >
                    <i className="fa-solid fa-mobile-screen" style={{ marginRight: '6px' }}></i>
                    Mobile OTP (1234)
                  </button>
                  <button
                    type="button"
                    className={`auth-mode-btn ${authTab === 'email' ? 'active' : ''}`}
                    onClick={() => setAuthTab('email')}
                  >
                    <i className="fa-solid fa-envelope" style={{ marginRight: '6px' }}></i>
                    Email & Password
                  </button>
                </div>

                {/* Tab 1: Mobile Phone + Simulated OTP */}
                {authTab === 'otp' && (
                  <div className="auth-unified-form">
                    <div className="form-group">
                      <label>10-Digit Mobile Number *</label>
                      <div className="phone-input-row" style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="tel"
                          className="form-input"
                          placeholder="e.g. 9876543210"
                          maxLength={10}
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                        />
                        <button
                          type="button"
                          className="btn-primary-action"
                          style={{ padding: '0 16px', whiteSpace: 'nowrap' }}
                          onClick={handleGetOtp}
                          disabled={isSubmittingAuth}
                        >
                          <i className="fa-solid fa-paper-plane"></i> Get OTP
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Enter 4-Digit OTP Code</label>
                      <input
                        type="text"
                        className="form-input font-mono"
                        placeholder="Enter 1234"
                        maxLength={4}
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                        style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-submit-auth"
                      onClick={() => handleVerifyOtp()}
                      disabled={isSubmittingAuth}
                    >
                      <i className="fa-solid fa-arrow-right-to-bracket"></i>
                      <span>Verify OTP & Enter {selectedRole === 'doctor' ? 'Doctor Suite' : 'Patient Portal'}</span>
                    </button>
                  </div>
                )}

                {/* Tab 2: Email & Password Auth */}
                {authTab === 'email' && (
                  <form onSubmit={handleEmailAuthSubmit} className="auth-unified-form">
                    {isRegistering && (
                      <div className="form-group">
                        <label>Full Name *</label>
                        <div className="input-with-icon">
                          <i className="fa-solid fa-user"></i>
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={authName}
                            onChange={e => setAuthName(e.target.value)}
                            required={isRegistering}
                          />
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Email Address *</label>
                      <div className="input-with-icon">
                        <i className="fa-solid fa-envelope"></i>
                        <input
                          type="email"
                          placeholder="user@example.com"
                          value={authEmail}
                          onChange={e => setAuthEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Password *</label>
                      <div className="input-with-icon">
                        <i className="fa-solid fa-lock"></i>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn-submit-auth"
                      disabled={isSubmittingAuth}
                    >
                      <i className="fa-solid fa-arrow-right-to-bracket"></i>
                      <span>{isRegistering ? 'Register with Firebase' : 'Sign In with Email'}</span>
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '4px' }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#3E69FE', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setIsRegistering(!isRegistering)}
                      >
                        {isRegistering ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
                      </button>
                    </div>
                  </form>
                )}

                {/* One-Click Google Sign-In Divider & Button */}
                <div className="google-auth-divider">
                  <span>OR CONTINUE WITH</span>
                </div>

                <button
                  type="button"
                  className="btn-google-auth"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmittingAuth}
                  title="Sign In using your Google Account"
                >
                  <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>
            )}

          </div>
        </main>
      )}

      {/* Patient View */}
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

      {/* Doctor View */}
      {currentView === 'doctor' && (
        <DoctorPortal
          doctor={selectedDoctor}
          doctors={doctors}
          onSelectDoctor={setSelectedDoctor}
          db={db}
          onOpenDoctorRegistration={() => setShowDocRegModal(true)}
        />
      )}

      {/* Admin View */}
      {currentView === 'admin' && (
        <AdminDashboard
          onExit={() => setCurrentView('landing')}
          db={db}
          onOpenDoctorRegistration={() => setShowDocRegModal(true)}
        />
      )}

      {/* Simulated OTP Modal */}
      {showOtpModal && (
        <OtpModal
          phone={phone}
          onAutoFill={handleAutoFillOtp}
          onClose={() => setShowOtpModal(false)}
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
