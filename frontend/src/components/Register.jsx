import React, { useState } from "react";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";

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
    <div className="ticket-card auth-card">
      <section className="auth-panel auth-form-panel">
        <h2>Create an Account</h2>
        <p className="auth-sub">Register a standard user account for support requests.</p>

        <form className="ticket-form" onSubmit={handleSubmit}>
          <input
            className="ticket-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="auth-password-row">
            <input
              className="ticket-input"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
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

          <button className="ticket-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        {message && (
          <p className={`ticket-message ${isError ? "error" : "success"}`}>
            {message}
          </p>
        )}

        <p className="auth-link-line">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </section>
    </div>
  );
}

export default Register;
