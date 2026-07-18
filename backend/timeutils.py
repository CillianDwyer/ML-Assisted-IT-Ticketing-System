# timeutils.py
# Single source of "now" for the app.

from datetime import datetime, timezone


def utcnow() -> datetime:
    # Naive UTC: SQLite's DateTime column round-trips naive datetimes cleanly,
    # and this avoids the deprecated datetime.utcnow().
    return datetime.now(timezone.utc).replace(tzinfo=None)
