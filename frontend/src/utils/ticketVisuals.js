const HOUR = 1000 * 60 * 60;

const PRIORITY_THRESHOLDS = {
  low: 72,
  medium: 48,
  high: 24,
  critical: 12,
};
const PRIORITY_ORDER = ["Low", "Medium", "High", "Critical"];
export const ISSUE_TYPES = [
  "Access Request",
  "Account Compromise",
  "Account Lockout",
  "Active Directory Issue",
  "Backup / Restore Issue",
  "Basic Software Issue",
  "DNS / Network Resolution Issue",
  "Device Performance Issue",
  "Disk Space / Storage Issue",
  "Email Access Issue",
  "File Server Issue",
  "Laptop/Desktop Hardware Issue",
  "MFA / 2FA Issue",
  "Mailbox / Email Sync Issue",
  "Malware / Virus Alert",
  "Network Drive Access Issue",
  "Network Outage / Connectivity Issue",
  "OS / Boot Issue",
  "Password Reset",
  "Peripheral / Docking Issue",
  "Phishing Report",
  "Printer Issue",
  "Security Policy Violation",
  "Server Down / Service Outage",
  "Software Installation Request",
  "Suspicious Login",
  "VM / Infrastructure Issue",
  "VPN Issue",
  "Wi-Fi Connectivity Issue",
];
const ISSUE_TYPE_TO_TEAM = {
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
};
const ISSUE_TYPE_BASE_PRIORITY = {
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
};
const TEAM_BASE_PRIORITY = {
  "Service Desk": "Medium",
  "Desktop Support": "Medium",
  "Network Team": "High",
  "Systems Team": "High",
  "Security Team": "High",
};
export const TEAM_NAMES = Object.keys(TEAM_BASE_PRIORITY);

export function getIssueTypesForTeam(team) {
  return ISSUE_TYPES.filter((issueType) => ISSUE_TYPE_TO_TEAM[issueType] === team);
}

export function getTicketTeam(ticket) {
  const persistedTeam = String(ticket?.team || "").trim();
  if (persistedTeam) return persistedTeam;

  const category = String(ticket?.category || "").trim();
  return ISSUE_TYPE_TO_TEAM[category] || "Unassigned";
}

export function getBasePriority(ticket) {
  const category = String(ticket?.category || "").trim();
  const team = getTicketTeam(ticket);
  return ISSUE_TYPE_BASE_PRIORITY[category] || TEAM_BASE_PRIORITY[team] || "Low";
}

function hoursSince(value) {
  if (!value) return 0;
  return (Date.now() - new Date(value).getTime()) / HOUR;
}

export function derivePriority(ticket) {
  const persistedPriority = String(ticket?.priority || "").trim();
  if (persistedPriority) return persistedPriority;
  if (!ticket || ticket.status === "Closed") return "Low";

  const ageHours = hoursSince(ticket.created_at);
  const basePriority = getBasePriority(ticket);

  if (ageHours >= PRIORITY_THRESHOLDS.low) return "Critical";

  const baseIndex = PRIORITY_ORDER.indexOf(basePriority);
  if (ageHours >= PRIORITY_THRESHOLDS.medium) {
    return PRIORITY_ORDER[Math.min(baseIndex + 2, PRIORITY_ORDER.length - 1)];
  }
  if (ageHours >= PRIORITY_THRESHOLDS.high) {
    return PRIORITY_ORDER[Math.min(baseIndex + 1, PRIORITY_ORDER.length - 1)];
  }
  if (ageHours >= PRIORITY_THRESHOLDS.critical && basePriority === "High") {
    return "Critical";
  }
  return basePriority;
}

export function getSlaState(ticket) {
  if (!ticket) return { label: "N/A", level: "ok" };
  const persistedSla = String(ticket.sla_state || "").trim().toLowerCase();
  if (persistedSla === "met") return { label: "Met", level: "ok" };
  if (persistedSla === "breached") return { label: "Breached", level: "breach" };
  if (persistedSla === "at_risk") return { label: "At Risk", level: "warn" };
  if (persistedSla === "on_track") return { label: "On Track", level: "ok" };
  if (ticket.status === "Closed") return { label: "Met", level: "ok" };

  const priority = derivePriority(ticket).toLowerCase();
  const ageHours = hoursSince(ticket.created_at);
  const targetHours = PRIORITY_THRESHOLDS[priority] ?? 48;
  const ratio = ageHours / targetHours;

  if (ratio >= 1) return { label: "Breached", level: "breach" };
  if (ratio >= 0.75) return { label: "At Risk", level: "warn" };
  return { label: "On Track", level: "ok" };
}

export function priorityClass(priority) {
  return `priority-badge ${String(priority || "low").toLowerCase()}`;
}

export function slaClass(level) {
  return `sla-badge ${level || "ok"}`;
}

export function getPriorityExplanation(ticket) {
  const team = getTicketTeam(ticket);
  const basePriority = getBasePriority(ticket);
  const currentPriority = derivePriority(ticket);
  const createdAt = ticket?.created_at ? new Date(ticket.created_at).getTime() : null;
  const ageHours = createdAt ? (Date.now() - createdAt) / HOUR : 0;

  if (!ticket || ticket.status === "Closed") {
    return {
      team,
      basePriority,
      currentPriority: "Low",
      reason: "Closed tickets are treated as Low priority.",
      escalation: "No further escalation applies after closure.",
    };
  }

  let escalation = "No age-based escalation has applied yet.";
  if (ageHours >= PRIORITY_THRESHOLDS.low) {
    escalation = "Open for 72+ hours, so the ticket is escalated to Critical.";
  } else if (ageHours >= PRIORITY_THRESHOLDS.medium) {
    escalation = "Open for 48+ hours, so the ticket is escalated by two levels.";
  } else if (ageHours >= PRIORITY_THRESHOLDS.high) {
    escalation = "Open for 24+ hours, so the ticket is escalated by one level.";
  }

  return {
    team,
    basePriority,
    currentPriority,
    reason: `Issue type "${ticket?.category || "Unknown"}" maps to ${team} and starts at ${basePriority} priority.`,
    escalation,
  };
}
