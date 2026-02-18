import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

function StatusPill({ status, detail }) {
  const cls =
    status === "Operational"
      ? "status-pill ok"
      : status === "Degraded"
      ? "status-pill warn"
      : status === "Down"
      ? "status-pill down"
      : "status-pill unknown";

  return (
    <span className={cls} title={detail || ""}>
      <span className="status-dot" />
      {status || "Unknown"}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="home-stat">
      <div className="home-stat-label">{label}</div>
      <div className="home-stat-value">{value}</div>
      {sub ? <div className="home-stat-sub">{sub}</div> : null}
    </div>
  );
}

function About() {
  const token = localStorage.getItem("token");

  const [health, setHealth] = useState({
    status: "Unknown",
    detail: "",
    checkedAt: null,
  });

  const [publicMetrics, setPublicMetrics] = useState({
    activeTickets: null,
    avgResolutionHours: null,
    lastUpdated: null,
  });

  const [myOpenTickets, setMyOpenTickets] = useState(null);

  const avgResText = useMemo(() => {
    const v = publicMetrics.avgResolutionHours;
    if (v == null) return "Unavailable";
    // keep it friendly for a home page
    if (v < 1) return `${Math.round(v * 60)} mins`;
    return `${Number(v).toFixed(1)} hrs`;
  }, [publicMetrics.avgResolutionHours]);

  const fetchHealth = async () => {
    try {
      // ✅ Recommended: expose a public health endpoint (no auth)
      // If your backend uses something else, update the path.
      const res = await api.get("/health");
      // Support a few common shapes:
      // { status: "ok" } or { ok: true } or { status: "Operational" }
      const raw = res.data;

      const normalized =
        raw?.status?.toLowerCase() === "ok" || raw?.ok === true
          ? "Operational"
          : raw?.status === "Operational" || raw?.status === "Degraded" || raw?.status === "Down"
          ? raw.status
          : "Operational";

      setHealth({
        status: normalized,
        detail: raw?.detail || raw?.message || "",
        checkedAt: new Date(),
      });
    } catch (e) {
      setHealth({
        status: "Unknown",
        detail: "Health endpoint not reachable.",
        checkedAt: new Date(),
      });
    }
  };

  const fetchPublicMetrics = async () => {
    try {
      // ✅ Recommended: expose a public metrics endpoint (no auth)
      // Example response:
      // { active_tickets: 12, avg_resolution_hours: 5.6, last_updated: "..." }
      const res = await api.get("/public/metrics");
      const d = res.data || {};

      setPublicMetrics({
        activeTickets: d.active_tickets ?? d.activeTickets ?? null,
        avgResolutionHours: d.avg_resolution_hours ?? d.avgResolutionHours ?? null,
        lastUpdated: d.last_updated ?? d.lastUpdated ?? null,
      });
    } catch (e) {
      // No public endpoint? Don’t break the page.
      setPublicMetrics((prev) => ({
        ...prev,
        activeTickets: null,
        avgResolutionHours: null,
        lastUpdated: null,
      }));
    }
  };

  const fetchMyTicketsIfLoggedIn = async () => {
    if (!token) {
      setMyOpenTickets(null);
      return;
    }
    try {
      // This endpoint should require auth — we only call it when logged in.
      const res = await api.get("/tickets");
      const list = Array.isArray(res.data) ? res.data : [];
      const openCount = list.filter((t) => t.status === "Open" || t.status === "In Progress").length;
      setMyOpenTickets(openCount);
    } catch {
      setMyOpenTickets(null);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchPublicMetrics();
    fetchMyTicketsIfLoggedIn();

    // light polling for status/metrics (public-safe)
    const id = setInterval(() => {
      fetchHealth();
      fetchPublicMetrics();
    }, 30000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="ticket-card home-card">
      {/* HERO */}
      <div className="home-hero">
        <div className="home-hero-text">
          <h2 className="home-title">IT Support Desk</h2>
          <p className="home-subtitle">
            A simple internal support portal for reporting issues, routing them to the right technician,
            and keeping communication in one place.
          </p>

          <div className="home-badges">
            <div className="home-badge">
              System status: <StatusPill status={health.status} detail={health.detail} />
            </div>

            <button
              className="home-refresh"
              onClick={() => {
                fetchHealth();
                fetchPublicMetrics();
                fetchMyTicketsIfLoggedIn();
              }}
              type="button"
              title="Refresh status"
            >
              ↻ Refresh
            </button>
          </div>

          {health.checkedAt && (
            <div className="home-meta">
              Last checked: {health.checkedAt.toLocaleString()}
            </div>
          )}
        </div>

        <div className="home-hero-panel">
          <div className="home-stats-grid">
            <StatCard
              label="Active tickets"
              value={publicMetrics.activeTickets ?? "Unavailable"}
              sub="Across the system"
            />
            <StatCard
              label="Avg resolution time"
              value={avgResText}
              sub="Rolling window (if enabled)"
            />
            <StatCard
              label="Your open tickets"
              value={token ? (myOpenTickets ?? "—") : "Login required"}
              sub={token ? "Open or in progress" : "Visible once signed in"}
            />
            <StatCard
              label="Security"
              value="Role-based"
              sub="Users • Technicians • Admins"
            />
          </div>

          {publicMetrics.lastUpdated ? (
            <div className="home-meta">
              Metrics updated: {new Date(publicMetrics.lastUpdated).toLocaleString()}
            </div>
          ) : (
            <div className="home-meta">Metrics: enabled if /public/metrics exists</div>
          )}
        </div>
      </div>

      {/* VALUE PROPS */}
      <div className="home-section">
        <h3>What you can do</h3>
        <ul className="about-list">
          <li>
            <b>Submit issues</b> and track progress through <b>Open → In Progress → Closed</b>
          </li>
          <li>
            <b>Get routed faster</b> with ML-assisted categorisation and technician speciality matching
          </li>
          <li>
            <b>Keep context</b> in the ticket conversation thread (no chasing email chains)
          </li>
        </ul>
      </div>

      {/* HOW IT WORKS */}
      <div className="home-section">
        <h3>How it works</h3>
        <pre className="arch-diagram">
{`Employee
  |
  v
React Frontend (Routes + Components)
  |
  v
FastAPI Backend (Auth + RBAC + Ticket Logic)
  |                     |
  v                     v
SQLite Database         ML Classifier
(Tickets, Users,        (Category prediction
 Messages)               from description)`}
        </pre>
        <p className="muted">
          Some information on this page is intentionally limited when you’re not signed in.
        </p>
      </div>
    </div>
  );
}

export default About;