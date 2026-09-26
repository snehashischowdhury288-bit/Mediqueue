import React, { useState } from 'react';
import OtpModal from './OtpModal';

export default function PatientAuth({ onBack, onAuthSuccess, db, showToast }) {
  const [authMethod, setAuthMethod] = useState('otp'); // 'otp' | 'email'
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('32');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [priorityCategory, setPriorityCategory] = useState('none');

  const { signInWithSimulatedOtp, signInWithEmail, signUpWithEmail, signInWithGoogle } = db;

  // Handle OTP Dispatch
  const handleGetOtp = () => {
    setAuthError(null);
    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      const msg = 'Please enter a valid 10-digit mobile number.';
      setAuthError(msg);
      showToast(msg);
      return;
    }
    setShowOtpModal(true);
    showToast('Simulated SMS OTP 1234 dispatched.');
  };

  // Handle Auto-Fill & Verify
  const handleAutoFillOtp = async () => {
    setOtp('1234');
    setShowOtpModal(false);
    await handleVerifyOtp('1234');
  };

  const handleVerifyOtp = async code => {
    setAuthError(null);
    const finalOtp = code || otp;
    if (finalOtp !== '1234') {
      const msg = 'Invalid OTP. Please enter mock OTP 1234.';
      setAuthError(msg);
      showToast(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const patName = name.trim() || 'Patient User';
      const res = await signInWithSimulatedOtp(phone, finalOtp, 'patient', patName, {
        age: parseInt(age, 10) || 30,
        priorityCategory: priorityCategory || 'none'
      });
      setIsSubmitting(false);

      if (res.success) {
        showToast('Patient verified & profile saved to Firestore!');
        onAuthSuccess(res.user);
      } else {
        setAuthError(res.message || 'Verification failed.');
        showToast(res.message || 'Verification failed.');
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error('[PatientAuth OTP Error]:', err.code || err);
      const msg = err.message || 'Failed to authenticate with OTP.';
      setAuthError(msg);
      showToast(msg);
    }
  };

  // Handle Email Auth
  const handleEmailSubmit = async e => {
    e.preventDefault();
    setAuthError(null);
    if (!email.trim() || !password.trim()) {
      const msg = 'Email and password are required.';
      setAuthError(msg);
      showToast(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegistering) {
        if (!name.trim()) {
          const msg = 'Please enter your full patient name.';
          setAuthError(msg);
          showToast(msg);
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          const msg = 'Password must be at least 6 characters.';
          setAuthError(msg);
          showToast(msg);
          setIsSubmitting(false);
          return;
        }

        console.log(`[PatientAuth] Registering patient ${email.trim()}...`);
        const res = await signUpWithEmail(email.trim(), password, name.trim(), 'patient', {
          age: parseInt(age, 10) || 30,
          phone: phone.trim(),
          priorityCategory: priorityCategory || 'none'
        });
        setIsSubmitting(false);

        if (res.success) {
          showToast('Account registered! Profile saved in Firestore.');
          onAuthSuccess(res.user);
        } else {
          console.error('[PatientAuth Register Error Code]:', res.code || 'UNKNOWN');
          setAuthError(res.message || 'Registration failed.');
          showToast(res.message || 'Registration failed.');
        }
      } else {
        console.log(`[PatientAuth] Signing in patient ${email.trim()}...`);
        const res = await signInWithEmail(email.trim(), password, 'patient');
        setIsSubmitting(false);

        if (res.success) {
          showToast('Patient signed in successfully.');
          onAuthSuccess(res.user);
        } else {
          console.error('[PatientAuth Sign-In Error Code]:', res.code || 'UNKNOWN');
          setAuthError(res.message || 'Invalid email or password.');
          showToast(res.message || 'Invalid email or password.');
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error('[PatientAuth Email Error]:', err.code || err);
      const msg = err.message || 'An error occurred during authentication.';
      setAuthError(msg);
      showToast(msg);
    }
  };

  // Handle Google Auth
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSubmitting(true);
    showToast('Connecting to Google...');
    try {
      const res = await signInWithGoogle('patient', {
        priorityCategory: priorityCategory || 'none'
      });
      setIsSubmitting(false);

      if (res.success) {
        showToast(`Welcome, ${res.user.name}!`);
        onAuthSuccess(res.user);
      } else {
        console.error('[PatientAuth Google Error Code]:', res.code || 'UNKNOWN');
        setAuthError(res.message || 'Google sign-in was cancelled.');
        showToast(res.message || 'Google sign-in was cancelled.');
      }
    } catch (err) {
      setIsSubmitting(false);
      console.error('[PatientAuth Google Catch Error]:', err.code || err);
      const msg = err.message || 'Google sign-in encountered an error.';
      setAuthError(msg);
      showToast(msg);
    }
  };

  return (
    <main className="page-viewport">
      <div className="landing-auth-container" style={{ maxWidth: '520px', margin: '0 auto' }}>

        {/* Back Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            type="button"
            className="btn-secondary-action"
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13.5px' }}
          >
            <i className="fa-solid fa-arrow-left"></i>
            <span>Back to Portal Selection</span>
          </button>
          <span className="font-mono text-blue" style={{ fontSize: '12px', fontWeight: 700 }}>
            PATIENT PORTAL AUTH
          </span>
        </div>

        {/* Dedicated Patient Auth Card */}
        <div className="auth-dialog-card" style={{ width: '100%' }}>
          <div className="auth-dialog-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="card-icon-bubble blue" style={{ width: '44px', height: '44px', margin: 0 }}>
                <img src="/heart.gif" alt="Patient Portal" className="card-icon-gif" style={{ width: '32px', height: '32px' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Patient Portal Access
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0' }}>
                  Register or sign in to track live queue & reserve priority OPD slots
                </p>
              </div>
            </div>
          </div>

          {/* User-friendly Error Banner */}
          {authError && (
            <div className="auth-error-banner" style={{
              background: '#FEE2E2',
              border: '1px solid #F87171',
              color: '#991B1B',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
              marginBottom: '4px'
            }}>
              <i className="fa-solid fa-circle-exclamation" style={{ flexShrink: 0 }}></i>
              <span style={{ flex: 1 }}>{authError}</span>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
          )}

          {/* Authentication Mode Switcher */}
          <div className="auth-mode-tabs" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className={`auth-mode-btn ${authMethod === 'otp' ? 'active' : ''}`}
              onClick={() => { setAuthMethod('otp'); setAuthError(null); }}
            >
              <i className="fa-solid fa-mobile-screen" style={{ marginRight: '6px' }}></i>
              Mobile OTP (1234)
            </button>
            <button
              type="button"
              className={`auth-mode-btn ${authMethod === 'email' ? 'active' : ''}`}
              onClick={() => { setAuthMethod('email'); setAuthError(null); }}
            >
              <i className="fa-solid fa-envelope" style={{ marginRight: '6px' }}></i>
              Email & Password
            </button>
          </div>

          {/* Method 1: Mobile Phone + Simulated OTP */}
          {authMethod === 'otp' && (
            <div className="auth-unified-form">
              <div className="form-group">
                <label>Full Patient Name</label>
                <div className="input-with-icon">
                  <i className="fa-solid fa-user"></i>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Age</label>
                  <input
                    type="number"
                    className="form-input"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    min={1}
                    max={120}
                  />
                </div>

                <div className="form-group">
                  <label>Priority Tier</label>
                  <select
                    className="form-input"
                    value={priorityCategory}
                    onChange={e => setPriorityCategory(e.target.value)}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="none">None (Standard)</option>
                    <option value="elderly">Elderly (60+)</option>
                    <option value="pregnant">Pregnant Woman</option>
                    <option value="emergency">Emergency Case</option>
                  </select>
                </div>
              </div>

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
                    disabled={isSubmitting}
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
                disabled={isSubmitting}
              >
                <i className="fa-solid fa-arrow-right-to-bracket"></i>
                <span>{isSubmitting ? 'Verifying...' : 'Verify OTP & Enter Patient Portal'}</span>
              </button>
            </div>
          )}

          {/* Method 2: Email & Password */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailSubmit} className="auth-unified-form">
              {isRegistering && (
                <>
                  <div className="form-group">
                    <label>Full Patient Name *</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-user"></i>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required={isRegistering}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>Age</label>
                      <input
                        type="number"
                        className="form-input"
                        value={age}
                        onChange={e => setAge(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Priority Category</label>
                      <select
                        className="form-input"
                        value={priorityCategory}
                        onChange={e => setPriorityCategory(e.target.value)}
                        style={{ fontSize: '13px' }}
                      >
                        <option value="none">None (Standard)</option>
                        <option value="elderly">Elderly (60+)</option>
                        <option value="pregnant">Pregnant Woman</option>
                        <option value="emergency">Emergency Case</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Contact Phone</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-phone"></i>
                      <input
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Email Address *</label>
                <div className="input-with-icon">
                  <i className="fa-solid fa-envelope"></i>
                  <input
                    type="email"
                    placeholder="patient@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
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
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-submit-auth"
                disabled={isSubmitting}
              >
                <i className="fa-solid fa-arrow-right-to-bracket"></i>
                <span>{isSubmitting ? 'Authenticating...' : (isRegistering ? 'Register as Patient' : 'Sign In as Patient')}</span>
              </button>

              <div style={{ textAlign: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#3E69FE', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}
                >
                  {isRegistering ? 'Already registered? Sign In' : "New patient? Register here"}
                </button>
              </div>
            </form>
          )}

          {/* Google Sign-In Option */}
          <div className="google-auth-divider">
            <span>OR CONTINUE WITH</span>
          </div>

          <button
            type="button"
            className="btn-google-auth"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{isSubmitting ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

        </div>
      </div>

      {/* Simulated OTP Modal */}
      {showOtpModal && (
        <OtpModal
          phone={phone}
          onAutoFill={handleAutoFillOtp}
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </main>
  );
}
