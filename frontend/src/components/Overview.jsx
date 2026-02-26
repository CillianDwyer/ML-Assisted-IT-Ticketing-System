import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import PageHeader from "./PageHeader";
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

function Overview() {
  const role = localStorage.getItem("role") || "user";

  const [myTickets, setMyTickets] = useState([]);
  const [assignedTickets, setAssignedTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
      detail: `Status: ${t.status} • Category: ${t.category}`,
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

  return (
    <div className="ticket-card dashboard-card">
      <PageHeader
        title="Overview"
        subtitle="Operational snapshot of ticket workload and your current queue."
        action={
          <Link to="/tickets/new" className="page-header-action">
            New Ticket
          </Link>
        }
      />

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
        <Link to="/" className="attention-card">
          <div className="attention-label">Unread Notifications</div>
          <div className="attention-value">{unreadCount}</div>
        </Link>
      </div>

      <div className="overview-grid">
        <div className="kpi-card">
          <div className="overview-label">Open</div>
          <div className="overview-value">{openCount}</div>
        </div>
        <div className="kpi-card">
          <div className="overview-label">In Progress</div>
          <div className="overview-value">{inProgressCount}</div>
        </div>
        <div className="kpi-card">
          <div className="overview-label">Closed Today</div>
          <div className="overview-value">{closedTodayCount}</div>
        </div>
        <div className="kpi-card">
          <div className="overview-label">Avg Resolution (hrs)</div>
          <div className="overview-value">
            {avgResolutionHours != null ? avgResolutionHours.toFixed(1) : "-"}
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: 14 }}>
        <h3>Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p>No recent activity.</p>
        ) : (
          <ul className="activity-list">
            {recentActivity.map((item) => (
              <li key={item.id}>
                <div className="activity-title">{item.label}</div>
                <div className="activity-detail">{item.detail}</div>
                <div className="activity-time">{new Date(item.at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Overview;
