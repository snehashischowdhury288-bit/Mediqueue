import React, { useState } from 'react';

export default function AdminAuth({ onBack, onAuthSuccess, db, showToast }) {
  const [adminKey, setAdminKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState('passcode'); // 'passcode' | 'email'
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signInWithEmail, signInWithGoogle, authAdminLogin } = db;

  const handlePasscodeSubmit = async e => {
    e.preventDefault();
    if (!adminKey.trim()) {
      showToast('Please enter the Hospital Administration Passcode.');
      return;
    }

    setIsSubmitting(true);
    // Verify passcode: accept ADMIN2026 or MEDIQUEUE_ADMIN
    if (adminKey.trim().toUpperCase() === 'ADMIN2026' || adminKey.trim().toUpperCase() === 'MEDIQUEUE_ADMIN') {
      const res = await authAdminLogin({
        method: 'passcode',
        name: 'Hospital Administrator'
      });
      setIsSubmitting(false);
      if (res.success) {
        showToast('Administrative authorization granted.');
        onAuthSuccess(res.user);
      } else {
        showToast('Administrative authorization failed.');
      }
    } else {
      setIsSubmitting(false);
      showToast('Invalid passcode. Hint: Use ADMIN2026');
    }
  };

  const handleEmailSubmit = async e => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    const res = await signInWithEmail(email.trim(), password);
    setIsSubmitting(false);
    if (res.success) {
      showToast('Admin logged in successfully.');
      onAuthSuccess({ ...res.user, role: 'admin' });
    } else {
      showToast(res.message || 'Invalid administrator credentials.');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    showToast('Connecting to Google...');
    const res = await signInWithGoogle('admin');
    setIsSubmitting(false);
    if (res.success) {
      showToast('Admin authenticated via Google.');
      onAuthSuccess({ ...res.user, role: 'admin' });
    } else {
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
          <span className="font-mono text-purple" style={{ fontSize: '12px', fontWeight: 700 }}>
            ADMIN ACCESS CONTROL
          </span>
        </div>

        {/* Dedicated Admin Auth Card */}
        <div className="auth-dialog-card" style={{ width: '100%' }}>
          <div className="auth-dialog-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="card-icon-bubble purple" style={{ width: '44px', height: '44px', margin: 0 }}>
                <img src="/admin.gif" alt="Admin Portal" className="card-icon-gif" style={{ width: '32px', height: '32px' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                  Hospital Admin Portal
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0' }}>
                  Centralized OPD telemetry, clinician directory & patient queue monitoring
                </p>
              </div>
            </div>
          </div>

          {/* Admin Auth Tabs */}
          <div className="auth-mode-tabs" style={{ marginTop: '16px' }}>
            <button
              type="button"
              className={`auth-mode-btn ${authMethod === 'passcode' ? 'active' : ''}`}
              onClick={() => setAuthMethod('passcode')}
            >
              <i className="fa-solid fa-key" style={{ marginRight: '6px' }}></i>
              Admin Passcode
            </button>
            <button
              type="button"
              className={`auth-mode-btn ${authMethod === 'email' ? 'active' : ''}`}
              onClick={() => setAuthMethod('email')}
            >
              <i className="fa-solid fa-envelope" style={{ marginRight: '6px' }}></i>
              Admin Email
            </button>
          </div>

          {/* Passcode Method */}
          {authMethod === 'passcode' && (
            <form onSubmit={handlePasscodeSubmit} className="auth-unified-form" style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label>Hospital Administration Master Key *</label>
                <div className="input-with-icon">
                  <i className="fa-solid fa-shield-halved"></i>
                  <input
                    type="password"
                    placeholder="Enter ADMIN2026"
                    value={adminKey}
                    onChange={e => setAdminKey(e.target.value)}
                    style={{ letterSpacing: '2px' }}
                    required
                  />
                </div>
                <small style={{ color: '#64748B', fontSize: '11.5px', marginTop: '2px' }}>
                  Default system authorization key: <code>ADMIN2026</code>
                </small>
              </div>

              <button
                type="submit"
                className="btn-submit-auth"
                style={{ background: '#7C3AED' }}
                disabled={isSubmitting}
              >
                <i className="fa-solid fa-lock-open"></i>
                <span>Authorize & Enter Admin Portal</span>
              </button>
            </form>
          )}

          {/* Email Method */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailSubmit} className="auth-unified-form" style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label>Admin Email Address *</label>
                <div className="input-with-icon">
                  <i className="fa-solid fa-envelope"></i>
                  <input
                    type="email"
                    placeholder="admin@hospital.mediqueue.clinic"
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
                style={{ background: '#7C3AED' }}
                disabled={isSubmitting}
              >
                <i className="fa-solid fa-arrow-right-to-bracket"></i>
                <span>Sign In as Administrator</span>
              </button>
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
            <span>Authorize with Google Admin</span>
          </button>

        </div>
      </div>
    </main>
  );
}
