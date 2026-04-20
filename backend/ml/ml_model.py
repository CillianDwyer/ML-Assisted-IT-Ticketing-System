import joblib
import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIN_DESCRIPTION_WORDS = 3
MIN_UNIQUE_TOKENS = 2
MIN_ALNUM_CHARS = 8
IT_HINT_PHRASES = {
    "cannot login", "cant login", "unable to login", "unable to sign in",
    "cannot connect", "cant connect", "cannot print", "wont print",
    "keeps crashing", "keeps freezing", "running slow", "very slow",
    "not responding", "access denied", "permission denied", "forgot password",
    "password reset", "account locked", "locked out", "drops connection",
    "installation failed", "update failed", "sync failed",
    "email not sending", "email not receiving", "screen is blank",
    "blue screen", "no sound", "no internet", "session expired",
    "account disabled", "account suspended", "packet loss",
    "limited connectivity", "calendar invite", "meeting invite",
    "out of office", "docking station", "operating system", "submit failed",
    "shared drive", "network drive", "mapped drive", "read-only",
    "read only", "locked file", "corrupted file", "missing file",
    "full disk", "disk full", "paper jam", "scan to email",
    "print server", "offline printer", "default printer", "suspicious login",
    "blocked attachment", "unsafe link", "remote desktop", "virtual desktop",
    "virtual machine", "remote access", "vpn client", "service unavailable",
    "stack trace", "memory leak", "cpu high", "disk high", "battery drain",
    "not charging", "dead battery", "black screen", "no display",
    "no signal", "audio not working", "microphone not working",
    "webcam not detected", "usb not recognized", "syncing issue",
    "not syncing", "duplicate records", "stale data", "missing data",
    "inconsistent data", "data loss", "file conflict", "merge conflict",
    "permission issue", "visibility issue", "error code", "crash dump",
    "network share", "meeting room", "conference room",
}
IT_HINT_TOKENS = {
    "account", "access", "active", "ad", "adapter", "adobe", "alias", "android",
    "antivirus", "api", "archive", "attachment", "authenticate", "authentication",
    "authorization", "autocorrect", "aws", "azure", "backup", "badge", "bandwidth",
    "battery", "bios", "bitlocker", "bounce", "bounced", "branch", "browser",
    "build", "cable", "calendar", "captive", "cert", "certificate", "charger",
    "chat", "chrome", "citrix", "cloud", "cluster", "coauthoring", "compiler",
    "compromise", "connectivity", "container", "copier", "cpu", "crash",
    "credentials", "daemon", "database", "defender", "deprovisioning", "desktop",
    "dhcp", "directory", "disk", "distribution", "dns", "docker", "dock",
    "domain", "download", "drive", "driver", "duplex", "email", "employee",
    "encryption", "endpoint", "entitlement", "error", "ethernet", "exchange",
    "excel", "exception", "execute", "expired", "export", "extension", "file",
    "firewall", "firefox", "firmware", "folder", "forwarding", "gcp", "gateway",
    "gmail", "google", "group", "hard", "headset", "hdmi", "hotspot", "hypervisor",
    "iam", "id", "inbox", "incident", "ink", "install", "instance", "integration",
    "internet", "ios", "ip", "issue", "jitter", "json", "junk", "kubernetes",
    "kernel", "keyboard", "lag", "lan", "laptop", "ldap", "linux", "load",
    "lockout", "login", "logon", "mac", "macos", "macro", "mailbox", "malware",
    "mapped", "memory", "message", "mfa", "microphone", "mobile", "monitor",
    "motherboard", "mouse", "microsoft", "mysql", "network", "notification",
    "oauth", "o365", "office", "onedrive", "operating", "oracle", "os", "otp",
    "outbox", "outlook", "packet", "passcode", "password", "patch", "path",
    "paas", "pdf", "performance", "permission", "phishing", "phone", "plugin",
    "pod", "portal", "postgres", "powerpoint", "printer", "printing", "privilege",
    "profile", "proxy", "query", "quarantine", "quota", "ram", "ransomware",
    "rdp", "receive", "recall", "reconnect", "recovery", "record", "refresh",
    "remote", "reset", "restore", "reboot", "restart", "role", "router", "rule",
    "run", "saas", "safari", "save", "scan", "scanner", "schema", "screen",
    "screenshot", "scripting", "sdd", "security", "send", "server", "service",
    "session", "share", "sharepoint", "shared", "shutdown", "sign", "signin",
    "signature", "slack", "sleep", "slow", "smtp", "software", "spam", "speaker",
    "spooler", "sql", "ssh", "ssd", "sso", "ssl", "stack", "startup", "storage",
    "subscription", "switch", "sync", "system", "table", "tablet", "teams",
    "tenant", "terminal", "thin", "throughput", "tls", "token", "toner", "trojan",
    "uninstall", "upgrade", "upload", "usb", "ubuntu", "uefi", "username", "version",
    "virtual", "virus", "vdi", "vm", "voicemail", "vpn", "wake", "wan", "warning",
    "webcam", "webex", "webhook", "wifi", "wireless", "windows", "word",
    "workstation", "xml", "zoom",
}

classifier = None

try:
    classifier = joblib.load(
        os.path.join(BASE_DIR, "ticket_classifier.pkl")
    )
except Exception as e:
    print("ML model failed to load:", e)

def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _contains_it_hint(normalized: str, tokens: list[str]) -> bool:
    if any(token in IT_HINT_TOKENS for token in tokens):
        return True
    return any(phrase in normalized for phrase in IT_HINT_PHRASES)


def _has_enough_signal(text: str) -> bool:
    normalized = _normalize_text(text)
    tokens = re.findall(r"[A-Za-z0-9]+", normalized.lower())

    if len(tokens) < MIN_DESCRIPTION_WORDS:
        return False

    if len(set(tokens)) < MIN_UNIQUE_TOKENS:
        return False

    # Reject descriptions that are mostly punctuation or otherwise too sparse.
    alnum_chars = sum(ch.isalnum() for ch in normalized)
    if alnum_chars < MIN_ALNUM_CHARS:
        return False

    # Require at least one IT/support-related hint before invoking the classifier.
    return _contains_it_hint(normalized.lower(), tokens)

def predict_category(text: str):
    if classifier is None:
        return "Uncategorized"

    normalized = _normalize_text(text)
    if not _has_enough_signal(normalized):
        return "Uncategorized"

    return classifier.predict([normalized])[0]
