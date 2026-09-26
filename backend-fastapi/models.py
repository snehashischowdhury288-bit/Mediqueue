from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class PriorityCategory(str, Enum):
    NORMAL = "Normal"
    ELDERLY = "Elderly"
    PREGNANT = "Pregnant Woman"
    EMERGENCY = "Emergency"


class AppointmentStatus(str, Enum):
    WAITING = "Waiting"
    IN_CONSULTATION = "In-Consultation"
    COMPLETED = "Completed"
    NO_SHOW = "No-Show"


class AppointmentItem(BaseModel):
    id: str
    doctor_id: str
    doctor_name: Optional[str] = "Attending Physician"
    doctor_specialization: Optional[str] = "General Physician"
    doctor_room: Optional[str] = "Suite 304, Wing C"
    patient_name: str
    patient_age: int
    patient_phone: str
    patient_email: Optional[str] = ""
    category: str = "Normal"
    status: str = "Waiting"
    slot_number: int = 1
    batch_number: int = 1
    batch_name: str = "Morning Batch (Batch 1)"
    global_index: int = 1
    created_at: Optional[float] = 0.0
    notified_3_away: Optional[bool] = False


class BookingRequest(BaseModel):
    doctor_code: str
    doctor_name: Optional[str] = "Doctor"
    doctor_specialization: Optional[str] = "General Physician"
    doctor_room: Optional[str] = "Suite 304, Wing C"
    patient_name: str
    patient_age: int = 30
    patient_phone: str
    email: Optional[str] = ""
    priority_category: str = "Normal"
    current_queue: List[AppointmentItem] = Field(default_factory=list)


class BookingResponse(BaseModel):
    success: bool
    message: str
    new_appointment: AppointmentItem
    updated_queue: List[AppointmentItem]
    is_priority_shifted: bool
    batch_overflow: bool


class WaitCalculationRequest(BaseModel):
    patients_ahead: int
    avg_consultation_time: float = 10.0
    doctor_specialization: Optional[str] = "General"
    active_queue_size: Optional[int] = 0


class WaitCalculationResponse(BaseModel):
    estimated_wait_minutes: int
    patients_ahead: int
    per_patient_minutes: float
    confidence_interval: str
    recommendation: str


class NotificationCheckRequest(BaseModel):
    patient_slot: int
    current_serving_slot: int
    patient_email: Optional[str] = ""
    patient_name: Optional[str] = "Patient"
    doctor_name: Optional[str] = "Attending Doctor"
    doctor_room: Optional[str] = "Suite 304, Wing C"


class NotificationCheckResponse(BaseModel):
    distance: int
    trigger_alert: bool
    alert_message: str
    delivery_channels: List[str]
    web3forms_payload: Optional[Dict[str, Any]] = None


class DepartmentLoad(BaseModel):
    department: str
    key: str
    patient_count: int
    percentage: float
    avg_wait_minutes: int
    load_status: str


class AdminMetricsResponse(BaseModel):
    total_queue_length: int
    overall_avg_wait_minutes: int
    departments: List[DepartmentLoad]
    timestamp: float
