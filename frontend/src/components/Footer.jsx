import React from "react";
import { NavLink } from "react-router-dom";

function Footer() {
  const year = new Date().getFullYear();
  const isAuthed = Boolean(localStorage.getItem("token"));
  const role = localStorage.getItem("role");

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">IT Support Desk</div>
          <div className="footer-sub">
            Internal ticketing • Faster triage • Clear communication
          </div>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <div className="footer-title">Navigation</div>
            <NavLink to="/about" className="footer-link">About</NavLink>

            {isAuthed && (
              <>
                <NavLink to="/" className="footer-link">Submit Ticket</NavLink>
                <NavLink to="/mytickets" className="footer-link">My Tickets</NavLink>
              </>
            )}
          </div>

          {isAuthed && (
            <div className="footer-col">
              <div className="footer-title">Dashboard</div>
              {role === "admin" && (
                <NavLink to="/admin" className="footer-link">Admin Dashboard</NavLink>
              )}
              {role === "technician" && (
                <NavLink to="/tech" className="footer-link">My Assignments</NavLink>
              )}
              <div className="footer-meta">Signed in as: {localStorage.getItem("email")}</div>
            </div>
          )}

          <div className="footer-col">
            <div className="footer-title">Support</div>
            <div className="footer-meta">Hours: Mon–Fri, 9:00–17:30</div>
            <div className="footer-meta">Response targets: P1 1h • P2 4h • P3 1d</div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {year} IT Support Desk</span>
        <span className="footer-dot">•</span>
        <span className="footer-meta">v0.1</span>
      </div>
    </footer>
  );
}

export default Footer;
