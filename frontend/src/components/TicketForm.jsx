import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import SectionCard from "./SectionCard";
import PageHeader from "./PageHeader";

const PROMPTS = [
  "What stopped working, and what were you trying to do?",
  "When did the issue start, and is it still happening now?",
  "Which device, system, app, or location is affected?",
  "Include any exact error message if you have one.",
];

const EXAMPLES = [
  "VPN disconnects after login from my home laptop since this morning.",
  "Outlook opens, but my mailbox is not syncing and new emails are missing.",
  "The printer on floor 2 shows paper jam even after clearing the tray.",
];

function TicketForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState(null);

  const descriptionWordCount = useMemo(() => {
    return description.trim() ? description.trim().split(/\s+/).length : 0;
  }, [description]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setMessage("");
    setIsError(false);
    setCreatedTicketId(null);
    setIsSubmitting(true);

    try {
      const res = await api.post("/tickets", { title, description });
      setCreatedTicketId(res.data?.id ?? null);
      setMessage("Ticket submitted successfully!");
      setTitle("");
      setDescription("");
    } catch (error) {
      console.error("Error submitting ticket:", error);
      setMessage(
        error?.response?.data?.detail || "Unable to submit ticket. Please try again."
      );
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ticket-card submit-ticket-card">
      <PageHeader
        title="Submit Ticket"
        subtitle="Describe the issue once. The system predicts issue type, assigns the right team, and sets priority automatically."
      />

      <div className="submit-ticket-grid">
        <SectionCard className="submit-ticket-panel submit-ticket-guide">
          <div className="submit-ticket-eyebrow">Before you send it</div>
          <h3>Write the ticket like a handoff.</h3>
          <p>
            Good tickets help the classifier route faster and help technicians act
            without asking basic follow-up questions.
          </p>

          <div className="submit-ticket-checklist">
            {PROMPTS.map((prompt) => (
              <div key={prompt} className="submit-ticket-check">
                <span className="submit-ticket-check-mark">+</span>
                <span>{prompt}</span>
              </div>
            ))}
          </div>

          <div className="submit-ticket-note">
            <strong>What happens next</strong>
            <p>
              After submission, the backend predicts an issue type, maps it to a
              support team, calculates priority, and opens the ticket thread. If
              the description is too vague, the ticket can stay uncategorized for
              manual review instead of being routed badly.
            </p>
          </div>
        </SectionCard>

        <SectionCard className="submit-ticket-panel submit-ticket-form-panel">
          <form className="ticket-form" onSubmit={handleSubmit}>
            <label className="submit-ticket-field">
              <span>Issue title</span>
              <input
                className="ticket-input"
                type="text"
                placeholder="Short summary of the problem"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label className="submit-ticket-field">
              <span>Issue description</span>
              <textarea
                className="ticket-input submit-ticket-textarea"
                placeholder="Describe what broke, when it started, what system is affected, and any error message."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={8}
              />
            </label>

            <div className="submit-ticket-meta">
              <span>{descriptionWordCount} words</span>
              <span>
                Tip: mention the device, app, location, and exact error text if known.
              </span>
            </div>

            <div className="submit-ticket-examples">
              <strong>Example descriptions</strong>
              <ul>
                {EXAMPLES.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>

            <button className="ticket-button submit-ticket-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Create Ticket"}
            </button>
          </form>

          {message && (
            <p className={`ticket-message ${isError ? "error" : "success"}`}>
              {message}
              {!isError && createdTicketId != null && (
                <> <Link to={`/tickets/${createdTicketId}`}>View Ticket #{createdTicketId}</Link></>
              )}
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default TicketForm;
