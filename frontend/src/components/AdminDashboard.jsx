import React, { useCallback, useEffect, useMemo, useState } from "react";
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

// Categories supported by ML + system
const CATEGORIES = ["Hardware", "Software", "Network", "Password Reset", "Access"];

// read CSS variables (works for light/dark because you swap vars)
function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function AdminDashboard() {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [stats, setStats] = useState(null);

  // re-render charts when theme (html class) changes
  const [themeTick, setThemeTick] = useState(0);

  const fetchStats = useCallback(async () => {
    const statsRes = await api.get("/admin/stats?days=14");
    setStats(statsRes.data);
  }, []);

  // Load tickets + technicians + stats (parallel)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ticketsRes, usersRes, statsRes] = await Promise.all([
          api.get("/tickets/all"),
          api.get("/users"),
          api.get("/admin/stats?days=14"),
        ]);

        setTickets(ticketsRes.data);

        const techs = usersRes.data.filter((u) => u.role === "technician");
        setTechnicians(techs);

        setStats(statsRes.data);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      }
    };

    fetchData();
  }, []);

  // Observe theme toggle (adds/removes .dark on <html>)
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setThemeTick((x) => x + 1));
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Assign technician
  const assignTicket = useCallback(
    async (ticketId, technicianIdRaw) => {
      const technicianId = technicianIdRaw; // keep as string unless your API requires Number()
      if (!technicianId) return; // prevents calling endpoint with empty value

      try {
        await api.put(`/tickets/${ticketId}/assign/${technicianId}`);
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, technician_id: technicianId } : t))
        );
        await fetchStats();
      } catch (error) {
        console.error("Error assigning ticket:", error);
        alert("Failed to assign ticket.");
      }
    },
    [fetchStats]
  );

  // Update category (ML override)
  const updateCategory = useCallback(
    async (ticketId, category) => {
      try {
        await api.put(`/tickets/${ticketId}/category`, { category });
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, category } : t)));
        await fetchStats();
      } catch (error) {
        console.error("Error updating category:", error);
        alert("Failed to update category.");
      }
    },
    [fetchStats]
  );

  // Chart theme derived from CSS vars
  const chartTheme = useMemo(() => {
    // themeTick exists purely to re-run this memo on theme changes
    void themeTick;

    const text = getCssVar("--text") || "#e5e7eb";
    const muted = getCssVar("--muted") || "#94a3b8";
    const border = getCssVar("--border") || "#1e293b";
    const card = getCssVar("--card") || "#0b1220";
    const primary = getCssVar("--primary") || "#3b82f6";

    const isDark = document.documentElement.classList.contains("dark");
    // outlines: white in dark mode, dark-ish in light mode
    const outline = isDark ? "#ffffff" : "#0f172a";

    return { text, muted, border, card, primary, outline, isDark };
  }, [themeTick]);

  // Shared chart options
  const commonOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,

      animation: {
        duration: 800,
        easing: "easeOutQuart",
      },

      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: chartTheme.text,
            font: {
              size: 13,
              weight: "700",
            },
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
    };
  }, [chartTheme]);

  // One shared XY options object for Line + Bar
  const xyOptions = useMemo(() => {
    return {
      ...commonOptions,
      scales: {
        x: {
          ticks: { color: chartTheme.text },
          grid: { color: chartTheme.border, lineWidth: 1 },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: chartTheme.text,
            precision: 0,
            stepSize: 1,
          },
          grid: { color: chartTheme.border, lineWidth: 1 },
        },
      },
    };
  }, [commonOptions, chartTheme]);

  const doughnutOptions = useMemo(() => {
    return {
      ...commonOptions,
      cutout: "65%",
    };
  }, [commonOptions]);

  // DATASETS (with outlines + better contrast)
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

    const labels = Object.keys(stats.by_status);
    const values = Object.values(stats.by_status);

    const colorMap = {
      Open: "#10b981",
      "In Progress": "#f59e0b",
      Closed: "#3b82f6",
    };

    const colors = labels.map((l) => colorMap[l] || chartTheme.primary);

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: chartTheme.card,
          borderWidth: 3,
        },
      ],
    };
  }, [stats, chartTheme]);

  const categoryData = useMemo(() => {
    if (!stats) return null;

    return {
      labels: Object.keys(stats.by_category),
      datasets: [
        {
          label: "Tickets",
          data: Object.values(stats.by_category),

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
      labels: stats.by_technician.map((x) => x.technician),
      datasets: [
        {
          label: "Assigned",
          data: stats.by_technician.map((x) => x.count),

          backgroundColor: "#6366f1",
          borderColor: chartTheme.outline,
          borderWidth: 1.5,
          borderRadius: 8,
        },
      ],
    };
  }, [stats, chartTheme]);

  return (
    <div className="ticket-card dashboard-card">
      <h2>Admin Dashboard</h2>
      <p>View, assign, and manage all tickets + analytics.</p>

      {/* Tickets table FIRST */}
      {tickets.length === 0 ? (
        <p>No tickets found.</p>
      ) : (
        <div className="table-wrap">
          <table className="ticket-table admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>User</th>
                <th>Technician</th>
                <th>Status</th>
                <th>Category</th>
                <th>Assign</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td className="cell-title">{t.title}</td>
                  <td className="cell-email" title={t.user_email || ""}>
                    {t.user_email || "Unknown"}
                  </td>
                  <td className="cell-email" title={t.technician_email || ""}>
                    {t.technician_email || "Unassigned"}
                  </td>
                  <td className="cell-status">{t.status}</td>

                  <td>
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

                  <td>
                    <select
                      value={t.technician_id ?? ""}
                      onChange={(e) => assignTicket(t.id, e.target.value)}
                    >
                      <option value="">Assign...</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.email}
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

      {/* Analytics AFTER the table */}
      {stats && (
        <>
          <div className="kpi-row">
            <div className="kpi-card">Total: {stats.overview.total}</div>
            <div className="kpi-card">Open: {stats.overview.open}</div>
            <div className="kpi-card">In Progress: {stats.overview.in_progress}</div>
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
                {ticketsOverTimeData && <Line data={ticketsOverTimeData} options={xyOptions} />}
              </div>
            </div>

            <div className="chart-card">
              <h3>Status Distribution</h3>
              <div className="chart-wrap">
                {statusData && <Doughnut data={statusData} options={doughnutOptions} />}
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
                {technicianData && <Bar data={technicianData} options={xyOptions} />}
              </div>
            </div>
          </div>

          <div className="chart-card">
            <h3>Oldest Open Tickets</h3>
            {stats.oldest_open.length === 0 ? (
              <p>No open tickets 🎉</p>
            ) : (
              <ul className="oldest-list">
                {stats.oldest_open.map((t) => (
                  <li key={t.id}>
                    <strong>#{t.id}</strong> — {t.title} <em>({t.status})</em>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;