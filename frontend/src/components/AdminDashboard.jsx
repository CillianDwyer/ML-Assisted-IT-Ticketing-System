import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

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

const CATEGORIES = ["Hardware", "Software", "Network", "Password Reset", "Access"];
const STATUSES = ["Open", "In Progress", "Closed"];

function getThemeElement() {
  return document.body.classList.contains("dark")
    ? document.body
    : document.documentElement;
}

function getCssVar(name) {
  return getComputedStyle(getThemeElement()).getPropertyValue(name).trim();
}

function AdminDashboard() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);

  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState("");

  // Search / filters / sort
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("Newest"); // Newest | Oldest

  // Re-render charts when theme changes
  const [themeTick, setThemeTick] = useState(0);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await api.get("/admin/stats?days=14");
      setStats(res.data);
    } catch (e) {
      console.error("Failed to fetch admin stats:", e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

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
    fetchStats();
  }, [fetchTickets, fetchStats]);

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
        await api.put(`/tickets/${ticketId}/category`, { category });
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, category } : t))
        );
        fetchStats();
      } catch (e) {
        console.error("Error updating category:", e);
        alert("Failed to update category.");
      }
    },
    [fetchStats]
  );

  const updateStatus = useCallback(
    async (ticketId, status) => {
      try {
        await api.put(`/tickets/${ticketId}/status`, { status });
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
        );
        fetchStats();
      } catch (e) {
        console.error("Error updating status:", e);
        alert("Failed to update status.");
      }
    },
    [fetchStats]
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

  const ticketsOverTimeData = useMemo(() => {
    if (!stats) return null;
    return {
      labels: stats.tickets_per_day.map((x) => x.day),
      datasets: [
        {
          label: "Tickets",
          data: stats.tickets_per_day.map((x) => x.count),
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
  }, [stats, chartTheme]);

  const statusData = useMemo(() => {
    if (!stats) return null;

    const labels = Object.keys(stats.by_status || {});
    const values = Object.values(stats.by_status || {});

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
  }, [stats, chartTheme]);

  const categoryData = useMemo(() => {
    if (!stats) return null;

    const labels = Object.keys(stats.by_category || {});
    const values = Object.values(stats.by_category || {});

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
  }, [stats, chartTheme]);

  const technicianData = useMemo(() => {
    if (!stats) return null;
    return {
      labels: (stats.by_technician || []).map((x) => x.technician),
      datasets: [
        {
          label: "Assigned",
          data: (stats.by_technician || []).map((x) => x.count),
          backgroundColor: "#6366f1",
          borderColor: chartTheme.outline,
          borderWidth: 1.5,
          borderRadius: 8,
        },
      ],
    };
  }, [stats, chartTheme]);

  const filteredTickets = useMemo(() => {
    let list = [...tickets];

    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((t) => {
        const hay = [
          t.title,
          t.description,
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

    if (categoryFilter !== "All") {
      list = list.filter(
        (t) => (t.category ?? "Uncategorized") === categoryFilter
      );
    }

    list.sort((a, b) => (sortOrder === "Newest" ? b.id - a.id : a.id - b.id));
    return list;
  }, [tickets, q, statusFilter, categoryFilter, sortOrder]);

  const clearFilters = () => {
    setQ("");
    setStatusFilter("All");
    setCategoryFilter("All");
    setSortOrder("Newest");
  };

  // Make entire row clickable, but keep dropdowns functional
  const openTicket = (ticketId) => navigate(`/tickets/${ticketId}`);
  const stopRowClick = (e) => e.stopPropagation();

  return (
    <div className="ticket-card dashboard-card">
      <h2>Admin Dashboard</h2>
      <p>View and manage all tickets + analytics.</p>

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
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(3, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <input
          className="ticket-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by ID, title, email…"
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
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

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ color: "var(--muted)", fontWeight: 800 }}>
          Showing{" "}
          <span style={{ color: "var(--text)" }}>
            {loadingTickets ? "…" : filteredTickets.length}
          </span>{" "}
          tickets
        </div>

        <button type="button" className="home-refresh" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      {/* Tickets table */}
      {loadingTickets ? (
        <p style={{ marginTop: 14 }}>Loading tickets…</p>
      ) : filteredTickets.length === 0 ? (
        <p style={{ marginTop: 14 }}>No tickets match your filters.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="ticket-table admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>User</th>
                <th>Technician</th>
                <th>Status</th>
                <th>Category</th>
              </tr>
            </thead>

            <tbody>
              {filteredTickets.map((t) => (
                <tr
                  key={t.id}
                  className="clickable"
                  onClick={() => openTicket(t.id)}
                  style={{ cursor: "pointer" }}
                  title="Open ticket"
                >
                  <td>{t.id}</td>
                  <td className="cell-title">{t.title}</td>

                  <td className="cell-email" title={t.user_email || ""}>
                    {t.user_email || "Unknown"}
                  </td>

                  <td className="cell-email" title={t.technician_email || ""}>
                    {t.technician_email || "Unassigned"}
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
                      value={t.category ?? CATEGORIES[0]}
                      onChange={(e) => updateCategory(t.id, e.target.value)}
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
      )}

      {/* Analytics */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 8 }}>Analytics</h3>

        {loadingStats && !stats ? (
          <p>Loading analytics…</p>
        ) : stats ? (
          <>
            <div className="kpi-row">
              <div className="kpi-card">Total: {stats.overview.total}</div>
              <div className="kpi-card">Open: {stats.overview.open}</div>
              <div className="kpi-card">
                In Progress: {stats.overview.in_progress}
              </div>
              <div className="kpi-card">Closed: {stats.overview.closed}</div>
              <div className="kpi-card">
                Avg Resolution:{" "}
                {stats.overview.avg_resolution_hours != null
                  ? `${stats.overview.avg_resolution_hours.toFixed(1)}h`
                  : "N/A"}
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-card">
                <h3>Tickets Created (Last 14 Days)</h3>
                <div className="chart-wrap">
                  {ticketsOverTimeData && (
                    <Line data={ticketsOverTimeData} options={xyOptions} />
                  )}
                </div>
              </div>

              <div className="chart-card">
                <h3>Status Distribution</h3>
                <div className="chart-wrap">
                  {statusData && (
                    <Doughnut data={statusData} options={doughnutOptions} />
                  )}
                </div>
              </div>

              <div className="chart-card">
                <h3>By Category</h3>
                <div className="chart-wrap">
                  {categoryData && <Bar data={categoryData} options={xyOptions} />}
                </div>
              </div>

              <div className="chart-card">
                <h3>Technician Workload</h3>
                <div className="chart-wrap">
                  {technicianData && (
                    <Bar data={technicianData} options={xyOptions} />
                  )}
                </div>
              </div>
            </div>

            <div className="chart-card">
              <h3>Oldest Open Tickets</h3>
              {stats.oldest_open?.length === 0 ? (
                <p>No open tickets 🎉</p>
              ) : (
                <ul className="oldest-list">
                  {stats.oldest_open?.map((t) => (
                    <li key={t.id}>
                      <strong>#{t.id}</strong> — {t.title}{" "}
                      <em>({t.status})</em>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p>Analytics unavailable.</p>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;