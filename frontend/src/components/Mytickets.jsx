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

const STATUSES = ["All", "Open", "In Progress", "Closed"];

function statusClassName(status) {
  if (status === "In Progress") return "in-progress";
  return (status || "open").toLowerCase();
}

function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState("All");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await api.get("/tickets");
        setTickets(response.data || []);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };
    fetchTickets();
  }, []);

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "All") return true;
    return ticket.status === filter;
  });

  return (
    <div className="ticket-card dashboard-card">
      <PageHeader
        title="My Tickets"
        subtitle="Track current progress and open a ticket to continue the thread."
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
                <th>Status</th>
                <th>Category</th>
                <th>Priority</th>
                <th>SLA</th>
                <th>Updated</th>
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
                  <td>
                    <span className={`status-badge ${statusClassName(ticket.status)}`}>
                      {ticket.status || "Open"}
                    </span>
                  </td>
                  <td>{ticket.category || "Uncategorized"}</td>
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
                  <td>
                    {ticket.updated_at
                      ? new Date(ticket.updated_at).toLocaleString()
                      : "-"}
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

export default MyTickets;
