const HOUR = 1000 * 60 * 60;

const PRIORITY_THRESHOLDS = {
  low: 72,
  medium: 48,
  high: 24,
  critical: 12,
};
const PRIORITY_ORDER = ["Low", "Medium", "High", "Critical"];

function hoursSince(value) {
  if (!value) return 0;
  return (Date.now() - new Date(value).getTime()) / HOUR;
}

export function derivePriority(ticket) {
  const persistedPriority = String(ticket?.priority || "").trim();
  if (persistedPriority) return persistedPriority;
  if (!ticket || ticket.status === "Closed") return "Low";

  const category = ticket.category || "";
  const ageHours = hoursSince(ticket.created_at);
  const basePriority =
    category === "Network" || category === "Access"
      ? "High"
      : category === "Hardware" || category === "Password Reset"
      ? "Medium"
      : "Low";

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
