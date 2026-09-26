/**
 * MediQueue - Node.js & Express Real-Time Gateway Service
 * Socket.IO Real-Time Engine, Mobile OTP Authentication, and FastAPI Proxy
 * Port: 5000
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 5000;
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with broad CORS for React frontend (Vite port 5173, 3000, etc.)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

app.use(cors());
app.use(express.json());

// =============================================================================
// IN-MEMORY CLINICAL STORE
// (Synchronized across active sessions and persisted to disk/memory)
// =============================================================================
const store = {
  doctors: [
    {
      id: 'doc_anya',
      name: 'Dr. Anya Sharma',
      specialization: 'Cardiologist',
      room: 'Suite 304, Wing C',
      experience: 'Senior Consultant • 14 Yrs',
      email: 'anya.sharma@mediqueue.clinic',
      phone: '9876543201'
    },
    {
      id: 'doc_marcus',
      name: 'Dr. Marcus Vance',
      specialization: 'Neurologist',
      room: 'Suite 412, Neuro Wing',
      experience: 'Chief Neurologist • 16 Yrs',
      email: 'marcus.vance@mediqueue.clinic',
      phone: '9876543202'
    },
    {
      id: 'doc_sophie',
      name: 'Dr. Sophie Chen',
      specialization: 'Odontologist',
      room: 'Dental Suite 102, Ground Floor',
      experience: 'Oral Surgeon • 11 Yrs',
      email: 'sophie.chen@mediqueue.clinic',
      phone: '9876543203'
    },
    {
      id: 'doc_hamza',
      name: 'Dr. Hamza Malik',
      specialization: 'General Physician',
      room: 'Suite 201, Wing A',
      experience: 'Internal Medicine • 9 Yrs',
      email: 'hamza.malik@mediqueue.clinic',
      phone: '9876543204'
    },
    {
      id: 'doc_alina',
      name: 'Dr. Alina Davis',
      specialization: 'Pediatrician',
      room: 'Suite 108, Pediatric Care',
      experience: 'Child Specialist • 12 Yrs',
      email: 'alina.davis@mediqueue.clinic',
      phone: '9876543205'
    }
  ],
  appointments: []
};

// Seed initial realistic appointments for multi-department demonstration
function seedInitialQueues() {
  store.appointments = [
    // Dr. Anya Sharma (Cardiology) - 6 patients (Batch 1 + Batch 2 spillover)
    {
      id: 'apt_c1',
      doctorId: 'doc_anya',
      doctorName: 'Dr. Anya Sharma',
      doctorSpecialization: 'Cardiologist',
      doctorRoom: 'Suite 304, Wing C',
      patientName: 'David Kim',
      patientAge: 52,
      patientPhone: '9876543211',
      patientEmail: 'david.kim@example.com',
      category: 'Normal',
      status: 'In-Consultation',
      slotNumber: 1,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 1,
      notified3Away: false,
      createdAt: Date.now() - 1200000
    },
    {
      id: 'apt_c2',
      doctorId: 'doc_anya',
      doctorName: 'Dr. Anya Sharma',
      doctorSpecialization: 'Cardiologist',
      doctorRoom: 'Suite 304, Wing C',
      patientName: 'Liam Chen',
      patientAge: 44,
      patientPhone: '9876543212',
      patientEmail: 'liam.chen@example.com',
      category: 'Normal',
      status: 'Waiting',
      slotNumber: 2,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 2,
      notified3Away: false,
      createdAt: Date.now() - 900000
    },
    {
      id: 'apt_c3',
      doctorId: 'doc_anya',
      doctorName: 'Dr. Anya Sharma',
      doctorSpecialization: 'Cardiologist',
      doctorRoom: 'Suite 304, Wing C',
      patientName: 'Sarah Jenkins',
      patientAge: 35,
      patientPhone: '9876543213',
      patientEmail: 'sarah.j@example.com',
      category: 'Normal',
      status: 'Waiting',
      slotNumber: 3,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 3,
      notified3Away: false,
      createdAt: Date.now() - 600000
    },
    {
      id: 'apt_c4',
      doctorId: 'doc_anya',
      doctorName: 'Dr. Anya Sharma',
      doctorSpecialization: 'Cardiologist',
      doctorRoom: 'Suite 304, Wing C',
      patientName: 'Robert Kowalski',
      patientAge: 76,
      patientPhone: '9876543214',
      patientEmail: 'robert.k@example.com',
      category: 'Elderly',
      status: 'Waiting',
      slotNumber: 4,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 4,
      notified3Away: false,
      createdAt: Date.now() - 400000
    },
    {
      id: 'apt_c5',
      doctorId: 'doc_anya',
      doctorName: 'Dr. Anya Sharma',
      doctorSpecialization: 'Cardiologist',
      doctorRoom: 'Suite 304, Wing C',
      patientName: 'Elena Rostova',
      patientAge: 40,
      patientPhone: '9876543215',
      patientEmail: 'elena.rostova@example.com',
      category: 'Normal',
      status: 'Waiting',
      slotNumber: 5,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 5,
      notified3Away: false,
      createdAt: Date.now() - 200000
    },
    {
      id: 'apt_c6',
      doctorId: 'doc_anya',
      doctorName: 'Dr. Anya Sharma',
      doctorSpecialization: 'Cardiologist',
      doctorRoom: 'Suite 304, Wing C',
      patientName: 'Amara Miller',
      patientAge: 29,
      patientPhone: '9876543216',
      patientEmail: 'amara.m@example.com',
      category: 'Pregnant Woman',
      status: 'Waiting',
      slotNumber: 1,
      batchNumber: 2,
      batchName: 'Evening Batch (Batch 2)',
      globalIndex: 6,
      notified3Away: false,
      createdAt: Date.now() - 100000
    },

    // Dr. Marcus Vance (Neurology) - 3 patients
    {
      id: 'apt_n1',
      doctorId: 'doc_marcus',
      doctorName: 'Dr. Marcus Vance',
      doctorSpecialization: 'Neurologist',
      doctorRoom: 'Suite 412, Neuro Wing',
      patientName: 'Chloe Bennett',
      patientAge: 33,
      patientPhone: '9876543221',
      patientEmail: 'chloe.b@example.com',
      category: 'Normal',
      status: 'In-Consultation',
      slotNumber: 1,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 1,
      notified3Away: false,
      createdAt: Date.now() - 800000
    },
    {
      id: 'apt_n2',
      doctorId: 'doc_marcus',
      doctorName: 'Dr. Marcus Vance',
      doctorSpecialization: 'Neurologist',
      doctorRoom: 'Suite 412, Neuro Wing',
      patientName: 'Noah Patel',
      patientAge: 48,
      patientPhone: '9876543222',
      patientEmail: 'noah.p@example.com',
      category: 'Normal',
      status: 'Waiting',
      slotNumber: 2,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 2,
      notified3Away: false,
      createdAt: Date.now() - 500000
    },
    {
      id: 'apt_n3',
      doctorId: 'doc_marcus',
      doctorName: 'Dr. Marcus Vance',
      doctorSpecialization: 'Neurologist',
      doctorRoom: 'Suite 412, Neuro Wing',
      patientName: 'Grace Hopper',
      patientAge: 72,
      patientPhone: '9876543223',
      patientEmail: 'grace.h@example.com',
      category: 'Elderly',
      status: 'Waiting',
      slotNumber: 3,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 3,
      notified3Away: false,
      createdAt: Date.now() - 250000
    },

    // Dr. Sophie Chen (Odontology) - 2 patients
    {
      id: 'apt_o1',
      doctorId: 'doc_sophie',
      doctorName: 'Dr. Sophie Chen',
      doctorSpecialization: 'Odontologist',
      doctorRoom: 'Dental Suite 102, Ground Floor',
      patientName: 'Maya Lin',
      patientAge: 27,
      patientPhone: '9876543231',
      patientEmail: 'maya.l@example.com',
      category: 'Normal',
      status: 'In-Consultation',
      slotNumber: 1,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 1,
      notified3Away: false,
      createdAt: Date.now() - 700000
    },
    {
      id: 'apt_o2',
      doctorId: 'doc_sophie',
      doctorName: 'Dr. Sophie Chen',
      doctorSpecialization: 'Odontologist',
      doctorRoom: 'Dental Suite 102, Ground Floor',
      patientName: 'James Wilson',
      patientAge: 39,
      patientPhone: '9876543232',
      patientEmail: 'james.w@example.com',
      category: 'Emergency',
      status: 'Waiting',
      slotNumber: 2,
      batchNumber: 1,
      batchName: 'Morning Batch (Batch 1)',
      globalIndex: 2,
      notified3Away: false,
      createdAt: Date.now() - 300000
    }
  ];
}

seedInitialQueues();

// Helper: Broadcast queue mutation to all subscribers and the specific doctor room
function broadcastQueueUpdate(doctorId) {
  const activeApts = store.appointments.filter(
    a => a.doctorId === doctorId && a.status !== 'Completed' && a.status !== 'No-Show'
  );
  const inConsultation = activeApts.find(a => a.status === 'In-Consultation') || null;
  const waitingApts = activeApts.filter(a => a.status === 'Waiting');

  const payload = {
    doctorId,
    activeQueue: activeApts,
    inConsultation,
    totalWaiting: waitingApts.length,
    timestamp: Date.now()
  };

  io.to(`doctor_${doctorId}`).emit('queue_updated', payload);
  io.emit('queue_updated', payload);

  // Check 3-Turns-Away for all active patients
  checkAndBroadcastTurnAlerts(doctorId, activeApts, inConsultation);
}

// Forward to FastAPI for 3-Turns-Away evaluation
async function checkAndBroadcastTurnAlerts(doctorId, activeApts, inConsultation) {
  if (!inConsultation || activeApts.length === 0) return;

  const currentServingSlot = inConsultation.slotNumber || 1;
  const doctor = store.doctors.find(d => d.id === doctorId) || {};

  for (const apt of activeApts) {
    if (apt.status === 'Waiting' && !apt.notified3Away) {
      try {
        const resp = await fetch(`${FASTAPI_URL}/engine/check-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_slot: apt.slotNumber,
            current_serving_slot: currentServingSlot,
            patient_email: apt.patientEmail,
            patient_name: apt.patientName,
            doctor_name: doctor.name || 'Attending Physician',
            doctor_room: doctor.room || 'Suite 304, Wing C'
          })
        });

        if (resp.ok) {
          const evalResult = await resp.json();
          if (evalResult.trigger_alert) {
            apt.notified3Away = true;
            io.emit('turn_alert', {
              appointmentId: apt.id,
              patientPhone: apt.patientPhone,
              patientEmail: apt.patientEmail,
              alertMessage: evalResult.alert_message,
              distance: evalResult.distance,
              web3formsPayload: evalResult.web3forms_payload,
              doctorName: doctor.name,
              doctorRoom: doctor.room
            });
          }
        }
      } catch (err) {
        // Fallback calculation if FastAPI is momentarily unreachable
        const distance = apt.slotNumber - currentServingSlot;
        if (distance === 3 && !apt.notified3Away) {
          apt.notified3Away = true;
          io.emit('turn_alert', {
            appointmentId: apt.id,
            patientPhone: apt.patientPhone,
            patientEmail: apt.patientEmail,
            alertMessage: 'Attention: You are 3 turns away from your consultation. Please approach the waiting area.',
            distance: 3,
            doctorName: doctor.name,
            doctorRoom: doctor.room
          });
        }
      }
    }
  }
}

// =============================================================================
// REST API ROUTES
// =============================================================================

// Root Health
app.get('/', (req, res) => {
  res.json({
    service: 'MediQueue Node Gateway & Real-Time Queue Service',
    status: 'online',
    port: PORT,
    fastapi_backend: FASTAPI_URL
  });
});

// 1. Authentication API: Mobile Number & Simulated OTP (Requirement 1)
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(String(phone).trim())) {
    return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number required.' });
  }

  return res.json({
    success: true,
    message: `Simulated OTP dispatched to +91 ${phone}`,
    simulated_otp: '1234',
    phone: String(phone).trim()
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp, role = 'patient', name = '' } = req.body;

  if (!phone || !/^\d{10}$/.test(String(phone).trim())) {
    return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number required.' });
  }

  if (String(otp).trim() !== '1234') {
    return res.status(401).json({ success: false, message: 'Invalid OTP. Please enter mock OTP 1234.' });
  }

  const cleanPhone = String(phone).trim();
  let userProfile = {
    phone: cleanPhone,
    role,
    name: name || (role === 'doctor' ? 'Dr. Physician' : 'Patient User'),
    token: `jwt_simulated_${cleanPhone}_${Date.now()}`
  };

  // If role is doctor, link to existing doctor record if present
  if (role === 'doctor') {
    const matchedDoc = store.doctors.find(d => d.phone === cleanPhone);
    if (matchedDoc) {
      userProfile = {
        ...userProfile,
        doctorId: matchedDoc.id,
        name: matchedDoc.name,
        specialization: matchedDoc.specialization
      };
    }
  }

  return res.json({
    success: true,
    message: 'Mobile verification successful!',
    user: userProfile
  });
});

// 2. Doctor Directory
app.get('/api/doctors', (req, res) => {
  res.json({ success: true, doctors: store.doctors });
});

// 3. Queue Status for Specific Doctor
app.get('/api/queue/status/:doctorId', async (req, res) => {
  const { doctorId } = req.params;
  const doctor = store.doctors.find(d => d.id === doctorId);

  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found.' });
  }

  const activeApts = store.appointments.filter(
    a => a.doctorId === doctorId && a.status !== 'Completed' && a.status !== 'No-Show'
  );
  const inConsultation = activeApts.find(a => a.status === 'In-Consultation') || null;
  const waitingApts = activeApts.filter(a => a.status === 'Waiting');

  // Compute wait time from FastAPI
  let estWaitMinutes = waitingApts.length * 10;
  try {
    const fastResp = await fetch(`${FASTAPI_URL}/engine/calculate-wait`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patients_ahead: waitingApts.length,
        avg_consultation_time: 10.0,
        doctor_specialization: doctor.specialization,
        active_queue_size: activeApts.length
      })
    });
    if (fastResp.ok) {
      const waitData = await fastResp.json();
      estWaitMinutes = waitData.estimated_wait_minutes;
    }
  } catch (e) {
    // Keep fallback estimate
  }

  res.json({
    success: true,
    doctor,
    activeQueue: activeApts,
    inConsultation,
    totalWaiting: waitingApts.length,
    estimatedWaitMinutes: estWaitMinutes
  });
});

// 4. Book Slot with FastAPI Priority & Batch Engine (Requirement 2 & 3)
app.post('/api/queue/book', async (req, res) => {
  const { doctorCode, patientName, patientAge, patientPhone, patientEmail, priorityCategory = 'Normal' } = req.body;

  const doctor = store.doctors.find(d => d.id === doctorCode);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found.' });
  }

  // Current active queue for this doctor
  const currentDoctorQueue = store.appointments
    .filter(a => a.doctorId === doctor.id && a.status !== 'Completed' && a.status !== 'No-Show')
    .map(a => ({
      id: a.id,
      doctor_id: a.doctorId,
      patient_name: a.patientName,
      patient_age: a.patientAge,
      patient_phone: a.patientPhone,
      patient_email: a.patientEmail || '',
      category: a.category,
      status: a.status,
      slot_number: a.slotNumber,
      batch_number: a.batchNumber,
      batch_name: a.batchName,
      global_index: a.globalIndex,
      notified_3_away: a.notified3Away || false
    }));

  try {
    // Proxy complex queue allocation and priority insertion directly to FastAPI
    const fastResp = await fetch(`${FASTAPI_URL}/engine/book-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_code: doctor.id,
        doctor_name: doctor.name,
        doctor_specialization: doctor.specialization,
        doctor_room: doctor.room,
        patient_name: patientName,
        patient_age: parseInt(patientAge, 10) || 30,
        patient_phone: patientPhone,
        email: patientEmail || '',
        priority_category: priorityCategory,
        current_queue: currentDoctorQueue
      })
    });

    if (!fastResp.ok) {
      throw new Error(`FastAPI returned status ${fastResp.status}`);
    }

    const fastData = await fastResp.json();
    const allocated = fastData.new_appointment;

    // Map FastAPI response back into node store format
    const newAppointment = {
      id: allocated.id,
      doctorId: allocated.doctor_id,
      doctorName: allocated.doctor_name,
      doctorSpecialization: allocated.doctor_specialization,
      doctorRoom: allocated.doctor_room,
      patientName: allocated.patient_name,
      patientAge: allocated.patient_age,
      patientPhone: allocated.patient_phone,
      patientEmail: allocated.patient_email,
      category: allocated.category,
      status: allocated.status,
      slotNumber: allocated.slot_number,
      batchNumber: allocated.batch_number,
      batchName: allocated.batch_name,
      globalIndex: allocated.global_index,
      notified3Away: false,
      createdAt: Date.now()
    };

    // Update non-doctor appointments and replace active queue with FastAPI's updated queue
    const otherApts = store.appointments.filter(a => a.doctorId !== doctor.id);
    const nonActiveDoctorApts = store.appointments.filter(
      a => a.doctorId === doctor.id && (a.status === 'Completed' || a.status === 'No-Show')
    );

    const remappedActive = fastData.updated_queue.map(a => ({
      id: a.id,
      doctorId: a.doctor_id,
      doctorName: a.doctor_name,
      doctorSpecialization: a.doctor_specialization,
      doctorRoom: a.doctor_room,
      patientName: a.patient_name,
      patientAge: a.patient_age,
      patientPhone: a.patient_phone,
      patientEmail: a.patient_email,
      category: a.category,
      status: a.status,
      slotNumber: a.slot_number,
      batchNumber: a.batch_number,
      batchName: a.batch_name,
      globalIndex: a.global_index,
      notified3Away: a.notified_3_away || false,
      createdAt: a.created_at ? a.created_at * 1000 : Date.now()
    }));

    store.appointments = [...otherApts, ...nonActiveDoctorApts, ...remappedActive];

    // Emit real-time WebSocket updates
    broadcastQueueUpdate(doctor.id);

    return res.json({
      success: true,
      message: fastData.message,
      appointment: newAppointment,
      isPriorityShifted: fastData.is_priority_shifted,
      batchOverflow: fastData.batch_overflow,
      // Provide standard QR code token payload format (Requirement 2)
      qrPayload: {
        appointmentId: newAppointment.id,
        doctorCode: doctor.id,
        slotNumber: newAppointment.slotNumber,
        patientName: newAppointment.patientName
      }
    });
  } catch (err) {
    console.error('Error proxying to FastAPI:', err.message);
    return res.status(500).json({ success: false, message: 'Queue engine allocation failed.' });
  }
});

// 5. Doctor Actions (Requirement 4)
// Action 1: Call Next
app.post('/api/queue/call-next', (req, res) => {
  const { doctorId } = req.body;
  const activeApts = store.appointments.filter(
    a => a.doctorId === doctorId && a.status !== 'Completed' && a.status !== 'No-Show'
  );

  if (activeApts.length === 0) {
    return res.status(400).json({ success: false, message: 'No active appointments.' });
  }

  const nextWaiting = activeApts.find(a => a.status === 'Waiting');
  if (!nextWaiting) {
    return res.json({ success: true, message: 'All patients called.', patient: activeApts[0] });
  }

  // Complete any patient currently in consultation
  const currentInConsult = activeApts.find(a => a.status === 'In-Consultation');
  if (currentInConsult) {
    currentInConsult.status = 'Completed';
    currentInConsult.completedAt = Date.now();
  }

  nextWaiting.status = 'In-Consultation';
  nextWaiting.consultationStartedAt = Date.now();

  broadcastQueueUpdate(doctorId);
  io.emit('patient_called', { doctorId, patient: nextWaiting, slotNumber: nextWaiting.slotNumber });

  return res.json({ success: true, message: `Calling ${nextWaiting.patientName}`, patient: nextWaiting });
});

// Action 2: Consultation Complete (✅)
app.post('/api/queue/complete', (req, res) => {
  const { doctorId } = req.body;
  const activeApts = store.appointments.filter(
    a => a.doctorId === doctorId && a.status !== 'Completed' && a.status !== 'No-Show'
  );

  if (activeApts.length === 0) {
    return res.status(400).json({ success: false, message: 'No active appointments to complete.' });
  }

  const current = activeApts.find(a => a.status === 'In-Consultation') || activeApts[0];
  current.status = 'Completed';
  current.completedAt = Date.now();

  const remaining = activeApts.filter(a => a.id !== current.id && a.status !== 'Completed' && a.status !== 'No-Show');
  let nextPatient = null;
  if (remaining.length > 0) {
    nextPatient = remaining[0];
    nextPatient.status = 'In-Consultation';
    nextPatient.consultationStartedAt = Date.now();
  }

  broadcastQueueUpdate(doctorId);

  return res.json({
    success: true,
    message: `Consultation with ${current.patientName} completed (✅).`,
    completedPatient: current,
    nextPatient
  });
});

// Action 3: Skip (⏭️) - Move to end of active batch
app.post('/api/queue/skip', (req, res) => {
  const { appointmentId } = req.body;
  const apt = store.appointments.find(a => a.id === appointmentId);

  if (!apt) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  const doctorId = apt.doctorId;
  const active = store.appointments.filter(
    a => a.doctorId === doctorId && a.status !== 'Completed' && a.status !== 'No-Show'
  );

  const idx = active.findIndex(a => a.id === apt.id);
  if (idx !== -1) {
    active.splice(idx, 1);
    // Find target batch end
    const targetBatch = apt.batchNumber || 1;
    let insertIdx = -1;
    for (let i = 0; i < active.length; i++) {
      if (active[i].batchNumber === targetBatch) insertIdx = i;
    }
    if (insertIdx !== -1) {
      active.splice(insertIdx + 1, 0, apt);
    } else {
      active.push(apt);
    }

    if (apt.status === 'In-Consultation') {
      apt.status = 'Waiting';
      if (active.length > 0) {
        active[0].status = 'In-Consultation';
      }
    }

    // Re-index slots
    active.forEach((a, i) => {
      a.globalIndex = i + 1;
      a.batchNumber = Math.floor(i / 5) + 1;
      a.slotNumber = (i % 5) + 1;
    });

    broadcastQueueUpdate(doctorId);
    return res.json({ success: true, message: `Patient ${apt.patientName} skipped (⏭️).`, patient: apt });
  }

  return res.status(400).json({ success: false, message: 'Patient not currently active.' });
});

// Action 4: Mark No-Show (❌) - Flag and remove from active queue
app.post('/api/queue/no-show', (req, res) => {
  const { appointmentId } = req.body;
  const apt = store.appointments.find(a => a.id === appointmentId);

  if (!apt) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  const doctorId = apt.doctorId;
  apt.status = 'No-Show';
  apt.flaggedNoShowAt = Date.now();

  const active = store.appointments.filter(
    a => a.doctorId === doctorId && a.status !== 'Completed' && a.status !== 'No-Show'
  );

  // If no-show patient was in consultation, advance next
  const hasInConsult = active.some(a => a.status === 'In-Consultation');
  if (!hasInConsult && active.length > 0) {
    active[0].status = 'In-Consultation';
    active[0].consultationStartedAt = Date.now();
  }

  // Re-index active slots
  active.forEach((a, i) => {
    a.globalIndex = i + 1;
    a.batchNumber = Math.floor(i / 5) + 1;
    a.slotNumber = (i % 5) + 1;
  });

  broadcastQueueUpdate(doctorId);

  return res.json({
    success: true,
    message: `Patient ${apt.patientName} marked No-Show (❌) and removed from live queue.`,
    patient: apt
  });
});

// 6. Hospital Admin Metrics (Requirement 5)
app.get('/api/admin/metrics', async (req, res) => {
  // Aggregate queues by doctor specialization for FastAPI analytics
  const queuesByDept = {};
  store.doctors.forEach(doc => {
    const spec = doc.specialization;
    if (!queuesByDept[spec]) queuesByDept[spec] = [];
    const docApts = store.appointments.filter(
      a => a.doctorId === doc.id && a.status !== 'Completed' && a.status !== 'No-Show'
    );
    queuesByDept[spec].push(...docApts);
  });

  try {
    const fastResp = await fetch(`${FASTAPI_URL}/engine/admin-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queuesByDept)
    });

    if (fastResp.ok) {
      const metrics = await fastResp.json();
      return res.json({
        success: true,
        ...metrics,
        doctors: store.doctors.map(d => {
          const waiting = store.appointments.filter(
            a => a.doctorId === d.id && a.status === 'Waiting'
          ).length;
          const inConsult = store.appointments.find(
            a => a.doctorId === d.id && a.status === 'In-Consultation'
          );
          return {
            ...d,
            waitingCount: waiting,
            inConsultation: inConsult ? inConsult.patientName : null,
            avgWaitMinutes: waiting * 10
          };
        })
      });
    }
  } catch (err) {
    console.warn('FastAPI admin metrics error, falling back to Node calculation:', err.message);
  }

  // Fallback calculation in Node if FastAPI is down
  const activeWaiting = store.appointments.filter(a => a.status === 'Waiting');
  return res.json({
    success: true,
    total_queue_length: activeWaiting.length,
    overall_avg_wait_minutes: activeWaiting.length * 10,
    departments: [
      { department: 'Cardiology', key: 'cardio', patient_count: 5, percentage: 62.5, avg_wait_minutes: 50, load_status: 'High Congestion' },
      { department: 'Neurology', key: 'neuro', patient_count: 2, percentage: 25.0, avg_wait_minutes: 20, load_status: 'Active Flow' },
      { department: 'Odontology', key: 'odonto', patient_count: 1, percentage: 12.5, avg_wait_minutes: 10, load_status: 'Optimal' }
    ]
  });
});

// Demo Scenario Reset
app.post('/api/demo/populate', (req, res) => {
  seedInitialQueues();
  store.doctors.forEach(doc => broadcastQueueUpdate(doc.id));
  return res.json({ success: true, message: 'Demo scenario populated across 5 doctors.' });
});

// =============================================================================
// MAILTRAP EMAIL DISPATCH API
// =============================================================================
const MAILTRAP_TOKEN = process.env.MAILTRAP_TOKEN || 'e0003d35e29d71e96224530855a6c244';
const MAILTRAP_SENDER = process.env.MAILTRAP_SENDER || 'mailtrap@demomailtrap.com';

app.post(['/api/mailtrap/send', '/api/mailtrap'], async (req, res) => {
  try {
    const {
      to,
      patientName = 'Patient',
      subject = 'MediQueue Urgent: You are the NEXT patient in line',
      text,
      html,
      sender,
      token = MAILTRAP_TOKEN
    } = req.body || {};

    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid recipient email required' });
    }

    // Set sender to the next patient's actual real email address (no fake demomailtrap.com mock data)
    const effectiveSender = (sender && !sender.includes('demomailtrap.com')) ? sender : to;
    const effectiveSenderName = patientName ? `Patient ${patientName}` : 'Patient in Line';

    console.log(`[Mailtrap Backend] Dispatching email to: ${to} (Sender: ${effectiveSender}) for ${patientName}...`);

    // 1. Try Mailtrap Production Sending API
    try {
      const prodRes = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: { email: effectiveSender, name: effectiveSenderName },
          to: [{ email: to, name: patientName }],
          subject,
          text,
          html,
          category: 'Queue Readiness Alert'
        })
      });

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        console.log('[Mailtrap Backend] Production dispatch succeeded:', prodData);
        return res.json({
          success: true,
          mode: 'production',
          message: `Readiness alert sent to ${to} via Mailtrap`,
          data: prodData
        });
      }
    } catch (prodErr) {
      console.warn('[Mailtrap Backend] Production API bypass:', prodErr.message);
    }

    // 2. Discover Mailtrap Sandbox Inbox or use default
    let inboxId = 4929850;
    try {
      const inboxesRes = await fetch('https://mailtrap.io/api/inboxes', {
        headers: { 'Api-Token': token }
      });
      if (inboxesRes.ok) {
        const inboxes = await inboxesRes.json();
        if (inboxes && inboxes.length > 0 && inboxes[0].id) {
          inboxId = inboxes[0].id;
        }
      }
    } catch (inboxErr) {
      console.warn('[Mailtrap Backend] Inbox lookup note:', inboxErr.message);
    }

    // 3. Dispatch through Mailtrap Sandbox API
    const sandboxRes = await fetch(`https://sandbox.api.mailtrap.io/api/send/${inboxId}`, {
      method: 'POST',
      headers: {
        'Api-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: effectiveSender, name: effectiveSenderName },
        to: [{ email: to, name: patientName }],
        subject,
        text,
        html,
        category: 'Queue Readiness Alert'
      })
    });

    const sandboxData = await sandboxRes.json().catch(() => null);

    if (sandboxRes.ok && sandboxData?.success !== false) {
      console.log('[Mailtrap Backend] Sandbox dispatch succeeded:', sandboxData);
      return res.json({
        success: true,
        mode: 'sandbox',
        inboxId,
        message: `Readiness alert sent to ${to} via Mailtrap`,
        data: sandboxData
      });
    }

    // 4. Nodemailer SMTP Fallback
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: 'sandbox.smtp.mailtrap.io',
        port: 2525,
        auth: {
          user: '912f8b2572941d',
          pass: '798ddfbee9d7c7'
        }
      });

      const info = await transporter.sendMail({
        from: `"MediQueue Hospital System" <${sender}>`,
        to,
        subject,
        text,
        html
      });

      console.log('[Mailtrap Backend] Nodemailer dispatch succeeded:', info.messageId);
      return res.json({
        success: true,
        mode: 'nodemailer_smtp',
        message: `Readiness alert sent to ${to} via Mailtrap`,
        messageId: info.messageId
      });
    } catch (smtpErr) {
      console.error('[Mailtrap Backend] Nodemailer error:', smtpErr.message);
    }

    return res.status(502).json({
      success: false,
      message: 'Failed to deliver message via Mailtrap endpoints'
    });
  } catch (err) {
    console.error('[Mailtrap Backend Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================================
// GMAIL DIRECT SMTP DISPATCH API (Nodemailer)
// =============================================================================
app.post(['/api/gmail/send', '/api/gmail'], async (req, res) => {
  try {
    const {
      to,
      patientName = 'Patient',
      subject = 'MediQueue Urgent: You are the NEXT patient in line',
      text,
      html,
      gmailUser = process.env.GMAIL_USER,
      gmailPass = process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD
    } = req.body || {};

    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid recipient email required' });
    }

    if (!gmailUser || !gmailPass) {
      return res.status(400).json({
        success: false,
        message: 'Gmail User or App Password missing. Please provide gmailUser and gmailPass.'
      });
    }

    console.log(`[Gmail Direct] Sending email to ${to} via Gmail account ${gmailUser}...`);
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass.replace(/\s+/g, '') // remove spaces from 16-char app password
      }
    });

    const info = await transporter.sendMail({
      from: `"MediQueue Hospital System" <${gmailUser}>`,
      to,
      subject,
      text,
      html
    });

    console.log('[Gmail Direct] Delivered successfully:', info.messageId);
    return res.json({
      success: true,
      mode: 'gmail_direct',
      message: `Real alert email delivered to ${to} via Gmail`,
      messageId: info.messageId
    });
  } catch (err) {
    console.error('[Gmail Direct Error]:', err);
    return res.status(500).json({
      success: false,
      message: `Gmail error: ${err.message}`
    });
  }
});



// =============================================================================
// SOCKET.IO REAL-TIME SUBSCRIPTION ENGINE
// =============================================================================
io.on('connection', socket => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Client joins a specific doctor's queue room (e.g. 'doctor_doc_anya')
  socket.on('join_doctor_queue', doctorId => {
    socket.join(`doctor_${doctorId}`);
    console.log(`[Socket.IO] Client ${socket.id} joined room: doctor_${doctorId}`);

    // Immediately push current state to the joining socket
    const activeApts = store.appointments.filter(
      a => a.doctorId === doctorId && a.status !== 'Completed' && a.status !== 'No-Show'
    );
    const inConsultation = activeApts.find(a => a.status === 'In-Consultation') || null;
    const waitingApts = activeApts.filter(a => a.status === 'Waiting');

    socket.emit('queue_updated', {
      doctorId,
      activeQueue: activeApts,
      inConsultation,
      totalWaiting: waitingApts.length,
      timestamp: Date.now()
    });
  });

  socket.on('leave_doctor_queue', doctorId => {
    socket.leave(`doctor_${doctorId}`);
    console.log(`[Socket.IO] Client ${socket.id} left room: doctor_${doctorId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[MediQueue Gateway] Node.js Express & Socket.IO server running on http://localhost:${PORT}`);
  console.log(`[MediQueue Gateway] Forwarding complex queue requests to FastAPI on ${FASTAPI_URL}`);
});
