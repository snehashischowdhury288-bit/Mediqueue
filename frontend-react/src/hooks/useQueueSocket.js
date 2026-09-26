/**
 * MediQueue - React Real-Time Queue Hook
 * Socket.IO client integration for real-time events:
 * - queue_updated
 * - patient_called
 * - turn_alert
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useQueueSocket(initialDoctorId = null) {
  const [currentDoctorId, setCurrentDoctorId] = useState(initialDoctorId);
  const [activeQueue, setActiveQueue] = useState([]);
  const [inConsultation, setInConsultation] = useState(null);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastCalledPatient, setLastCalledPatient] = useState(null);
  const [turnAlert, setTurnAlert] = useState(null); // 3-turns-away alert payload

  const socketRef = useRef(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to MediQueue Gateway:', socket.id);
      setIsConnected(true);
      if (currentDoctorId) {
        socket.emit('join_doctor_queue', currentDoctorId);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected from MediQueue Gateway');
      setIsConnected(false);
    });

    // 1. Live Queue Mutations Listener
    socket.on('queue_updated', payload => {
      console.log('[Socket.IO] queue_updated received:', payload);
      if (!currentDoctorId || payload.doctorId === currentDoctorId) {
        setActiveQueue(payload.activeQueue || []);
        setInConsultation(payload.inConsultation || null);
        setTotalWaiting(payload.totalWaiting || 0);
      }
    });

    // 2. Patient Called Listener
    socket.on('patient_called', payload => {
      console.log('[Socket.IO] patient_called received:', payload);
      setLastCalledPatient(payload);
    });

    // 3. Multi-Channel 3-Turns-Away Notification Listener (Requirement 6)
    socket.on('turn_alert', alertData => {
      console.log('[Socket.IO] turn_alert received:', alertData);
      setTurnAlert(alertData);

      // Trigger Mailtrap alert dispatch if payload is provided
      if (alertData.email || alertData.patientEmail) {
        fetch('/api/mailtrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            to: alertData.email || alertData.patientEmail,
            patientName: alertData.patientName || 'Patient',
            subject: 'MediQueue Urgent Update: You are 3 turns away from your consultation',
            text: alertData.message || `Attention ${alertData.patientName}: You are 3 turns away from your consultation.`
          })
        })
          .then(res => res.json())
          .then(data => console.log('[Mailtrap Alert] Dispatched successfully:', data))
          .catch(err => console.warn('[Mailtrap Alert] Dispatch notice:', err));
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [currentDoctorId]);

  // Join or switch active doctor queue room
  const joinQueue = useCallback(doctorId => {
    if (!doctorId) return;
    setCurrentDoctorId(doctorId);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_doctor_queue', doctorId);
    }
  }, []);

  const dismissTurnAlert = useCallback(() => {
    setTurnAlert(null);
  }, []);

  // Action 1: Call Next Patient in Line (Doctor Action)
  const callNext = useCallback(async doctorId => {
    const id = doctorId || currentDoctorId;
    const res = await fetch(`${SOCKET_SERVER_URL}/api/queue/call-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: id })
    });
    return res.json();
  }, [currentDoctorId]);

  // Action 2: Consultation Complete (✅) (Doctor Action)
  const completeConsultation = useCallback(async doctorId => {
    const id = doctorId || currentDoctorId;
    const res = await fetch(`${SOCKET_SERVER_URL}/api/queue/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: id })
    });
    return res.json();
  }, [currentDoctorId]);

  // Action 3: Skip (⏭️) (Doctor Action)
  const skipPatient = useCallback(async appointmentId => {
    const res = await fetch(`${SOCKET_SERVER_URL}/api/queue/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId })
    });
    return res.json();
  }, []);

  // Action 4: Mark No-Show (❌) (Doctor Action)
  const markNoShow = useCallback(async appointmentId => {
    const res = await fetch(`${SOCKET_SERVER_URL}/api/queue/no-show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId })
    });
    return res.json();
  }, []);

  // Book a new slot with FastAPI priority shifting
  const bookSlot = useCallback(async bookingData => {
    const res = await fetch(`${SOCKET_SERVER_URL}/api/queue/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    });
    return res.json();
  }, []);

  return {
    currentDoctorId,
    activeQueue,
    inConsultation,
    totalWaiting,
    isConnected,
    lastCalledPatient,
    turnAlert,
    joinQueue,
    dismissTurnAlert,
    callNext,
    completeConsultation,
    skipPatient,
    markNoShow,
    bookSlot
  };
}
