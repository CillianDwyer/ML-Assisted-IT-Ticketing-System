import React, { useState } from "react";
import api from "../api";
import PageHeader from "./PageHeader";

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
      await api.post("/tickets", {
        title,
        description,
        category: "Uncategorized",
        status: "Open",
      });

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
      <PageHeader
        title="Submit Ticket"
        subtitle="Capture issue details once. The system handles classification and assignment."
      />
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
