import React from "react";
import { NavLink } from "react-router-dom";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">IT Support Desk</div>
          <div className="footer-sub">
            Internal ticketing | Faster triage | Clear communication
          </div>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <div className="footer-title">Navigation</div>
            <NavLink to="/about" className="footer-link">About</NavLink>
            <NavLink to="/tickets/new" className="footer-link">Submit Ticket</NavLink>
            <NavLink to="/mytickets" className="footer-link">My Tickets</NavLink>
          </div>

          <div className="footer-col">
            <div className="footer-title">Support</div>
            <div className="footer-meta">Internal IT Support Portal</div>
            <div className="footer-meta">For employees only</div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>(c) {year} IT Support Desk</span>
        <span className="footer-dot">|</span>
        <span className="footer-meta">Built for internal use</span>
      </div>
    </footer>
  );
}

export default Footer;
