import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import EmptyState from "./EmptyState";
import MetricCard from "./MetricCard";
import PageHeader from "./PageHeader";
import SectionCard from "./SectionCard";
import { derivePriority, getSlaState } from "../utils/ticketVisuals";

function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function getRoleCopy(role) {
  if (role === "admin") {
    return {
      title: "Operations at a glance",
      subtitle: "Keep queue pressure, ownership gaps, and SLA risk visible before they turn into bottlenecks.",
      primaryHref: "/admin",
      primaryLabel: "Open admin dashboard",
      secondaryHref: "/mytickets",
      secondaryLabel: "View my tickets",
      focusLabel: "Queue pressure",
      focusDescription: "Unassigned tickets and breached SLAs need attention first.",
      attentionTitle: "Escalation candidates",
      attentionEmptyTitle: "No queue hotspots right now",
      attentionEmptyDescription: "Unassigned, breached, and critical tickets will surface here first.",
    };
  }

  if (role === "technician") {
    return {
      title: "Your working queue",
      subtitle: "Start with the tickets most likely to breach, then move the queue forward with clear updates.",
      primaryHref: "/tech",
      primaryLabel: "Open technician queue",
      secondaryHref: "/mytickets",
      secondaryLabel: "View my submitted tickets",
      focusLabel: "Queue focus",
      focusDescription: "Breached, critical, and due-soon tickets should lead the day.",
      attentionTitle: "Work next",
      attentionEmptyTitle: "No urgent assigned tickets",
      attentionEmptyDescription: "Assigned tickets that need attention first will show up here.",
    };
  }

  return {
    title: "Your support home",
    subtitle: "Track open requests, follow replies, and keep the next action visible without digging through the queue.",
    primaryHref: "/tickets/new",
    primaryLabel: "Create ticket",
    secondaryHref: "/mytickets",
    secondaryLabel: "Open my tickets",
    focusLabel: "Support status",
    focusDescription: "Open requests, unread replies, and recent changes are surfaced here first.",
    attentionTitle: "Tickets to check",
    attentionEmptyTitle: "No active requests right now",
    attentionEmptyDescription: "Open or recently updated tickets will show here when you need to check back in.",
  };
}

function Overview() {
  const role = localStorage.getItem("role") || "user";

  const [myTickets, setMyTickets] = useState([]);
  const [assignedTickets, setAssignedTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);
  const focusSlideRefs = useRef([]);
  const activitySlideRefs = useRef([]);

  useEffect(() => {
    const load = async () => {
      try {
        const calls = [
          api.get("/tickets"),
          api.get("/notifications/unread-count"),
          api.get("/notifications?limit=10"),
        ];

        if (role === "technician") {
          calls.push(api.get("/tickets/assigned"));
        }

        if (role === "admin") {
          calls.push(api.get("/tickets/all"));
        }

        const responses = await Promise.all(calls);
        setMyTickets(responses[0].data || []);
        setUnreadCount(responses[1].data?.count ?? 0);
        setNotifications(responses[2].data || []);

        if (role === "technician") {
          setAssignedTickets(responses[3].data || []);
        }

        if (role === "admin") {
          setAllTickets(responses[3].data || []);
        }
      } catch (e) {
        console.error("Overview load failed:", e);
      }
    };

    load();
  }, [role]);

  const queueTickets = useMemo(() => {
    if (role === "admin") return allTickets;
    if (role === "technician") return assignedTickets;
    return myTickets;
  }, [role, allTickets, assignedTickets, myTickets]);

  const criticalCount = queueTickets.filter((t) => derivePriority(t) === "Critical").length;
  const breachedCount = queueTickets.filter((t) => getSlaState(t).level === "breach").length;
  const unassignedCount =
    role === "admin"
      ? allTickets.filter((t) => !t.technician_id && t.status !== "Closed").length
      : 0;

  const openCount = queueTickets.filter((t) => t.status === "Open").length;
  const inProgressCount = queueTickets.filter((t) => t.status === "In Progress").length;
  const closedTodayCount = queueTickets.filter((t) => isToday(t.closed_at)).length;

  const avgResolutionHours = useMemo(() => {
    const closedWithTimes = queueTickets.filter((t) => t.closed_at && t.created_at);
    if (closedWithTimes.length === 0) return null;
    const totalHours = closedWithTimes.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime();
      const closed = new Date(t.closed_at).getTime();
      return sum + (closed - created) / (1000 * 60 * 60);
    }, 0);
    return totalHours / closedWithTimes.length;
  }, [queueTickets]);

  const recentActivity = useMemo(() => {
    const ticketEvents = queueTickets.slice(0, 6).map((t) => ({
      id: `ticket-${t.id}`,
      label: `#${t.id} ${t.title}`,
      detail: `Status: ${t.status} | Team: ${t.team || "-"} | Issue Type: ${t.category}`,
      at: t.updated_at || t.created_at,
    }));

    const notifEvents = notifications.map((n) => ({
      id: `notif-${n.id}`,
      label: n.type === "message" ? "New message" : "Ticket update",
      detail: n.content,
      at: n.created_at,
    }));

    return [...ticketEvents, ...notifEvents]
      .filter((x) => x.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);
  }, [queueTickets, notifications]);

  const roleCopy = getRoleCopy(role);

  const spotlightValue =
    role === "admin"
      ? `${unassignedCount} unassigned`
      : role === "technician"
        ? `${breachedCount} breached`
        : `${openCount} active`;

  const focusTickets = useMemo(() => {
    const scored = queueTickets
      .filter((ticket) => ticket.status !== "Closed")
      .map((ticket) => {
        const priority = derivePriority(ticket);
        const sla = getSlaState(ticket).level;
        const score =
          (sla === "breach" ? 100 : sla === "warn" ? 60 : 0) +
          (priority === "Critical" ? 40 : priority === "High" ? 20 : 0);

        return { ticket, priority, sla, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.ticket.created_at).getTime() - new Date(b.ticket.created_at).getTime();
      });

    return scored.slice(0, 5);
  }, [queueTickets]);

  useEffect(() => {
    setFocusIndex(0);
  }, [role, queueTickets.length]);

  useEffect(() => {
    setActivityIndex(0);
  }, [role, recentActivity.length]);

  useEffect(() => {
    const slide = focusSlideRefs.current[focusIndex];
    if (!slide) return;
    slide.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: focusIndex === 0 ? "start" : "center",
    });
  }, [focusIndex]);

  useEffect(() => {
    const slide = activitySlideRefs.current[activityIndex];
    if (!slide) return;
    slide.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: activityIndex === 0 ? "start" : "center",
    });
  }, [activityIndex]);

  const focusItem = focusTickets[focusIndex] ?? null;
  const activityItem = recentActivity[activityIndex] ?? null;

  const moveFocus = (direction) => {
    if (focusTickets.length === 0) return;
    setFocusIndex((current) =>
      Math.max(0, Math.min(focusTickets.length - 1, current + direction))
    );
  };

  const moveActivity = (direction) => {
    if (recentActivity.length === 0) return;
    setActivityIndex((current) =>
      Math.max(0, Math.min(recentActivity.length - 1, current + direction))
    );
  };

  const heroStats = useMemo(() => {
    if (role === "admin") {
      return [
        { label: "Unassigned", value: unassignedCount },
        { label: "Breached", value: breachedCount },
        { label: "Critical", value: criticalCount },
      ];
    }

    if (role === "technician") {
      return [
        { label: "Assigned open", value: openCount },
        { label: "Breached", value: breachedCount },
        { label: "In progress", value: inProgressCount },
      ];
    }

    return [
      { label: "Open requests", value: openCount },
      { label: "Unread", value: unreadCount },
      { label: "Closed today", value: closedTodayCount },
    ];
  }, [role, unassignedCount, breachedCount, criticalCount, openCount, inProgressCount, unreadCount, closedTodayCount]);

  return (
    <div className="ticket-card dashboard-card">
      <PageHeader
        title="Overview"
        subtitle="Snapshot of ticket activity, queue health, and recent updates."
      />

      <section className="overview-hero">
        <div className="overview-hero-main">
          <div className="overview-hero-eyebrow">{roleCopy.focusLabel}</div>
          <h2 className="overview-hero-title">{roleCopy.title}</h2>
          <p className="overview-hero-subtitle">{roleCopy.subtitle}</p>

          <div className="overview-hero-actions">
            <Link to={roleCopy.primaryHref} className="page-header-action">
              {roleCopy.primaryLabel}
            </Link>
            <Link to={roleCopy.secondaryHref} className="overview-secondary-action">
              {roleCopy.secondaryLabel}
            </Link>
          </div>
        </div>

        <aside className="overview-hero-side">
          <div className="overview-spotlight-card">
            <div className="overview-spotlight-label">Current focus</div>
            <div className="overview-spotlight-value">{spotlightValue}</div>
            <p className="overview-spotlight-copy">{roleCopy.focusDescription}</p>

            <div className="overview-spotlight-stats">
              {heroStats.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <div className="attention-strip">
        <Link to={role === "technician" ? "/tech" : role === "admin" ? "/admin" : "/mytickets"} className="attention-card">
          <div className="attention-label">SLA Breached</div>
          <div className="attention-value">{breachedCount}</div>
        </Link>
        <Link to={role === "technician" ? "/tech" : role === "admin" ? "/admin" : "/mytickets"} className="attention-card">
          <div className="attention-label">Critical Tickets</div>
          <div className="attention-value">{criticalCount}</div>
        </Link>
        {role === "admin" && (
          <Link to="/admin" className="attention-card">
            <div className="attention-label">Unassigned</div>
            <div className="attention-value">{unassignedCount}</div>
          </Link>
        )}
        <Link to="/overview" className="attention-card">
          <div className="attention-label">Unread Notifications</div>
          <div className="attention-value">{unreadCount}</div>
        </Link>
      </div>

      <div className="overview-grid">
        <MetricCard label="Open" value={openCount} />
        <MetricCard label="In Progress" value={inProgressCount} />
        <MetricCard label="Closed Today" value={closedTodayCount} />
        <MetricCard
          label="Avg Resolution (hrs)"
          value={avgResolutionHours != null ? avgResolutionHours.toFixed(1) : "-"}
        />
      </div>

      <div className="overview-body-grid">
        <SectionCard
          title={roleCopy.attentionTitle}
          action={
            <div className="overview-section-actions">
              <div className="overview-carousel-controls">
                <button
                  type="button"
                  className="overview-arrow-btn"
                  onClick={() => moveFocus(-1)}
                  disabled={focusTickets.length <= 1 || focusIndex === 0}
                  aria-label="Previous ticket"
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  className="overview-arrow-btn"
                  onClick={() => moveFocus(1)}
                  disabled={
                    focusTickets.length <= 1 || focusIndex === focusTickets.length - 1
                  }
                  aria-label="Next ticket"
                >
                  {">"}
                </button>
              </div>
              <Link
                to={role === "user" ? roleCopy.secondaryHref : roleCopy.primaryHref}
                className="overview-section-link"
              >
                {role === "user" ? "View all tickets" : "Open queue"}
              </Link>
            </div>
          }
          className="chart-card"
        >
          {focusItem == null ? (
            <EmptyState
              title={roleCopy.attentionEmptyTitle}
              description={roleCopy.attentionEmptyDescription}
            />
          ) : (
            <div className="overview-carousel-shell">
              <div className="overview-carousel-meta">
                <span>
                  {focusIndex + 1} / {focusTickets.length}
                </span>
              </div>
              <div className="overview-carousel-viewport">
                {focusTickets.map((item, index) => (
                  <div
                    key={item.ticket.id}
                    ref={(node) => {
                      focusSlideRefs.current[index] = node;
                    }}
                    className={`overview-carousel-slide ${index === focusIndex ? "is-active" : ""}`}
                  >
                    <div className="overview-carousel-card">
                      <div className="focus-list-main">
                        <Link to={`/tickets/${item.ticket.id}`} className="focus-list-title">
                          #{item.ticket.id} {item.ticket.title}
                        </Link>
                        <div className="focus-list-meta">
                          Status: {item.ticket.status} | Team: {item.ticket.team || "-"} | Type: {item.ticket.category}
                        </div>
                      </div>
                      <div className="focus-list-badges">
                        <span className={`priority-badge ${item.priority.toLowerCase()}`}>
                          {item.priority}
                        </span>
                        <span
                          className={`sla-badge ${
                            item.sla === "breach" ? "breach" : item.sla === "warn" ? "warn" : "ok"
                          }`}
                        >
                          {item.sla === "breach"
                            ? "Breached"
                            : item.sla === "warn"
                              ? "At Risk"
                              : "On Track"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          action={
            <div className="overview-carousel-controls">
              <button
                type="button"
                className="overview-arrow-btn"
                onClick={() => moveActivity(-1)}
                disabled={recentActivity.length <= 1 || activityIndex === 0}
                aria-label="Previous activity"
              >
                {"<"}
              </button>
              <button
                type="button"
                className="overview-arrow-btn"
                onClick={() => moveActivity(1)}
                disabled={
                  recentActivity.length <= 1 || activityIndex === recentActivity.length - 1
                }
                aria-label="Next activity"
              >
                {">"}
              </button>
            </div>
          }
          className="chart-card"
        >
          {activityItem == null ? (
            <EmptyState
              title="No recent activity"
              description="New ticket updates and notifications will appear here."
            />
          ) : (
            <div className="overview-carousel-shell">
              <div className="overview-carousel-meta">
                <span>
                  {activityIndex + 1} / {recentActivity.length}
                </span>
              </div>
              <div className="overview-carousel-viewport">
                {recentActivity.map((item, index) => (
                  <div
                    key={item.id}
                    ref={(node) => {
                      activitySlideRefs.current[index] = node;
                    }}
                    className={`overview-carousel-slide ${index === activityIndex ? "is-active" : ""}`}
                  >
                    <div className="overview-carousel-card activity-card">
                      <div className="activity-title">{item.label}</div>
                      <div className="activity-detail">{item.detail}</div>
                      <div className="activity-time">
                        {new Date(item.at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default Overview;
