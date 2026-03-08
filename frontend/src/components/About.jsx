import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import MetricCard from "./MetricCard";
import SectionCard from "./SectionCard";

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

function FeatureCard({ title, text }) {
  return (
    <div className="about-feature-card">
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  );
}

function About() {
  const token = localStorage.getItem("token");
  const [activeFaq, setActiveFaq] = useState("");

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
    if (v < 1) return `${Math.round(v * 60)} mins`;
    return `${Number(v).toFixed(1)} hrs`;
  }, [publicMetrics.avgResolutionHours]);

  const fetchHealth = async () => {
    try {
      const res = await api.get("/health");
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
      const res = await api.get("/public/metrics");
      const d = res.data || {};

      setPublicMetrics({
        activeTickets: d.active_tickets ?? d.activeTickets ?? null,
        avgResolutionHours: d.avg_resolution_hours ?? d.avgResolutionHours ?? null,
        lastUpdated: d.last_updated ?? d.lastUpdated ?? null,
      });
    } catch (e) {
      setPublicMetrics({
        activeTickets: null,
        avgResolutionHours: null,
        lastUpdated: null,
      });
    }
  };

  const fetchMyTicketsIfLoggedIn = async () => {
    if (!token) {
      setMyOpenTickets(null);
      return;
    }

    try {
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

    const id = setInterval(() => {
      fetchHealth();
      fetchPublicMetrics();
    }, 30000);

    return () => clearInterval(id);
  }, [token]);

  return (
    <div className="ticket-card home-card">
      <div className="home-hero about-hero">
        <div className="home-hero-text">
          <span className="submit-ticket-eyebrow">Platform Overview</span>
          <h2 className="home-title">IT Support Desk</h2>
          <p className="home-subtitle about-subtitle">
            A focused internal support platform for submitting issues, routing them to the correct
            team, and keeping every update in one ticket thread.
          </p>

          <div className="home-badges">
            <div className="home-badge">
              System status: <StatusPill status={health.status} detail={health.detail} />
            </div>
            <div className="home-badge">Issue type prediction | team routing | technician queue</div>
          </div>

          <div className="about-hero-actions">
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
              Refresh live stats
            </button>
          </div>

          {health.checkedAt && (
            <div className="home-meta">Last checked: {health.checkedAt.toLocaleString()}</div>
          )}
        </div>

        <div className="home-hero-panel">
          <div className="home-stats-grid">
            <MetricCard
              label="Active tickets"
              value={publicMetrics.activeTickets ?? "Unavailable"}
              subtext="Current open workload"
            />
            <MetricCard
              label="Avg resolution time"
              value={avgResText}
              subtext="Rolling average if metrics are enabled"
            />
            <MetricCard
              label="Your open tickets"
              value={token ? (myOpenTickets ?? "-") : "Login required"}
              subtext={token ? "Open or in progress" : "Visible once signed in"}
            />
            <MetricCard
              label="Support model"
              value="5 teams"
              subtext="Service Desk, Desktop, Network, Systems, Security"
            />
          </div>

          {publicMetrics.lastUpdated ? (
            <div className="home-meta">
              Metrics updated: {new Date(publicMetrics.lastUpdated).toLocaleString()}
            </div>
          ) : (
            <div className="home-meta">Metrics appear here when the public metrics endpoint is available.</div>
          )}
        </div>
      </div>

      <SectionCard title="Key Capabilities">
        <div className="about-feature-grid">
          <FeatureCard
            title="Submit and track issues"
            text="Users can create tickets, follow status changes, and continue the discussion inside one ticket conversation."
          />
          <FeatureCard
            title="Smart routing"
            text="The system predicts an issue type from the ticket description, maps it to a support team, and routes it accordingly."
          />
          <FeatureCard
            title="Priority and SLA logic"
            text="Priority starts from the issue type and escalates with ticket age, helping teams surface urgent work faster."
          />
        </div>
      </SectionCard>

      <div className="about-two-column">
        <SectionCard title="How the platform works" className="about-panel">
          <div className="about-flow-grid">
            <div className="about-flow-step">
              <span>1</span>
              <strong>User submits a ticket</strong>
              <p>The user provides a title and description, and the backend handles the rest.</p>
            </div>
            <div className="about-flow-step">
              <span>2</span>
              <strong>ML predicts issue type</strong>
              <p>The classifier predicts a detailed issue type from the ticket description.</p>
            </div>
            <div className="about-flow-step">
              <span>3</span>
              <strong>Team and priority are derived</strong>
              <p>The issue type maps to a team, and the system calculates base priority and SLA state.</p>
            </div>
            <div className="about-flow-step">
              <span>4</span>
              <strong>Conversation stays in one place</strong>
              <p>Users, technicians, and admins collaborate inside the ticket thread with attachments and private assist notes.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Architecture at a glance" className="about-panel">
          <div className="arch-diagram arch-flow-diagram" aria-label="System architecture diagram">
            <div className="arch-node arch-node-user">User</div>
            <div className="arch-arrow arch-arrow-down arch-arrow-user-front" />

            <div className="arch-node arch-node-frontend">React Frontend</div>
            <div className="arch-arrow arch-arrow-down arch-arrow-front-back" />

            <div className="arch-node arch-node-backend">FastAPI Backend</div>

            <div className="arch-branch-row">
              <div className="arch-branch arch-branch-left" />
              <div className="arch-branch arch-branch-center" />
              <div className="arch-branch arch-branch-right" />
            </div>

            <div className="arch-node-row">
              <div className="arch-node">SQLite</div>
              <div className="arch-node">ML Classifier</div>
              <div className="arch-node">Auth + RBAC</div>
            </div>

            <div className="arch-arrow arch-arrow-down arch-arrow-sqlite-data" />
            <div className="arch-node arch-node-storage">
              Tickets, users, messages, notifications
            </div>
          </div>
          <p className="muted">
            Some details on this page stay limited when you are not signed in, but platform health
            and public metrics can still be shown when enabled.
          </p>
        </SectionCard>
      </div>

      <div className="home-section">
        <h3>Quick Answers</h3>
        <div className="faq-links">
          <button type="button" className="faq-link-chip" onClick={() => setActiveFaq("faq-access")}>
            Account access
          </button>
          <button type="button" className="faq-link-chip" onClick={() => setActiveFaq("faq-routing")}>
            Routing
          </button>
          <button type="button" className="faq-link-chip" onClick={() => setActiveFaq("faq-private")}>
            Private assist
          </button>
          <button type="button" className="faq-link-chip" onClick={() => setActiveFaq("faq-sla")}>
            Priority and SLA
          </button>
          <button type="button" className="faq-link-chip" onClick={() => setActiveFaq("faq-data")}>
            Visibility
          </button>
          <button type="button" className="faq-link-chip" onClick={() => setActiveFaq("faq-status")}>
            System status
          </button>
        </div>
      </div>

      <SectionCard title="Frequently Asked Questions" className="home-section faq-section">
        <div className="about-faq-grid">
          <div id="faq-access" className={`faq-item ${activeFaq === "faq-access" ? "active" : ""}`}>
            <h4>Who can create an account?</h4>
            <p>
              Internal users can register for a standard user account. Technician and admin accounts
              are managed separately for support operations.
            </p>
          </div>

          <div id="faq-routing" className={`faq-item ${activeFaq === "faq-routing" ? "active" : ""}`}>
            <h4>How are tickets assigned?</h4>
            <p>
              The system predicts an issue type from the description, maps that issue type to a support
              team, and routes the ticket to a matching technician when one is available.
            </p>
          </div>

          <div id="faq-private" className={`faq-item ${activeFaq === "faq-private" ? "active" : ""}`}>
            <h4>What is private assist messaging?</h4>
            <p>
              Technicians and admins can send private assistance messages inside a ticket thread so
              internal collaboration stays separate from the requester-facing conversation.
            </p>
          </div>

          <div id="faq-sla" className={`faq-item ${activeFaq === "faq-sla" ? "active" : ""}`}>
            <h4>How are priority and SLA decided?</h4>
            <p>
              Each ticket starts with a base priority from its issue type, then escalates if it remains
              open for long enough. SLA state is shown as On Track, At Risk, or Breached.
            </p>
          </div>

          <div id="faq-data" className={`faq-item ${activeFaq === "faq-data" ? "active" : ""}`}>
            <h4>Who can see my ticket details?</h4>
            <p>
              Standard users can access their own tickets. Assigned technicians and admins can access
              tickets relevant to their role permissions.
            </p>
          </div>

          <div id="faq-status" className={`faq-item ${activeFaq === "faq-status" ? "active" : ""}`}>
            <h4>Where can I check platform health?</h4>
            <p>
              This page shows live service status and public metrics when those endpoints are available,
              including active ticket volume and resolution indicators.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export default About;
