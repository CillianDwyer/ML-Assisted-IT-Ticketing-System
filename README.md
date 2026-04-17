# IT Ticketing System

This project is a role-based IT support ticketing platform built as a full-stack application with machine-learning-assisted ticket classification.

It consists of:
- a FastAPI backend in `backend/`
- a React + Vite frontend in `frontend/`
- an ML classifier and training utilities in `ml/` and `backend/ml/`

## Project Summary

The system allows end users to submit IT support tickets, automatically predicts the likely issue type from the ticket description, maps that issue type to the correct support team, and then supports technician/admin workflows for triage, tracking, messaging, and analytics.

Main capabilities include:
- JWT authentication with role-based access for `user`, `technician`, and `admin`
- ticket creation, assignment, category updates, and status changes
- ticket messaging with:
  - public ticket messages
  - private assist messages between technicians/admins
  - file attachments and downloads
- notifications with unread counts and mark-read actions
- overview, technician, and admin dashboards
- ML-based category prediction during ticket creation
- priority and SLA logic based on issue type and ticket age

## Assessor Notes

This repository is intended for local demonstration/assessment use.

- The frontend expects the backend API to run at `http://127.0.0.1:8000`.
- The frontend dev server runs at `http://127.0.0.1:5173`.
- Demo accounts are seeded by the backend for assessment purposes.
- The application uses SQLite and stores data in `backend/tickets.db`.
- Uploaded attachments are stored in `backend/uploads/`.
- The trained ML model used by the backend is included at `backend/ml/ticket_classifier.pkl`.
- ML retraining scripts are included, but retraining requires a dataset path to be provided.

## Project Structure

- `backend/` - FastAPI API, database models, authentication, business logic, uploads, SQLite database
- `frontend/` - React UI built with Vite
- `ml/` - model training and evaluation scripts
- `backend/ml/` - model loading and inference used at runtime by the API

## Requirements

- Python 3.10+
- Node.js 18+
- npm 9+

## Running the Project

Start the backend first, then the frontend.

### 1. Backend Setup

From the project root:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

### 2. Frontend Setup

From the project root in a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:5173
```

## Demo Accounts

The backend seeds demo accounts automatically on startup. These accounts are included for demonstration and assessment only.

### Admin

- Email: `admin@example.com`
- Password: `admin123`

### Technicians

- `servicedesk@example.com` / `tech123`
- `desktopsupport@example.com` / `tech123`
- `networkteam@example.com` / `tech123`
- `systemsteam@example.com` / `tech123`
- `securityteam@example.com` / `tech123`

Normal end users can also be created through the Register page.

## Core Features

### User Features

- register and log in
- create support tickets
- view personal tickets
- send and receive ticket messages
- download attachments from ticket conversations
- receive notifications about updates

### Technician Features

- view assigned tickets
- update ticket status
- update category/issue type
- monitor SLA risk and queue priority
- send public and private assist messages

### Admin Features

- view all tickets across the system
- triage unassigned tickets
- update ticket category and status
- review analytics and dashboard charts
- monitor workload, ticket distribution, and queue health

## Machine Learning Component

The project includes a text classification model that predicts an IT issue type from the ticket description.

### Runtime Usage

- The backend loads the trained model from `backend/ml/ticket_classifier.pkl`.
- Inference logic is implemented in `backend/ml/ml_model.py`.
- When a ticket is created, the backend predicts the issue type and stores it as the ticket `category`.
- The predicted issue type is then mapped to a support team for routing.

### Training

Training utilities are included in `ml/train_model.py` and `ml/testing.py`.

Important:
- Retraining is optional for running the submitted project.
- The trained model file is already included for runtime use.
- To retrain, provide your own dataset path with `--dataset` or the `TICKET_DATASET_PATH` environment variable.
- The default dataset paths in the ML scripts are local development paths and may need to be changed on another machine.

## Priority and SLA Policy

Ticket priority is calculated in two stages:

1. A base priority is assigned from the predicted or selected issue type.
2. Priority is escalated further based on how long the ticket has been open.

### Base Priority by Issue Type

#### Critical

- `Account Compromise`
- `Malware / Virus Alert`
- `Network Outage / Connectivity Issue`
- `Server Down / Service Outage`

#### High

- `Account Lockout`
- `Active Directory Issue`
- `DNS / Network Resolution Issue`
- `File Server Issue`
- `MFA / 2FA Issue`
- `OS / Boot Issue`
- `Phishing Report`
- `Suspicious Login`
- `VM / Infrastructure Issue`
- `VPN Issue`

#### Medium

- `Backup / Restore Issue`
- `Disk Space / Storage Issue`
- `Email Access Issue`
- `Laptop/Desktop Hardware Issue`
- `Mailbox / Email Sync Issue`
- `Network Drive Access Issue`
- `Password Reset`
- `Security Policy Violation`
- `Wi-Fi Connectivity Issue`

#### Low

- `Access Request`
- `Basic Software Issue`
- `Device Performance Issue`
- `Peripheral / Docking Issue`
- `Printer Issue`
- `Software Installation Request`

### Age-Based Escalation

- Closed tickets are treated as `Low`.
- After `24` hours, priority increases by one level.
- After `48` hours, priority increases by two levels.
- After `72` hours, the ticket becomes `Critical`.

This policy is implemented in the backend and mirrored in the frontend for consistent display.

## Key API Endpoints

- `POST /register`
- `POST /login`
- `GET /tickets`
- `POST /tickets`
- `GET /tickets/{ticket_id}`
- `GET /tickets/{ticket_id}/messages`
- `POST /tickets/{ticket_id}/messages`
- `POST /tickets/{ticket_id}/messages/upload`
- `GET /tickets/{ticket_id}/messages/{message_id}/attachment`
- `GET /notifications`
- `GET /notifications/unread-count`
- `GET /health`

## Suggested Manual Test Flow

For a quick demonstration, this sequence is enough:

1. Start backend and frontend.
2. Register a normal user account.
3. Create a ticket with a realistic IT issue description.
4. Confirm the ticket receives a predicted category, team, and priority.
5. Log in as a technician and update the ticket status.
6. Send a ticket message and optionally upload an attachment.
7. Log in as admin and verify dashboards, queue data, and notifications.

## Troubleshooting

### Login Fails With a Network Error

- confirm the backend is running on port `8000`
- confirm the frontend is running on port `5173`
- confirm `frontend/src/api.js` still points to `http://127.0.0.1:8000`

### CORS Issues

- the backend currently allows localhost/127.0.0.1 frontend origins

### Attachment Upload Issues

- the backend enforces a 10MB attachment size limit

### ML Prediction Falls Back to Uncategorized

- this can happen if the model file is missing
- it can also happen if the ticket description is too short or has too little useful signal
