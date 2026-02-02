import React from "react";

function About() {
  return (
    <div className="ticket-card">
      <h2>About the System</h2>

      <p>
        This application is an internal IT support ticketing system designed to
        simplify how technical issues are reported, assigned, and resolved. It
        supports role-based access for users, technicians, and administrators,
        with machine learning used to assist ticket categorisation.
      </p>

      <h3>Key Features</h3>
      <ul className="about-list">
        <li><b>Secure authentication:</b> login/register with token-based access</li>
        <li><b>Role-based access:</b> different dashboards for users, technicians, and admins</li>
        <li><b>ML-assisted categorisation:</b> predicts ticket category from the description</li>
        <li><b>Technician routing:</b> auto-assign by speciality with admin override</li>
        <li><b>Ticket lifecycle:</b> Open → In Progress → Closed</li>
        <li><b>Conversation thread:</b> messaging inside each ticket</li>
        <li><b>Admin dashboard:</b> view all tickets, assign technicians, and override category</li>
        <li><b>Modern UI:</b> responsive layout and optional dark mode</li>
      </ul>

      <h3>Architecture Overview</h3>

      <pre className="arch-diagram">
{`User / Technician / Admin
          |
          v
React Frontend (Routes + Components)
          |
          v
FastAPI Backend (Auth + RBAC + Ticket Logic)
      |                     |
      v                     v
SQLite Database         ML Classifier
(Tickets, Users,        (Category prediction
 Messages)               from description)`}
      </pre>

      <p className="muted">
        This project was developed for learning and demonstration purposes.
      </p>
    </div>
  );
}

export default About;
