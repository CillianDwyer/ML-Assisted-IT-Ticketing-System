# IT Ticketing System

A full-stack IT support ticketing platform with role-based access and machine-learning-assisted ticket classification.

The system lets users submit support tickets, predicts an issue type from the ticket description, maps that issue type to a support team, and supports technician/admin workflows for triage, updates, messaging, notifications, and dashboards.

## Stack

- `backend/` - FastAPI API, SQLite database, authentication, ticket logic, notifications, uploads
- `frontend/` - React + Vite client
- `backend/ml/` - runtime model loading and inference
- `ml/` - model training and evaluation scripts
- `ml/data/` - included datasets used by the ML scripts

## Main Features

- JWT authentication with roles: `user`, `technician`, `admin`
- ticket creation with ML-based issue-type prediction
- team routing, technician assignment, priority, and SLA status
- ticket status and category updates
- public ticket messages
- private assist messages between technicians/admins
- attachment upload and download on ticket messages
- notifications with unread count, mark-read, and mark-all-read actions
- overview, technician, and admin dashboards

## Requirements

- Python 3.10+
- Node.js 18+
- npm 9+

## Run Locally

Start the backend first, then the frontend.

### Backend

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

Notes:

- The SQLite database is created from `backend/` and stored as `backend/tickets.db`.
- Uploaded attachments are stored in `backend/uploads/`.
- `backend/requirements.txt` covers both backend runtime dependencies and the included ML scripts.

### Frontend

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

The frontend is configured to call the backend at `http://127.0.0.1:8000`.

## Demo Accounts

The backend seeds demo staff accounts automatically on startup.

### Admin

- `admin@example.com` / `admin123`

### Technicians

- `servicedesk@example.com` / `tech123`
- `desktopsupport@example.com` / `tech123`
- `networkteam@example.com` / `tech123`
- `systemsteam@example.com` / `tech123`
- `securityteam@example.com` / `tech123`

Regular end users can register from the UI.

## How Routing Works

When a user creates a ticket:

1. the backend predicts an issue type from the ticket description
2. that issue type is mapped to a support team
3. priority is calculated from the issue type and ticket age
4. SLA state is derived from ticket age versus the target window
5. if a matching technician exists for that team, the ticket is assigned automatically; otherwise it remains unassigned for admin review

If the model is unavailable or the description is too short/low-signal, the ticket falls back to `Uncategorized`.

## Priority and SLA

Priority starts from the ticket issue type and escalates with age:

- after `24` hours: escalate by one level
- after `48` hours: escalate by two levels
- after `72` hours: escalate to `Critical`
- closed tickets are treated as `Low`

SLA state is shown as:

- `On Track`
- `At Risk`
- `Breached`

## Machine Learning

Runtime inference:

- model file: `backend/ml/ticket_classifier.pkl`
- loader/inference code: `backend/ml/ml_model.py`

Training and evaluation:

- train: `python ml/train_model.py`
- compare models: `python ml/testing.py`

Included datasets:

- `ml/data/helpdesk_tickets_synthetic.csv`
- `ml/data/helpdesk_tickets_unseen_test.csv`

## Key API Endpoints

Authentication:

- `POST /register`
- `POST /login`

Tickets:

- `GET /tickets`
- `GET /tickets/all`
- `GET /tickets/assigned`
- `POST /tickets`
- `GET /tickets/{ticket_id}`
- `PUT /tickets/{ticket_id}/assign/{technician_id}`
- `PUT /tickets/{ticket_id}/status`
- `PUT /tickets/{ticket_id}/category`
- `GET /tickets/{ticket_id}/assist-users`

Messages and attachments:

- `GET /tickets/{ticket_id}/messages`
- `POST /tickets/{ticket_id}/messages`
- `POST /tickets/{ticket_id}/messages/upload`
- `GET /tickets/{ticket_id}/messages/{message_id}/attachment`

Notifications and health:

- `GET /notifications`
- `GET /notifications/unread-count`
- `PUT /notifications/{notification_id}/read`
- `PUT /notifications/read-all`
- `GET /admin/stats`
- `GET /public/metrics`
- `GET /health`

## Quick Demo Flow

1. Start backend and frontend.
2. Register a normal user account.
3. Create a ticket with a realistic IT issue description.
4. Confirm the ticket receives a category, team, priority, and SLA state.
5. Log in as a technician and update the ticket status or category.
6. Send a ticket message and optionally upload an attachment.
7. Log in as admin and review the dashboards, notifications, and queue state.

## Troubleshooting

### Login or Network Errors

- confirm the backend is running on port `8000`
- confirm the frontend is running on port `5173`
- confirm `frontend/src/api.js` still points to `http://127.0.0.1:8000`

### CORS

- the backend allows localhost/127.0.0.1 frontend origins

### Attachments

- the backend enforces a 10MB attachment size limit

### ML Prediction Falls Back to `Uncategorized`

- the model file may be missing
- the description may be too short or too low-signal
