import React, { useEffect, useState } from "react";
import api from "../api";

function AdminDashboard() {
  const [tickets, setTickets] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  // Load all tickets + list of technicians
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get all tickets
        const ticketsRes = await api.get("/tickets/all", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setTickets(ticketsRes.data);

        // Get all users (to find technicians)
        const usersRes = await api.get("/users", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const techs = usersRes.data.filter((u) => u.role === "technician");
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
      await api.put(
        `/tickets/${ticketId}/assign/${technicianId}`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      alert("Ticket assigned successfully!");
      window.location.reload();
    } catch (error) {
      console.error("Error assigning ticket:", error);
      alert("Failed to assign ticket.");
    }
  };

  return (
    <div className="ticket-card">
      <h2>Admin Dashboard</h2>
      <p>View and assign all tickets.</p>

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
        <td>{t.category}</td>
        <td>
          <select
            defaultValue=""
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


      )}
    </div>
  );
}

export default AdminDashboard;
