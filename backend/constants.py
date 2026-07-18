# constants.py
# Domain configuration: statuses, routing tables, priority and SLA rules.

import os

# Ticket statuses
STATUS_OPEN = "Open"
STATUS_IN_PROGRESS = "In Progress"
STATUS_CLOSED = "Closed"
ALLOWED_STATUSES = {STATUS_OPEN, STATUS_IN_PROGRESS, STATUS_CLOSED}

# Local storage for uploaded message attachments.
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

# Age thresholds used for escalating unresolved tickets.
PRIORITY_THRESHOLDS_HOURS = {
    "low": 72,
    "medium": 48,
    "high": 24,
    "critical": 12,
}
PRIORITY_ORDER = ["Low", "Medium", "High", "Critical"]

# Resolution targets used for SLA state calculation.
SLA_TARGET_HOURS = {
    "Low": 72,
    "Medium": 48,
    "High": 24,
    "Critical": 12,
}

ADMIN_REVIEW_QUEUE = "Admin Review Queue"

ISSUE_TYPE_TO_TEAM = {
    "Password Reset": "Service Desk",
    "Account Lockout": "Service Desk",
    "MFA / 2FA Issue": "Service Desk",
    "Email Access Issue": "Service Desk",
    "Mailbox / Email Sync Issue": "Service Desk",
    "Software Installation Request": "Service Desk",
    "Basic Software Issue": "Service Desk",
    "Access Request": "Service Desk",
    "Laptop/Desktop Hardware Issue": "Desktop Support",
    "OS / Boot Issue": "Desktop Support",
    "Printer Issue": "Desktop Support",
    "Peripheral / Docking Issue": "Desktop Support",
    "Device Performance Issue": "Desktop Support",
    "Disk Space / Storage Issue": "Desktop Support",
    "Wi-Fi Connectivity Issue": "Network Team",
    "VPN Issue": "Network Team",
    "Network Drive Access Issue": "Network Team",
    "DNS / Network Resolution Issue": "Network Team",
    "Network Outage / Connectivity Issue": "Network Team",
    "Active Directory Issue": "Systems Team",
    "File Server Issue": "Systems Team",
    "Server Down / Service Outage": "Systems Team",
    "Backup / Restore Issue": "Systems Team",
    "VM / Infrastructure Issue": "Systems Team",
    "Phishing Report": "Security Team",
    "Malware / Virus Alert": "Security Team",
    "Suspicious Login": "Security Team",
    "Account Compromise": "Security Team",
    "Security Policy Violation": "Security Team",
}

ISSUE_TYPE_BASE_PRIORITY = {
    "Access Request": "Low",
    "Account Compromise": "Critical",
    "Account Lockout": "High",
    "Active Directory Issue": "High",
    "Backup / Restore Issue": "Medium",
    "Basic Software Issue": "Low",
    "DNS / Network Resolution Issue": "High",
    "Device Performance Issue": "Low",
    "Disk Space / Storage Issue": "Medium",
    "Email Access Issue": "Medium",
    "File Server Issue": "High",
    "Laptop/Desktop Hardware Issue": "Medium",
    "MFA / 2FA Issue": "High",
    "Mailbox / Email Sync Issue": "Medium",
    "Malware / Virus Alert": "Critical",
    "Network Drive Access Issue": "Medium",
    "Network Outage / Connectivity Issue": "Critical",
    "OS / Boot Issue": "High",
    "Password Reset": "Medium",
    "Peripheral / Docking Issue": "Low",
    "Phishing Report": "High",
    "Printer Issue": "Low",
    "Security Policy Violation": "Medium",
    "Server Down / Service Outage": "Critical",
    "Software Installation Request": "Low",
    "Suspicious Login": "High",
    "VM / Infrastructure Issue": "High",
    "VPN Issue": "High",
    "Wi-Fi Connectivity Issue": "Medium",
}

TEAM_BASE_PRIORITY = {
    ADMIN_REVIEW_QUEUE: "Medium",
    "Service Desk": "Medium",
    "Desktop Support": "Medium",
    "Network Team": "High",
    "Systems Team": "High",
    "Security Team": "High",
}
