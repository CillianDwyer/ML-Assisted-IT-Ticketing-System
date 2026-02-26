import React, { useState } from "react";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";

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
    <div className="ticket-card auth-card">
      <section className="auth-panel auth-form-panel">
        <h2>Login</h2>
        <p className="auth-sub">Access your support workspace.</p>

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
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {error && <p className="ticket-message error">{error}</p>}

        <p className="auth-link-line">
          No account? <Link to="/register">Register</Link>
        </p>
      </section>
    </div>
  );
}

export default Login;
