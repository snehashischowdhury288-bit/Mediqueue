/**
 * MediQueue - Frontend State & Application Controller
 * Dynamic Doctor Association & Selection (No Private Code System),
 * Dual-Portal Routing, 10-Specialty Directory, and Priority Queue Management.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    selectedPortalRole: 'patient', // 'patient' | 'doctor'
    authMode: 'signin',           // 'signin' | 'signup'
    activeView: 'viewLandingAuth',
    consultationTimerInterval: null,
    consultationSeconds: 0,
    currentPatientAppointmentId: null, // active patient appointment
    selectedDoctorId: null             // current doctor whose live queue is being viewed in Patient Portal
  };

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    setupReactiveSubscriptions();
    restoreSessionOrInitialView();
  });

  function initEventListeners() {
    // Top Nav Bar
    const btnPopulateDemo = document.getElementById('btnPopulateDemoScenario');
    if (btnPopulateDemo) {
      btnPopulateDemo.addEventListener('click', handlePopulateDemo);
    }

    const btnClearAll = document.getElementById('btnClearAllState');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', handleClearAllState);
    }

    const btnGlobalSignOut = document.getElementById('btnGlobalSignOut');
    if (btnGlobalSignOut) {
      btnGlobalSignOut.addEventListener('click', handleSignOut);
    }

    // Top Nav Admin View Toggle (Requirement 5)
    const btnNavAdmin = document.getElementById('btnNavAdminView');
    if (btnNavAdmin) {
      btnNavAdmin.addEventListener('click', () => {
        showView('viewAdminDashboard');
        if (window.history && window.history.pushState) {
          window.history.pushState(null, '', '/admin');
        }
      });
    }

      // 1. Landing & Unified Auth Entry
      const btnChoosePatient = document.getElementById('btnChoosePatient');
      const cardPatient = document.getElementById('choicePatientPortal');
      if (btnChoosePatient) btnChoosePatient.addEventListener('click', () => openAuthDialog('patient'));
      if (cardPatient) cardPatient.addEventListener('click', () => openAuthDialog('patient'));

      const btnChooseDoctor = document.getElementById('btnChooseDoctor');
      const cardDoctor = document.getElementById('choiceDoctorPortal');
      if (btnChooseDoctor) btnChooseDoctor.addEventListener('click', () => openAuthDialog('doctor'));
      if (cardDoctor) cardDoctor.addEventListener('click', () => openAuthDialog('doctor'));

      const btnChooseAdmin = document.getElementById('btnChooseAdmin');
      const cardAdmin = document.getElementById('choiceAdminPortal');
      if (btnChooseAdmin) btnChooseAdmin.addEventListener('click', enterAdminPortal);
      if (cardAdmin) cardAdmin.addEventListener('click', enterAdminPortal);

      const btnBackChoices = document.getElementById('btnBackToChoices');
      if (btnBackChoices) {
        btnBackChoices.addEventListener('click', closeAuthDialog);
      }

    // Auth Method Switcher (Mobile OTP vs Email) - Requirement 1
    const btnMethodPhone = document.getElementById('btnMethodPhone');
    const btnMethodEmail = document.getElementById('btnMethodEmail');
    if (btnMethodPhone && btnMethodEmail) {
      btnMethodPhone.addEventListener('click', () => setAuthMethod('phone'));
      btnMethodEmail.addEventListener('click', () => setAuthMethod('email'));
    }

    // Mobile Number & Simulated OTP Listeners - Requirement 1
    const btnGetOtp = document.getElementById('btnGetOtp');
    if (btnGetOtp) {
      btnGetOtp.addEventListener('click', handleGetOtp);
    }

    const btnAutoFillOtp = document.getElementById('btnAutoFillOtp');
    if (btnAutoFillOtp) {
      btnAutoFillOtp.addEventListener('click', handleAutoFillOtp);
    }

    const btnVerifyOtpSubmit = document.getElementById('btnVerifyOtpSubmit');
    if (btnVerifyOtpSubmit) {
      btnVerifyOtpSubmit.addEventListener('click', handleVerifyOtpSubmit);
    }

    // Tabbed Toggle: Sign In vs Sign Up
    const btnTabSignIn = document.getElementById('btnTabSignIn');
    const btnTabSignUp = document.getElementById('btnTabSignUp');
    if (btnTabSignIn && btnTabSignUp) {
      btnTabSignIn.addEventListener('click', () => setAuthMode('signin'));
      btnTabSignUp.addEventListener('click', () => setAuthMode('signup'));
    }

    const formUnifiedAuth = document.getElementById('formUnifiedAuth');
    if (formUnifiedAuth) {
      formUnifiedAuth.addEventListener('submit', handleUnifiedAuthSubmit);
    }

    const btnMockGoogleAuth = document.getElementById('btnMockGoogleAuth');
    if (btnMockGoogleAuth) {
      btnMockGoogleAuth.addEventListener('click', handleMockGoogleAuth);
    }

    // 2. Doctor Onboarding Form
    const formDoctorOnboard = document.getElementById('formDoctorOnboarding');
    if (formDoctorOnboard) {
      formDoctorOnboard.addEventListener('submit', handleDoctorOnboardSubmit);
    }

    // Quick Specialization Chips in Doctor Onboarding
    const specChips = document.querySelectorAll('.spec-chip-btn');
    specChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const specInput = document.getElementById('docSpecInput');
        if (specInput) {
          specInput.value = chip.getAttribute('data-spec');
          showToast(`Specialization selected: ${chip.getAttribute('data-spec')}`);
        }
      });
    });

    // 3. Patient Onboarding Form
    const formPatientOnboard = document.getElementById('formPatientOnboarding');
    if (formPatientOnboard) {
      formPatientOnboard.addEventListener('submit', handlePatientOnboardSubmit);
    }

    // Patient Category Radio Selection Cards
    const priorityCards = document.querySelectorAll('.priority-radio-card');
    priorityCards.forEach(card => {
      card.addEventListener('click', () => {
        priorityCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    // Clinical Services 10-Item Grid Interaction (Patient Portal)
    const serviceCards = document.querySelectorAll('.service-card-compact');
    serviceCards.forEach(card => {
      card.addEventListener('click', () => {
        const specialty = card.getAttribute('data-specialty');
        handleSelectSpecialty(specialty, card);
      });
    });

    const btnCloseDrawer = document.getElementById('btnCloseSpecialtyDrawer');
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', closeSpecialtyDrawer);
    }

    // Modal: Book Consultation Event Listeners
    const btnCloseBooking = document.getElementById('btnCloseBookConsultation');
    if (btnCloseBooking) btnCloseBooking.addEventListener('click', closeBookingModal);

    const btnCancelBooking = document.getElementById('btnCancelBookingModal');
    if (btnCancelBooking) btnCancelBooking.addEventListener('click', closeBookingModal);

    const formConfirmBooking = document.getElementById('formConfirmBooking');
    if (formConfirmBooking) formConfirmBooking.addEventListener('submit', handleConfirmBookingSubmit);

    // Modal Category Radio cards
    const modalPriorityCards = document.querySelectorAll('.priority-radio-card[data-modal-category]');
    modalPriorityCards.forEach(card => {
      card.addEventListener('click', () => {
        modalPriorityCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    // Doctor Switcher Dropdown (Patient Portal Live Queue)
    const patDoctorSwitcher = document.getElementById('patDoctorSwitcherSelect');
    if (patDoctorSwitcher) {
      patDoctorSwitcher.addEventListener('change', (e) => {
        state.selectedDoctorId = e.target.value;
        const selectedDoc = QueueStore.getDoctorById(e.target.value);
        if (selectedDoc) {
          showToast(`Viewing queue for ${selectedDoc.name}`);
        }
        renderPatientPortal();
      });
    }

    // 4. Patient Portal Actions
    const btnBookAnother = document.getElementById('btnBookAnother');
    if (btnBookAnother) {
      btnBookAnother.addEventListener('click', () => {
        const grid = document.getElementById('patientServicesGrid');
        if (grid) {
          grid.scrollIntoView({ behavior: 'smooth' });
          showToast('Select any specialty below to choose a doctor and book a token.');
        }
      });
    }

    const btnPatientSignOut = document.getElementById('btnPatientSignOut');
    if (btnPatientSignOut) {
      btnPatientSignOut.addEventListener('click', handleSignOut);
    }

    // 3-Turns-Away Dismiss Banner Listener - Requirement 6
    const btnDismiss3Turn = document.getElementById('btnDismiss3TurnAlert');
    if (btnDismiss3Turn) {
      btnDismiss3Turn.addEventListener('click', () => {
        const banner = document.getElementById('pat3TurnsAlertBanner');
        if (banner) banner.classList.add('hidden');
      });
    }

    // Digital Token / Ticket Pass Modal Listeners - Requirement 2
    const btnViewTicket = document.getElementById('btnViewFullTicketModal');
    if (btnViewTicket) {
      btnViewTicket.addEventListener('click', handleOpenCurrentTicketModal);
    }

    const btnCloseTicket = document.getElementById('btnCloseDigitalTicketModal');
    if (btnCloseTicket) {
      btnCloseTicket.addEventListener('click', closeDigitalTicketModal);
    }

    const btnContinueQueue = document.getElementById('btnContinueToQueue');
    if (btnContinueQueue) {
      btnContinueQueue.addEventListener('click', closeDigitalTicketModal);
    }

    // 5. Complete Doctor Control Panel Actions - Requirement 4
    const btnDoctorCallNext = document.getElementById('btnDoctorCallNext');
    if (btnDoctorCallNext) {
      btnDoctorCallNext.addEventListener('click', handleDoctorCallNext);
    }

    const btnCompleteCurrent = document.getElementById('btnCompleteCurrentPatient');
    if (btnCompleteCurrent) {
      btnCompleteCurrent.addEventListener('click', handleCompleteCurrentPatient);
    }

    const btnDoctorSkipCurrent = document.getElementById('btnDoctorSkipCurrent');
    if (btnDoctorSkipCurrent) {
      btnDoctorSkipCurrent.addEventListener('click', handleDoctorSkipCurrent);
    }

    const btnDoctorNoShowCurrent = document.getElementById('btnDoctorNoShowCurrent');
    if (btnDoctorNoShowCurrent) {
      btnDoctorNoShowCurrent.addEventListener('click', handleDoctorNoShowCurrent);
    }

    const btnQuickWalkIn = document.getElementById('btnQuickAddWalkInPatient');
    if (btnQuickWalkIn) {
      btnQuickWalkIn.addEventListener('click', handleQuickWalkInPrompt);
    }

    const btnDoctorSignOut = document.getElementById('btnDoctorSignOut');
    if (btnDoctorSignOut) {
      btnDoctorSignOut.addEventListener('click', handleSignOut);
    }

    // 6. Hospital Admin Dashboard Actions - Requirement 5
    const btnAdminRefresh = document.getElementById('btnAdminRefresh');
    if (btnAdminRefresh) {
      btnAdminRefresh.addEventListener('click', () => {
        renderAdminDashboard();
        showToast('Admin telemetry refreshed.');
      });
    }

    const btnAdminExit = document.getElementById('btnAdminExit');
    if (btnAdminExit) {
      btnAdminExit.addEventListener('click', () => {
        window.handleLogoClick();
      });
    }

    // Initialize all Admin Control Center listeners
    initAdminEventListeners();
  }

  // =========================================================================
  // VIEW ROUTER
  // =========================================================================
  function showView(viewId) {
    const views = [
      'viewLandingAuth',
      'viewDoctorOnboarding',
      'viewPatientOnboarding',
      'viewPatientPortal',
      'viewDoctorPortal',
      'viewAdminDashboard'
    ];

    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === viewId) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    state.activeView = viewId;
    updateTopNavUserSession();

    // Specific View Lifecycle Hooks
    if (viewId === 'viewDoctorPortal') {
      startConsultationStopwatch();
      renderDoctorPortal();
    } else {
      stopConsultationStopwatch();
    }

    if (viewId === 'viewPatientPortal') {
      renderPatientPortal();
    }

    if (viewId === 'viewAdminDashboard') {
      renderAdminDashboard();
    }

    if (viewId === 'viewPatientOnboarding') {
      const user = QueueStore.getCurrentUser();
      resetPatientOnboardingForm(user ? user.email : '', state.selectedDoctorId);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.handleLogoClick = function () {
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', '/');
    }
    const user = QueueStore.getCurrentUser();
    if (user && user.role === 'doctor') {
      showView('viewDoctorPortal');
    } else if (user && user.role === 'patient') {
      showView('viewPatientPortal');
    } else {
      showView('viewLandingAuth');
      closeAuthDialog();
    }
  };

  // =========================================================================
  // REACTIVE STATE SUBSCRIPTIONS
  // =========================================================================
  function setupReactiveSubscriptions() {
    QueueStore.subscribe(({ doctors, appointments, currentUser }) => {
      // Re-render currently visible dashboard if state changed
      if (state.activeView === 'viewDoctorPortal') {
        renderDoctorPortal();
      } else if (state.activeView === 'viewPatientPortal') {
        renderPatientPortal();
      } else if (state.activeView === 'viewAdminDashboard') {
        renderAdminDashboard();
      }
      updateTopNavUserSession();
    });
  }

  function restoreSessionOrInitialView() {
    if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
      enterAdminPortal();
      return;
    }

    const currentUser = QueueStore.getCurrentUser();
    if (!currentUser) {
      showView('viewLandingAuth');
      return;
    }

    if (currentUser.role === 'admin') {
      showView('viewAdminDashboard');
      return;
    }

    if (currentUser.role === 'doctor') {
      const doc = QueueStore.getDoctorById(currentUser.doctorId || currentUser.doctorCode);
      if (doc) {
        showView('viewDoctorPortal');
      } else {
        showView('viewDoctorOnboarding');
      }
    } else if (currentUser.role === 'patient') {
      state.currentPatientAppointmentId = currentUser.lastAppointmentId || null;
      if (currentUser.doctorId) {
        state.selectedDoctorId = currentUser.doctorId;
      }
      showView('viewPatientPortal');
    } else {
      showView('viewLandingAuth');
    }
  }

  function updateTopNavUserSession() {
    const user = QueueStore.getCurrentUser();
    const chip = document.getElementById('userSessionChip');
    const avatar = document.getElementById('chipAvatar');
    const label = document.getElementById('chipLabel');

    if (!chip) return;

    if (user && user.email) {
      chip.classList.remove('hidden');
      if (avatar) avatar.textContent = (user.name || user.email).charAt(0).toUpperCase();
      if (label) label.textContent = user.name || user.email;
    } else {
      chip.classList.add('hidden');
    }
  }

  // =========================================================================
  // 1. LANDING & UNIFIED AUTHENTICATION CONTROLLER
  // =========================================================================
  function openAuthDialog(role) {
    state.selectedPortalRole = role;
    const dialog = document.getElementById('authDialogCard');
    const title = document.getElementById('authRoleTitle');
    const choices = document.querySelector('.portal-choices-row');

    if (title) {
      title.textContent = role === 'doctor' ? 'Doctor Portal Authentication' : 'Patient Portal Authentication';
    }

    // Default to Mobile OTP method
    setAuthMethod('phone');
    const otpStage = document.getElementById('otpStageContainer');
    if (otpStage) otpStage.classList.add('hidden');
    const otpInput = document.getElementById('authOtpInput');
    if (otpInput) otpInput.value = '';

    if (choices) choices.classList.add('hidden');
    if (dialog) dialog.classList.remove('hidden');
  }

  function closeAuthDialog() {
    const dialog = document.getElementById('authDialogCard');
    const choices = document.querySelector('.portal-choices-row');

    if (dialog) dialog.classList.add('hidden');
    if (choices) choices.classList.remove('hidden');
  }

  // Toggle between Mobile OTP & Email Login
  function setAuthMethod(method) {
    const btnPhone = document.getElementById('btnMethodPhone');
    const btnEmail = document.getElementById('btnMethodEmail');
    const panePhone = document.getElementById('paneMobileAuth');
    const paneEmail = document.getElementById('paneEmailAuth');

    if (method === 'phone') {
      if (btnPhone) btnPhone.classList.add('active');
      if (btnEmail) btnEmail.classList.remove('active');
      if (panePhone) panePhone.classList.remove('hidden');
      if (paneEmail) paneEmail.classList.add('hidden');
    } else {
      if (btnEmail) btnEmail.classList.add('active');
      if (btnPhone) btnPhone.classList.remove('active');
      if (paneEmail) paneEmail.classList.remove('hidden');
      if (panePhone) panePhone.classList.add('hidden');
    }
  }

  // Requirement 1: Mobile Number Registration with Simulated OTP
  function handleGetOtp() {
    const phoneInput = document.getElementById('authPhoneInput');
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!phone || !/^\d{10}$/.test(phone)) {
      showToast('Please enter a valid 10-digit mobile number.');
      if (phoneInput) phoneInput.focus();
      return;
    }

    const modal = document.getElementById('modalSimulatedOtp');
    const phoneDisplay = document.getElementById('simulatedOtpPhoneDisplay');
    const otpStage = document.getElementById('otpStageContainer');

    if (phoneDisplay) phoneDisplay.textContent = `+91 ${phone}`;
    if (modal) modal.classList.remove('hidden');
    if (otpStage) otpStage.classList.remove('hidden');

    showToast(`Simulated OTP "1234" sent to +91 ${phone}`);
  }

  function handleAutoFillOtp() {
    const otpInput = document.getElementById('authOtpInput');
    const modal = document.getElementById('modalSimulatedOtp');

    if (otpInput) otpInput.value = '1234';
    if (modal) modal.classList.add('hidden');

    handleVerifyOtpSubmit();
  }

  function handleVerifyOtpSubmit() {
    const phoneInput = document.getElementById('authPhoneInput');
    const otpInput = document.getElementById('authOtpInput');

    const phone = phoneInput ? phoneInput.value.trim() : '';
    const otp = otpInput ? otpInput.value.trim() : '';

    if (!phone || !/^\d{10}$/.test(phone)) {
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (otp !== '1234') {
      showToast('Invalid OTP. Please enter mock OTP 1234.');
      if (otpInput) otpInput.focus();
      return;
    }

    showToast('Mobile verification successful! Welcome.');
    proceedMobileAuthSuccess(phone, state.selectedPortalRole);
  }

  function proceedMobileAuthSuccess(phone, role) {
    if (role === 'doctor') {
      const allDoctors = QueueStore.getDoctors();
      const existingDoc = allDoctors.find(d => (d.phone || '') === phone);

      if (existingDoc) {
        QueueStore.setCurrentUser({
          role: 'doctor',
          phone: existingDoc.phone || phone,
          name: existingDoc.name,
          doctorId: existingDoc.id
        });
        showToast(`Welcome back, ${existingDoc.name}!`);
        showView('viewDoctorPortal');
      } else {
        QueueStore.setCurrentUser({
          role: 'doctor',
          phone: phone,
          name: 'Doctor'
        });
        resetDoctorOnboardingForm('');
        showToast('Mobile verified! Please complete your Clinical Credentials.');
        showView('viewDoctorOnboarding');
      }
    } else {
      // Patient Portal flow
      const existingUser = QueueStore.getCurrentUser() || {};
      QueueStore.setCurrentUser({
        ...existingUser,
        role: 'patient',
        phone: phone,
        name: existingUser.name || 'Patient'
      });
      showToast('Mobile verified! Proceed to Patient Onboarding.');
      showView('viewPatientOnboarding');
      const patPhoneInput = document.getElementById('patPhoneInput');
      if (patPhoneInput) patPhoneInput.value = phone;
    }
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const btnTabSignIn = document.getElementById('btnTabSignIn');
    const btnTabSignUp = document.getElementById('btnTabSignUp');
    const groupConfirm = document.getElementById('groupConfirmPassword');
    const submitText = document.getElementById('btnAuthSubmitText');

    if (mode === 'signin') {
      if (btnTabSignIn) btnTabSignIn.classList.add('active');
      if (btnTabSignUp) btnTabSignUp.classList.remove('active');
      if (groupConfirm) groupConfirm.classList.add('hidden');
      if (submitText) submitText.textContent = 'Sign In & Proceed';
    } else {
      if (btnTabSignUp) btnTabSignUp.classList.add('active');
      if (btnTabSignIn) btnTabSignIn.classList.remove('active');
      if (groupConfirm) groupConfirm.classList.remove('hidden');
      if (submitText) submitText.textContent = 'Create Account & Continue';
    }
  }

  function handleUnifiedAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value;

    if (!email || !password) {
      showToast('Please fill in both email and password.');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }

    if (state.authMode === 'signup') {
      const confirmPass = document.getElementById('authConfirmPasswordInput').value;
      if (password !== confirmPass) {
        showToast('Passwords do not match. Please verify.');
        return;
      }
    }

    proceedAuthSuccess(email, state.selectedPortalRole);
  }

  function handleMockGoogleAuth() {
    const mockEmail = state.selectedPortalRole === 'doctor' ? 'dr.specialist@mediqueue.clinic' : 'patient.care@example.com';
    showToast(`Google Auth verified: ${mockEmail}`);
    proceedAuthSuccess(mockEmail, state.selectedPortalRole);
  }

  function proceedAuthSuccess(email, role) {
    if (role === 'doctor') {
      // Check if a doctor already exists with this email
      const allDoctors = QueueStore.getDoctors();
      const existingDoc = allDoctors.find(d => (d.email || '').toLowerCase() === email.toLowerCase());

      if (existingDoc) {
        QueueStore.setCurrentUser({
          role: 'doctor',
          email: existingDoc.email,
          name: existingDoc.name,
          doctorId: existingDoc.id
        });
        showToast(`Welcome back, ${existingDoc.name}!`);
        showView('viewDoctorPortal');
      } else {
        // Direct to Doctor Onboarding Form
        QueueStore.setCurrentUser({
          role: 'doctor',
          email: email
        });
        resetDoctorOnboardingForm(email);
        showToast('Please complete your Clinical Credentials.');
        showView('viewDoctorOnboarding');
      }
    } else {
      // Patient Portal flow - direct to portal to pick from Services
      const existingUser = QueueStore.getCurrentUser() || {};
      QueueStore.setCurrentUser({
        ...existingUser,
        role: 'patient',
        email: email
      });
      showToast('Welcome to Patient Portal! Select any specialty below to choose a doctor.');
      showView('viewPatientPortal');
    }
  }

  function handleSignOut() {
    QueueStore.setCurrentUser(null);
    state.currentPatientAppointmentId = null;
    showToast('Signed out successfully.');
    showView('viewLandingAuth');
    closeAuthDialog();
  }

  // =========================================================================
  // 2. DOCTOR ONBOARDING (NO CODE SYSTEM)
  // =========================================================================
  function resetDoctorOnboardingForm(email) {
    const form = document.getElementById('formDoctorOnboarding');
    if (form) form.reset();

    const nameInput = document.getElementById('docNameInput');
    const roomInput = document.getElementById('docRoomInput');

    if (nameInput) nameInput.value = '';
    if (roomInput) roomInput.value = 'Suite 304, Wing C';
  }

  function handleDoctorOnboardSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('docNameInput').value.trim();
    const age = parseInt(document.getElementById('docAgeInput').value, 10);
    const experience = document.getElementById('docExpInput').value.trim();
    const specialization = document.getElementById('docSpecInput').value.trim();
    const room = document.getElementById('docRoomInput').value.trim();

    if (!name || !age || !experience || !specialization) {
      showToast('Please complete all required fields.');
      return;
    }

    try {
      const currentUser = QueueStore.getCurrentUser() || {};
      const newDoc = QueueStore.addDoctor({
        name,
        age,
        experience,
        specialization,
        room,
        email: currentUser.email || ''
      });

      QueueStore.setCurrentUser({
        role: 'doctor',
        email: newDoc.email || currentUser.email,
        name: newDoc.name,
        doctorId: newDoc.id
      });

      state.selectedDoctorId = newDoc.id;
      showToast(`Doctor Profile saved for ${newDoc.name}!`);
      showView('viewDoctorPortal');
    } catch (err) {
      showToast(err.message);
    }
  }

  // =========================================================================
  // 3. PATIENT PROFILE REGISTRATION (NO DOCTOR DROPDOWN HERE)
  // =========================================================================
  function resetPatientOnboardingForm(email) {
    const form = document.getElementById('formPatientOnboarding');
    if (form) form.reset();

    const user = QueueStore.getCurrentUser();
    const emailInput = document.getElementById('patEmailInput');
    const nameInput = document.getElementById('patNameInput');
    const ageInput = document.getElementById('patAgeInput');
    const phoneInput = document.getElementById('patPhoneInput');

    if (emailInput) emailInput.value = (user && user.email) || email || '';
    if (nameInput && user && user.name) nameInput.value = user.name;
    if (ageInput && user && user.age) ageInput.value = user.age;
    if (phoneInput && user && user.phone) phoneInput.value = user.phone;

    const savedCat = (user && user.category) || 'Normal';
    const catRadio = document.querySelector(`input[name="patientCategory"][value="${savedCat}"]`);
    if (catRadio) catRadio.checked = true;

    const cards = document.querySelectorAll('.priority-radio-card[data-category]');
    cards.forEach(c => {
      if (c.getAttribute('data-category') === savedCat) c.classList.add('active');
      else c.classList.remove('active');
    });
  }

  function handlePatientOnboardSubmit(e) {
    e.preventDefault();

    const patientName = document.getElementById('patNameInput').value.trim();
    const patientAge = parseInt(document.getElementById('patAgeInput').value, 10);
    const patientPhone = document.getElementById('patPhoneInput').value.trim();
    const patientEmail = document.getElementById('patEmailInput').value.trim();
    const categoryEl = document.querySelector('input[name="patientCategory"]:checked');
    const category = categoryEl ? categoryEl.value : 'Normal';

    if (!patientName || !patientAge || !patientPhone || !patientEmail) {
      showToast('Please fill in your name, age, phone, and email.');
      return;
    }

    const currentUser = QueueStore.getCurrentUser() || {};
    QueueStore.setCurrentUser({
      ...currentUser,
      role: 'patient',
      email: patientEmail,
      name: patientName,
      age: patientAge,
      phone: patientPhone,
      category: category
    });

    showToast(`Profile saved for ${patientName}! Choose your doctor from Clinical Services below.`);
    showView('viewPatientPortal');

    setTimeout(() => {
      const grid = document.getElementById('patientServicesGrid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  }

  // =========================================================================
  // 4. PATIENT PORTAL CONTROLLER (Dynamic Doctor Association & Live Queue)
  // =========================================================================
  function renderPatientPortal() {
    const user = QueueStore.getCurrentUser();
    if (!user || user.role !== 'patient') return;

    const allDoctors = QueueStore.getDoctors();

    // Determine which doctor queue the patient is currently viewing
    let targetDoctorId = state.selectedDoctorId || (user && user.doctorId);

    if (!targetDoctorId && state.currentPatientAppointmentId) {
      const allApts = QueueStore.getAppointments();
      const myApt = allApts.find(a => a.id === state.currentPatientAppointmentId);
      if (myApt) targetDoctorId = myApt.doctorId;
    }

    if (!targetDoctorId && allDoctors.length > 0) {
      targetDoctorId = allDoctors[0].id;
    }

    const doctor = QueueStore.getDoctorById(targetDoctorId) || (allDoctors.length > 0 ? allDoctors[0] : null);

    // Populate Doctor Switcher Dropdown in Patient Portal
    const switcher = document.getElementById('patDoctorSwitcherSelect');
    if (switcher) {
      switcher.innerHTML = '';
      if (allDoctors.length === 0) {
        switcher.innerHTML = '<option value="" disabled selected>No Registered Doctors</option>';
      } else {
        allDoctors.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = `${d.name} (${d.specialization})`;
          if (doctor && d.id === doctor.id) {
            opt.selected = true;
          }
          switcher.appendChild(opt);
        });
      }
    }

    // Associated Doctor Banner
    const nameEl = document.getElementById('patAssocDocName');
    const specEl = document.getElementById('patAssocDocSpec');
    const statusEl = document.getElementById('patAssocDocStatus');
    const greeting = document.getElementById('patPortalGreeting');

    if (doctor) {
      if (nameEl) nameEl.textContent = doctor.name;
      if (specEl) specEl.textContent = `${doctor.specialization} · ${doctor.room || 'Suite 304, Wing C'}`;
      if (statusEl) statusEl.style.display = 'inline-flex';
    } else {
      if (nameEl) nameEl.textContent = 'No Doctor Selected';
      if (specEl) specEl.textContent = 'Select a doctor or specialty from the directory below';
      if (statusEl) statusEl.style.display = 'none';
    }

    if (greeting) {
      greeting.textContent = `Hello, ${user.name || 'Patient'}!`;
    }

    // Retrieve appointments for THIS doctor (active = not Completed & not No-Show)
    const doctorApts = doctor ? QueueStore.getAppointments(doctor.id) : [];
    const activeApts = doctorApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');

    // Check if the current user has a booked appointment with THIS doctor
    let myApt = null;
    if (state.currentPatientAppointmentId) {
      myApt = doctorApts.find(a => a.id === state.currentPatientAppointmentId);
    }
    if (!myApt && user.email) {
      myApt = doctorApts.find(a => (a.patientEmail || '').toLowerCase() === user.email.toLowerCase());
    }
    if (!myApt && user.phone) {
      myApt = doctorApts.find(a => a.patientPhone === user.phone);
    }

    // Status Card Elements
    const batchTag = document.getElementById('patCardBatchName');
    const posTag = document.getElementById('patCardPosition');
    const posSub = document.getElementById('patCardPositionSub');
    const slotTag = document.getElementById('patCardSlotBadge');
    const waitTag = document.getElementById('patCardWaitTime');
    const stateTag = document.getElementById('patCardStatusState');

    if (!doctor) {
      if (posTag) posTag.textContent = '--';
      if (posSub) posSub.textContent = 'NO DOCTOR';
      if (slotTag) slotTag.textContent = 'No Doctor Registered';
      if (waitTag) waitTag.textContent = 'Clinic Opening Soon';
      if (batchTag) batchTag.textContent = 'Batch --';
      if (stateTag) stateTag.innerHTML = '<i class="fa-solid fa-circle-info text-blue"></i> No active doctors currently in clinic.';
      renderBatchSlotsVisual([], null);
      renderPatientRosterTable([], null);
      renderPatientDigitalTokenCard(null, null);
      updatePatientPortalServicesUI();
      return;
    }

    if (!myApt) {
      // Patient has NOT booked with this doctor yet
      const nextSlot = activeApts.length + 1;
      const nextBatch = Math.floor((nextSlot - 1) / 5) + 1;
      const nextSlotNum = ((nextSlot - 1) % 5) + 1;

      if (posTag) posTag.textContent = 'OPEN';
      if (posSub) posSub.textContent = 'No active bookings found. Book an appointment above.';
      if (slotTag) slotTag.textContent = `Next Available: Slot ${nextSlotNum} (Batch ${nextBatch})`;
      if (waitTag) waitTag.textContent = `~${activeApts.length * 10} min current queue`;
      if (batchTag) batchTag.textContent = `Batch ${nextBatch}`;
      if (stateTag) {
        stateTag.innerHTML = `
          <button class="btn-primary-action" style="padding: 8px 18px; font-size: 13px;" onclick="window.bookWithDoctor('${doctor.id}')">
            <i class="fa-solid fa-ticket"></i> Book Queue Token with ${doctor.name}
          </button>
        `;
      }

      renderBatchSlotsVisual(doctorApts.filter(a => a.batchNumber === (activeApts.length > 0 ? activeApts[0].batchNumber : 1)), null);
      renderPatientRosterTable(doctorApts.filter(a => a.batchNumber === (activeApts.length > 0 ? activeApts[0].batchNumber : 1)), null);
      renderPatientDigitalTokenCard(null, doctor);
      updatePatientPortalServicesUI();
      return;
    }

    // Patient has an appointment with THIS doctor
    const myIndexInActive = activeApts.findIndex(a => a.id === myApt.id);

    if (batchTag) batchTag.textContent = myApt.batchName || `Batch ${myApt.batchNumber}`;
    if (slotTag) slotTag.textContent = `Assigned Slot: Slot ${myApt.slotNumber}`;

    // Render Digital Token QR Code Card (Requirement 2)
    renderPatientDigitalTokenCard(myApt, doctor);

    // Track Multi-Channel 3-Turns-Away Notification (Requirement 6)
    checkAndTrigger3TurnsAway(myApt, doctor, activeApts);

    if (myApt.status === 'Completed') {
      if (posTag) posTag.textContent = 'Done';
      if (posSub) posSub.textContent = 'CONSULTATION FINISHED';
      if (waitTag) waitTag.textContent = '0 min (Finished)';
      if (stateTag) stateTag.innerHTML = '<i class="fa-solid fa-circle-check text-green"></i> Examination completed. Thank you!';
    } else if (myApt.status === 'In-Consultation') {
      if (posTag) posTag.textContent = 'NOW';
      if (posSub) posSub.textContent = 'IN CONSULTATION';
      if (waitTag) waitTag.textContent = '0 min (In Room)';
      if (stateTag) stateTag.innerHTML = '<i class="fa-solid fa-door-open text-green"></i> <strong>You are in consultation now.</strong> Please proceed inside.';
    } else {
      // Waiting State:
      // Requirement 3:
      // Live Position = Number of active patients ahead in the queue
      // Estimated Wait Time = (Patients Ahead) * 10 mins
      const patientsAhead = Math.max(0, myIndexInActive);
      if (posTag) posTag.textContent = `${patientsAhead}`;
      if (posSub) {
        posSub.textContent = patientsAhead === 0 ? 'AHEAD (NEXT IN LINE)' : `PATIENT${patientsAhead > 1 ? 'S' : ''} AHEAD (${getOrdinalSuffix(patientsAhead + 1)} in line)`;
      }

      const estMinutes = patientsAhead * 10;
      if (waitTag) {
        waitTag.textContent = patientsAhead === 0 ? '~0 min (Next in line)' : `~${estMinutes} mins (${patientsAhead} ahead * 10m)`;
      }

      if (patientsAhead === 0) {
        if (stateTag) stateTag.innerHTML = '<span class="pulse-dot-green"></span> <strong>You are next in line!</strong> Please wait near the consulting room door.';
      } else {
        if (stateTag) stateTag.innerHTML = `<i class="fa-regular fa-clock text-blue"></i> ${patientsAhead} active patient(s) ahead of you in line.`;
      }
    }

    // 5-per-Batch Visualizer & Batch Roster
    const batchNumber = myApt.batchNumber || 1;
    const batchApts = doctorApts.filter(a => a.batchNumber === batchNumber);

    renderBatchSlotsVisual(batchApts, myApt.id);
    renderPatientRosterTable(batchApts, myApt.id);
    updatePatientPortalServicesUI();
  }

  function renderBatchSlotsVisual(batchApts, myAptId) {
    const container = document.getElementById('patBatchSlotsVisual');
    const counter = document.getElementById('patBatchSlotsCounter');
    if (!container) return;

    if (counter) {
      counter.textContent = `${batchApts.length} / 5 Filled`;
    }

    container.innerHTML = '';

    // Render 5 fixed slots for the batch
    for (let slot = 1; slot <= 5; slot++) {
      const apt = batchApts.find(a => a.slotNumber === slot);
      const node = document.createElement('div');
      node.className = 'batch-slot-node';

      if (apt) {
        node.classList.add('filled');
        if (apt.id === myAptId) {
          node.classList.add('current');
        }
        if (['Elderly', 'Pregnant Woman', 'Emergency'].includes(apt.category)) {
          node.classList.add('priority');
        }

        const isMe = apt.id === myAptId;
        const displayName = isMe ? `${apt.patientName} (You)` : maskPatientName(apt.patientName);

        node.innerHTML = `
          <span class="slot-label font-mono">SLOT ${slot}</span>
          <span class="slot-patient-name" title="${apt.patientName}">${displayName}</span>
        `;
      } else {
        node.innerHTML = `
          <span class="slot-label font-mono">SLOT ${slot}</span>
          <span class="slot-patient-name text-muted">Open</span>
        `;
      }

      container.appendChild(node);
    }
  }

  function renderPatientRosterTable(batchApts, myAptId) {
    const tbody = document.getElementById('patRosterTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (batchApts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94A3B8; padding: 20px;">No patients booked in this batch yet.</td></tr>';
      return;
    }

    batchApts.forEach(apt => {
      const tr = document.createElement('tr');
      const isMe = apt.id === myAptId;
      if (isMe) tr.style.backgroundColor = 'rgba(62, 105, 254, 0.05)';

      const displayName = isMe ? `<strong>${apt.patientName} (You)</strong>` : maskPatientName(apt.patientName);
      const catClass = getCategoryBadgeClass(apt.category);
      const statusClass = apt.status === 'In-Consultation' ? 'consulting' : (apt.status === 'Completed' ? 'completed' : 'waiting');

      tr.innerHTML = `
        <td class="font-mono"><strong>Slot ${apt.slotNumber}</strong></td>
        <td>${displayName}</td>
        <td><span class="badge-priority ${catClass}">${apt.category}</span></td>
        <td><span class="badge-status ${statusClass}">${apt.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // CLINICAL SERVICES & SPECIALTIES CONTROLLER
  // =========================================================================
  function updatePatientPortalServicesUI() {
    const allDoctors = QueueStore.getDoctors();
    const badges = document.querySelectorAll('[data-spec-badge]');
    badges.forEach(badge => {
      const spec = badge.getAttribute('data-spec-badge');
      const count = allDoctors.filter(d => {
        const docSpec = (d.specialization || '').toLowerCase();
        const targetSpec = (spec || '').toLowerCase();
        return docSpec.includes(targetSpec) || targetSpec.includes(docSpec);
      }).length;

      if (count > 0) {
        badge.textContent = `${count} Doctor${count > 1 ? 's' : ''}`;
        badge.classList.add('badge-active-doc');
      } else {
        badge.textContent = 'OPD Active';
        badge.classList.remove('badge-active-doc');
      }
    });
  }

  function handleSelectSpecialty(specialty, clickedCard) {
    const allCards = document.querySelectorAll('.service-card-compact');
    const drawer = document.getElementById('specialtyPractitionersDrawer');
    const titleEl = document.getElementById('drawerSpecialtyTitle');
    const listEl = document.getElementById('drawerPractitionersList');

    if (!drawer || !titleEl || !listEl) return;

    if (clickedCard.classList.contains('active') && !drawer.classList.contains('hidden')) {
      closeSpecialtyDrawer();
      return;
    }

    allCards.forEach(c => c.classList.remove('active'));
    clickedCard.classList.add('active');

    titleEl.textContent = `${specialty} Department`;

    // Query doctors registered with this specialization
    const allDoctors = QueueStore.getDoctors();
    const matchingDocs = allDoctors.filter(d => {
      const docSpec = (d.specialization || '').toLowerCase();
      const targetSpec = specialty.toLowerCase();
      return docSpec.includes(targetSpec) || targetSpec.includes(docSpec);
    });

    listEl.innerHTML = '';

    if (matchingDocs.length === 0) {
      listEl.innerHTML = `
        <div class="drawer-empty-state">
          <i class="fa-solid fa-user-doctor" style="font-size: 24px; color: #94A3B8; margin-bottom: 6px; display: block;"></i>
          <strong>No practitioner currently on-duty in ${specialty}.</strong><br>
          <span style="font-size: 12px; color: #64748B;">Doctors can register their clinical profile in the Doctor Portal to activate this department.</span>
        </div>
      `;
    } else {
      matchingDocs.forEach(doc => {
        const activeCount = QueueStore.getActiveAppointments(doc.id).length;
        const nextSlot = activeCount + 1;
        const nextBatch = Math.floor((nextSlot - 1) / 5) + 1;
        const nextSlotNum = ((nextSlot - 1) % 5) + 1;

        const docCard = document.createElement('div');
        docCard.className = 'drawer-doc-card';
        docCard.innerHTML = `
          <div class="drawer-doc-left">
            <div class="drawer-doc-avatar"><i class="fa-solid fa-user-doctor"></i></div>
            <div class="drawer-doc-meta">
              <span class="drawer-doc-name">${doc.name}</span>
              <span class="drawer-doc-sub">${doc.specialization} &bull; ${doc.room || 'OPD Suite'} &bull; ${doc.experience || 'Specialist'}</span>
              <div style="font-size: 11px; color: #2563EB; font-weight: 600; margin-top: 3px;">
                <i class="fa-solid fa-users"></i> Queue: ${activeCount} active &bull; Next Available: Slot ${nextSlotNum} (Batch ${nextBatch})
              </div>
            </div>
          </div>
          <div class="drawer-doc-right">
            <button class="btn-book-specialist" onclick="window.bookWithDoctor('${doc.id}')">
              <i class="fa-solid fa-ticket"></i> Book Appointment
            </button>
          </div>
        `;
        listEl.appendChild(docCard);
      });
    }

    drawer.classList.remove('hidden');
    drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeSpecialtyDrawer() {
    const drawer = document.getElementById('specialtyPractitionersDrawer');
    if (drawer) drawer.classList.add('hidden');
    const allCards = document.querySelectorAll('.service-card-compact');
    allCards.forEach(c => c.classList.remove('active'));
  }

  window.bookWithDoctor = function (doctorId) {
    openBookingModal(doctorId);
  };

  function openBookingModal(doctorId) {
    const doc = QueueStore.getDoctorById(doctorId);
    if (!doc) {
      showToast('Doctor profile not found.');
      return;
    }

    state.selectedDoctorId = doc.id;

    const modal = document.getElementById('modalBookConsultation');
    const hiddenId = document.getElementById('modalBookingDoctorId');
    const summary = document.getElementById('modalDocSummary');
    const nameInput = document.getElementById('modalPatName');
    const ageInput = document.getElementById('modalPatAge');
    const phoneInput = document.getElementById('modalPatPhone');
    const emailInput = document.getElementById('modalPatEmail');

    if (!modal) return;

    if (hiddenId) hiddenId.value = doc.id;

    if (summary) {
      const activeApts = QueueStore.getActiveAppointments(doc.id);
      summary.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div>
            <i class="fa-solid fa-stethoscope text-blue"></i> <strong>${doc.name}</strong>
            <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">${doc.specialization} &bull; ${doc.room || 'OPD Suite'} &bull; Experience: ${doc.experience || 'Specialist'}</div>
          </div>
          <span class="badge-status consulting" style="font-size: 11px;">${activeApts.length} In Queue</span>
        </div>
      `;
    }

    const user = QueueStore.getCurrentUser() || {};
    if (nameInput) nameInput.value = user.name || '';
    if (ageInput) ageInput.value = user.age || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (emailInput) emailInput.value = user.email || '';

    // Set priority category
    const userCat = user.category || 'Normal';
    const modalRadio = document.querySelector(`input[name="modalCategory"][value="${userCat}"]`);
    if (modalRadio) modalRadio.checked = true;

    const modalCards = document.querySelectorAll('.priority-radio-card[data-modal-category]');
    modalCards.forEach(c => {
      if (c.getAttribute('data-modal-category') === userCat) c.classList.add('active');
      else c.classList.remove('active');
    });

    modal.classList.remove('hidden');
  }

  function closeBookingModal() {
    const modal = document.getElementById('modalBookConsultation');
    if (modal) modal.classList.add('hidden');
  }

  function handleConfirmBookingSubmit(e) {
    e.preventDefault();

    const doctorId = document.getElementById('modalBookingDoctorId').value;
    const patientName = document.getElementById('modalPatName').value.trim();
    const patientAge = parseInt(document.getElementById('modalPatAge').value, 10);
    const patientPhone = document.getElementById('modalPatPhone').value.trim();
    const patientEmail = document.getElementById('modalPatEmail').value.trim();
    const categoryEl = document.querySelector('input[name="modalCategory"]:checked');
    const category = categoryEl ? categoryEl.value : 'Normal';

    if (!doctorId || !patientName || !patientAge || !patientPhone || !patientEmail) {
      showToast('Please complete all required fields.');
      return;
    }

    const doctor = QueueStore.getDoctorById(doctorId);
    if (!doctor) {
      showToast('Selected doctor not found.');
      return;
    }

    try {
      const newAppointment = QueueStore.addAppointment({
        doctorId: doctor.id,
        patientName,
        patientAge,
        patientPhone,
        patientEmail,
        category
      });

      // Update state
      state.currentPatientAppointmentId = newAppointment.id;
      state.selectedDoctorId = doctor.id;

      // Update current user profile
      QueueStore.setCurrentUser({
        role: 'patient',
        email: patientEmail,
        name: patientName,
        age: patientAge,
        phone: patientPhone,
        category: category,
        doctorId: doctor.id,
        lastAppointmentId: newAppointment.id
      });

      closeBookingModal();
      closeSpecialtyDrawer();

      if (['Elderly', 'Pregnant Woman', 'Emergency'].includes(category)) {
        showToast(`Priority Assigned: Slot ${newAppointment.slotNumber} of ${newAppointment.batchName} with ${doctor.name}!`);
      } else {
        showToast(`Appointment Confirmed with ${doctor.name}: Slot ${newAppointment.slotNumber} (${newAppointment.batchName})`);
      }

      renderPatientPortal();

      // Immediately issue & display dynamic QR code token modal (Requirement 2)
      openDigitalTokenModal(newAppointment, doctor);

      // Smooth scroll to top of live queue
      const topSection = document.getElementById('patPortalGreeting');
      if (topSection) topSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      showToast(err.message);
    }
  }

  // =========================================================================
  // 5. DOCTOR PORTAL & LIVE QUEUE MANAGEMENT
  // =========================================================================
  function renderDoctorPortal() {
    const user = QueueStore.getCurrentUser();
    if (!user || user.role !== 'doctor') return;

    const allDoctors = QueueStore.getDoctors();
    let doctor = QueueStore.getDoctorById(user.doctorId);

    if (!doctor && allDoctors.length > 0) {
      doctor = allDoctors[0];
      user.doctorId = doctor.id;
      QueueStore.setCurrentUser(user);
    }

    if (!doctor) {
      showToast('Doctor credentials not found. Please complete profile.');
      showView('viewDoctorOnboarding');
      return;
    }

    // Doctor Credentials Banner
    const docName = document.getElementById('docDashboardName');
    const docSpec = document.getElementById('docDashboardSpecialty');

    if (docName) docName.textContent = doctor.name;
    if (docSpec) docSpec.textContent = `${doctor.specialization} • ${doctor.room || 'OPD Suite'} • ${doctor.experience || 'Specialist'}`;

    // Queue Roster for this doctor (excluding Completed and No-Show)
    const doctorApts = QueueStore.getAppointments(doctor.id);
    const activeApts = doctorApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');

    // Counters
    const totalSched = document.getElementById('docTotalScheduledCount');
    const activeBatch = document.getElementById('docActiveBatchName');
    if (totalSched) totalSched.textContent = activeApts.length;

    if (activeBatch) {
      if (activeApts.length > 0) {
        activeBatch.textContent = activeApts[0].batchName || `Batch ${activeApts[0].batchNumber}`;
      } else {
        activeBatch.textContent = 'Batch 1';
      }
    }

    // Active Patient In Consultation Card
    const currentActive = activeApts.find(a => a.status === 'In-Consultation') || (activeApts.length > 0 ? activeApts[0] : null);
    renderActiveInSuiteCard(currentActive);

    // Doctor Appointments Table
    renderDoctorQueueTable(doctorApts, currentActive ? currentActive.id : null);
  }

  function renderActiveInSuiteCard(patient) {
    const nameEl = document.getElementById('activePatientDisplayName');
    const metaEl = document.getElementById('activePatientDisplayMeta');
    const phoneEl = document.getElementById('activePatientPhoneText');
    const emailEl = document.getElementById('activePatientEmailText');
    const btnCallNext = document.getElementById('btnDoctorCallNext');
    const btnDone = document.getElementById('btnCompleteCurrentPatient');
    const btnSkip = document.getElementById('btnDoctorSkipCurrent');
    const btnNoShow = document.getElementById('btnDoctorNoShowCurrent');

    if (!patient) {
      if (nameEl) nameEl.textContent = 'No Patient in Consultation';
      if (metaEl) metaEl.textContent = 'Queue is clear. Waiting for upcoming registrations...';
      if (phoneEl) phoneEl.textContent = '--';
      if (emailEl) emailEl.textContent = '--';
      if (btnCallNext) btnCallNext.disabled = true;
      if (btnDone) btnDone.disabled = true;
      if (btnSkip) btnSkip.disabled = true;
      if (btnNoShow) btnNoShow.disabled = true;
      return;
    }

    if (btnCallNext) btnCallNext.disabled = false;
    if (btnDone) btnDone.disabled = false;
    if (btnSkip) btnSkip.disabled = false;
    if (btnNoShow) btnNoShow.disabled = false;

    if (nameEl) nameEl.textContent = patient.patientName;
    if (metaEl) {
      metaEl.textContent = `Slot ${patient.slotNumber} • ${patient.batchName} • Age ${patient.patientAge} • Category: ${patient.category}`;
    }
    if (phoneEl) phoneEl.textContent = patient.patientPhone;
    if (emailEl) emailEl.textContent = patient.patientEmail || 'No email provided';
  }

  function renderDoctorQueueTable(appointments, activePatientId) {
    const tbody = document.getElementById('docQueueTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (appointments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748B; padding: 28px; font-weight: 600;">No patients waiting in current batch.</td></tr>';
      return;
    }

    appointments.forEach(apt => {
      const tr = document.createElement('tr');
      const isActive = apt.id === activePatientId;
      if (isActive) tr.style.backgroundColor = 'rgba(62, 105, 254, 0.05)';

      const catClass = getCategoryBadgeClass(apt.category);
      const statusClass = apt.status === 'In-Consultation' ? 'consulting' : (apt.status === 'Completed' ? 'completed' : (apt.status === 'No-Show' ? 'noshow' : 'waiting'));

      let actionButtons = '';
      if (apt.status === 'Waiting') {
        actionButtons = `
          <div class="doctor-row-actions">
            <button type="button" class="row-mini-btn call" onclick="window.callPatientDirectly('${apt.id}')" title="Call Next / Activate in Suite">
              <i class="fa-solid fa-bullhorn"></i> Call Next
            </button>
            <button type="button" class="row-mini-btn skip" onclick="window.skipPatientDirectly('${apt.id}')" title="Move to end of active batch">
              <i class="fa-solid fa-forward-step"></i> Skip (⏭️)
            </button>
            <button type="button" class="row-mini-btn noshow" onclick="window.noShowPatientDirectly('${apt.id}')" title="Mark No-Show & Remove from live queue">
              <i class="fa-solid fa-circle-xmark"></i> No-Show (❌)
            </button>
          </div>
        `;
      } else if (apt.status === 'In-Consultation') {
        actionButtons = `
          <div class="doctor-row-actions">
            <button type="button" class="row-mini-btn done" onclick="window.completePatientDirectly('${apt.doctorId}')" title="Consultation Finished (✅)">
              <i class="fa-solid fa-check"></i> Complete (✅)
            </button>
            <button type="button" class="row-mini-btn skip" onclick="window.skipPatientDirectly('${apt.id}')" title="Move to end of active batch">
              <i class="fa-solid fa-forward-step"></i> Skip (⏭️)
            </button>
            <button type="button" class="row-mini-btn noshow" onclick="window.noShowPatientDirectly('${apt.id}')" title="Mark No-Show">
              <i class="fa-solid fa-circle-xmark"></i> No-Show (❌)
            </button>
          </div>
        `;
      } else if (apt.status === 'No-Show') {
        actionButtons = '<span class="badge-status noshow"><i class="fa-solid fa-xmark"></i> Flagged No-Show</span>';
      } else {
        actionButtons = '<span style="font-size: 12px; color: #94A3B8;"><i class="fa-solid fa-check-double text-blue"></i> Completed</span>';
      }

      tr.innerHTML = `
        <td class="font-mono"><strong>Slot ${apt.slotNumber}</strong><br><span style="font-size: 11px; color: #64748B;">${apt.batchName}</span></td>
        <td><strong>${apt.patientName}</strong></td>
        <td>${apt.patientAge}</td>
        <td class="font-mono">${apt.patientPhone}</td>
        <td><span class="badge-priority ${catClass}">${apt.category}</span></td>
        <td><span class="badge-status ${statusClass}">${apt.status}</span></td>
        <td>${actionButtons}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Doctor Action 1: Call Next Patient in Line
  function handleDoctorCallNext() {
    const user = QueueStore.getCurrentUser();
    if (!user || user.role !== 'doctor') return;

    const nextPatient = QueueStore.callNext(user.doctorId);
    if (nextPatient) {
      playCallChime();
      showToast(`Calling next in line: ${nextPatient.patientName} (Slot ${nextPatient.slotNumber})`);
      state.consultationSeconds = 0;
    } else {
      showToast('No more waiting patients in queue.');
    }
  }

  // Doctor Action 2: Consultation Complete (✅)
  async function handleCompleteCurrentPatient() {
    const user = QueueStore.getCurrentUser();
    if (!user || user.role !== 'doctor') return;

    try {
      const res = await QueueStore.completeConsultation(user.doctorId);
      if (res && res.completedPatient) {
        showToast(`Consultation with ${res.completedPatient.patientName} marked Completed (✅)`);
        state.consultationSeconds = 0;
      } else {
        showToast('No active patient to complete.');
      }
    } catch (err) {
      showToast(`Error completing consultation: ${err.message}`);
    }
  }

  // Doctor Action 3: Skip (⏭️)
  function handleDoctorSkipCurrent() {
    const user = QueueStore.getCurrentUser();
    if (!user || user.role !== 'doctor') return;

    const apts = QueueStore.getActiveAppointments(user.doctorId);
    const current = apts.find(a => a.status === 'In-Consultation') || apts[0];

    if (!current) {
      showToast('No active patient to skip.');
      return;
    }

    QueueStore.skipPatient(current.id);
    showToast(`Skipped ${current.patientName}. Moved to end of active batch.`);
    state.consultationSeconds = 0;
  }

  // Doctor Action 4: Mark No-Show (❌)
  function handleDoctorNoShowCurrent() {
    const user = QueueStore.getCurrentUser();
    if (!user || user.role !== 'doctor') return;

    const apts = QueueStore.getActiveAppointments(user.doctorId);
    const current = apts.find(a => a.status === 'In-Consultation') || apts[0];

    if (!current) {
      showToast('No active patient to mark no-show.');
      return;
    }

    QueueStore.markNoShow(current.id);
    showToast(`Flagged ${current.patientName} as No-Show. Removed from live queue.`);
    state.consultationSeconds = 0;
  }

  window.callPatientDirectly = function (appointmentId) {
    QueueStore.callPatient(appointmentId);
    playCallChime();
    showToast('Patient called into active consultation room.');
    state.consultationSeconds = 0;
  };

  window.completePatientDirectly = async function (doctorId) {
    await QueueStore.completeConsultation(doctorId);
    showToast('Consultation marked complete (✅). Queue advanced.');
    state.consultationSeconds = 0;
  };

  window.skipPatientDirectly = function (appointmentId) {
    const apt = QueueStore.skipPatient(appointmentId);
    if (apt) {
      showToast(`Patient ${apt.patientName} moved to end of active batch.`);
      state.consultationSeconds = 0;
    }
  };

  window.noShowPatientDirectly = function (appointmentId) {
    const apt = QueueStore.markNoShow(appointmentId);
    if (apt) {
      showToast(`Patient ${apt.patientName} flagged as No-Show & removed from live queue.`);
      state.consultationSeconds = 0;
    }
  };

  function handleQuickWalkInPrompt() {
    const user = QueueStore.getCurrentUser();
    if (!user || user.role !== 'doctor') return;

    const name = prompt('Walk-In Patient Name:');
    if (!name) return;

    const age = prompt('Patient Age:') || '30';
    const phone = prompt('Patient Phone:') || '+1 (555) 019-0000';
    const category = confirm('Is this an Emergency / Priority Walk-In? Click OK for Priority, Cancel for Normal.') ? 'Emergency' : 'Normal';

    try {
      QueueStore.addAppointment({
        doctorId: user.doctorId,
        patientName: name.trim(),
        patientAge: parseInt(age, 10),
        patientPhone: phone.trim(),
        patientEmail: '',
        category
      });
      showToast(`Walk-In Patient "${name}" added to queue.`);
    } catch (e) {
      showToast(e.message);
    }
  }

  // Consultation Stopwatch
  function startConsultationStopwatch() {
    stopConsultationStopwatch();
    state.consultationSeconds = 0;
    state.consultationTimerInterval = setInterval(() => {
      state.consultationSeconds++;
      const mins = Math.floor(state.consultationSeconds / 60).toString().padStart(2, '0');
      const secs = (state.consultationSeconds % 60).toString().padStart(2, '0');
      const timerEl = document.getElementById('docConsultationTimer');
      if (timerEl) {
        timerEl.textContent = `${mins}:${secs}`;
      }
    }, 1000);
  }

  function stopConsultationStopwatch() {
    if (state.consultationTimerInterval) {
      clearInterval(state.consultationTimerInterval);
      state.consultationTimerInterval = null;
    }
  }

  // =========================================================================
  // DEMO SCENARIO POPULATION & CLEAN STATE HELPERS
  // =========================================================================
  function handlePopulateDemo() {
    if (confirm('Load demo scenario with 3 Doctors across specialties and sample queue patients?')) {
      const doc = QueueStore.populateDemoScenario();
      QueueStore.setCurrentUser({
        role: 'doctor',
        email: doc.email,
        name: doc.name,
        doctorId: doc.id
      });
      state.selectedDoctorId = doc.id;
      showToast('Demo scenario populated successfully! Viewing Doctor Dashboard.');
      showView('viewDoctorPortal');
    }
  }

  function handleClearAllState() {
    if (confirm('Are you sure you want to reset all data and clear state to zero mock records?')) {
      QueueStore.clearAllData();
      state.currentPatientAppointmentId = null;
      state.selectedDoctorId = null;
      showToast('All state and storage cleared. Initialized clean.');
      showView('viewLandingAuth');
      closeAuthDialog();
    }
  }

  // =========================================================================
  // UTILITY HELPERS
  // =========================================================================
  function getCategoryBadgeClass(category) {
    switch (category) {
      case 'Elderly': return 'elderly';
      case 'Pregnant Woman': return 'pregnant';
      case 'Emergency': return 'emergency';
      default: return 'normal';
    }
  }

  function maskPatientName(fullName) {
    if (!fullName) return 'Patient';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0) + '****';
    }
    return parts.map(p => p.charAt(0) + '*'.repeat(Math.max(1, p.length - 1))).join(' ');
  }

  function getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  function playCallChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      // AudioContext unavailable or blocked before user interaction
    }
  }

  // =========================================================================
  // DIGITAL TOKEN (QR CODE) GENERATION & MODAL CONTROLLERS (Requirement 2)
  // =========================================================================
  function renderPatientDigitalTokenCard(myApt, doctor) {
    const card = document.getElementById('patDigitalTokenCard');
    if (!card) return;

    if (!myApt || !doctor) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'flex';

    const tokenTag = document.getElementById('patTokenIdTag');
    const slotText = document.getElementById('patTokenSlotText');
    const canvas = document.getElementById('patLiveQrCanvas');

    if (tokenTag) tokenTag.textContent = `TOKEN #${myApt.id.slice(-6).toUpperCase()}`;
    if (slotText) slotText.textContent = `Slot ${myApt.slotNumber} • ${myApt.batchName || 'Batch ' + myApt.batchNumber}`;

    const payloadObj = {
      appointmentId: myApt.id,
      doctorCode: doctor.id || doctor.specialization,
      slotNumber: myApt.slotNumber,
      patientName: myApt.patientName
    };

    renderQrToCanvas(canvas, JSON.stringify(payloadObj));
  }

  function openDigitalTokenModal(appointment, doctor) {
    if (!appointment || !doctor) return;

    const modal = document.getElementById('modalDigitalTicket');
    if (!modal) return;

    const slotPill = document.getElementById('modalTicketSlotPill');
    const tokenId = document.getElementById('modalTicketTokenId');
    const patName = document.getElementById('modalTicketPatientName');
    const docName = document.getElementById('modalTicketDoctorName');
    const deptRoom = document.getElementById('modalTicketDeptRoom');
    const catBadge = document.getElementById('modalTicketCategoryBadge');
    const payloadDisplay = document.getElementById('modalTicketPayloadDisplay');
    const canvas = document.getElementById('modalQrCanvas');

    if (slotPill) slotPill.textContent = `Slot ${appointment.slotNumber} • ${appointment.batchName || 'Batch ' + appointment.batchNumber}`;
    if (tokenId) tokenId.textContent = `TOKEN #${appointment.id.toUpperCase()}`;
    if (patName) patName.textContent = appointment.patientName;
    if (docName) docName.textContent = doctor.name;
    if (deptRoom) deptRoom.textContent = `${doctor.specialization} • ${doctor.room || 'Suite 304, Wing C'}`;
    if (catBadge) catBadge.textContent = `${appointment.category} Priority`;

    const payloadObj = {
      appointmentId: appointment.id,
      doctorCode: doctor.id || doctor.specialization,
      slotNumber: appointment.slotNumber,
      patientName: appointment.patientName
    };
    const payloadStr = JSON.stringify(payloadObj);

    if (payloadDisplay) payloadDisplay.textContent = payloadStr;

    renderQrToCanvas(canvas, payloadStr);
    modal.classList.remove('hidden');
  }

  function handleOpenCurrentTicketModal() {
    const user = QueueStore.getCurrentUser();
    if (!user) return;

    const allApts = QueueStore.getAppointments();
    let myApt = null;
    if (state.currentPatientAppointmentId) {
      myApt = allApts.find(a => a.id === state.currentPatientAppointmentId);
    }
    if (!myApt && user.email) {
      myApt = allApts.find(a => (a.patientEmail || '').toLowerCase() === user.email.toLowerCase());
    }
    if (!myApt && user.phone) {
      myApt = allApts.find(a => a.patientPhone === user.phone);
    }

    if (!myApt) {
      showToast('No active appointment token found to display.');
      return;
    }

    const doctor = QueueStore.getDoctorById(myApt.doctorId);
    if (!doctor) {
      showToast('Attending doctor details not found.');
      return;
    }

    openDigitalTokenModal(myApt, doctor);
  }

  function closeDigitalTicketModal() {
    const modal = document.getElementById('modalDigitalTicket');
    if (modal) modal.classList.add('hidden');
  }

  function renderQrToCanvas(canvas, payloadText) {
    if (!canvas) return;
    const width = canvas.width || 120;
    const height = canvas.height || 120;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    if (typeof window.QRCode !== 'undefined') {
      try {
        const temp = document.createElement('div');
        new window.QRCode(temp, {
          text: payloadText,
          width: width,
          height: height,
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
        });

        setTimeout(() => {
          const qrCanvas = temp.querySelector('canvas');
          const qrImg = temp.querySelector('img');
          if (qrCanvas) {
            ctx.drawImage(qrCanvas, 0, 0, width, height);
          } else if (qrImg && qrImg.src) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, width, height);
            img.src = qrImg.src;
          } else {
            drawFallbackQr(canvas, payloadText);
          }
        }, 40);
        return;
      } catch (e) {
        console.warn('qrcodejs failed, using canvas fallback:', e);
      }
    }

    drawFallbackQr(canvas, payloadText);
  }

  function drawFallbackQr(canvas, payloadText) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width || 120;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const cells = 21;
    const cellSize = Math.floor(size / cells);
    const offset = Math.floor((size - (cells * cellSize)) / 2);

    ctx.fillStyle = '#0F172A';

    function drawFinder(row, col) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            ctx.fillRect(offset + (col + c) * cellSize, offset + (row + r) * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, 14);
    drawFinder(14, 0);

    let hash = 0;
    for (let i = 0; i < payloadText.length; i++) {
      hash = ((hash << 5) - hash) + payloadText.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8)) continue;
        const val = Math.abs(Math.sin((r * 23) + (c * 29) + hash) * 10000);
        if (val - Math.floor(val) > 0.44) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  // =========================================================================
  // MULTI-CHANNEL 3-TURNS-AWAY NOTIFICATION (Requirement 6)
  // =========================================================================
  function checkAndTrigger3TurnsAway(myApt, doctor, activeApts) {
    if (!myApt || !doctor || !activeApts || activeApts.length === 0) return;

    // Determine currently active slot number
    const activePatient = activeApts.find(a => a.status === 'In-Consultation') || activeApts[0];
    const currentlyActiveSlot = activePatient ? activePatient.slotNumber : 1;
    const queueDistance = myApt.slotNumber - currentlyActiveSlot;
    const myIndex = activeApts.findIndex(a => a.id === myApt.id);

    const isExactly3TurnsAway = (queueDistance === 3 || myIndex === 3);

    if (isExactly3TurnsAway) {
      const banner = document.getElementById('pat3TurnsAlertBanner');
      const docNameEl = document.getElementById('alertBannerDocName');
      const docRoomEl = document.getElementById('alertBannerDocRoom');

      if (banner) {
        banner.classList.remove('hidden');
        if (docNameEl) docNameEl.textContent = doctor.name;
        if (docRoomEl) docRoomEl.textContent = `${doctor.specialization} (${doctor.room || 'Suite 304'})`;
      }

      if (!myApt.notified3Away) {
        myApt.notified3Away = true;
        if (typeof QueueStore.saveAppointments === 'function') {
          QueueStore.saveAppointments();
        }

        // 1. In-App Banner & Toast alert
        showToast('Attention: You are 3 turns away from your consultation. Please approach the waiting area.');

        // 2. Client-side POST request to Web3Forms
        sendWeb3FormsNotification(myApt, doctor);
      }
    }
  }

  async function sendWeb3FormsNotification(appointment, doctor) {
    if (!appointment || !appointment.patientEmail) return;

    try {
      const payload = {
        access_key: 'c039dbb7-d1a2-4a7b-a0d0-087e85c136a8',
        subject: `MediQueue Alert: You are 3 turns away from your consultation with ${doctor.name}`,
        from_name: 'MediQueue OPD Smart System',
        to: appointment.patientEmail,
        email: appointment.patientEmail,
        message: `Attention: You are 3 turns away from your consultation. Please approach the waiting area. Attending Doctor: ${doctor.name} (${doctor.specialization}), Location: ${doctor.room || 'Suite 304, Wing C'}. Assigned Slot: Slot ${appointment.slotNumber} (${appointment.batchName}).`
      };

      console.log('Dispatching Web3Forms 3-Turns-Away Notification:', payload);

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('Web3Forms response:', result);
      showToast(`Notification email dispatched to ${appointment.patientEmail}`);
    } catch (err) {
      console.warn('Web3Forms notification dispatch error (simulated/offline):', err);
    }
  }

  // =========================================================================
  // HOSPITAL ADMIN CENTRAL CONTROL CENTER ENGINE
  // =========================================================================
  let currentAdminTab = 'overview';

  window.enterAdminPortal = function () {
    QueueStore.setCurrentUser({
      role: 'admin',
      name: 'Dr. Arthur Mitchell',
      email: 'admin@mediqueue.org'
    });
    showView('viewAdminDashboard');
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', '/admin');
    }
    renderAdminDashboard();
  };

  window.switchAdminTab = function (tabName) {
    currentAdminTab = tabName;
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
      if (btn.getAttribute('data-admin-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const paneMap = {
      'overview': 'adminPaneOverview',
      'live-queues': 'adminPaneLiveQueues',
      'appointments': 'adminPaneAppointments',
      'patients': 'adminPanePatients',
      'patient-registration': 'adminPanePatientRegistration',
      'doctors': 'adminPaneDoctors',
      'staff': 'adminPaneStaff',
      'departments': 'adminPaneDepartments',
      'doctor-assignment': 'adminPaneDoctorAssignment',
      'queue-management': 'adminPaneQueueManagement',
      'hospital-analytics': 'adminPaneHospitalAnalytics',
      'department-analytics': 'adminPaneDepartmentAnalytics',
      'doctor-analytics': 'adminPaneDoctorAnalytics',
      'notifications': 'adminPaneNotifications',
      'audit-logs': 'adminPaneAuditLogs',
      'settings': 'adminPaneSettings'
    };

    const targetPaneId = paneMap[tabName] || 'adminPaneOverview';
    document.querySelectorAll('.admin-tab-pane').forEach(pane => {
      if (pane.id === targetPaneId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    const titleEl = document.getElementById('adminHeaderTitle');
    const subEl = document.getElementById('adminHeaderSubtitle');
    if (titleEl && subEl) {
      switch (tabName) {
        case 'overview':
          titleEl.textContent = 'Good Morning, Admin';
          subEl.textContent = "Monitor and manage today's hospital operations.";
          break;
        case 'live-queues':
          titleEl.textContent = 'Live Hospital Queues';
          subEl.textContent = 'Direct real-time operations across all OPD clinics.';
          break;
        case 'appointments':
          titleEl.textContent = 'Appointments Management';
          subEl.textContent = 'Manage tokens, schedules, and clinical allocations.';
          break;
        case 'patients':
          titleEl.textContent = 'Patient Directory';
          subEl.textContent = 'Full patient records, registration source, and history.';
          break;
        case 'patient-registration':
          titleEl.textContent = 'Patient Registration';
          subEl.textContent = 'Manual walk-in, kiosk, and clinical admission.';
          break;
        case 'doctors':
          titleEl.textContent = 'Doctor Management';
          subEl.textContent = 'Specialist roster, suites, and consulting throughput.';
          break;
        case 'staff':
          titleEl.textContent = 'Staff Management';
          subEl.textContent = 'OPD nurses, queue coordinators, and front desk.';
          break;
        case 'departments':
          titleEl.textContent = 'Department Management';
          subEl.textContent = 'Clinical wings, doctor coverage, and queue capacities.';
          break;
        case 'doctor-assignment':
          titleEl.textContent = 'Doctor Assignment';
          subEl.textContent = 'Real-time department allocation with instant portal synchronization.';
          break;
        case 'queue-management':
          titleEl.textContent = 'Queue Management & Policies';
          subEl.textContent = '5-batching rules, priority shifts, and capacity controls.';
          break;
        case 'hospital-analytics':
        case 'department-analytics':
        case 'doctor-analytics':
          titleEl.textContent = 'Hospital Telemetry & Analytics';
          subEl.textContent = 'Wait-time distributions, volume throughput, and SLA metrics.';
          break;
        case 'notifications':
          titleEl.textContent = 'Notification Telemetry';
          subEl.textContent = '3-turn approaching alerts, SMS, and WhatsApp tracking.';
          break;
        case 'audit-logs':
          titleEl.textContent = 'System Audit Logs';
          subEl.textContent = 'Immutable log of administrative and clinical operations.';
          break;
        case 'settings':
          titleEl.textContent = 'Hospital Settings';
          subEl.textContent = 'Operational hours and system maintenance.';
          break;
        default:
          titleEl.textContent = 'Hospital Administration';
          subEl.textContent = "Monitor and manage today's hospital operations.";
      }
    }

    renderAdminDashboard();
  };

  window.refreshAdminData = function () {
    renderAdminDashboard();
    showToast('Admin telemetry refreshed.');
  };

  function initAdminEventListeners() {
    // Nav Tabs
    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-admin-tab');
        if (tab) window.switchAdminTab(tab);
      });
    });

    // Workspace actions
    const btnSync = document.getElementById('btnAdminTelemetryRefresh');
    if (btnSync) btnSync.addEventListener('click', window.refreshAdminData);

    const btnQuickReg = document.getElementById('btnAdminQuickRegister');
    if (btnQuickReg) btnQuickReg.addEventListener('click', () => window.switchAdminTab('patient-registration'));

    const btnSidebarExit = document.getElementById('btnAdminSidebarExit');
    if (btnSidebarExit) btnSidebarExit.addEventListener('click', () => window.handleLogoClick());

    // Filter listeners
    const apptSearch = document.getElementById('filterApptSearch');
    const apptDept = document.getElementById('filterApptDept');
    const apptDoc = document.getElementById('filterApptDoctor');
    const apptStatus = document.getElementById('filterApptStatus');
    [apptSearch, apptDept, apptDoc, apptStatus].forEach(el => {
      if (el) el.addEventListener('input', renderAdminAppointments);
    });

    const patSearch = document.getElementById('filterPatientSearch');
    const patDept = document.getElementById('filterPatientDept');
    const patPriority = document.getElementById('filterPatientPriority');
    const patSource = document.getElementById('filterPatientSource');
    [patSearch, patDept, patPriority, patSource].forEach(el => {
      if (el) el.addEventListener('input', renderAdminPatients);
    });

    // Forms
    const formReg = document.getElementById('formAdminRegisterPatient');
    if (formReg) formReg.addEventListener('submit', handleAdminRegisterPatientSubmit);

    const formAssign = document.getElementById('formAdminAssignDoctor');
    if (formAssign) formAssign.addEventListener('submit', handleAdminAssignDoctorSubmit);

    const assignDept = document.getElementById('assignSelectDept');
    const assignDoc = document.getElementById('assignSelectDoctor');
    if (assignDept && assignDoc) {
      assignDept.addEventListener('change', updateDoctorAssignmentPreview);
      assignDoc.addEventListener('change', updateDoctorAssignmentPreview);
    }

    // Modal forms & triggers
    const btnAddDoc = document.getElementById('btnOpenAddDoctorModal');
    if (btnAddDoc) btnAddDoc.addEventListener('click', () => {
      populateModalDeptSelects();
      openModal('modalAddDoctor');
    });
    const formAddDoc = document.getElementById('formAddDoctorModal');
    if (formAddDoc) formAddDoc.addEventListener('submit', handleAddDoctorSubmit);
    const btnCloseAddDoc = document.getElementById('btnCloseAddDoctorModal');
    const btnCancelAddDoc = document.getElementById('btnCancelAddDoctor');
    if (btnCloseAddDoc) btnCloseAddDoc.addEventListener('click', () => closeModal('modalAddDoctor'));
    if (btnCancelAddDoc) btnCancelAddDoc.addEventListener('click', () => closeModal('modalAddDoctor'));

    const btnAddStaff = document.getElementById('btnOpenAddStaffModal');
    if (btnAddStaff) btnAddStaff.addEventListener('click', () => {
      populateModalDeptSelects();
      openModal('modalAddStaff');
    });
    const formAddStaff = document.getElementById('formAddStaffModal');
    if (formAddStaff) formAddStaff.addEventListener('submit', handleAddStaffSubmit);
    const btnCloseAddStaff = document.getElementById('btnCloseAddStaffModal');
    const btnCancelAddStaff = document.getElementById('btnCancelAddStaff');
    if (btnCloseAddStaff) btnCloseAddStaff.addEventListener('click', () => closeModal('modalAddStaff'));
    if (btnCancelAddStaff) btnCancelAddStaff.addEventListener('click', () => closeModal('modalAddStaff'));

    const btnAddDept = document.getElementById('btnOpenAddDeptModal');
    if (btnAddDept) btnAddDept.addEventListener('click', () => openModal('modalAddDept'));
    const formAddDept = document.getElementById('formAddDeptModal');
    if (formAddDept) formAddDept.addEventListener('submit', handleAddDeptSubmit);
    const btnCloseAddDept = document.getElementById('btnCloseAddDeptModal');
    const btnCancelAddDept = document.getElementById('btnCancelAddDept');
    if (btnCloseAddDept) btnCloseAddDept.addEventListener('click', () => closeModal('modalAddDept'));
    if (btnCancelAddDept) btnCancelAddDept.addEventListener('click', () => closeModal('modalAddDept'));

    // Patient History Modal Close
    const btnCloseHist = document.getElementById('btnClosePatientHistoryModal');
    const btnCloseHistFoot = document.getElementById('btnClosePatientHistoryFooter');
    if (btnCloseHist) btnCloseHist.addEventListener('click', () => closeModal('modalPatientHistory'));
    if (btnCloseHistFoot) btnCloseHistFoot.addEventListener('click', () => closeModal('modalPatientHistory'));

    // Doctor Profile Modal Close
    const btnCloseDocProf = document.getElementById('btnCloseDoctorProfileModal');
    const btnCloseDocProfFoot = document.getElementById('btnCloseDoctorProfileFooter');
    if (btnCloseDocProf) btnCloseDocProf.addEventListener('click', () => closeModal('modalDoctorProfile'));
    if (btnCloseDocProfFoot) btnCloseDocProfFoot.addEventListener('click', () => closeModal('modalDoctorProfile'));
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // Master Render Coordinator
  function renderAdminDashboard() {
    const allDoctors = QueueStore.getDoctors();
    const allApts = QueueStore.getAppointments();
    const allPatients = QueueStore.getPatients();
    const allNotifs = QueueStore.getNotifications();

    // Update Live Clock
    const clockEl = document.getElementById('adminLiveClock');
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Top Sidebar Pills
    const waitingApts = allApts.filter(a => a.status === 'Waiting');
    const liveQueueCountEl = document.getElementById('navLiveQueueCount');
    if (liveQueueCountEl) liveQueueCountEl.textContent = waitingApts.length;

    const apptCountEl = document.getElementById('navApptCount');
    if (apptCountEl) apptCountEl.textContent = allApts.length;

    const notifCountEl = document.getElementById('navNotifCount');
    if (notifCountEl) notifCountEl.textContent = allNotifs.length;

    // Render tab-specific content
    switch (currentAdminTab) {
      case 'overview':
        renderAdminOverview();
        break;
      case 'live-queues':
        renderAdminLiveQueues();
        break;
      case 'appointments':
        renderAdminAppointments();
        break;
      case 'patients':
        renderAdminPatients();
        break;
      case 'patient-registration':
        renderAdminPatientRegistration();
        break;
      case 'doctors':
        renderAdminDoctors();
        break;
      case 'staff':
        renderAdminStaff();
        break;
      case 'departments':
        renderAdminDepartments();
        break;
      case 'doctor-assignment':
        renderAdminDoctorAssignment();
        break;
      case 'queue-management':
        // Policy overview is largely static HTML, but sync numbers
        break;
      case 'hospital-analytics':
      case 'department-analytics':
      case 'doctor-analytics':
        renderAdminAnalytics();
        break;
      case 'notifications':
        renderAdminNotifications();
        break;
      case 'audit-logs':
        renderAdminAuditLogs();
        break;
    }
  }

  // 1. Overview Tab
  function renderAdminOverview() {
    const allDoctors = QueueStore.getDoctors();
    const allApts = QueueStore.getAppointments();
    const allPatients = QueueStore.getPatients();
    const allDepts = QueueStore.getDepartments();
    const auditLogs = QueueStore.getAuditLogs();
    const allNotifs = QueueStore.getNotifications();

    const waitingApts = allApts.filter(a => a.status === 'Waiting');
    const consultingApts = allApts.filter(a => a.status === 'In-Consultation');
    const completedApts = allApts.filter(a => a.status === 'Completed');

    // 6 Key KPIs
    const totalPatientsCount = Math.max(allPatients.length, allApts.length);
    const waitingCount = waitingApts.length;
    const consultingCount = consultingApts.length;
    const completedCount = completedApts.length;

    // Active Queues count
    const activeDoctorIds = new Set(allApts.filter(a => a.status === 'Waiting' || a.status === 'In-Consultation').map(a => a.doctorId));
    const activeQueuesCount = Math.max(activeDoctorIds.size, 1);

    // Avg Wait
    const avgWaitMins = activeQueuesCount > 0 ? Math.round((waitingCount * 10) / activeQueuesCount) : 0;

    const kpiTotal = document.getElementById('adminKpiTotalPatients');
    if (kpiTotal) kpiTotal.textContent = totalPatientsCount;

    const kpiWaiting = document.getElementById('adminKpiWaiting');
    if (kpiWaiting) kpiWaiting.textContent = waitingCount;

    const kpiConsulting = document.getElementById('adminKpiInConsultation');
    if (kpiConsulting) kpiConsulting.textContent = consultingCount;

    const kpiCompleted = document.getElementById('adminKpiCompleted');
    if (kpiCompleted) kpiCompleted.textContent = completedCount;

    const kpiAvgWait = document.getElementById('adminKpiAvgWait');
    if (kpiAvgWait) kpiAvgWait.textContent = `${avgWaitMins} min`;

    const kpiActiveQueues = document.getElementById('adminKpiActiveQueues');
    if (kpiActiveQueues) kpiActiveQueues.textContent = activeQueuesCount;

    // Section 27: Central Patient Journey Pipeline
    const journeyPipeline = document.getElementById('adminJourneyPipeline');
    if (journeyPipeline) {
      const stages = [
        { num: '01', name: 'PATIENT', count: totalPatientsCount, icon: 'fa-users' },
        { num: '02', name: 'REGISTRATION', count: allPatients.length, icon: 'fa-id-card' },
        { num: '03', name: 'DEPARTMENT', count: allDepts.length, icon: 'fa-sitemap' },
        { num: '04', name: 'DOCTOR', count: allDoctors.length, icon: 'fa-user-doctor' },
        { num: '05', name: 'APPOINTMENT', count: allApts.length, icon: 'fa-calendar-check' },
        { num: '06', name: 'TOKEN', count: allApts.length, icon: 'fa-ticket' },
        { num: '07', name: 'QUEUE', count: waitingCount, icon: 'fa-clock' },
        { num: '08', name: 'NOTIFICATION', count: allNotifs.length, icon: 'fa-bell' },
        { num: '09', name: 'CONSULTATION', count: consultingCount, icon: 'fa-stethoscope' },
        { num: '10', name: 'COMPLETION', count: completedCount, icon: 'fa-circle-check' }
      ];

      journeyPipeline.innerHTML = stages.map((st, i) => `
        <div class="journey-step">
          <span class="journey-step-num font-mono">STEP ${st.num}</span>
          <span class="journey-step-title">${st.name}</span>
          <span class="journey-step-count font-mono">${st.count}</span>
        </div>
        ${i < stages.length - 1 ? '<i class="fa-solid fa-chevron-right journey-arrow"></i>' : ''}
      `).join('');
    }

    // Overview Queue Snapshot
    const snapQueue = document.getElementById('overviewQueueSnapshot');
    if (snapQueue) {
      snapQueue.innerHTML = '';
      if (allDoctors.length === 0) {
        snapQueue.innerHTML = '<div style="color: #94A3B8; font-size: 13px;">No active queues found.</div>';
      } else {
        allDoctors.slice(0, 5).forEach(doc => {
          const docApts = QueueStore.getAppointments(doc.id);
          const waiting = docApts.filter(a => a.status === 'Waiting');
          const consulting = docApts.find(a => a.status === 'In-Consultation');
          const isPaused = QueueStore.isQueuePaused(doc.id);

          const div = document.createElement('div');
          div.className = 'overview-queue-item';
          div.innerHTML = `
            <div class="overview-queue-left">
              <span class="overview-queue-dept">${doc.department || doc.specialization} &bull; ${doc.room || 'Suite'}</span>
              <span class="overview-queue-doc">${doc.name} ${isPaused ? '<span class="badge-status noshow">PAUSED</span>' : ''}</span>
            </div>
            <div class="overview-queue-right">
              <span class="font-mono text-blue" style="font-weight: 800; font-size: 14px;">${consulting ? consulting.tokenNumber || 'A-001' : (waiting[0] ? waiting[0].tokenNumber : 'None')}</span>
              <span class="font-mono" style="color: #64748B; font-size: 12px;">${waiting.length} waiting</span>
              <button type="button" class="btn-table-action" onclick="handleAdminQueueCallNext('${doc.id}')">Call Next</button>
            </div>
          `;
          snapQueue.appendChild(div);
        });
      }
    }

    // Overview Audit Stream
    const snapAudit = document.getElementById('overviewAuditSnapshot');
    if (snapAudit) {
      snapAudit.innerHTML = '';
      const recentLogs = auditLogs.slice(0, 5);
      if (recentLogs.length === 0) {
        snapAudit.innerHTML = '<div style="color: #94A3B8; font-size: 13px;">No audit events recorded yet.</div>';
      } else {
        recentLogs.forEach(log => {
          const item = document.createElement('div');
          item.className = 'overview-audit-item';
          item.innerHTML = `
            <div class="overview-audit-meta">
              <span><strong>${log.action}</strong> by ${log.performedBy}</span>
              <span class="font-mono">${new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="overview-audit-text">${log.target}: ${log.details}</div>
          `;
          snapAudit.appendChild(item);
        });
      }
    }
  }

  // 2. Live Queues Tab
  function renderAdminLiveQueues() {
    const container = document.getElementById('adminLiveQueuesContainer');
    if (!container) return;

    const allDoctors = QueueStore.getDoctors();
    container.innerHTML = '';

    if (allDoctors.length === 0) {
      container.innerHTML = '<div style="color: #64748B; padding: 24px; font-weight: 600;">Queue length: 0 | Average Wait Time: 0 min | No active department traffic.</div>';
      return;
    }

    allDoctors.forEach(doc => {
      const docApts = QueueStore.getAppointments(doc.id);
      const active = docApts.filter(a => a.status !== 'Completed' && a.status !== 'No-Show');
      const inConsultation = active.find(a => a.status === 'In-Consultation');
      const waiting = active.filter(a => a.status === 'Waiting');
      const nextInLine = waiting[0] || null;
      const isPaused = QueueStore.isQueuePaused(doc.id);
      const estWaitMins = waiting.length * 10;

      const card = document.createElement('div');
      card.className = `live-queue-card ${isPaused ? 'paused' : ''}`;
      card.innerHTML = `
        <div class="live-queue-card-header">
          <div>
            <h3 class="live-queue-dept-name">${doc.department || doc.specialization}</h3>
            <div class="live-queue-doc-name"><i class="fa-solid fa-user-doctor text-dark"></i> ${doc.name} &bull; <span class="font-mono">${doc.room || 'Suite'}</span></div>
          </div>
          <span class="badge-status ${isPaused ? 'noshow' : 'consulting'} font-mono">
            ${isPaused ? '<i class="fa-solid fa-pause"></i> PAUSED' : '<span class="pulse-dot-green"></span> LIVE'}
          </span>
        </div>

        <div class="queue-live-token-banner">
          <div class="live-token-block">
            <span class="live-token-label">CURRENT IN CONSULTATION</span>
            <span class="live-token-number font-mono">${inConsultation ? inConsultation.tokenNumber || 'A-001' : 'None Calling'}</span>
            <small style="color: #64748B;">${inConsultation ? inConsultation.patientName : 'Room ready for next patient'}</small>
          </div>
          <div class="live-token-block" style="text-align: right;">
            <span class="live-token-label">NEXT IN LINE</span>
            <span class="live-token-number font-mono" style="color: #F59E0B; font-size: 20px;">${nextInLine ? nextInLine.tokenNumber || 'A-002' : '---'}</span>
            <small style="color: #64748B;">${nextInLine ? nextInLine.patientName : 'Queue clear'}</small>
          </div>
        </div>

        <div class="live-queue-stats-row font-mono">
          <span>Waiting: <strong>${waiting.length} patients</strong></span>
          <span>&bull;</span>
          <span>Est. Wait: <strong>~${estWaitMins} min</strong></span>
        </div>

        <!-- Real-Time Administrative Queue Controls (Section 9) -->
        <div class="queue-control-btn-group">
          <button type="button" class="btn-queue-ctl call" onclick="handleAdminQueueCallNext('${doc.id}')" title="Call next waiting patient">
            <i class="fa-solid fa-bullhorn"></i> CALL NEXT
          </button>
          <button type="button" class="btn-queue-ctl complete" onclick="handleAdminQueueComplete('${doc.id}')" title="Mark current examination completed">
            <i class="fa-solid fa-check"></i> COMPLETE
          </button>
          <button type="button" class="btn-queue-ctl skip" onclick="handleAdminQueueSkip('${inConsultation ? inConsultation.id : (nextInLine ? nextInLine.id : '')}')" title="Move patient to end of batch">
            <i class="fa-solid fa-forward-step"></i> SKIP
          </button>
          <button type="button" class="btn-queue-ctl noshow" onclick="handleAdminQueueNoShow('${inConsultation ? inConsultation.id : (nextInLine ? nextInLine.id : '')}')" title="Mark as No-Show">
            <i class="fa-solid fa-user-xmark"></i> NO-SHOW
          </button>
          ${isPaused ? `
            <button type="button" class="btn-queue-ctl resume" onclick="handleAdminQueueResume('${doc.id}')" title="Resume Queue Operations">
              <i class="fa-solid fa-play"></i> RESUME
            </button>
          ` : `
            <button type="button" class="btn-queue-ctl pause" onclick="handleAdminQueuePause('${doc.id}')" title="Temporarily Pause Queue">
              <i class="fa-solid fa-pause"></i> PAUSE
            </button>
          `}
        </div>

        <!-- Mini Patients In Line List -->
        <div class="live-queue-patients-list" style="border-top: 1px solid #F1F5F9; padding-top: 12px; margin-top: 4px;">
          <div style="font-size: 11px; font-weight: 700; color: #94A3B8; margin-bottom: 8px;">NEXT PATIENTS IN QUEUE:</div>
          ${waiting.slice(0, 3).map((w, idx) => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 4px 0; border-bottom: 1px dashed #F1F5F9;">
              <span><strong>${w.tokenNumber || 'T-' + (idx + 1)}</strong>: ${w.patientName}</span>
              <span class="priority-tag ${getPriorityClass(w.category)}">${w.category || 'Normal'}</span>
            </div>
          `).join('') || '<div style="font-size: 11.5px; color: #94A3B8;">No further patients in waiting line.</div>'}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Queue Control Handlers (Immediate Cross-Portal Reflection)
  window.handleAdminQueueCallNext = function (doctorId) {
    try {
      const nextPat = QueueStore.callNext(doctorId);
      if (nextPat) {
        showToast(`Calling ${nextPat.patientName} (${nextPat.tokenNumber || 'Token'}) into consultation.`);
        QueueStore.addAuditLog('Admin Called Patient', 'Chief Admin', nextPat.patientName, `Direct call to suite via Central Live Queue`);
      } else {
        showToast('No waiting patients to call.');
      }
      renderAdminDashboard();
    } catch (e) {
      showToast(e.message);
    }
  };

  window.handleAdminQueueComplete = function (doctorId) {
    try {
      const res = QueueStore.completeConsultation(doctorId);
      if (res && res.completedPatient) {
        showToast(`Consultation completed for ${res.completedPatient.patientName}.`);
        QueueStore.addAuditLog('Admin Completed Consultation', 'Chief Admin', res.completedPatient.patientName, `Marked completed from Central Control Center`);
      } else {
        showToast('No active consultation to mark completed.');
      }
      renderAdminDashboard();
    } catch (e) {
      showToast(e.message);
    }
  };

  window.handleAdminQueueSkip = function (appointmentId) {
    if (!appointmentId) {
      showToast('No active patient to skip.');
      return;
    }
    const apt = QueueStore.skipPatient(appointmentId);
    if (apt) {
      showToast(`Patient ${apt.patientName} shifted to end of current batch.`);
      QueueStore.addAuditLog('Admin Skipped Patient', 'Chief Admin', apt.patientName, `Shifted to end of batch ${apt.batchNumber}`);
    }
    renderAdminDashboard();
  };

  window.handleAdminQueueNoShow = function (appointmentId) {
    if (!appointmentId) {
      showToast('No patient selected to mark No-Show.');
      return;
    }
    const apt = QueueStore.markNoShow(appointmentId);
    if (apt) {
      showToast(`Patient ${apt.patientName} recorded as No-Show.`);
      QueueStore.addAuditLog('Admin Marked No-Show', 'Chief Admin', apt.patientName, `Seat vacated and queue advanced`);
    }
    renderAdminDashboard();
  };

  window.handleAdminQueuePause = function (doctorId) {
    QueueStore.pauseQueue(doctorId);
    showToast('OPD Queue paused.');
    renderAdminDashboard();
  };

  window.handleAdminQueueResume = function (doctorId) {
    QueueStore.resumeQueue(doctorId);
    showToast('OPD Queue resumed.');
    renderAdminDashboard();
  };

  // 3. Appointments Tab
  function renderAdminAppointments() {
    const tableBody = document.getElementById('adminApptsTableBody');
    if (!tableBody) return;

    const allApts = QueueStore.getAppointments();
    const allDoctors = QueueStore.getDoctors();
    const allDepts = QueueStore.getDepartments();

    // Populate Filters if needed
    const deptSelect = document.getElementById('filterApptDept');
    if (deptSelect && deptSelect.options.length <= 1) {
      allDepts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
    }

    const docSelect = document.getElementById('filterApptDoctor');
    if (docSelect && docSelect.options.length <= 1) {
      allDoctors.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        docSelect.appendChild(opt);
      });
    }

    // Filter values
    const query = (document.getElementById('filterApptSearch')?.value || '').toLowerCase().trim();
    const selDept = document.getElementById('filterApptDept')?.value || '';
    const selDoc = document.getElementById('filterApptDoctor')?.value || '';
    const selStatus = document.getElementById('filterApptStatus')?.value || '';

    const filtered = allApts.filter(a => {
      const matchQuery = !query || 
        (a.patientName && a.patientName.toLowerCase().includes(query)) ||
        (a.tokenNumber && a.tokenNumber.toLowerCase().includes(query)) ||
        (a.patientId && a.patientId.toLowerCase().includes(query));
      const matchDept = !selDept || (a.department && a.department.toLowerCase().includes(selDept.toLowerCase()));
      const matchDoc = !selDoc || a.doctorId === selDoc;
      const matchStatus = !selStatus || a.status === selStatus;
      return matchQuery && matchDept && matchDoc && matchStatus;
    });

    tableBody.innerHTML = '';
    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #94A3B8; padding: 24px;">No appointments match your filters.</td></tr>';
      return;
    }

    filtered.forEach(apt => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono text-blue"><strong>${apt.tokenNumber || 'T-001'}</strong></td>
        <td><strong>${apt.patientName}</strong><br><small style="color: #64748B;">${apt.patientPhone || ''}</small></td>
        <td>${apt.department || apt.doctorSpecialization || 'General OPD'}</td>
        <td>${apt.doctorName || 'Assigned Specialist'}</td>
        <td class="font-mono">Slot ${apt.slotNumber || 1} (${apt.batchName || 'Batch 1'})</td>
        <td><span class="priority-tag ${getPriorityClass(apt.category)}">${apt.category || 'Normal'}</span></td>
        <td><span class="source-badge ${getSourceClass(apt.source)}">${apt.source || 'PATIENT PORTAL'}</span></td>
        <td><span class="badge-status ${getStatusClass(apt.status)}">${apt.status || 'Waiting'}</span></td>
        <td>
          <div class="table-btn-group">
            <button type="button" class="btn-table-action" onclick="openAdminViewQR('${apt.id}')" title="View Digital Token Pass & QR"><i class="fa-solid fa-qrcode"></i></button>
            <button type="button" class="btn-table-action" onclick="openPatientHistoryModal('${apt.patientId || ''}')" title="View Patient Clinical Record"><i class="fa-solid fa-clock-rotate-left"></i></button>
            ${apt.status === 'Waiting' ? `
              <button type="button" class="btn-table-action text-red" onclick="handleAdminCancelAppointment('${apt.id}')" title="Cancel Appointment"><i class="fa-solid fa-ban"></i></button>
            ` : ''}
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  window.openAdminViewQR = function (aptId) {
    const apt = QueueStore.getAppointments().find(a => a.id === aptId);
    if (!apt) return;
    openDigitalTicketModal(apt);
  };

  window.handleAdminCancelAppointment = function (aptId) {
    if (confirm('Are you sure you want to cancel this appointment and free the OPD slot?')) {
      const apt = QueueStore.markNoShow(aptId);
      if (apt) {
        showToast(`Appointment for ${apt.patientName} cancelled.`);
        QueueStore.addAuditLog('Admin Cancelled Appointment', 'Chief Admin', apt.patientName, 'Slot released');
      }
      renderAdminDashboard();
    }
  };

  // 4. All Patients Tab
  function renderAdminPatients() {
    const tableBody = document.getElementById('adminPatientsTableBody');
    if (!tableBody) return;

    const allPatients = QueueStore.getPatients();
    const allApts = QueueStore.getAppointments();
    const allDepts = QueueStore.getDepartments();

    // Populate filter depts
    const deptSelect = document.getElementById('filterPatientDept');
    if (deptSelect && deptSelect.options.length <= 1) {
      allDepts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
    }

    const query = (document.getElementById('filterPatientSearch')?.value || '').toLowerCase().trim();
    const selDept = document.getElementById('filterPatientDept')?.value || '';
    const selPriority = document.getElementById('filterPatientPriority')?.value || '';
    const selSource = document.getElementById('filterPatientSource')?.value || '';

    const filtered = allPatients.filter(p => {
      const matchQuery = !query ||
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.phone && p.phone.toLowerCase().includes(query)) ||
        (p.id && p.id.toLowerCase().includes(query));
      const matchDept = !selDept || (p.department && p.department.toLowerCase().includes(selDept.toLowerCase()));
      const matchPriority = !selPriority || p.category === selPriority;
      const matchSource = !selSource || p.source === selSource;
      return matchQuery && matchDept && matchPriority && matchSource;
    });

    tableBody.innerHTML = '';
    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #94A3B8; padding: 24px;">No patients match search criteria.</td></tr>';
      return;
    }

    filtered.forEach(p => {
      // Find latest appointment for patient
      const patApt = allApts.find(a => a.patientId === p.id || a.patientPhone === p.phone) || null;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono" style="font-weight: 700; color: #7C3AED;">${p.id}</td>
        <td><strong>${p.name}</strong><br><small style="color: #64748B;">${p.phone}</small></td>
        <td>${p.age || '---'} / ${p.gender || '---'}</td>
        <td>${patApt ? patApt.department : (p.department || 'General Medicine')}</td>
        <td>${patApt ? patApt.doctorName : (p.assignedDoctorName || 'Dr. Specialist')}</td>
        <td class="font-mono text-blue">${patApt ? (patApt.tokenNumber || 'A-001') : '---'}</td>
        <td class="font-mono">${patApt ? (patApt.globalIndex || patApt.slotNumber || '1') : '---'}</td>
        <td><span class="priority-tag ${getPriorityClass(p.category)}">${p.category || 'Normal'}</span></td>
        <td><span class="source-badge ${getSourceClass(p.source)}">${p.source || 'PATIENT PORTAL'}</span></td>
        <td><span class="badge-status ${getStatusClass(patApt ? patApt.status : 'Registered')}">${patApt ? patApt.status : 'Registered'}</span></td>
        <td>
          <div class="table-btn-group">
            <button type="button" class="btn-table-action" onclick="openPatientHistoryModal('${p.id}')">View</button>
            <button type="button" class="btn-table-action" onclick="quickBookPatientForQueue('${p.id}')">Queue</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  window.quickBookPatientForQueue = function (patientId) {
    const pat = QueueStore.getPatientById(patientId);
    if (!pat) return;
    const docs = QueueStore.getDoctors();
    if (docs.length === 0) {
      showToast('Please add doctors or click Populate Demo Scenario.');
      return;
    }
    const doc = docs[0];
    try {
      const apt = QueueStore.addAppointment({
        patientId: pat.id,
        patientName: pat.name,
        patientPhone: pat.phone,
        patientAge: pat.age,
        gender: pat.gender,
        category: pat.category,
        doctorId: doc.id,
        source: pat.source || 'STAFF'
      });
      showToast(`Token allocated: ${apt.tokenNumber} for Dr. ${doc.name}`);
      window.switchAdminTab('live-queues');
    } catch (e) {
      showToast(e.message);
    }
  };

  // 5. Patient Registration Tab
  function renderAdminPatientRegistration() {
    const allDoctors = QueueStore.getDoctors();
    const allDepts = QueueStore.getDepartments();

    const deptSelect = document.getElementById('adminRegDept');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">Select Department...</option>';
      allDepts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = `${d.name} (${d.code || 'OPD'})`;
        deptSelect.appendChild(opt);
      });
    }

    const docSelect = document.getElementById('adminRegDoctor');
    if (docSelect) {
      docSelect.innerHTML = '<option value="">Select Attending Doctor...</option>';
      allDoctors.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = `${doc.name} - ${doc.department || doc.specialization} (${doc.room || 'Suite'})`;
        docSelect.appendChild(opt);
      });
    }
  }

  function handleAdminRegisterPatientSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('adminRegName').value.trim();
    const phone = document.getElementById('adminRegMobile').value.trim();
    const age = parseInt(document.getElementById('adminRegAge').value, 10);
    const gender = document.getElementById('adminRegGender').value;
    const category = document.getElementById('adminRegPriority').value;
    const source = document.getElementById('adminRegSource').value;
    const dept = document.getElementById('adminRegDept').value;
    const docId = document.getElementById('adminRegDoctor').value;
    const address = document.getElementById('adminRegAddress').value.trim();
    const emergency = document.getElementById('adminRegEmergency').value.trim();

    try {
      const patient = QueueStore.registerPatient({
        name,
        phone,
        age,
        gender,
        category,
        source,
        address,
        emergencyContact: emergency,
        department: dept
      });

      let tokenMsg = '';
      if (docId) {
        const apt = QueueStore.addAppointment({
          patientId: patient.id,
          patientName: name,
          patientPhone: phone,
          patientAge: age,
          gender,
          category,
          source,
          doctorId: docId
        });
        tokenMsg = ` & Allocated Token: ${apt.tokenNumber || 'T-001'}`;
      }

      showToast(`Patient Registered: ${patient.id}${tokenMsg}`);
      QueueStore.addAuditLog('Admin registered patient', 'Chief Admin', patient.name, `ID ${patient.id}, source ${source}${tokenMsg}`);
      
      // Reset form and switch to Live Queues
      document.getElementById('formAdminRegisterPatient').reset();
      window.switchAdminTab('live-queues');
    } catch (err) {
      alert(err.message);
    }
  }

  // 6. Doctor Management Tab
  function renderAdminDoctors() {
    const container = document.getElementById('adminDoctorsListContainer');
    if (!container) return;

    const doctors = QueueStore.getDoctors();
    const allApts = QueueStore.getAppointments();

    container.innerHTML = doctors.map(doc => {
      const docApts = allApts.filter(a => a.doctorId === doc.id);
      const waiting = docApts.filter(a => a.status === 'Waiting').length;
      const completed = docApts.filter(a => a.status === 'Completed').length;
      const isActive = doc.status !== 'Inactive';

      return `
        <div class="kpi-card" style="padding: 22px;">
          <div class="kpi-header">
            <div>
              <span class="font-mono" style="font-size: 11px; color: #7C3AED; font-weight: 700;">${doc.id}</span>
              <h4 style="font-size: 16px; font-weight: 800; color: var(--color-dark-primary); margin: 2px 0;">${doc.name}</h4>
              <span style="font-size: 12.5px; color: #64748B;">${doc.specialization} &bull; ${doc.department || doc.specialization}</span>
            </div>
            <div class="kpi-icon dark"><i class="fa-solid fa-stethoscope"></i></div>
          </div>
          <div style="font-size: 12px; color: #64748B; margin: 8px 0;">
            <div><i class="fa-solid fa-door-open"></i> Suite: <strong>${doc.room || 'Suite 101'}</strong></div>
            <div><i class="fa-solid fa-clock"></i> ${doc.experience || 'Specialist'} &bull; ${doc.availability || '09:00 - 17:00'}</div>
          </div>
          <div class="live-queue-stats-row font-mono" style="border-top: 1px solid #F1F5F9; padding-top: 10px;">
            <span>Waiting: <strong>${waiting}</strong></span>
            <span>Completed: <strong>${completed}</strong></span>
            <span class="badge-status ${isActive ? 'consulting' : 'noshow'}" style="margin-left: auto;">${doc.status || 'Active'}</span>
          </div>
          <div class="table-btn-group" style="margin-top: 14px; justify-content: flex-end;">
            <button type="button" class="btn-table-action" onclick="openDoctorProfileModal('${doc.id}')">View Profile</button>
            <button type="button" class="btn-table-action" onclick="toggleDoctorStatusAdmin('${doc.id}')">${isActive ? 'Set Inactive' : 'Activate'}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.toggleDoctorStatusAdmin = function (doctorId) {
    const doc = QueueStore.toggleDoctorStatus(doctorId);
    if (doc) {
      showToast(`Status updated for ${doc.name}: ${doc.status}`);
      renderAdminDashboard();
    }
  };

  // 7. Staff Management Tab
  function renderAdminStaff() {
    const tableBody = document.getElementById('adminStaffTableBody');
    if (!tableBody) return;

    const staffList = QueueStore.getStaff();
    tableBody.innerHTML = staffList.map(st => `
      <tr>
        <td class="font-mono" style="font-weight: 700; color: #7C3AED;">${st.id}</td>
        <td><strong>${st.name}</strong></td>
        <td>${st.role}</td>
        <td>${st.department}</td>
        <td class="font-mono">${st.phone || '---'}</td>
        <td><span class="badge-status ${st.status === 'Active' ? 'consulting' : 'noshow'}">${st.status}</span></td>
        <td>
          <button type="button" class="btn-table-action" onclick="toggleStaffStatusAdmin('${st.id}')">Toggle Status</button>
        </td>
      </tr>
    `).join('');
  }

  window.toggleStaffStatusAdmin = function (staffId) {
    const st = QueueStore.toggleStaffStatus(staffId);
    if (st) {
      showToast(`Staff member ${st.name} status: ${st.status}`);
      renderAdminDashboard();
    }
  };

  // 8. Department Management Tab
  function renderAdminDepartments() {
    const container = document.getElementById('adminDeptsGridContainer');
    if (!container) return;

    const depts = QueueStore.getDepartments();
    const allDoctors = QueueStore.getDoctors();
    const allApts = QueueStore.getAppointments();

    container.innerHTML = depts.map(dept => {
      const assignedDocs = allDoctors.filter(d => (d.department || d.specialization || '').toLowerCase().includes(dept.name.toLowerCase()));
      const deptApts = allApts.filter(a => (a.department || '').toLowerCase().includes(dept.name.toLowerCase()));
      const waiting = deptApts.filter(a => a.status === 'Waiting').length;
      const completed = deptApts.filter(a => a.status === 'Completed').length;
      const avgWait = waiting * 10;

      return `
        <div class="kpi-card" style="padding: 22px;">
          <div class="kpi-header">
            <div>
              <span class="font-mono" style="font-size: 11px; color: #3E69FE; font-weight: 700;">${dept.code || 'DEPT'}</span>
              <h4 style="font-size: 18px; font-weight: 800; color: var(--color-dark-primary); margin: 2px 0;">${dept.name}</h4>
              <span style="font-size: 12.5px; color: #64748B;"><i class="fa-solid fa-location-dot"></i> ${dept.floor || 'OPD Wing'}</span>
            </div>
            <div class="kpi-icon blue"><i class="fa-solid fa-sitemap"></i></div>
          </div>
          <div style="font-size: 12.5px; color: #64748B; margin: 10px 0;">
            <div>Doctors Assigned: <strong>${assignedDocs.length} Specialists</strong></div>
            <div>Queue Length: <strong>${waiting} waiting</strong> (~${avgWait} min)</div>
            <div>Consultations Done Today: <strong>${completed}</strong></div>
          </div>
          <div class="live-queue-stats-row font-mono" style="border-top: 1px solid #F1F5F9; padding-top: 12px; justify-content: space-between;">
            <span class="badge-status ${dept.status === 'Active' ? 'consulting' : 'noshow'}">${dept.status || 'Active'}</span>
            <button type="button" class="btn-table-action" onclick="window.switchAdminTab('doctor-assignment')">Assign Doctor &rarr;</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 9. Doctor & Department Assignment Tab
  function renderAdminDoctorAssignment() {
    const allDoctors = QueueStore.getDoctors();
    const allDepts = QueueStore.getDepartments();
    const allApts = QueueStore.getAppointments();

    const deptSelect = document.getElementById('assignSelectDept');
    if (deptSelect) {
      deptSelect.innerHTML = '<option value="">Select Target Department...</option>';
      allDepts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = d.name;
        deptSelect.appendChild(opt);
      });
    }

    const docSelect = document.getElementById('assignSelectDoctor');
    if (docSelect) {
      docSelect.innerHTML = '<option value="">Select Doctor to Reassign...</option>';
      allDoctors.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = `${doc.name} (Current: ${doc.department || doc.specialization})`;
        docSelect.appendChild(opt);
      });
    }

    updateDoctorAssignmentPreview();

    // Roster Matrix
    const matrixBody = document.getElementById('adminDeptAssignmentMatrixBody');
    if (matrixBody) {
      matrixBody.innerHTML = allDepts.map(dept => {
        const assigned = allDoctors.filter(d => (d.department || d.specialization || '').toLowerCase().includes(dept.name.toLowerCase()));
        const deptWaiting = allApts.filter(a => (a.department || '').toLowerCase().includes(dept.name.toLowerCase()) && a.status === 'Waiting').length;

        return `
          <tr>
            <td><strong>${dept.name}</strong><br><small class="font-mono" style="color: #64748B;">${dept.code || 'OPD'}</small></td>
            <td>
              ${assigned.map(d => `<span class="badge-doc font-mono" style="font-size: 11px; margin-right: 4px;">${d.name}</span>`).join(' ') || '<span style="color: #94A3B8;">No doctor currently assigned</span>'}
            </td>
            <td class="font-mono text-blue"><strong>${deptWaiting} waiting</strong></td>
            <td>${dept.floor || 'OPD Wing'}</td>
            <td><span class="badge-status consulting">LIVE CLINIC</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  function updateDoctorAssignmentPreview() {
    const deptVal = document.getElementById('assignSelectDept')?.value || 'Department';
    const docSelect = document.getElementById('assignSelectDoctor');
    let docVal = 'Doctor';
    if (docSelect && docSelect.selectedIndex > 0) {
      docVal = docSelect.options[docSelect.selectedIndex].text.split('(')[0].trim();
    }

    const prevDoc = document.getElementById('prevDocName');
    const prevDept = document.getElementById('prevDeptName');
    if (prevDoc) prevDoc.textContent = docVal;
    if (prevDept) prevDept.textContent = deptVal;
  }

  function handleAdminAssignDoctorSubmit(e) {
    e.preventDefault();
    const docId = document.getElementById('assignSelectDoctor').value;
    const deptName = document.getElementById('assignSelectDept').value;

    if (!docId || !deptName) {
      alert('Please select both a doctor and target department.');
      return;
    }

    try {
      const updatedDoc = QueueStore.assignDoctorToDepartment(docId, deptName);
      showToast(`${updatedDoc.name} assigned to ${deptName}! Synchronized across Patient & Doctor Portals.`);
      renderAdminDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  // 11-13. Analytics Tab
  function renderAdminAnalytics() {
    const allDoctors = QueueStore.getDoctors();
    const allApts = QueueStore.getAppointments();
    const allDepts = QueueStore.getDepartments();

    // Volume and wait chart in Hospital Analytics
    const volChart = document.getElementById('hospitalDeptVolumeChart');
    const waitChart = document.getElementById('hospitalDeptWaitChart');

    if (volChart && waitChart) {
      volChart.innerHTML = '';
      waitChart.innerHTML = '';

      allDepts.forEach(dept => {
        const deptApts = allApts.filter(a => (a.department || '').toLowerCase().includes(dept.name.toLowerCase()));
        const waiting = deptApts.filter(a => a.status === 'Waiting').length;
        const waitMins = waiting * 10;
        const volPct = Math.min(Math.round((deptApts.length / Math.max(allApts.length, 1)) * 100), 100);

        const vItem = document.createElement('div');
        vItem.className = 'load-bar-item';
        vItem.innerHTML = `
          <div class="load-bar-meta">
            <span class="load-bar-title font-mono">${dept.name}</span>
            <span class="load-bar-val font-mono">${deptApts.length} Patients (${volPct}%)</span>
          </div>
          <div class="load-bar-track">
            <div class="load-bar-fill cardio" style="width: ${Math.max(volPct, deptApts.length > 0 ? 8 : 0)}%"></div>
          </div>
        `;
        volChart.appendChild(vItem);

        const wItem = document.createElement('div');
        wItem.className = 'load-bar-item';
        wItem.innerHTML = `
          <div class="load-bar-meta">
            <span class="load-bar-title font-mono">${dept.name}</span>
            <span class="load-bar-val font-mono text-amber">~${waitMins} Minutes</span>
          </div>
          <div class="load-bar-track">
            <div class="load-bar-fill neuro" style="width: ${Math.min(waitMins * 1.5, 100)}%"></div>
          </div>
        `;
        waitChart.appendChild(wItem);
      });
    }

    // Department Analytics Table
    const deptTable = document.getElementById('deptAnalyticsTableBody');
    if (deptTable) {
      deptTable.innerHTML = allDepts.map(dept => {
        const deptApts = allApts.filter(a => (a.department || '').toLowerCase().includes(dept.name.toLowerCase()));
        const waiting = deptApts.filter(a => a.status === 'Waiting').length;
        const completed = deptApts.filter(a => a.status === 'Completed').length;
        const noShow = deptApts.filter(a => a.status === 'No-Show').length;
        const compRate = deptApts.length > 0 ? Math.round((completed / deptApts.length) * 100) : 0;
        const noShowRate = deptApts.length > 0 ? Math.round((noShow / deptApts.length) * 100) : 0;

        return `
          <tr>
            <td><strong>${dept.name}</strong></td>
            <td class="font-mono">${deptApts.length}</td>
            <td class="font-mono text-blue">${waiting}</td>
            <td class="font-mono">${waiting * 10} min</td>
            <td class="font-mono text-green">${compRate}%</td>
            <td class="font-mono text-red">${noShowRate}%</td>
            <td><span class="badge-status ${waiting > 4 ? 'noshow' : 'consulting'}">${waiting > 4 ? 'Congested' : 'Optimal'}</span></td>
          </tr>
        `;
      }).join('');
    }

    // Doctor Analytics Table
    const docTable = document.getElementById('doctorAnalyticsTableBody');
    if (docTable) {
      docTable.innerHTML = allDoctors.map(doc => {
        const docApts = allApts.filter(a => a.doctorId === doc.id);
        const waiting = docApts.filter(a => a.status === 'Waiting').length;
        const completed = docApts.filter(a => a.status === 'Completed').length;
        const noShow = docApts.filter(a => a.status === 'No-Show').length;

        return `
          <tr>
            <td><strong>${doc.name}</strong></td>
            <td>${doc.department || doc.specialization}</td>
            <td class="font-mono">${docApts.length}</td>
            <td class="font-mono text-blue">${waiting}</td>
            <td class="font-mono text-green">${completed}</td>
            <td class="font-mono text-red">${noShow}</td>
            <td class="font-mono"><strong>${doc.consultationDuration || 10} min</strong></td>
          </tr>
        `;
      }).join('');
    }
  }

  // 14. Notifications Tab
  function renderAdminNotifications() {
    const tableBody = document.getElementById('adminNotifsTableBody');
    if (!tableBody) return;

    const notifs = QueueStore.getNotifications();
    const allApts = QueueStore.getAppointments();

    // 3-Turn Approaching Counter
    const approachingCount = allApts.filter(a => a.status === 'Waiting' && a.globalIndex === 3).length;
    const badge = document.getElementById('approachingCountBadge');
    if (badge) badge.textContent = `${approachingCount} patients 3-away`;

    tableBody.innerHTML = notifs.map(n => `
      <tr>
        <td class="font-mono" style="font-size: 11.5px; color: #64748B;">${new Date(n.timestamp || Date.now()).toLocaleTimeString()}</td>
        <td><strong>${n.patientName}</strong></td>
        <td><span class="badge-status waiting" style="font-size: 11px;">${n.type}</span></td>
        <td style="max-width: 320px;">${n.message}</td>
        <td><span class="font-mono" style="font-weight: 700; color: #7C3AED;">${n.channel || 'In-App'}</span></td>
        <td><span class="badge-status consulting font-mono">${n.status || 'SENT ✓'}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align: center; color: #94A3B8; padding: 24px;">No notifications logged yet.</td></tr>';
  }

  // 15. Audit Logs Tab
  function renderAdminAuditLogs() {
    const tableBody = document.getElementById('adminAuditTableBody');
    if (!tableBody) return;

    const logs = QueueStore.getAuditLogs();
    tableBody.innerHTML = logs.map(l => `
      <tr>
        <td class="font-mono" style="font-size: 11.5px; color: #64748B;">${new Date(l.timestamp).toLocaleTimeString()}</td>
        <td><strong>${l.action}</strong></td>
        <td><span class="font-mono" style="color: #7C3AED; font-weight: 700;">${l.performedBy}</span></td>
        <td><strong>${l.target}</strong></td>
        <td>${l.details}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align: center; color: #94A3B8; padding: 24px;">No audit events recorded yet.</td></tr>';
  }

  // Modal: Patient History Modal
  window.openPatientHistoryModal = function (patientId) {
    const allPatients = QueueStore.getPatients();
    const allApts = QueueStore.getAppointments();
    const allNotifs = QueueStore.getNotifications();

    let pat = allPatients.find(p => p.id === patientId || p.phone === patientId);
    if (!pat && allApts.length > 0) {
      const a = allApts.find(apt => apt.patientId === patientId || apt.id === patientId);
      if (a) {
        pat = {
          id: a.patientId || 'PAT-001',
          name: a.patientName,
          phone: a.patientPhone,
          age: a.patientAge,
          gender: a.gender,
          category: a.category,
          source: a.source,
          department: a.department
        };
      }
    }

    if (!pat) {
      showToast('Patient record not found.');
      return;
    }

    const patApts = allApts.filter(a => a.patientId === pat.id || a.patientPhone === pat.phone);
    const patNotifs = allNotifs.filter(n => n.patientName === pat.name);
    const activeApt = patApts.find(a => a.status === 'Waiting' || a.status === 'In-Consultation');

    const modalBody = document.getElementById('patientHistoryModalBody');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #E2E8F0; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 800; color: var(--color-dark-primary);">${pat.name}</h2>
            <div class="font-mono" style="font-size: 13px; color: #7C3AED; font-weight: 700;">ID: ${pat.id} &bull; Phone: ${pat.phone}</div>
            <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Age: ${pat.age || '--'} &bull; Gender: ${pat.gender || '--'}</div>
          </div>
          <div style="text-align: right;">
            <span class="priority-tag ${getPriorityClass(pat.category)}" style="font-size: 12px;">${pat.category || 'Normal'}</span>
            <div style="margin-top: 6px;"><span class="source-badge ${getSourceClass(pat.source)}">${pat.source || 'PATIENT PORTAL'}</span></div>
          </div>
        </div>

        <!-- Current OPD Status -->
        <div style="background: #F8FAFC; border-radius: 14px; padding: 16px; margin-bottom: 20px; border: 1px solid #E2E8F0;">
          <h4 style="font-size: 13px; font-weight: 800; color: var(--color-dark-primary); margin-bottom: 8px;">CURRENT OPD CONSULTATION STATUS</h4>
          ${activeApt ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 13px;">
              <div>Department: <strong>${activeApt.department}</strong></div>
              <div>Doctor: <strong>${activeApt.doctorName}</strong></div>
              <div class="font-mono">Token: <strong class="text-blue">${activeApt.tokenNumber || 'A-001'}</strong></div>
              <div class="font-mono">Queue Pos: <strong>Slot ${activeApt.slotNumber || 1}</strong></div>
              <div>Status: <span class="badge-status ${getStatusClass(activeApt.status)}">${activeApt.status}</span></div>
              <div class="font-mono">Est Wait: <strong>~${(activeApt.globalIndex || 1) * 10} min</strong></div>
            </div>
          ` : `
            <div style="color: #64748B; font-size: 13px;">No active queue slot today. Completed or unscheduled.</div>
          `}
        </div>

        <!-- Consultation & Queue History -->
        <h4 style="font-size: 13.5px; font-weight: 800; color: var(--color-dark-primary); margin-bottom: 10px;">CONSULTATION & TOKEN HISTORY</h4>
        <div class="queue-table-wrapper" style="margin-bottom: 20px;">
          <table class="admin-data-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th>TOKEN</th>
                <th>DEPARTMENT</th>
                <th>DOCTOR</th>
                <th>DATE / TIME</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${patApts.map(a => `
                <tr>
                  <td class="font-mono text-blue"><strong>${a.tokenNumber || 'T-001'}</strong></td>
                  <td>${a.department}</td>
                  <td>${a.doctorName}</td>
                  <td class="font-mono">${new Date(a.createdAt).toLocaleDateString()}</td>
                  <td><span class="badge-status ${getStatusClass(a.status)}">${a.status}</span></td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="text-align: center; color: #94A3B8;">No past visits.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Notification History -->
        <h4 style="font-size: 13.5px; font-weight: 800; color: var(--color-dark-primary); margin-bottom: 10px;">DISPATCHED NOTIFICATIONS</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${patNotifs.map(n => `
            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <div>
                <strong>${n.type}</strong> (${n.channel || 'In-App'}): <span style="color: #64748B;">${n.message}</span>
              </div>
              <span class="font-mono text-green" style="font-weight: 700;">${n.status || 'SENT ✓'}</span>
            </div>
          `).join('') || '<div style="color: #94A3B8; font-size: 12px;">No automated messages logged.</div>'}
        </div>
      `;
    }

    openModal('modalPatientHistory');
  };

  // Modal: Doctor Profile
  window.openDoctorProfileModal = function (doctorId) {
    const doc = QueueStore.getDoctorById(doctorId);
    if (!doc) return;

    const allApts = QueueStore.getAppointments(doc.id);
    const waiting = allApts.filter(a => a.status === 'Waiting');
    const inConsultation = allApts.find(a => a.status === 'In-Consultation');
    const completed = allApts.filter(a => a.status === 'Completed');
    const noShow = allApts.filter(a => a.status === 'No-Show');

    const modalBody = document.getElementById('doctorProfileModalBody');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #E2E8F0; margin-bottom: 16px;">
          <div>
            <span class="font-mono" style="font-size: 11.5px; color: #7C3AED; font-weight: 700;">${doc.id}</span>
            <h2 style="font-size: 22px; font-weight: 800; color: var(--color-dark-primary);">${doc.name}</h2>
            <div style="font-size: 13.5px; color: #64748B;">Specialty: <strong>${doc.specialization}</strong> &bull; Dept: <strong>${doc.department || doc.specialization}</strong></div>
            <div style="font-size: 12.5px; color: #64748B; margin-top: 4px;">Suite: <strong class="font-mono">${doc.room || 'Suite 101'}</strong> &bull; Contact: ${doc.phone || '+91 9876543210'}</div>
          </div>
          <span class="badge-status ${doc.status !== 'Inactive' ? 'consulting' : 'noshow'} font-mono">${doc.status || 'Active'}</span>
        </div>

        <!-- Today's Telemetry Metrics -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div class="kpi-card" style="padding: 12px; text-align: center;">
            <span style="font-size: 10px; font-weight: 800; color: #64748B;">WAITING</span>
            <span class="font-mono text-blue" style="font-size: 22px; font-weight: 800;">${waiting.length}</span>
          </div>
          <div class="kpi-card" style="padding: 12px; text-align: center;">
            <span style="font-size: 10px; font-weight: 800; color: #64748B;">COMPLETED</span>
            <span class="font-mono text-green" style="font-size: 22px; font-weight: 800;">${completed.length}</span>
          </div>
          <div class="kpi-card" style="padding: 12px; text-align: center;">
            <span style="font-size: 10px; font-weight: 800; color: #64748B;">NO-SHOWS</span>
            <span class="font-mono text-red" style="font-size: 22px; font-weight: 800;">${noShow.length}</span>
          </div>
          <div class="kpi-card" style="padding: 12px; text-align: center;">
            <span style="font-size: 10px; font-weight: 800; color: #64748B;">AVG TIME</span>
            <span class="font-mono" style="font-size: 18px; font-weight: 800;">10 min</span>
          </div>
        </div>

        <div style="background: #F8FAFC; border-radius: 12px; padding: 14px; border: 1px solid #E2E8F0; margin-bottom: 16px;">
          <h4 style="font-size: 12px; font-weight: 800; color: #64748B; margin-bottom: 6px;">CURRENT CONSULTING SUITE TELEMETRY</h4>
          <div>Current Calling Patient: <strong>${inConsultation ? `${inConsultation.patientName} (${inConsultation.tokenNumber})` : 'No patient currently inside'}</strong></div>
          <div style="font-size: 12.5px; color: #64748B; margin-top: 4px;">Queue Estimated Waiting Throughput: <strong>~${waiting.length * 10} minutes</strong></div>
        </div>
      `;
    }

    const btnLive = document.getElementById('btnDoctorProfileLiveQueue');
    if (btnLive) {
      btnLive.onclick = () => {
        closeModal('modalDoctorProfile');
        window.switchAdminTab('live-queues');
      };
    }

    openModal('modalDoctorProfile');
  };

  // Add Doctor Form Submit
  function handleAddDoctorSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('addDocName').value.trim();
    const dept = document.getElementById('addDocDept').value;
    const room = document.getElementById('addDocRoom').value.trim();
    const phone = document.getElementById('addDocPhone').value.trim();
    const email = document.getElementById('addDocEmail').value.trim();
    const experience = document.getElementById('addDocExperience').value.trim();
    const status = document.getElementById('addDocStatus').value;

    try {
      const doc = QueueStore.addDoctor({
        name,
        specialization: dept,
        department: dept,
        room,
        phone,
        email,
        experience,
        status
      });

      showToast(`Doctor ${doc.name} successfully registered in OPD.`);
      QueueStore.addAuditLog('Admin added doctor', 'Chief Admin', doc.name, `Suite ${doc.room}, ${doc.department}`);
      closeModal('modalAddDoctor');
      document.getElementById('formAddDoctorModal').reset();
      renderAdminDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  // Add Staff Form Submit
  function handleAddStaffSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('addStaffName').value.trim();
    const role = document.getElementById('addStaffRole').value;
    const department = document.getElementById('addStaffDept').value;
    const phone = document.getElementById('addStaffPhone').value.trim();

    try {
      const st = QueueStore.addStaff({
        name,
        role,
        department,
        phone,
        status: 'Active'
      });

      showToast(`Staff member ${st.name} added.`);
      QueueStore.addAuditLog('Admin added staff', 'Chief Admin', st.name, `${st.role} in ${st.department}`);
      closeModal('modalAddStaff');
      document.getElementById('formAddStaffModal').reset();
      renderAdminDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  // Add Department Form Submit
  function handleAddDeptSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('addDeptName').value.trim();
    const code = document.getElementById('addDeptCode').value.trim().toUpperCase();
    const floor = document.getElementById('addDeptFloor').value.trim();
    const description = document.getElementById('addDeptDesc').value.trim();

    try {
      const dept = QueueStore.addDepartment({
        name,
        code,
        floor,
        description,
        status: 'Active'
      });

      showToast(`Department ${dept.name} created.`);
      QueueStore.addAuditLog('Admin added department', 'Chief Admin', dept.name, `Code ${dept.code}, ${dept.floor}`);
      closeModal('modalAddDept');
      document.getElementById('formAddDeptModal').reset();
      renderAdminDashboard();
    } catch (err) {
      alert(err.message);
    }
  }

  // Populate depts inside add doctor & add staff modal selects
  function populateModalDeptSelects() {
    const depts = QueueStore.getDepartments();
    const docDeptSelect = document.getElementById('addDocDept');
    const staffDeptSelect = document.getElementById('addStaffDept');

    [docDeptSelect, staffDeptSelect].forEach(sel => {
      if (sel) {
        sel.innerHTML = depts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
      }
    });
  }

  // Helpers
  function getPriorityClass(category) {
    switch (category) {
      case 'Emergency': return 'emergency';
      case 'Elderly': return 'elderly';
      case 'Pregnant':
      case 'Pregnant Woman': return 'pregnant';
      case 'Approved Clinical Priority': return 'approved';
      default: return 'normal';
    }
  }

  function getSourceClass(source) {
    switch (source) {
      case 'STAFF': return 'staff';
      case 'KIOSK': return 'kiosk';
      default: return 'portal';
    }
  }

  function getStatusClass(status) {
    switch (status) {
      case 'In-Consultation': return 'consulting';
      case 'Completed': return 'consulting';
      case 'No-Show': return 'noshow';
      default: return 'waiting';
    }
  }

  let toastTimer = null;
  function showToast(msg) {
    const popup = document.getElementById('toastNotice');
    const msgEl = document.getElementById('toastMsg');
    if (!popup || !msgEl) return;

    msgEl.textContent = msg;
    popup.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      popup.classList.add('hidden');
    }, 3500);
  }

})();
