import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import EmptyState from "./EmptyState";
import FilterBar from "./FilterBar";
import MetricCard from "./MetricCard";
import PageHeader from "./PageHeader";
import SectionCard from "./SectionCard";
import {
  derivePriority,
  getTicketTeam,
  getSlaState,
  getIssueTypesForTeam,
  TEAM_NAMES,
  priorityClass,
  slaClass,
} from "../utils/ticketVisuals";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const STATUSES = ["Open", "In Progress", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

function getThemeElement() {
  return document.body.classList.contains("dark")
    ? document.body
    : document.documentElement;
}

function getCssVar(name) {
  return getComputedStyle(getThemeElement()).getPropertyValue(name).trim();
}

function buildCounts(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildFilteredStats(items) {
  const overview = {
    total: items.length,
    open: items.filter((t) => t.status === "Open").length,
    in_progress: items.filter((t) => t.status === "In Progress").length,
    closed: items.filter((t) => t.status === "Closed").length,
    assigned: items.filter((t) => t.technician_id != null).length,
    unassigned: items.filter((t) => !t.technician_id).length,
    avg_resolution_hours: null,
  };

  const closedWithTimes = items.filter((t) => t.closed_at && t.created_at);
  if (closedWithTimes.length > 0) {
    const totalHours = closedWithTimes.reduce((sum, ticket) => {
      return (
        sum +
        (new Date(ticket.closed_at).getTime() - new Date(ticket.created_at).getTime()) /
          (1000 * 60 * 60)
      );
    }, 0);
    overview.avg_resolution_hours = totalHours / closedWithTimes.length;
  }

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const dayCounts = items.reduce((acc, ticket) => {
    const createdAt = new Date(ticket.created_at).getTime();
    if (!createdAt || createdAt < cutoff) return acc;
    const day = new Date(ticket.created_at).toISOString().slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const ticketsPerDay = Object.entries(dayCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  const byStatus = buildCounts(items, (ticket) => ticket.status || "Open");
  const byCategory = buildCounts(items, (ticket) => ticket.category || "Uncategorized");
  const byTeam = buildCounts(items, (ticket) => getTicketTeam(ticket));
  const byTechnician = Object.entries(
    buildCounts(items, (ticket) => ticket.technician_email || "Unassigned")
  ).map(([technician, count]) => ({ technician, count }));

  const oldestOpen = [...items]
    .filter((ticket) => ticket.status !== "Closed")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 5);

  return {
    overview,
    tickets_per_day: ticketsPerDay,
    by_status: byStatus,
    by_category: byCategory,
    by_team: byTeam,
    by_technician: byTechnician,
    oldest_open: oldestOpen,
  };
}

function AdminDashboard() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);

  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState("");

  // Search / filters / sort
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("Newest"); // Newest | Oldest
  const [teamSelections, setTeamSelections] = useState({});

  // Re-render charts when theme changes
  const [themeTick, setThemeTick] = useState(0);

  const fetchTickets = useCallback(async () => {
    setError("");
    setLoadingTickets(true);
    try {
      const res = await api.get("/tickets/all");
      setTickets(res.data || []);
    } catch (e) {
      console.error("Failed to fetch tickets:", e);
      setError(
        e?.response?.data?.detail ||
          "Failed to load tickets. Check backend and your admin login."
      );
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    setLoadingStats(false);
  }, [fetchTickets]);

  // Observe theme toggle (.dark on body) for chart re-theme
  useEffect(() => {
    const el = document.body;
    const observer = new MutationObserver(() => setThemeTick((x) => x + 1));
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const updateCategory = useCallback(
    async (ticketId, category) => {
      try {
        const res = await api.put(`/tickets/${ticketId}/category`, { category });
        const updatedTicket = res.data;
        setTeamSelections((prev) => {
          const next = { ...prev };
          delete next[ticketId];
          return next;
        });
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, ...updatedTicket } : t))
        );
      } catch (e) {
        console.error("Error updating category:", e);
        alert("Failed to update category.");
      }
    },
    []
  );

  const setSelectedTeamForTicket = useCallback((ticketId, team) => {
    setTeamSelections((prev) => ({ ...prev, [ticketId]: team }));
  }, []);

  const updateStatus = useCallback(
    async (ticketId, status) => {
      try {
        await api.put(`/tickets/${ticketId}/status`, { status });
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
        );
      } catch (e) {
        console.error("Error updating status:", e);
        alert("Failed to update status.");
      }
    },
    []
  );

  // Chart theme derived from CSS vars
  const chartTheme = useMemo(() => {
    void themeTick;

    const text = getCssVar("--text") || "#e5e7eb";
    const muted = getCssVar("--muted") || "#94a3b8";
    const border = getCssVar("--border") || "#1e293b";
    const card = getCssVar("--card") || "#0b1220";
    const primary = getCssVar("--primary") || "#3b82f6";

    const isDark = document.body.classList.contains("dark");
    const outline = isDark ? "#ffffff" : "#0f172a";

    return { text, muted, border, card, primary, outline, isDark };
  }, [themeTick]);

  const commonOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: "easeOutQuart" },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: chartTheme.text,
            font: { size: 13, weight: "700" },
            boxWidth: 16,
            boxHeight: 12,
            padding: 15,
          },
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

  const xyOptions = useMemo(
    () => ({
      ...commonOptions,
      scales: {
        x: {
          ticks: { color: chartTheme.text },
          grid: { color: chartTheme.border, lineWidth: 1 },
        },
        y: {
          beginAtZero: true,
          ticks: { color: chartTheme.text, precision: 0, stepSize: 1 },
          grid: { color: chartTheme.border, lineWidth: 1 },
        },
      },
    }),
    [commonOptions, chartTheme]
  );

  const doughnutOptions = useMemo(
    () => ({ ...commonOptions, cutout: "65%" }),
    [commonOptions]
  );

  const categoryOptions = useMemo(() => {
    if (teamFilter === "All") return [];
    return getIssueTypesForTeam(teamFilter);
  }, [teamFilter]);

  const filteredTickets = useMemo(() => {
    let list = [...tickets];

    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((t) => {
        const hay = [
          t.title,
          t.description,
          t.team,
          t.user_email,
          t.technician_email,
          String(t.id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }

    if (statusFilter !== "All") {
      list = list.filter((t) => (t.status ?? "Open") === statusFilter);
    }

    if (teamFilter !== "All") {
      list = list.filter((t) => getTicketTeam(t) === teamFilter);
    }

    if (categoryFilter !== "All") {
      list = list.filter(
        (t) => (t.category ?? "Uncategorized") === categoryFilter
      );
    }

    if (priorityFilter !== "All") {
      list = list.filter((t) => derivePriority(t) === priorityFilter);
    }

    list.sort((a, b) => (sortOrder === "Newest" ? b.id - a.id : a.id - b.id));
    return list;
  }, [tickets, q, statusFilter, teamFilter, categoryFilter, priorityFilter, sortOrder]);

  const filteredStats = useMemo(() => buildFilteredStats(filteredTickets), [filteredTickets]);

  const ticketsOverTimeData = useMemo(() => {
    if (!filteredStats) return null;
    return {
      labels: filteredStats.tickets_per_day.map((x) => x.day),
      datasets: [
        {
          label: "Tickets",
          data: filteredStats.tickets_per_day.map((x) => x.count),
          borderColor: chartTheme.primary,
          backgroundColor: chartTheme.primary + (chartTheme.isDark ? "22" : "33"),
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: chartTheme.primary,
          pointBorderColor: chartTheme.outline,
          pointBorderWidth: 2,
        },
      ],
    };
  }, [filteredStats, chartTheme]);

  const statusData = useMemo(() => {
    if (!filteredStats) return null;

    const labels = Object.keys(filteredStats.by_status || {});
    const values = Object.values(filteredStats.by_status || {});

    const colorMap = {
      Open: "#10b981",
      "In Progress": "#f59e0b",
      Closed: "#3b82f6",
    };

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((l) => colorMap[l] || chartTheme.primary),
          borderColor: chartTheme.card,
          borderWidth: 3,
        },
      ],
    };
  }, [filteredStats, chartTheme]);

  const categoryData = useMemo(() => {
    if (!filteredStats) return null;

    const labels = Object.keys(filteredStats.by_category || {});
    const values = Object.values(filteredStats.by_category || {});

    return {
      labels,
      datasets: [
        {
          label: "Tickets",
          data: values,
          backgroundColor: chartTheme.primary,
          borderColor: chartTheme.outline,
          borderWidth: 1.5,
          borderRadius: 8,
        },
      ],
    };
  }, [filteredStats, chartTheme]);

  const teamData = useMemo(() => {
    if (!filteredStats) return null;

    const labels = Object.keys(filteredStats.by_team || {});
    const values = Object.values(filteredStats.by_team || {});

    return {
      labels,
      datasets: [
        {
          label: "Tickets",
          data: values,
          backgroundColor: "#14b8a6",
          borderColor: chartTheme.outline,
          borderWidth: 1.5,
          borderRadius: 8,
        },
      ],
    };
  }, [filteredStats, chartTheme]);

  const technicianData = useMemo(() => {
    if (!filteredStats) return null;
    return {
      labels: (filteredStats.by_technician || []).map((x) => x.technician),
      datasets: [
        {
          label: "Assigned",
          data: (filteredStats.by_technician || []).map((x) => x.count),
          backgroundColor: "#6366f1",
          borderColor: chartTheme.outline,
          borderWidth: 1.5,
          borderRadius: 8,
        },
      ],
    };
  }, [filteredStats, chartTheme]);

  const clearFilters = () => {
    setQ("");
    setStatusFilter("All");
    setTeamFilter("All");
    setCategoryFilter("All");
    setPriorityFilter("All");
    setSortOrder("Newest");
  };

  // Make entire row clickable, but keep dropdowns functional
  const openTicket = (ticketId) => navigate(`/tickets/${ticketId}`);
  const stopRowClick = (e) => e.stopPropagation();
  const criticalCount = tickets.filter((t) => derivePriority(t) === "Critical").length;
  const slaBreachedCount = tickets.filter((t) => getSlaState(t).level === "breach").length;

  return (
    <div className="ticket-card dashboard-card">
      <PageHeader
        title="Admin Operations"
        subtitle="Manage tickets, monitor queue health, and review support analytics."
      />

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <strong style={{ color: "var(--text)" }}>Error:</strong>{" "}
          <span style={{ color: "var(--muted)" }}>{error}</span>
        </div>
      )}

      {/* Controls */}
      <FilterBar>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr repeat(5, minmax(150px, 1fr))",
            gap: 10,
            width: "100%",
          }}
        >
          <input
            className="ticket-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ID, title, email, or team"
          />

          <select
            className="ticket-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="ticket-input"
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              setCategoryFilter("All");
            }}
          >
            <option value="All">All teams</option>
            {TEAM_NAMES.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

          <select
            className="ticket-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={teamFilter === "All"}
          >
            <option value="All">
              {teamFilter === "All" ? "Select a team first" : "All issue types"}
            </option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="ticket-input"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="All">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="ticket-input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="Newest">Newest first</option>
            <option value="Oldest">Oldest first</option>
          </select>
        </div>

        <div style={{ color: "var(--muted)", fontWeight: 800 }}>
          Showing{" "}
          <span style={{ color: "var(--text)" }}>
            {loadingTickets ? "..." : filteredTickets.length}
          </span>{" "}
          tickets
        </div>

        <button type="button" className="home-refresh" onClick={clearFilters}>
          Clear filters
        </button>
      </FilterBar>

      {/* Tickets table */}
      {loadingTickets ? (
        <p style={{ marginTop: 14 }}>Loading tickets...</p>
      ) : filteredTickets.length === 0 ? (
        <EmptyState
          title="No tickets match the current filters"
          description="Adjust the search or filters to bring tickets back into view."
        />
      ) : (
        <>
          {filteredStats?.overview.unassigned > 0 && (
            <div className="admin-triage-alert">
              <div>
                <strong>{filteredStats.overview.unassigned} ticket{filteredStats.overview.unassigned === 1 ? "" : "s"} need assignment</strong>
                <span>
                  These tickets are not being worked yet. Triage them first so they have an owner.
                </span>
              </div>
            </div>
          )}

          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="ticket-table admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>User</th>
                  <th>Technician</th>
                  <th>Priority</th>
                  <th>SLA</th>
                  <th>Status</th>
                  <th>Team</th>
                  <th>Issue Type</th>
                </tr>
              </thead>

              <tbody>
                {filteredTickets.map((t) => (
                  (() => {
                    const selectedTeam = teamSelections[t.id] || getTicketTeam(t);
                    const rowCategoryOptions = getIssueTypesForTeam(selectedTeam);
                    const categoryValue = rowCategoryOptions.includes(t.category)
                      ? t.category
                      : "";
                    const isUnassigned = !t.technician_id;

                    return (
                      <tr
                        key={t.id}
                        className={`clickable admin-ticket-row ${isUnassigned ? "unassigned-ticket" : ""}`}
                        onClick={() => openTicket(t.id)}
                        style={{ cursor: "pointer" }}
                        title={isUnassigned ? "Unassigned ticket needing triage" : "Open ticket"}
                      >
                        <td>{t.id}</td>
                        <td className="cell-title">{t.title}</td>

                        <td className="cell-email" title={t.user_email || ""}>
                          {t.user_email || "Unknown"}
                        </td>

                        <td className="cell-email" title={t.technician_email || ""}>
                          {t.technician_email || (
                            <span className="unassigned-pill">Needs assignment</span>
                          )}
                        </td>

                        <td>
                          <span className={priorityClass(derivePriority(t))}>
                            {derivePriority(t)}
                          </span>
                        </td>

                        <td>
                          <span className={slaClass(getSlaState(t).level)}>
                            {getSlaState(t).label}
                          </span>
                        </td>

                        {/* Stop click from bubbling when using dropdowns */}
                        <td onClick={stopRowClick}>
                          <select
                            value={t.status ?? "Open"}
                            onChange={(e) => updateStatus(t.id, e.target.value)}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td onClick={stopRowClick}>
                          <select
                            className="ticket-input"
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeamForTicket(t.id, e.target.value)}
                          >
                            {TEAM_NAMES.map((team) => (
                              <option key={team} value={team}>
                                {team}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td onClick={stopRowClick}>
                          <select
                            className="ticket-input"
                            value={categoryValue}
                            onChange={(e) => updateCategory(t.id, e.target.value)}
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
        </>
      )}

      {/* Analytics */}
      <SectionCard title="Analytics">
        {loadingStats && !filteredStats ? (
          <p>Loading analytics...</p>
        ) : filteredStats ? (
          <>
            <div className="kpi-row">
              <MetricCard label="Total" value={filteredStats.overview.total} />
              <MetricCard label="Open" value={filteredStats.overview.open} />
              <MetricCard label="In Progress" value={filteredStats.overview.in_progress} />
              <MetricCard label="Closed" value={filteredStats.overview.closed} />
              <MetricCard label="Critical" value={criticalCount} />
              <MetricCard label="SLA Breached" value={slaBreachedCount} />
              <MetricCard
                label="Avg Resolution"
                value={
                  filteredStats.overview.avg_resolution_hours != null
                    ? `${filteredStats.overview.avg_resolution_hours.toFixed(1)}h`
                    : "N/A"
                }
              />
            </div>

            <div className="charts-grid">
              <SectionCard title="Tickets Created (Last 14 Days)" className="chart-card">
                <div className="chart-wrap">
                  {ticketsOverTimeData && (
                    <Line data={ticketsOverTimeData} options={xyOptions} />
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Status Distribution" className="chart-card">
                <div className="chart-wrap">
                  {statusData && (
                    <Doughnut data={statusData} options={doughnutOptions} />
                  )}
                </div>
              </SectionCard>

              <SectionCard title="By Issue Type" className="chart-card">
                <div className="chart-wrap">
                  {categoryData && <Bar data={categoryData} options={xyOptions} />}
                </div>
              </SectionCard>

              <SectionCard title="By Team" className="chart-card">
                <div className="chart-wrap">
                  {teamData && <Bar data={teamData} options={xyOptions} />}
                </div>
              </SectionCard>

              <SectionCard title="Technician Workload" className="chart-card">
                <div className="chart-wrap">
                  {technicianData && (
                    <Bar data={technicianData} options={xyOptions} />
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Oldest Open Tickets" className="chart-card">
              {filteredStats.oldest_open?.length === 0 ? (
                <EmptyState
                  title="No open tickets"
                  description="Everything in the current filtered view is closed."
                />
              ) : (
                <ul className="oldest-list">
                  {filteredStats.oldest_open?.map((t) => (
                    <li key={t.id}>
                      <strong>#{t.id}</strong> - {t.title}{" "}
                      <em>({t.status})</em>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </>
        ) : (
          <p>Analytics unavailable.</p>
        )}
      </SectionCard>
    </div>
  );
}

export default AdminDashboard;
