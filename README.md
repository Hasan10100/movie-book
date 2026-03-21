# Ticket Booking System - Concurrency Handling Demo

This project demonstrates how to handle concurrent database updates in a web application using Django and React. Specifically, it addresses the "Double Booking" problem where two users try to book the same seat at the exact same time.

## 🚀 Tech Stack
- **Backend:** Django, Django REST Framework, SQLite
- **Frontend:** React (Vite, TypeScript), Axios
- **Simulation:** Python (threading)

## 🏗️ The Problem: Race Conditions
In a naive implementation:
1. User A checks if Seat 1 is available (Yes).
2. User B checks if Seat 1 is available (Yes).
3. User A updates Seat 1 to 'BOOKED'.
4. User B updates Seat 1 to 'BOOKED'.
5. **Result:** Both users think they booked the seat, but User B overwrote User A (or a database unique constraint triggered an error).

## 🛠️ Solutions Implemented

### 1. Naive Implementation (Vulnerable)
Uses a simple `if status == 'AVAILABLE': save()`. This is highly susceptible to race conditions. I added a `time.sleep(1)` to the view to make the race condition easily reproducible.

### 2. Pessimistic Locking (`select_for_update`)
- **How it works:** Django tells the database to lock the row as soon as it's read (`SELECT ... FOR UPDATE`).
- **Pros:** Guarantees consistency; other requests wait (or fail fast with `nowait=True`) until the transaction is finished.
- **Cons:** Can lead to performance bottlenecks if locks are held too long.

### 3. Optimistic Locking (Version Field)
- **How it works:** Each record has a `version` field. When updating, we check if the version is still the same as when we read it: `UPDATE seat SET status='BOOKED', version=2 WHERE id=1 AND version=1`.
- **Pros:** No database locks; high performance for read-heavy systems.
- **Cons:** Fails if another update happened in between (requires retry logic or user intervention).

## 🏃 How to Run

### Backend
1. `cd backend`
2. `python -m venv venv`
3. `.\venv\Scripts\Activate.ps1` (Windows) or `source venv/bin/activate` (Unix)
4. `pip install django djangorestframework django-cors-headers`
5. `python manage.py migrate`
6. `python manage.py runserver`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Concurrency Simulation
1. Ensure the Django server is running.
2. `python scripts/simulate_booking.py`
3. Observe the logs to see how the different endpoints handle simultaneous requests.

## 🧪 Simulation Results
When running the script:
- **Naive:** Multiple users see the seat as available; only one succeeds due to the DB unique constraint on the `Booking` model, but the `Seat` status update is messy.
- **Pessimistic:** One user locks the row; others are rejected immediately (due to `nowait=True`).
- **Optimistic:** One user updates the version; others fail because their `WHERE version=X` clause no longer matches.
