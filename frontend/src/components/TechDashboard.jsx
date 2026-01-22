import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const CATEGORIES = [
  "Hardware",
  "Software",
  "Network",
  "Access",
  "Password Reset"
];

function TechDashboard() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");
  const navigate = useNavigate();

  const fetchTickets = async () => {
    try {
      const response = await api.get("/tickets/assigned");
      setTickets(response.data);
    } catch (error) {
      console.error("Error fetching assigned tickets:", error);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // 🔹 Update ticket status
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await api.put(`/tickets/${ticketId}/status`, { status: newStatus });
      fetchTickets();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // 🔹 Update ticket category
  const handleCategoryChange = async (ticketId, newCategory) => {
    try {
      await api.put(`/tickets/${ticketId}/category`, {
        category: newCategory
      });
      fetchTickets();
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  // 🔹 Filtering
  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "All") return true;
    return ticket.status === filter;
  });

  return (
    <div className="ticket-card">
      <h2>My Assigned Tickets</h2>

      {/* 🔹 Filter Buttons */}
      <div className="ticket-filters">
        {["All", "Open", "In Progress", "Closed"].map((status) => (
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
        <ul className="ticket-list">
          {filteredTickets.map((ticket) => (
            <li
              key={ticket.id}
              className="ticket-item clickable"
              onClick={() => navigate(`/tickets/${ticket.id}`)}
            >
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>

              <p>
                <b>Created by:</b> {ticket.user_email || "Unknown"}
              </p>

              {/* 🔹 Status dropdown */}
              <label onClick={(e) => e.stopPropagation()}>
                <b>Status:</b>
                <select
                  className="ticket-input"
                  value={ticket.status}
                  onChange={(e) =>
                    handleStatusChange(ticket.id, e.target.value)
                  }
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </label>

              {/* 🔹 Category dropdown */}
              <label onClick={(e) => e.stopPropagation()}>
                <b>Category:</b>
                <select
                  className="ticket-input"
                  value={ticket.category}
                  onChange={(e) =>
                    handleCategoryChange(ticket.id, e.target.value)
                  }
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TechDashboard;
