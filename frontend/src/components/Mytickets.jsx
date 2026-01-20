import React, { useEffect, useState } from "react";
import api from "../api";

function MyTickets() {
  const [tickets, setTickets] = useState([]);

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

  return (
    <div className="ticket-card">
      <h2>My Submitted Tickets</h2>
      {tickets.length === 0 ? (
        <p>No tickets submitted yet.</p>
      ) : (
        <ul className="ticket-list">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="ticket-item">
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>
              <p>Status: {ticket.status ? ticket.status : "Pending"}</p>
              <p>Category: {ticket.category ? ticket.category : "Uncategorized"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyTickets;
