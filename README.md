# MediQueue - Refactored 3-Tier Distributed Architecture

MediQueue is a distributed, high-performance outpatient department (OPD) queue and clinical management system refactored into three decoupled tiers:

```
                  +-----------------------------+
                  |   React Frontend (Client)   |
                  |  - Patient, Doctor & Admin  |
                  +--------------+--------------+
                                 |
          REST / WebSockets      |
                                 v
                  +-----------------------------+
                  |   Node.js / Express Server  |
                  |   - Auth (Simulated OTP)    |
                  |   - Queue Operations        |
                  |   - Socket.IO Event Engine  |
                  +--------------+--------------+
                                 |
                    Internal REST| (HTTP/JSON)
                                 v
                  +-----------------------------+
                  |     FastAPI Microservice    |
                  |   - Batch Capacity & Spill  |
                  |   - Priority Shift Logic    |
                  |   - Dynamic Wait Analytics  |
                  +-----------------------------+
```

---

## Architecture Components

### 1. FastAPI Logic & Analytics Microservice (`backend-fastapi`)
* **Port:** `8000` (Uvicorn ASGI)
* **Purpose:** Core clinical business logic, algorithmic priority queueing, and predictive analytics.
* **Endpoints:**
  * `POST /engine/book-slot`: Enforces 5-patient batch capacity, handles automated spillover, and executes slot 1 priority shifting for Elderly, Pregnant, and Emergency categories.
  * `POST /engine/calculate-wait`: Dynamic wait-time computation (`patients_ahead * 10 mins`) with confidence intervals and specialty weighting.
  * `POST /engine/check-notification`: Evaluates queue distance (`patient_slot - current_serving_slot == 3`) and outputs trigger payloads for Web3Forms email and in-app alerts.
  * `GET` & `POST /engine/admin-metrics`: Aggregates active queue telemetry across **Cardiology**, **Neurology**, and **Odontology**.

### 2. Node.js & Express Gateway (`backend-node`)
* **Port:** `5000`
* **Purpose:** Central API gateway, mobile number OTP verification, and real-time Socket.IO room coordination.
* **Endpoints:**
  * `POST /api/auth/send-otp` & `POST /api/auth/verify-otp` (Simulated mock OTP `1234`)
  * `GET /api/doctors`: Attending clinician directory
  * `POST /api/queue/book`: Proxies booking and priority calculation to FastAPI
  * `POST /api/queue/call-next`: Highlights and activates the next patient in line
  * `POST /api/queue/complete`: Marks consultation finished (✅) and advances queue
  * `POST /api/queue/skip`: Moves patient to the end of the active batch (⏭️)
  * `POST /api/queue/no-show`: Flags patient as `No-Show` (❌) and removes from live queue
  * `GET /api/admin/metrics`: Real-time hospital analytics proxy
* **Socket.IO Events:**
  * Emits: `queue_updated`, `patient_called`, `turn_alert`
  * Rooms: `doctor_${doctorId}`

### 3. React Frontend Client (`frontend-react`)
* **Port:** `3000` (Vite)
* **Purpose:** Mobile-first responsive patient view, doctor in-suite workstation, and hospital admin telemetry dashboard.
* **Key Features:**
  * `useQueueSocket.js`: Custom hook binding all components directly to Socket.IO real-time streams.
  * `qrcode.react`: Dynamic QR code token generation encoding `{"appointmentId": "...", "doctorCode": "...", "slotNumber": ..., "patientName": "..."}`.
  * Mobile OTP modal with one-click auto-fill (`1234`).
  * 3-Turns-Away in-app urgent alert banner.
  * Doctor control action bar: Call Next, Complete (✅), Skip (⏭️), No-Show (❌).
  * Admin dashboard with visual telemetry bars for Cardiology, Neurology, and Odontology.

---

## Quickstart & Launch Guide

### Terminal 1: Launch FastAPI Microservice
```bash
cd backend-fastapi
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

### Terminal 2: Launch Node.js Gateway
```bash
cd backend-node
npm install
npm start
```

### Terminal 3: Launch React Frontend
```bash
cd frontend-react
npm install
npm run dev
```

Open **`http://localhost:3000`** in your browser to interact with the full stack.
