import React, { useState } from "react";
import api from "../api";

function TicketForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e) => {
  e.preventDefault();
  setMessage("");
  setIsError(false);

  try {
    console.log("Posting ticket to:", "http://127.0.0.1:8000/tickets");

    const response = await fetch("http://127.0.0.1:8000/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        title,
        description,
        category: "Uncategorized",
        status: "Open",
      }),
    });

    const data = await response.json();
    console.log("Backend response:", data);

    if (!response.ok) throw new Error(JSON.stringify(data));

    setMessage("Ticket submitted successfully!");
    setTitle("");
    setDescription("");
  } catch (error) {
    console.error("Error submitting ticket:", error);
    setMessage("Error submitting ticket");
    setIsError(true);
  }
};


  return (
    <div className="ticket-card">
      <h2>Submit IT Support Ticket</h2>
      <form className="ticket-form" onSubmit={handleSubmit}>
        <input
          className="ticket-input"
          type="text"
          placeholder="Issue Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="ticket-input"
          placeholder="Describe your issue"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={5}
        />
        <button className="ticket-button" type="submit">
          Submit Ticket
        </button>
      </form>
      {message && (
        <p className={`ticket-message ${isError ? "error" : "success"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export default TicketForm;
