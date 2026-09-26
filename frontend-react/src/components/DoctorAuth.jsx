import React, { useState } from 'react';

export default function DoctorAuth({ onBack, onAuthSuccess, db, showToast }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Cardiology');
  const [age, setAge] = useState('42');
  const [doctorCode, setDoctorCode] = useState('DOC-404');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, registerDoctor, doctors } = db;

  const handleGenerateCode = () => {
    const randomCode = `DOC-${Math.floor(100 + Math.random() * 900)}`;
    setDoctorCode(randomCode);
    showToast(`Generated Doctor Code: ${randomCode}`);
  };

  const handleEmailSubmit = async e => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    if (isRegistering) {
      if (!name.trim()) {
        showToast('Please enter your full clinician name.');
        setIsSubmitting(false);
        return;
      }
      const finalCode = (doctorCode.trim() || `DOC-${Math.floor(100 + Math.random() * 900)}`).toUpperCase();

      // Sign up user with Firebase Auth and set role: "doctor"
      const res = await signUpWithEmail(email.trim(), password, name.trim(), 'doctor', {
        department,
        doctorCode: finalCode,
        age: parseInt(age, 10) || 40,
        isAvailable: true
      });

      if (!res.success) {
        setIsSubmitting(false);
        showToast(res.message || 'Registration failed.');
        return;
      }

      // Register doctor in the Firestore doctors collection
      const newDocRecord = await registerDoctor({
        doctorId: res.user.uid,
        doctorCode: finalCode,
        name: name.trim(),
        department,
        age: parseInt(age, 10) || 40,
        isAvailable: true
      });

      setIsSubmitting(false);
      showToast(`Dr. ${name.trim()} onboarded with code ${finalCode}!`);
      onAuthSuccess(res.user, newDocRecord);
    } else {
      const res = await signInWithEmail(email.trim(), password);
      setIsSubmitting(false);
      if (res.success) {
        // Find matching doctor record from doctors collection
        const matchedDoc = doctors.find(
          d => d.doctorId === res.user.uid || (res.user.doctorCode && d.doctorCode?.toUpperCase() === res.user.doctorCode.toUpperCase())
        ) || {
          doctorId: res.user.uid,
          doctorCode: res.user.doctorCode || 'DOC-101',
          name: res.user.name || 'Dr. Clinician',
          department: res.user.department || 'General Medicine'
        };

        showToast(`Welcome back, ${matchedDoc.name}!`);
        onAuthSuccess(res.user, matchedDoc);
      } else {
        showToast(res.message || 'Invalid email or password.');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    showToast('Connecting to Google...');
    const finalCode = (doctorCode.trim() || `DOC-${Math.floor(100 + Math.random() * 900)}`).toUpperCase();
    const res = await signInWithGoogle('doctor', {
      department,
      doctorCode: finalCode,
      isAvailable: true
    });

    if (res.success) {
      // Check if this doctor is already in doctors collection
      let matchedDoc = doctors.find(
        d => d.doctorId === res.user.uid || d.doctorCode?.toUpperCase() === finalCode
      );

      if (!matchedDoc) {
        matchedDoc = await registerDoctor({
          doctorId: res.user.uid,
          doctorCode: finalCode,
          name: res.user.name,
          department,
          age: 40,
          isAvailable: true
        });
      }

      setIsSubmitting(false);
      showToast(`Clinician authenticated: ${res.user.name}`);
      onAuthSuccess(res.user, matchedDoc);
    } else {
      setIsSubmitting(false);
      showToast(res.message || 'Google sign-in was cancelled.');
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
          <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>
            DOCTOR SUITE AUTH
          </span>
        </div>

        {/* Dedicated Doctor Auth Card */}
        <div className="auth-dialog-card" style={{ width: '100%' }}>
          <div className="auth-dialog-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="card-icon-bubble dark" style={{ width: '44px', height: '44px', margin: 0 }}>
                <img src="/doctor.gif" alt="Doctor Portal" className="card-icon-gif" style={{ width: '32px', height: '32px' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Doctor & Clinician Suite
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0' }}>
                  Manage patient consultation queues, examinations & clinical records
                </p>
              </div>
            </div>
          </div>

          {/* Clinician Auth Switcher */}
          <div className="auth-mode-tabs" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className={`auth-mode-btn ${!isRegistering ? 'active' : ''}`}
              onClick={() => setIsRegistering(false)}
            >
              <i className="fa-solid fa-right-to-bracket" style={{ marginRight: '6px' }}></i>
              Doctor Sign In
            </button>
            <button
              type="button"
              className={`auth-mode-btn ${isRegistering ? 'active' : ''}`}
              onClick={() => setIsRegistering(true)}
            >
              <i className="fa-solid fa-user-plus" style={{ marginRight: '6px' }}></i>
              Onboard Clinician
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="auth-unified-form" style={{ marginTop: '16px' }}>
            {isRegistering && (
              <>
                <div className="form-group">
                  <label>Doctor Full Name *</label>
                  <div className="input-with-icon">
                    <i className="fa-solid fa-user-doctor"></i>
                    <input
                      type="text"
                      placeholder="Dr. Sarah Khan"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required={isRegistering}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Department / Service *</label>
                    <select
                      className="form-input"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      style={{ fontSize: '13px' }}
                    >
                      <option value="Cardiology">Cardiology</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Odontology">Odontology</option>
                      <option value="General Medicine">General Medicine</option>
                      <option value="Pediatrics">Pediatrics</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Age / Experience</label>
                    <input
                      type="number"
                      className="form-input"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Doctor Private Code (Unique) *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input font-mono"
                      placeholder="e.g. DOC-404"
                      value={doctorCode}
                      onChange={e => setDoctorCode(e.target.value.toUpperCase())}
                      style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
                      required={isRegistering}
                    />
                    <button
                      type="button"
                      className="btn-secondary-action"
                      style={{ padding: '0 14px', whiteSpace: 'nowrap', fontSize: '12px' }}
                      onClick={handleGenerateCode}
                      title="Generate unique code"
                    >
                      <i className="fa-solid fa-shuffle"></i> Random
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Clinician Email Address *</label>
              <div className="input-with-icon">
                <i className="fa-solid fa-envelope"></i>
                <input
                  type="email"
                  placeholder="doctor@hospital.mediqueue.clinic"
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
              <span>{isRegistering ? 'Register & Enter Doctor Suite' : 'Sign In to Doctor Suite'}</span>
            </button>
          </form>

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
            <span>Continue with Google</span>
          </button>

        </div>
      </div>
    </main>
  );
}
