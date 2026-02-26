const HOUR = 1000 * 60 * 60;

const PRIORITY_THRESHOLDS = {
  low: 72,
  medium: 48,
  high: 24,
  critical: 12,
};

function hoursSince(value) {
  if (!value) return 0;
  return (Date.now() - new Date(value).getTime()) / HOUR;
}

export function derivePriority(ticket) {
  if (!ticket || ticket.status === "Closed") return "Low";

  const category = ticket.category || "";
  const ageHours = hoursSince(ticket.created_at);

  if (ageHours >= PRIORITY_THRESHOLDS.low) return "Critical";
  if (category === "Network" || category === "Access") return "High";
  if (ageHours >= PRIORITY_THRESHOLDS.medium) return "High";
  if (category === "Hardware" || category === "Password Reset") return "Medium";
  return "Low";
}

export function getSlaState(ticket) {
  if (!ticket) return { label: "N/A", level: "ok" };
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
