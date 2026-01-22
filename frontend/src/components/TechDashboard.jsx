import React, { useEffect, useState } from "react";
import api from "../api";

function TechDashboard() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");

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

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await api.put(`/tickets/${ticketId}/status`, { status: newStatus });
      fetchTickets();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "All") return true;
    return ticket.status === filter;
  });

  return (
    <div className="ticket-card">
      <h2>My Assigned Tickets</h2>

      {/* Filters */}
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
            <li key={ticket.id} className="ticket-item">
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>
              <p><b>Category:</b> {ticket.category}</p>
              <p><b>Created by:</b> {ticket.user_email || "Unknown"}</p>
              <p><b>Status:</b> {ticket.status}</p>

              <select
                value={ticket.status}
                onChange={(e) =>
                  handleStatusChange(ticket.id, e.target.value)
                }
                className="ticket-input"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TechDashboard;
