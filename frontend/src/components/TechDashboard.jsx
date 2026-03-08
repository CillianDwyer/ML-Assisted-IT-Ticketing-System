import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import EmptyState from "./EmptyState";
import FilterBar from "./FilterBar";
import MetricCard from "./MetricCard";
import PageHeader from "./PageHeader";
import SectionCard from "./SectionCard";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  derivePriority,
  getIssueTypesForTeam,
  getTicketTeam,
  getSlaState,
  TEAM_NAMES,
  priorityClass,
  slaClass,
} from "../utils/ticketVisuals";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

const STATUSES = ["All", "Open", "In Progress", "Closed"];
const PRIORITY_TARGET_HOURS = {
  Low: 72,
  Medium: 48,
  High: 24,
  Critical: 12,
};

function getThemeElement() {
  return document.body.classList.contains("dark")
    ? document.body
    : document.documentElement;
}

function getCssVar(name) {
  return getComputedStyle(getThemeElement()).getPropertyValue(name).trim();
}

function getHoursSince(value) {
  if (!value) return 0;
  return (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60);
}

function TechDashboard() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [teamSelections, setTeamSelections] = useState({});
  const [themeTick, setThemeTick] = useState(0);
  const navigate = useNavigate();

  const fetchTickets = async () => {
    try {
      const response = await api.get("/tickets/assigned");
      setTickets(response.data || []);
    } catch (error) {
      console.error("Error fetching assigned tickets:", error);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    const el = document.body;
    const observer = new MutationObserver(() => setThemeTick((x) => x + 1));
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await api.put(`/tickets/${ticketId}/status`, { status: newStatus });
      fetchTickets();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleCategoryChange = async (ticketId, newCategory) => {
    try {
      await api.put(`/tickets/${ticketId}/category`, { category: newCategory });
      setTeamSelections((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      fetchTickets();
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const setSelectedTeamForTicket = (ticketId, team) => {
    setTeamSelections((prev) => ({ ...prev, [ticketId]: team }));
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus = filter === "All" || ticket.status === filter;
    const matchesTeam = teamFilter === "All" || getTicketTeam(ticket) === teamFilter;
    return matchesStatus && matchesTeam;
  });

  const triageSource = filteredTickets;

  const slaSummary = useMemo(() => {
    const counts = { on_track: 0, at_risk: 0, breached: 0 };
    triageSource.forEach((ticket) => {
      if (ticket.status === "Closed") return;
      const level = getSlaState(ticket).level;
      if (level === "breach") counts.breached += 1;
      else if (level === "warn") counts.at_risk += 1;
      else counts.on_track += 1;
    });
    return counts;
  }, [triageSource]);

  const prioritySummary = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    triageSource.forEach((ticket) => {
      const p = derivePriority(ticket);
      if (counts[p] !== undefined) counts[p] += 1;
    });
    return counts;
  }, [triageSource]);

  const dueSoon = useMemo(() => {
    return triageSource
      .filter((ticket) => ticket.status !== "Closed")
      .map((ticket) => {
        const priority = derivePriority(ticket);
        const targetHours = PRIORITY_TARGET_HOURS[priority] ?? 48;
        const ageHours = getHoursSince(ticket.created_at);
        const hoursToBreach = targetHours - ageHours;
        return { ticket, priority, hoursToBreach };
      })
      .filter((x) => x.hoursToBreach > 0 && x.hoursToBreach <= 24)
      .sort((a, b) => a.hoursToBreach - b.hoursToBreach)
      .slice(0, 8);
  }, [triageSource]);

  const chartTheme = useMemo(() => {
    void themeTick;
    const isDark = document.body.classList.contains("dark");
    return {
      text: getCssVar("--text") || "#e5e7eb",
      border: getCssVar("--border") || "#1e293b",
      card: getCssVar("--card") || "#0b1220",
      primary: getCssVar("--primary") || "#3b82f6",
      outline: isDark ? "#ffffff" : "#0f172a",
    };
  }, [themeTick]);

  const doughnutData = useMemo(
    () => ({
      labels: ["On Track", "At Risk", "Breached"],
      datasets: [
        {
          data: [slaSummary.on_track, slaSummary.at_risk, slaSummary.breached],
          backgroundColor: ["#3b82f6", "#f59e0b", "#ef4444"],
          borderColor: chartTheme.card,
          borderWidth: 3,
        },
      ],
    }),
    [slaSummary, chartTheme]
  );

  const priorityBarData = useMemo(
    () => ({
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [
        {
          label: "Tickets",
          data: [
            prioritySummary.Low,
            prioritySummary.Medium,
            prioritySummary.High,
            prioritySummary.Critical,
          ],
          backgroundColor: chartTheme.primary,
          borderColor: chartTheme.outline,
          borderWidth: 1.5,
          borderRadius: 8,
        },
      ],
    }),
    [prioritySummary, chartTheme]
  );

  const commonOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: "easeOutQuart" },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { color: chartTheme.text, font: { weight: "700" } },
        },
        tooltip: {
          backgroundColor: chartTheme.card,
          titleColor: chartTheme.text,
          bodyColor: chartTheme.text,
          borderColor: chartTheme.border,
          borderWidth: 1,
        },
      },
    }),
    [chartTheme]
  );

  const doughnutOptions = useMemo(
    () => ({ ...commonOptions, cutout: "65%" }),
    [commonOptions]
  );

  const barOptions = useMemo(
    () => ({
      ...commonOptions,
      scales: {
        x: { ticks: { color: chartTheme.text }, grid: { color: chartTheme.border } },
        y: {
          beginAtZero: true,
          ticks: { color: chartTheme.text, precision: 0, stepSize: 1 },
          grid: { color: chartTheme.border },
        },
      },
    }),
    [commonOptions, chartTheme]
  );

  return (
    <div className="ticket-card dashboard-card">
      <PageHeader
        title="Technician Queue"
        subtitle="Work assigned tickets, update progress, and keep queue health in view."
      />

      <div className="overview-grid" style={{ marginBottom: 14 }}>
        <MetricCard label="On Track" value={slaSummary.on_track} />
        <MetricCard label="At Risk" value={slaSummary.at_risk} />
        <MetricCard label="Breached" value={slaSummary.breached} />
        <MetricCard label="Due Soon" value={dueSoon.length} />
      </div>

      <FilterBar>
        <div className="ticket-filters">
          {STATUSES.map((status) => (
            <button
              key={status}
              className={`filter-btn ${filter === status ? "active" : ""}`}
              onClick={() => setFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: 260, width: "100%" }}>
          <select
            className="ticket-input"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="All">All teams</option>
            {TEAM_NAMES.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      {filteredTickets.length === 0 ? (
        <EmptyState
          title="No assigned tickets match the current filters"
          description="Try a different status or team filter to widen the queue."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="ticket-table queue-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Created By</th>
                  <th>Priority</th>
                  <th>SLA</th>
                  <th>Status</th>
                  <th>Team</th>
                  <th>Issue Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  (() => {
                    const selectedTeam = teamSelections[ticket.id] || getTicketTeam(ticket);
                    const rowCategoryOptions = getIssueTypesForTeam(selectedTeam);
                    const categoryValue = rowCategoryOptions.includes(ticket.category)
                      ? ticket.category
                      : "";

                    return (
                      <tr
                        key={ticket.id}
                        className="clickable"
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        title="Open ticket"
                      >
                        <td>#{ticket.id}</td>
                        <td className="cell-title">{ticket.title}</td>
                        <td className="cell-email" title={ticket.user_email || ""}>
                          {ticket.user_email || "Unknown"}
                        </td>
                        <td>
                          <span className={priorityClass(derivePriority(ticket))}>
                            {derivePriority(ticket)}
                          </span>
                        </td>
                        <td>
                          <span className={slaClass(getSlaState(ticket).level)}>
                            {getSlaState(ticket).label}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="ticket-input"
                            value={ticket.status || "Open"}
                            onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                          >
                            {STATUSES.filter((s) => s !== "All").map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="ticket-input"
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeamForTicket(ticket.id, e.target.value)}
                          >
                            {TEAM_NAMES.map((team) => (
                              <option key={team} value={team}>
                                {team}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="ticket-input"
                            value={categoryValue}
                            onChange={(e) => handleCategoryChange(ticket.id, e.target.value)}
                          >
                            <option value="">Select issue type</option>
                            {rowCategoryOptions.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>

          <div className="charts-grid">
            <SectionCard title="Queue Status" className="chart-card">
              <div className="chart-wrap">
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </SectionCard>

            <SectionCard title="Priority Distribution" className="chart-card">
              <div className="chart-wrap">
                <Bar data={priorityBarData} options={barOptions} />
              </div>
            </SectionCard>

            <SectionCard title="Due Soon (Next 24h)" className="chart-card">
              {dueSoon.length === 0 ? (
                <EmptyState
                  title="No tickets due soon"
                  description="Nothing in this queue is set to breach within the next 24 hours."
                />
              ) : (
                <ul className="oldest-list">
                  {dueSoon.map(({ ticket, priority, hoursToBreach }) => (
                    <li
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="clickable"
                    >
                      <strong>#{ticket.id}</strong> - {ticket.title}{" "}
                      <span className={priorityClass(priority)}>{priority}</span>{" "}
                      <span className={slaClass(getSlaState(ticket).level)}>
                        {getSlaState(ticket).label}
                      </span>{" "}
                      <em>({Math.ceil(hoursToBreach)}h to breach)</em>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

export default TechDashboard;
