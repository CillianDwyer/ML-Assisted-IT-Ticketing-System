# main.py
# App wiring: CORS, startup lifecycle, routers and public endpoints.

import os
from contextlib import asynccontextmanager
from datetime import timedelta

import uvicorn
from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, text
from sqlalchemy.orm import Session

import models
from constants import STATUS_CLOSED, UPLOAD_DIR
from database import get_db
from routers import admin, auth_routes, messages, notifications, tickets
from startup import run_startup_tasks
from timeutils import utcnow


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Migrations, indexes and demo seeding run once per server start,
    # not at import time (keeps tests and tooling side-effect free).
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    run_startup_tasks()
    yield


app = FastAPI(title="IT Ticketing API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(tickets.router)
app.include_router(messages.router)
app.include_router(notifications.router)
app.include_router(admin.router)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    # lightweight DB check
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception:
        return {"status": "degraded", "db": "error"}


@app.get("/public/metrics")
def public_metrics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    # Aggregate-only stats safe to expose without auth.
    active_tickets = (
        db.query(models.Ticket)
        .filter(models.Ticket.status != STATUS_CLOSED)
        .count()
    )

    start = utcnow() - timedelta(days=days)

    avg_resolution_hours = db.query(
        func.avg(
            (func.strftime('%s', models.Ticket.closed_at) - func.strftime('%s', models.Ticket.created_at)) / 3600.0
        )
    ).filter(
        models.Ticket.closed_at.isnot(None),
        models.Ticket.closed_at >= start
    ).scalar()

    by_status_rows = (
        db.query(models.Ticket.status, func.count(models.Ticket.id))
        .group_by(models.Ticket.status)
        .all()
    )
    by_status = {status: count for status, count in by_status_rows}

    return {
        "active_tickets": active_tickets,
        "avg_resolution_hours": float(avg_resolution_hours) if avg_resolution_hours is not None else None,
        "window_days": days,
        "by_status": by_status,
        "last_updated": utcnow().isoformat()
    }


@app.get("/")
def read_root():
    return {"message": "Welcome to the Machine Learning-Based IT Ticketing System API"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
