"""
MediQueue - FastAPI Microservice
Logic, Priority Shifting, Batch Capacity & Wait-Time Prediction Engine
Port: 8000
"""

import time
import uuid
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware

from models import (
    BookingRequest,
    BookingResponse,
    AppointmentItem,
    WaitCalculationRequest,
    WaitCalculationResponse,
    NotificationCheckRequest,
    NotificationCheckResponse,
    AdminMetricsResponse,
    DepartmentLoad
)

app = FastAPI(
    title="MediQueue - Logic & Analytics Engine",
    description="High-performance priority queueing, 5-patient batch capacity, dynamic wait prediction, and analytics engine.",
    version="2.0.0"
)

# Enable CORS for Node.js gateway (port 5000) and React frontend (port 5173/3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BATCH_SIZE = 5
PRIORITY_CATEGORIES = {"elderly", "pregnant woman", "pregnant", "emergency"}

# Department telemetry mappings
DEPARTMENT_METADATA = [
    {"name": "Cardiology", "key": "cardio", "specialty": "Cardiologist"},
    {"name": "Neurology", "key": "neuro", "specialty": "Neurologist"},
    {"name": "Odontology", "key": "odonto", "specialty": "Odontologist"},
    {"name": "General Physician", "key": "gp", "specialty": "General Physician"},
    {"name": "Pediatrician", "key": "pedia", "specialty": "Pediatrician"}
]

# Internal mock department queue store for standalone testing
standalone_department_queues: Dict[str, List[Dict[str, Any]]] = {
    "Cardiologist": [
        {"id": "apt_c1", "status": "In-Consultation", "patient_name": "David Kim", "slot_number": 1},
        {"id": "apt_c2", "status": "Waiting", "patient_name": "Liam Chen", "slot_number": 2},
        {"id": "apt_c3", "status": "Waiting", "patient_name": "Sarah Jenkins", "slot_number": 3},
        {"id": "apt_c4", "status": "Waiting", "patient_name": "Robert Kowalski", "slot_number": 4},
        {"id": "apt_c5", "status": "Waiting", "patient_name": "Elena Rostova", "slot_number": 5},
    ],
    "Neurologist": [
        {"id": "apt_n1", "status": "In-Consultation", "patient_name": "Chloe Bennett", "slot_number": 1},
        {"id": "apt_n2", "status": "Waiting", "patient_name": "Noah Patel", "slot_number": 2},
        {"id": "apt_n3", "status": "Waiting", "patient_name": "Grace Hopper", "slot_number": 3},
    ],
    "Odontologist": [
        {"id": "apt_o1", "status": "In-Consultation", "patient_name": "Maya Lin", "slot_number": 1},
        {"id": "apt_o2", "status": "Waiting", "patient_name": "James Wilson", "slot_number": 2},
    ],
    "General Physician": [],
    "Pediatrician": []
}


def compute_batch_metadata(index_zero_based: int):
    """
    Computes batch number, batch name, and slot number within the 5-patient batch.
    """
    global_index = index_zero_based + 1
    batch_num = ((global_index - 1) // BATCH_SIZE) + 1
    slot_num = ((global_index - 1) % BATCH_SIZE) + 1

    if batch_num == 1:
        batch_name = "Morning Batch (Batch 1)"
    elif batch_num == 2:
        batch_name = "Evening Batch (Batch 2)"
    else:
        batch_name = f"Batch {batch_num}"

    return global_index, batch_num, batch_name, slot_num


@app.get("/")
def health_check():
    return {
        "service": "MediQueue FastAPI Engine",
        "status": "online",
        "version": "2.0.0",
        "port": 8000,
        "batch_capacity": BATCH_SIZE
    }


# =============================================================================
# 1. BOOK SLOT WITH 5-PATIENT BATCHING & PRIORITY SHIFTING
# =============================================================================
@app.post("/engine/book-slot", response_model=BookingResponse)
def book_slot(request: BookingRequest):
    """
    Accepts patient booking payload.
    Enforces 5-patient batch capacity and handles automated spillover.
    Executes Priority Queue Insertion:
      - If category is Elderly, Pregnant, or Emergency, shifts standard entries down by 1 position.
    """
    category_clean = request.priority_category.strip().lower()
    is_priority = category_clean in PRIORITY_CATEGORIES

    # Extract existing active queue (exclude Completed and No-Show)
    active_queue = [
        apt for apt in request.current_queue
        if apt.status not in ("Completed", "No-Show")
    ]

    new_apt_id = f"apt_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"

    # Default appointment template
    new_apt = AppointmentItem(
        id=new_apt_id,
        doctor_id=request.doctor_code,
        doctor_name=request.doctor_name or "Attending Doctor",
        doctor_specialization=request.doctor_specialization or "General Physician",
        doctor_room=request.doctor_room or "Suite 304, Wing C",
        patient_name=request.patient_name.strip(),
        patient_age=request.patient_age,
        patient_phone=request.patient_phone.strip(),
        patient_email=request.email.strip() if request.email else "",
        category=request.priority_category.strip(),
        status="Waiting",
        created_at=time.time(),
        notified_3_away=False
    )

    is_priority_shifted = False
    batch_overflow = False

    if not is_priority:
        # Standard Queue Assignment: Append to the end of the active queue
        if len(active_queue) == 0:
            new_apt.status = "In-Consultation"
        else:
            new_apt.status = "Waiting"

        active_queue.append(new_apt)
    else:
        # Priority Shift Insertion:
        # If someone is already in consultation, insert at position 1 (Slot 1 of waiting patients).
        # Otherwise, insert at position 0.
        has_in_consultation = any(apt.status == "In-Consultation" for apt in active_queue)
        insert_idx = 1 if has_in_consultation else 0

        if len(active_queue) == 0:
            new_apt.status = "In-Consultation"
        else:
            new_apt.status = "Waiting"

        active_queue.insert(insert_idx, new_apt)
        is_priority_shifted = True

    # Re-index all active appointments with 5-per-batch capacity and slot recalculation
    for i, apt in enumerate(active_queue):
        g_idx, b_num, b_name, s_num = compute_batch_metadata(i)
        apt.global_index = g_idx
        apt.batch_number = b_num
        apt.batch_name = b_name
        apt.slot_number = s_num

        if b_num > 1:
            batch_overflow = True

    # Find the populated new appointment from the updated list
    allocated_apt = next(apt for apt in active_queue if apt.id == new_apt_id)

    message = (
        f"Priority allocation: Assigned Slot {allocated_apt.slot_number} ({allocated_apt.batch_name}) "
        f"with automated position shift."
        if is_priority_shifted
        else f"Slot confirmed: Slot {allocated_apt.slot_number} of {allocated_apt.batch_name}."
    )

    return BookingResponse(
        success=True,
        message=message,
        new_appointment=allocated_apt,
        updated_queue=active_queue,
        is_priority_shifted=is_priority_shifted,
        batch_overflow=batch_overflow
    )


# =============================================================================
# 2. DYNAMIC WAIT-TIME PREDICTION ENGINE
# =============================================================================
@app.post("/engine/calculate-wait", response_model=WaitCalculationResponse)
def calculate_wait(request: WaitCalculationRequest):
    """
    Computes dynamic wait times based on historical consultation averages and active queue length.
    Live Formula: estimated_wait_minutes = patients_ahead * avg_consultation_time (default: 10 mins).
    """
    patients_ahead = max(0, request.patients_ahead)
    base_per_patient = request.avg_consultation_time or 10.0

    # Department adjustment factor
    dept_factor = 1.0
    spec_lower = (request.doctor_specialization or "").lower()
    if "cardio" in spec_lower:
        dept_factor = 1.15  # Comprehensive cardiovascular ECG/Echo review
    elif "neuro" in spec_lower:
        dept_factor = 1.20  # Neurological reflex and cognitive testing
    elif "odonto" in spec_lower or "dent" in spec_lower:
        dept_factor = 1.10  # Dental examination and imaging

    effective_per_patient = base_per_patient * dept_factor
    est_minutes = int(round(patients_ahead * effective_per_patient))

    min_wait = max(0, est_minutes - int(patients_ahead * 2))
    max_wait = est_minutes + int(patients_ahead * 3)
    confidence = f"{min_wait} - {max_wait} mins" if patients_ahead > 0 else "0 - 5 mins"

    if patients_ahead == 0:
        recommendation = "You are next in line. Please proceed immediately to the consulting room door."
    elif patients_ahead <= 2:
        recommendation = "Consultation upcoming shortly. Please remain seated in the immediate waiting lounge."
    else:
        recommendation = "Standard wait. Refreshments and clinical reading materials available in the main foyer."

    return WaitCalculationResponse(
        estimated_wait_minutes=est_minutes,
        patients_ahead=patients_ahead,
        per_patient_minutes=round(effective_per_patient, 1),
        confidence_interval=confidence,
        recommendation=recommendation
    )


# =============================================================================
# 3. 3-TURNS-AWAY NOTIFICATION EVALUATION
# =============================================================================
@app.post("/engine/check-notification", response_model=NotificationCheckResponse)
def check_notification(request: NotificationCheckRequest):
    """
    Evaluates queue distance: patient_slot - current_serving_slot.
    When distance equals exactly 3 turns away:
    Returns trigger parameters for client-side Web3Forms email and in-app banner alert.
    """
    distance = request.patient_slot - request.current_serving_slot
    trigger_alert = (distance == 3)

    alert_message = (
        "Attention: You are 3 turns away from your consultation. Please approach the waiting area."
        if trigger_alert
        else "Queue distance normal."
    )

    web3forms_payload = None
    if trigger_alert and request.patient_email:
        web3forms_payload = {
            "access_key": "c039dbb7-d1a2-4a7b-a0d0-087e85c136a8",
            "subject": f"MediQueue Alert: 3 Turns Away - {request.doctor_name}",
            "from_name": "MediQueue OPD Smart System",
            "to": request.patient_email,
            "email": request.patient_email,
            "message": (
                f"Dear {request.patient_name},\n\n"
                f"Attention: You are 3 turns away from your consultation. Please approach the waiting area.\n"
                f"Attending Doctor: {request.doctor_name}\n"
                f"Location: {request.doctor_room}\n"
                f"Your Assigned Slot: Slot {request.patient_slot}\n\n"
                "Thank you for using MediQueue."
            )
        }

    return NotificationCheckResponse(
        distance=distance,
        trigger_alert=trigger_alert,
        alert_message=alert_message,
        delivery_channels=["In-App Banner", "Client-Side Toast", "Web3Forms Email Dispatch"],
        web3forms_payload=web3forms_payload
    )


# =============================================================================
# 4. HOSPITAL ADMIN DASHBOARD TELEMETRY METRICS
# =============================================================================
@app.post("/engine/admin-metrics", response_model=AdminMetricsResponse)
def calculate_admin_metrics(live_queues: Optional[Dict[str, List[Dict[str, Any]]]] = Body(default=None)):
    """
    Computes real-time admin metrics:
    - Total Queue Length: Active waiting patients per department.
    - Average Wait Time: Real-time average across active departments based on 10 min/patient.
    - Patient Load Distribution: Visual metrics across Cardiology, Neurology, Odontology, etc.
    """
    queues_to_analyze = live_queues if live_queues is not None else standalone_department_queues

    total_waiting_count = 0
    dept_loads: List[DepartmentLoad] = []
    dept_waits: List[int] = []

    # Map input queues to the target departments
    for dept_meta in DEPARTMENT_METADATA:
        dept_name = dept_meta["name"]
        dept_key = dept_meta["key"]
        specialty = dept_meta["specialty"]

        # Collect matching patient lists from the provided data
        matching_patients = []
        for key, patient_list in queues_to_analyze.items():
            if (
                dept_name.lower() in key.lower() or
                key.lower() in dept_name.lower() or
                specialty.lower() in key.lower() or
                (dept_key == "odonto" and "dent" in key.lower()) or
                (dept_key == "neuro" and "psych" in key.lower())
            ):
                matching_patients.extend(patient_list)

        # Count active waiting patients (exclude Completed/No-Show)
        waiting_count = sum(
            1 for p in matching_patients
            if p.get("status") in ("Waiting", None)
        )
        total_waiting_count += waiting_count

        avg_wait = waiting_count * 10
        if waiting_count > 0:
            dept_waits.append(avg_wait)

        if waiting_count >= 5:
            load_status = "High Congestion"
        elif waiting_count >= 2:
            load_status = "Active Flow"
        else:
            load_status = "Optimal"

        dept_loads.append(DepartmentLoad(
            department=dept_name,
            key=dept_key,
            patient_count=waiting_count,
            percentage=0.0,  # Will compute once total is known
            avg_wait_minutes=avg_wait,
            load_status=load_status
        ))

    # Calculate percentages
    for d in dept_loads:
        d.percentage = round((d.patient_count / total_waiting_count * 100), 1) if total_waiting_count > 0 else 0.0

    overall_avg_wait = int(round(sum(dept_waits) / len(dept_waits))) if dept_waits else 0

    return AdminMetricsResponse(
        total_queue_length=total_waiting_count,
        overall_avg_wait_minutes=overall_avg_wait,
        departments=dept_loads,
        timestamp=time.time()
    )


@app.get("/engine/admin-metrics", response_model=AdminMetricsResponse)
def get_admin_metrics_get():
    """
    GET fallback for admin metrics using internal telemetry store.
    """
    return calculate_admin_metrics(live_queues=None)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
