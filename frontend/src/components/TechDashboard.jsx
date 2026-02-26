import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import PageHeader from "./PageHeader";
import {
  derivePriority,
  getSlaState,
  priorityClass,
  slaClass,
} from "../utils/ticketVisuals";

const CATEGORIES = ["Hardware", "Software", "Network", "Access", "Password Reset"];
const STATUSES = ["All", "Open", "In Progress", "Closed"];

function TechDashboard() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");
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
      )}
    </div>
  );
}

export default TechDashboard;
