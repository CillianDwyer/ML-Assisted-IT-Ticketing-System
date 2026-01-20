import React, { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const response = await api.post("/login", formData);
      // Save token and role
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("role", response.data.user.role);
      localStorage.setItem("email", response.data.user.email);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid credentials or server error.");
    }
  };

  return (
    <div className="ticket-card">
      <h2>Login</h2>
      <form className="ticket-form" onSubmit={handleSubmit}>
        <input
          className="ticket-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="ticket-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="ticket-button" type="submit">Login</button>
      </form>
      {error && <p className="ticket-message error">{error}</p>}
    </div>
  );
}

export default Login;
