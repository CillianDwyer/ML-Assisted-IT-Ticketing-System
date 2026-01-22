import React, { useEffect, useState } from "react";
import api from "../api";

function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await api.get("/tickets");
        setTickets(response.data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };
    fetchTickets();
  }, []);

  // 🔹 Filter logic
  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "All") return true;
    return ticket.status === filter;
  });

  return (
    <div className="ticket-card">
      <h2>My Submitted Tickets</h2>

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
            <li key={ticket.id} className="ticket-item">
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>
              <p>
                <b>Status:</b> {ticket.status || "Pending"}
              </p>
              <p>
                <b>Category:</b> {ticket.category || "Uncategorized"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyTickets;
