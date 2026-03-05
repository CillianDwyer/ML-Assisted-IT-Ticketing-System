import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import PageHeader from "./PageHeader";
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
  getSlaState,
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

const CATEGORIES = ["Hardware", "Software", "Network", "Access", "Password Reset"];
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
      fetchTickets();
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "All") return true;
    return ticket.status === filter;
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
        subtitle="Work assigned tickets from a single operational queue."
      />

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

      {filteredTickets.length === 0 ? (
        <p>No tickets found.</p>
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
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
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
                        value={ticket.category || "Hardware"}
                        onChange={(e) => handleCategoryChange(ticket.id, e.target.value)}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <h3>Queue Status</h3>
              <div className="chart-wrap">
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </div>

            <div className="chart-card">
              <h3>Priority Distribution</h3>
              <div className="chart-wrap">
                <Bar data={priorityBarData} options={barOptions} />
              </div>
            </div>

            <div className="chart-card">
              <h3>Due Soon (Next 24h)</h3>
              {dueSoon.length === 0 ? (
                <p>No tickets are due to breach in the next 24 hours.</p>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TechDashboard;
