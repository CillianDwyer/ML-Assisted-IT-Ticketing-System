import React, { useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await api.post("/register", { email, password });
      if (response.status === 200) {
        setMessage("Registration successful! Redirecting to login...");
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch (err) {
      setMessage("Registration failed. Email may already exist.");
      console.error(err);
    }
  };

  return (
    <div className="ticket-card">
      <h2>Create an Account</h2>
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
        <button className="ticket-button" type="submit">
          Register
        </button>
      </form>
      {message && <p className="ticket-message">{message}</p>}
    </div>
  );
}

export default Register;
