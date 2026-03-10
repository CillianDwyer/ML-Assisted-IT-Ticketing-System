import React, { useState } from "react";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";

const ROLE_ITEMS = [
  { label: "Users", detail: "Submit incidents, track replies, and keep one ticket thread per issue." },
  { label: "Technicians", detail: "Work assigned queues, send assist messages, and keep SLA risk visible." },
  { label: "Admins", detail: "Review workload, reroute issues, and monitor operations in one place." },
];

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const formData = new URLSearchParams();
      formData.append("username", email.trim());
      formData.append("password", password);

      const response = await api.post("/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      // Save token and role
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("role", response.data.user.role);
      localStorage.setItem("email", response.data.user.email);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      if (err?.code === "ECONNABORTED") {
        setError("Login request timed out. Check backend server and try again.");
      } else if (err?.code === "ERR_NETWORK") {
        setError("Cannot reach backend server. Check API URL, backend status, and CORS settings.");
      } else if (err?.response?.status === 401) {
        setError("Invalid email or password.");
      } else if (err?.response?.data?.detail) {
        setError(String(err.response.data.detail));
      } else {
        setError("Login failed. Check backend server and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ticket-card auth-card auth-hero-card">
      <div className="auth-grid">
        <section className="auth-panel auth-hero-panel">
          <div className="auth-eyebrow">Support Workspace</div>
          <h1 className="auth-title">Keep requests, ownership, and resolution in one place.</h1>
          <p className="auth-sub auth-sub-hero">
            Sign in to route tickets faster, work the queue cleanly, and keep every update attached to the ticket thread.
          </p>

          <div className="auth-stat-strip">
            <div className="auth-stat-card">
              <span>Roles</span>
              <strong>3 workspaces</strong>
            </div>
            <div className="auth-stat-card">
              <span>Threaded support</span>
              <strong>One ticket, one history</strong>
            </div>
          </div>

          <div className="auth-feature-list">
            {ROLE_ITEMS.map((item) => (
              <div key={item.label} className="auth-feature-item">
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-panel auth-form-panel">
          <div className="auth-form-topline">
            <div className="auth-eyebrow">Login</div>
            <h2>Access your support workspace</h2>
            <p className="auth-sub">Use your assigned account to continue where your queue left off.</p>
          </div>

          <form className="ticket-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Email</span>
              <input
                className="ticket-input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Password</span>
              <div className="auth-password-row">
                <input
                  className="ticket-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button className="ticket-button auth-submit-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {error && <p className="ticket-message error auth-message">{error}</p>}

          <div className="auth-note">
            Demo staff accounts are seeded by the backend. Regular end users can create their own support account.
          </div>

          <p className="auth-link-line">
            No account? <Link to="/register">Create one</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default Login;
