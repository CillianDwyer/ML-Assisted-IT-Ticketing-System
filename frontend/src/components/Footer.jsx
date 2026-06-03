import React from "react";
import { NavLink } from "react-router-dom";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-compact">
        <div className="footer-brand">
          <div className="footer-logo">IT Support Desk</div>
          <div className="footer-sub">Internal ticketing · Faster triage · Clear communication</div>
        </div>

        <div className="footer-compact-right">
          <NavLink to="/about" className="footer-link">About</NavLink>
          <NavLink to="/tickets/new" className="footer-link">Submit Ticket</NavLink>
          <NavLink to="/mytickets" className="footer-link">My Tickets</NavLink>
          <span className="footer-meta">(c) {year}</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
