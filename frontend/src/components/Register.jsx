import React, { useState } from "react";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";

const REGISTER_NOTES = [
  "Open a ticket once and keep replies, attachments, and status in the same place.",
  "The backend predicts issue type, support team, and starting priority automatically.",
  "You will register as a standard requester account. Technician and admin accounts are managed separately.",
];

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    setIsSubmitting(true);

    try {
      const response = await api.post("/register", { email, password });
      if (response.status === 200) {
        setMessage("Registration successful. Redirecting to login...");
        setTimeout(() => navigate("/login"), 1200);
      }
    } catch (err) {
      console.error(err);
      setMessage("Registration failed. Email may already exist.");
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ticket-card auth-card auth-hero-card">
      <div className="auth-grid">
        <section className="auth-panel auth-hero-panel">
          <div className="auth-eyebrow">Create Access</div>
          <h1 className="auth-title">Start with a cleaner request workflow from day one.</h1>
          <p className="auth-sub auth-sub-hero">
            Register a requester account to submit incidents, follow every update, and keep support communication attached to the ticket.
          </p>

          <div className="auth-feature-list">
            {REGISTER_NOTES.map((note) => (
              <div key={note} className="auth-feature-item">
                <strong>Included</strong>
                <p>{note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-panel auth-form-panel">
          <div className="auth-form-topline">
            <div className="auth-eyebrow">Register</div>
            <h2>Create a requester account</h2>
            <p className="auth-sub">This account is for submitting and following support tickets.</p>
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
                  placeholder="Create a password"
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
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          {message && (
            <p className={`ticket-message auth-message ${isError ? "error" : "success"}`}>
              {message}
            </p>
          )}

          <div className="auth-note">
            Requester accounts can create and track tickets immediately after sign-in.
          </div>

          <p className="auth-link-line">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

export default Register;
