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
- `hardware@example.com` / `tech123`
- `passwordrest@example.com` / `tech123`
- `software@example.com` / `tech123`
- `access@example.com` / `tech123`
- `network@example.com` / `tech123`

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
- Ticket category is predicted by `backend/ml/ml_model.py` using `backend/ml/ticket_classifier.pkl`.

## Troubleshooting

- Login fails with network error:
  - confirm backend is running on port `8000`
  - confirm frontend is running on port `5173`
- CORS issues:
  - backend CORS currently allows localhost/127.0.0.1 origins
- Attachment upload issues:
  - backend enforces a 10MB attachment size limit
