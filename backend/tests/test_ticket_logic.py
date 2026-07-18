# Run from backend/: python -m pytest
# Covers the pure domain logic: routing, priority escalation, SLA and access rules.

from datetime import timedelta
from types import SimpleNamespace

from constants import ADMIN_REVIEW_QUEUE
from ticket_logic import (
    can_access_ticket,
    compute_ticket_priority,
    compute_ticket_sla_state,
    extract_mentioned_email,
    resolve_ticket_team,
)
from timeutils import utcnow


def ticket(**kwargs):
    defaults = {
        "id": 1,
        "status": "Open",
        "category": "Printer Issue",
        "priority": None,
        "created_at": utcnow(),
        "user_id": 10,
        "technician_id": 20,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def user(role, id=99):
    return SimpleNamespace(id=id, role=role)


# ---------- resolve_ticket_team ----------

def test_known_issue_maps_to_team():
    assert resolve_ticket_team("VPN Issue") == "Network Team"
    assert resolve_ticket_team("Phishing Report") == "Security Team"


def test_uncategorized_goes_to_admin_review():
    assert resolve_ticket_team("Uncategorized") == ADMIN_REVIEW_QUEUE
    assert resolve_ticket_team("uncategorized") == ADMIN_REVIEW_QUEUE


def test_empty_category_has_no_team():
    assert resolve_ticket_team(None) is None
    assert resolve_ticket_team("   ") is None


def test_unknown_category_passes_through():
    assert resolve_ticket_team("Custom Team Name") == "Custom Team Name"


# ---------- compute_ticket_priority ----------

def test_closed_tickets_are_low_priority():
    assert compute_ticket_priority(
        status="Closed", category="Account Compromise", created_at=utcnow()
    ) == "Low"


def test_fresh_ticket_uses_base_priority():
    assert compute_ticket_priority(
        status="Open", category="Printer Issue", created_at=utcnow()
    ) == "Low"
    assert compute_ticket_priority(
        status="Open", category="Account Compromise", created_at=utcnow()
    ) == "Critical"


def test_priority_escalates_one_level_after_24h():
    created = utcnow() - timedelta(hours=25)
    assert compute_ticket_priority(
        status="Open", category="Printer Issue", created_at=created
    ) == "Medium"


def test_priority_escalates_two_levels_after_48h():
    created = utcnow() - timedelta(hours=49)
    assert compute_ticket_priority(
        status="Open", category="Printer Issue", created_at=created
    ) == "High"


def test_priority_is_critical_after_72h():
    created = utcnow() - timedelta(hours=73)
    assert compute_ticket_priority(
        status="Open", category="Printer Issue", created_at=created
    ) == "Critical"


def test_high_priority_becomes_critical_after_12h():
    created = utcnow() - timedelta(hours=13)
    assert compute_ticket_priority(
        status="Open", category="VPN Issue", created_at=created
    ) == "Critical"


def test_unknown_category_falls_back_to_low():
    assert compute_ticket_priority(
        status="Open", category="Something Odd", created_at=utcnow()
    ) == "Low"


def test_string_created_at_is_parsed():
    created = (utcnow() - timedelta(hours=25)).isoformat()
    assert compute_ticket_priority(
        status="Open", category="Printer Issue", created_at=created
    ) == "Medium"


# ---------- compute_ticket_sla_state ----------

def test_closed_ticket_sla_is_met():
    assert compute_ticket_sla_state(ticket(status="Closed")) == "met"


def test_fresh_ticket_is_on_track():
    t = ticket(priority="Medium", created_at=utcnow())
    assert compute_ticket_sla_state(t) == "on_track"


def test_ticket_past_target_is_breached():
    # Medium target is 48h
    t = ticket(priority="Medium", created_at=utcnow() - timedelta(hours=49))
    assert compute_ticket_sla_state(t) == "breached"


def test_ticket_near_target_is_at_risk():
    # 0.75 * 48h = 36h
    t = ticket(priority="Medium", created_at=utcnow() - timedelta(hours=40))
    assert compute_ticket_sla_state(t) == "at_risk"


# ---------- can_access_ticket ----------

def test_admin_can_access_any_ticket():
    assert can_access_ticket(ticket(), user("admin")) is True


def test_user_can_access_own_ticket_only():
    assert can_access_ticket(ticket(user_id=10), user("user", id=10)) is True
    assert can_access_ticket(ticket(user_id=10), user("user", id=11)) is False


def test_technician_can_access_assigned_ticket():
    assert can_access_ticket(ticket(technician_id=20), user("technician", id=20)) is True


def test_technician_cannot_access_unassigned_ticket_without_assist():
    assert can_access_ticket(ticket(technician_id=20), user("technician", id=21), db=None) is False


def test_unknown_role_is_denied():
    assert can_access_ticket(ticket(), user("superuser")) is False


# ---------- extract_mentioned_email ----------

def test_mention_is_extracted_and_lowercased():
    assert extract_mentioned_email("please check @Tech@Example.com thanks") == "tech@example.com"


def test_no_mention_returns_none():
    assert extract_mentioned_email("no mention here") is None
    assert extract_mentioned_email("") is None
    assert extract_mentioned_email(None) is None
