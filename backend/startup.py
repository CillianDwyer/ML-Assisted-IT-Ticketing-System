# startup.py
# One-time startup work: lightweight SQLite migrations, indexes and demo seeding.
# Called from the FastAPI lifespan handler in main.py — no import-time side effects.

from sqlalchemy import text

import auth
import database
import models
from ticket_logic import compute_ticket_priority, resolve_ticket_team


def ensure_ticket_message_columns():
    # Lightweight startup migration so older SQLite files still work.
    db = database.SessionLocal()
    try:
        cols = db.execute(text("PRAGMA table_info(ticket_messages)")).fetchall()
        col_names = {c[1] for c in cols}

        new_columns = {
            "is_private": "BOOLEAN NOT NULL DEFAULT 0",
            "recipient_id": "INTEGER",
            "attachment_name": "VARCHAR",
            "attachment_path": "VARCHAR",
            "attachment_type": "VARCHAR",
            "attachment_size": "INTEGER",
        }
        for name, ddl in new_columns.items():
            if name not in col_names:
                db.execute(text(f"ALTER TABLE ticket_messages ADD COLUMN {name} {ddl}"))

        # Older rows stored created_at as isoformat strings with a "T" separator;
        # normalize so SQLAlchemy's DateTime type can parse them.
        db.execute(
            text(
                "UPDATE ticket_messages "
                "SET created_at = REPLACE(created_at, 'T', ' ') "
                "WHERE created_at LIKE '%T%'"
            )
        )

        db.commit()
    finally:
        db.close()


def ensure_ticket_priority_column():
    # Adds and backfills the priority column for older databases.
    db = database.SessionLocal()
    try:
        cols = db.execute(text("PRAGMA table_info(tickets)")).fetchall()
        col_names = {c[1] for c in cols}

        if "priority" in col_names:
            return

        db.execute(
            text(
                "ALTER TABLE tickets "
                "ADD COLUMN priority VARCHAR NOT NULL DEFAULT 'Low'"
            )
        )
        # Backfill only on first migration; reads keep priorities fresh afterwards.
        for ticket in db.query(models.Ticket).all():
            ticket.priority = compute_ticket_priority(
                status=ticket.status,
                category=ticket.category,
                created_at=ticket.created_at
            )
        db.commit()
    finally:
        db.close()


def ensure_ticket_team_column():
    # Adds and backfills the team column for older databases.
    db = database.SessionLocal()
    try:
        cols = db.execute(text("PRAGMA table_info(tickets)")).fetchall()
        col_names = {c[1] for c in cols}

        if "team" in col_names:
            return

        db.execute(
            text(
                "ALTER TABLE tickets "
                "ADD COLUMN team VARCHAR NOT NULL DEFAULT 'Unassigned'"
            )
        )
        for ticket in db.query(models.Ticket).all():
            ticket.team = resolve_ticket_team(ticket.category) or "Unassigned"
        db.commit()
    finally:
        db.close()


def ensure_indexes():
    db = database.SessionLocal()
    try:
        for stmt in [
            "CREATE INDEX IF NOT EXISTS ix_tickets_user_id ON tickets (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_tickets_technician_id ON tickets (technician_id)",
            "CREATE INDEX IF NOT EXISTS ix_ticket_messages_ticket_id ON ticket_messages (ticket_id)",
            "CREATE INDEX IF NOT EXISTS ix_ticket_messages_sender_id ON ticket_messages (sender_id)",
        ]:
            db.execute(text(stmt))
        db.commit()
    finally:
        db.close()


def seed_default_users():
    # Seeds demo users used for local assessment and role-based testing.
    db = database.SessionLocal()
    try:
        admin_email = "admin@example.com"

        if not db.query(models.User).filter(models.User.email == admin_email).first():
            admin_user = models.User(
                email=admin_email,
                hashed_password=auth.get_password_hash("admin123"),
                role="admin"
            )
            db.add(admin_user)

        technicians = [
            ("servicedesk@example.com", "Service Desk"),
            ("desktopsupport@example.com", "Desktop Support"),
            ("networkteam@example.com", "Network Team"),
            ("systemsteam@example.com", "Systems Team"),
            ("securityteam@example.com", "Security Team"),
        ]

        for email, speciality in technicians:
            existing = db.query(models.User).filter(models.User.email == email).first()
            if existing:
                existing.role = "technician"
                existing.speciality = speciality
            else:
                tech = models.User(
                    email=email,
                    hashed_password=auth.get_password_hash("tech123"),
                    role="technician",
                    speciality=speciality
                )
                db.add(tech)

        db.commit()
    finally:
        db.close()


def cleanup_legacy_technician_accounts():
    # Moves old demo-account references onto the current technician accounts.
    db = database.SessionLocal()
    try:
        legacy_mapping = {
            "hardware@example.com": "desktopsupport@example.com",
            "passwordrest@example.com": "servicedesk@example.com",
            "software@example.com": "servicedesk@example.com",
            "access@example.com": "systemsteam@example.com",
            "network@example.com": "networkteam@example.com",
        }
        changed = False
        for legacy_email, canonical_email in legacy_mapping.items():
            legacy_user = db.query(models.User).filter(models.User.email == legacy_email).first()
            canonical_user = db.query(models.User).filter(models.User.email == canonical_email).first()
            if not legacy_user or not canonical_user:
                continue
            if legacy_user.id == canonical_user.id:
                continue

            (
                db.query(models.Ticket)
                .filter(models.Ticket.technician_id == legacy_user.id)
                .update({"technician_id": canonical_user.id}, synchronize_session=False)
            )
            (
                db.query(models.Notification)
                .filter(models.Notification.user_id == legacy_user.id)
                .update({"user_id": canonical_user.id}, synchronize_session=False)
            )
            (
                db.query(models.TicketMessage)
                .filter(models.TicketMessage.recipient_id == legacy_user.id)
                .update({"recipient_id": canonical_user.id}, synchronize_session=False)
            )

            db.delete(legacy_user)
            changed = True

        if changed:
            db.commit()
    finally:
        db.close()


def run_startup_tasks():
    models.Base.metadata.create_all(bind=database.engine)
    ensure_ticket_message_columns()
    ensure_ticket_team_column()
    ensure_ticket_priority_column()
    ensure_indexes()
    seed_default_users()
    cleanup_legacy_technician_accounts()
