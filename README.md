# IT Ticketing System (Frontend + Backend + ML)

This project is a role-based IT support ticketing platform with:
- FastAPI backend (`backend/`)
- React + Vite frontend (`frontend/`)
- ML category classifier (`ml/` + `backend/ml/`)

## Features

- JWT authentication and role-based access (`user`, `technician`, `admin`)
- Ticket creation, assignment, status updates, and category updates
- Ticket chat with:
  - public ticket messages
  - private assist messages (technician/admin)
  - file attachments + downloads
- Notification system (unread count, list, mark read)
- Dashboards:
  - Overview page for all roles
  - Technician queue dashboard
  - Admin operations dashboard with analytics charts and filters
- ML-based category prediction on ticket creation

## Project Structure

- `backend/` - FastAPI API, DB models, auth, business logic
- `frontend/` - React UI
- `ml/` - model training scripts/dataset

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

## Backend Setup

From project root:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at: `http://127.0.0.1:8000`

## Frontend Setup

From project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://127.0.0.1:5173`

## Demo Accounts (Seeded by Backend)

### Admin
- Email: `admin@example.com`
- Password: `admin123`

### Technicians
- `servicedesk@example.com` / `tech123`
- `desktopsupport@example.com` / `tech123`
- `networkteam@example.com` / `tech123`
- `systemsteam@example.com` / `tech123`
- `securityteam@example.com` / `tech123`

You can also register normal end users from the Register page.

## Key API Endpoints

- `POST /register`
- `POST /login`
- `GET /tickets`
- `POST /tickets`
- `GET /tickets/{ticket_id}/messages`
- `POST /tickets/{ticket_id}/messages/upload`
- `GET /tickets/{ticket_id}/messages/{message_id}/attachment`
- `GET /notifications`
- `GET /admin/stats`
- `GET /health`

## Notes

- API base URL is set in `frontend/src/api.js`.
- SQLite DB file is `backend/tickets.db`.
- Ticket issue type is predicted by `backend/ml/ml_model.py` using `backend/ml/ticket_classifier.pkl`.
- The backend maps predicted issue types onto 5 support teams for technician assignment.
- Tickets now persist both the detailed issue type (`category`) and the assigned support team (`team`).

## Priority Policy

Ticket priority is derived in two steps:

1. A base priority is assigned from the predicted or selected issue type.
2. The ticket is escalated further based on how long it has been open.

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

## Troubleshooting

- Login fails with network error:
  - confirm backend is running on port `8000`
  - confirm frontend is running on port `5173`
- CORS issues:
  - backend CORS currently allows localhost/127.0.0.1 origins
- Attachment upload issues:
  - backend enforces a 10MB attachment size limit
