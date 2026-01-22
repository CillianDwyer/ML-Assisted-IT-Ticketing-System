import React, { useEffect, useState } from "react";
import api from "../api";

function AdminDashboard() {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  // Categories supported by ML + system
  const categories = ["Hardware", "Software", "Network", "Password Reset","Access"];

  // Load all tickets + list of technicians
  useEffect(() => {
    const fetchData = async () => {
      try {
        const ticketsRes = await api.get("/tickets/all");
        setTickets(ticketsRes.data);

        const usersRes = await api.get("/users");
        const techs = usersRes.data.filter(
          (u) => u.role === "technician"
        );
        setTechnicians(techs);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      }
    };

    fetchData();
  }, []);

  // Assign technician to a ticket
  const assignTicket = async (ticketId, technicianId) => {
    try {
      await api.put(`/tickets/${ticketId}/assign/${technicianId}`);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, technician_id: technicianId }
            : t
        )
      );
    } catch (error) {
      console.error("Error assigning ticket:", error);
      alert("Failed to assign ticket.");
    }
  };

  // Update ticket category (ML override)
  const updateCategory = async (ticketId, category) => {
    try {
      await api.put(`/tickets/${ticketId}/category`, { category });
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, category } : t
        )
      );
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Failed to update category.");
    }
  };

  return (
    <div className="ticket-card dashboard-card">
      <h2>Admin Dashboard</h2>
      <p>View, assign, and manage all tickets.</p>

      {tickets.length === 0 ? (
        <p>No tickets found.</p>
      ) : (
        <table className="ticket-table">
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
                <td>{t.title}</td>
                <td>{t.user_email || "Unknown"}</td>
                <td>{t.technician_email || "Unassigned"}</td>
                <td>{t.status}</td>

                {/* 🔹 Category override (human-in-the-loop) */}
                <td>
                  <select
                    value={t.category}
                    onChange={(e) =>
                      updateCategory(t.id, e.target.value)
                    }
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>

                {/* 🔹 Technician assignment */}
                <td>
                  <select
                    defaultValue=""
                    onChange={(e) =>
                      assignTicket(t.id, e.target.value)
                    }
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
      )}
    </div>
  );
}

export default AdminDashboard;
