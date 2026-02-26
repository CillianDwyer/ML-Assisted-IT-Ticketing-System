import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PageHeader from "./PageHeader";

function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [assistUsers, setAssistUsers] = useState([]);
  const [isPrivateMessage, setIsPrivateMessage] = useState(false);
  const [privateRecipientEmail, setPrivateRecipientEmail] = useState("");

  const currentUserEmail = localStorage.getItem("email");
  const currentUserRole = localStorage.getItem("role");
  const canSendPrivateAssist =
    currentUserRole === "technician" || currentUserRole === "admin";

  const fetchTicket = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);
    } catch (err) {
      console.error("Error loading ticket", err);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/tickets/${id}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error("Error loading messages", err);
    }
  };

  const fetchAssistUsers = async () => {
    if (!canSendPrivateAssist) return;
    try {
      const res = await api.get(`/tickets/${id}/assist-users`);
      setAssistUsers(res.data || []);
    } catch (err) {
      console.error("Error loading assist users", err);
      setAssistUsers([]);
    }
  };

  useEffect(() => {
    fetchTicket();
    fetchMessages();
    fetchAssistUsers();
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    if (isPrivateMessage && !privateRecipientEmail) return;

    try {
      await api.post(`/tickets/${id}/messages`, {
        content: newMessage,
        private_to_email: isPrivateMessage ? privateRecipientEmail : null,
      });

      setNewMessage("");
      setIsPrivateMessage(false);
      setPrivateRecipientEmail("");
      fetchMessages();
      fetchTicket();
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  const handleMessageKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const timeline = useMemo(() => {
    if (!ticket) return [];

    const items = [
      {
        key: `created-${ticket.id}`,
        time: ticket.created_at,
        label: "Ticket created",
        detail: `Status: ${ticket.status}`,
      },
      ...messages.map((msg) => ({
        key: `msg-${msg.id}`,
        time: msg.created_at,
        label: msg.is_private ? "Private assist message" : "Message added",
        detail: `${msg.sender_email}${msg.recipient_email ? ` -> ${msg.recipient_email}` : ""}`,
      })),
    ];

    if (ticket.closed_at) {
      items.push({
        key: `closed-${ticket.id}`,
        time: ticket.closed_at,
        label: "Ticket closed",
        detail: "Marked as Closed",
      });
    }

    return items
      .slice()
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [ticket, messages]);

  if (!ticket) return <p>Loading ticket...</p>;

  return (
    <div className="ticket-card dashboard-card">
      <PageHeader
        title={`Ticket #${ticket.id}`}
        subtitle={ticket.title}
        action={
          <button className="page-header-action" onClick={() => navigate(-1)}>
            Back
          </button>
        }
      />

      <div className="workspace-grid">
        <section className="workspace-main">
          <div className="panel-card">
            <h3>Conversation</h3>
            <div className="chat-box">
              {messages.length === 0 ? (
                <p>No messages yet.</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_email === currentUserEmail;

                  return (
                    <div
                      key={msg.id}
                      className={`chat-message ${isMine ? "left" : "right"} ${
                        msg.is_private ? "private-msg" : ""
                      }`}
                    >
                      <div className="chat-sender">{msg.sender_email}</div>
                      {msg.is_private && (
                        <div className="private-badge">
                          Private
                          {msg.recipient_email ? ` to ${msg.recipient_email}` : ""}
                        </div>
                      )}
                      <div className="chat-content">{msg.content}</div>
                      <div className="chat-time">{fmtDate(msg.created_at)}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="message-compose">
              <textarea
                className="ticket-input"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleMessageKeyDown}
                rows={3}
              />

              {canSendPrivateAssist && (
                <div className="compose-private">
                  <label>
                    <input
                      type="checkbox"
                      checked={isPrivateMessage}
                      onChange={(e) => setIsPrivateMessage(e.target.checked)}
                    />{" "}
                    Send as private assist message
                  </label>

                  {isPrivateMessage && (
                    <select
                      className="ticket-input"
                      value={privateRecipientEmail}
                      onChange={(e) => setPrivateRecipientEmail(e.target.value)}
                    >
                      <option value="">Select technician/admin recipient</option>
                      {assistUsers.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.email} ({u.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <button className="ticket-button" onClick={sendMessage}>
                Send Message
              </button>
            </div>
          </div>
        </section>

        <aside className="workspace-side">
          <div className="panel-card">
            <h3>Ticket Snapshot</h3>
            <div className="snapshot-list">
              <div>
                <span>Status</span>
                <strong>{ticket.status}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{ticket.category}</strong>
              </div>
              <div>
                <span>Assigned To</span>
                <strong>{ticket.technician_email || "Unassigned"}</strong>
              </div>
              <div>
                <span>Created</span>
                <strong>{fmtDate(ticket.created_at)}</strong>
              </div>
              <div>
                <span>Last Updated</span>
                <strong>{fmtDate(ticket.updated_at)}</strong>
              </div>
              <div>
                <span>Closed At</span>
                <strong>{fmtDate(ticket.closed_at)}</strong>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <h3>Activity Timeline</h3>
            {timeline.length === 0 ? (
              <p>No activity yet.</p>
            ) : (
              <ul className="timeline-list">
                {timeline.map((item) => (
                  <li key={item.key}>
                    <div className="timeline-head">{item.label}</div>
                    <div className="timeline-detail">{item.detail}</div>
                    <div className="timeline-time">{fmtDate(item.time)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default TicketDetails;
