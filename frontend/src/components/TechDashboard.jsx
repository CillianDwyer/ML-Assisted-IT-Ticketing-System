import React, { useEffect, useState } from "react";
import api from "../api";

function TechDashboard() {
  const [tickets, setTickets] = useState([]);

  // Categories supported by the system
  const categories = ["Hardware", "Software", "Network","Password Reset","Access"];

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

  // Update ticket status
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await api.put(`/tickets/${ticketId}/status`, { status: newStatus });
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, status: newStatus } : t
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Update ticket category (ML override)
  const handleCategoryChange = async (ticketId, category) => {
    try {
      await api.put(`/tickets/${ticketId}/category`, { category });
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, category } : t
        )
      );
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Failed to update category");
    }
  };

  return (
    <div className="ticket-card">
      <h2>My Assigned Tickets</h2>

      {tickets.length === 0 ? (
        <p>No tickets assigned yet.</p>
      ) : (
        <ul className="ticket-list">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="ticket-item">
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>

              {/* Category override */}
              <p>
                <b>Category:</b>{" "}
                <select
                  value={ticket.category}
                  onChange={(e) =>
                    handleCategoryChange(ticket.id, e.target.value)
                  }
                  className="ticket-input"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </p>

              <p>
                <b>Created by:</b> {ticket.user_email || "Unknown"}
              </p>

              {/* Status update */}
              <p>
                <b>Status:</b>{" "}
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
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TechDashboard;
