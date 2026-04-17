import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import SectionCard from "./SectionCard";
import { getPriorityExplanation } from "../utils/ticketVisuals";

function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [ticketError, setTicketError] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [assistUsers, setAssistUsers] = useState([]);
  const [isPrivateMessage, setIsPrivateMessage] = useState(false);
  const [privateRecipientEmail, setPrivateRecipientEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const currentUserEmail = localStorage.getItem("email");
  const currentUserRole = localStorage.getItem("role");
  const canSendPrivateAssist =
    currentUserRole === "technician" || currentUserRole === "admin";

  const fetchTicket = async () => {
    setTicketError("");
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);
    } catch (err) {
      console.error("Error loading ticket", err);
      setTicket(null);
      const status = err.response?.status;
      if (status === 403) {
        setTicketError("You do not have access to this ticket.");
      } else if (status === 404) {
        setTicketError("This ticket could not be found.");
      } else {
        setTicketError("Ticket details could not be loaded. Please try again.");
      }
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
  }, [id]);

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;
    if (isPrivateMessage && !privateRecipientEmail) return;

    try {
      const formData = new FormData();
      formData.append("content", newMessage);
      if (isPrivateMessage) formData.append("private_to_email", privateRecipientEmail);
      if (selectedFile) formData.append("attachment", selectedFile);

      await api.post(`/tickets/${id}/messages/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setNewMessage("");
      setIsPrivateMessage(false);
      setPrivateRecipientEmail("");
      setSelectedFile(null);
      fetchMessages();
      fetchTicket();
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  const downloadAttachment = async (messageId, attachmentName) => {
    try {
      const res = await api.get(`/tickets/${id}/messages/${messageId}/attachment`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = attachmentName || "attachment";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading attachment", err);
    }
  };

  const handleMessageKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
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

  const priorityExplanation = useMemo(
    () => (ticket ? getPriorityExplanation(ticket) : null),
    [ticket]
  );

  const statusClass = (ticket?.status || "open").toLowerCase().replace(/\s+/g, "-");
  const priorityClass = (priorityExplanation?.currentPriority || ticket?.priority || "medium")
    .toLowerCase()
    .replace(/\s+/g, "-");

  if (ticketError) {
    return (
      <div className="ticket-card dashboard-card ticket-workspace-shell">
        <PageHeader
          title="Ticket unavailable"
          subtitle={ticketError}
          action={
            <button className="page-header-action" onClick={() => navigate(-1)}>
              Go Back
            </button>
          }
        />
      </div>
    );
  }

  if (!ticket) return <p>Loading ticket...</p>;

  return (
    <div className="ticket-card dashboard-card ticket-workspace-shell">
      <PageHeader
        title={`Ticket #${ticket.id}`}
        subtitle={ticket.title}
        action={
          <button className="page-header-action" onClick={() => navigate(-1)}>
            Back to Tickets
          </button>
        }
      />

      <div className="ticket-workspace-hero">
        <div className="ticket-workspace-topline">
          <button className="ticket-breadcrumb" onClick={() => navigate(-1)}>
            My Tickets / Ticket #{ticket.id}
          </button>
          <span className="ticket-context-note">Ticket conversation</span>
        </div>
        <div className="ticket-summary-strip">
          <div className="ticket-summary-card">
            <span className="ticket-summary-label">Status</span>
            <span className={`status-badge ${statusClass}`}>{ticket.status}</span>
          </div>
          <div className="ticket-summary-card">
            <span className="ticket-summary-label">Priority</span>
            <span className={`priority-badge ${priorityClass}`}>
              {priorityExplanation?.currentPriority || ticket.priority || "Medium"}
            </span>
          </div>
          <div className="ticket-summary-card">
            <span className="ticket-summary-label">Team</span>
            <strong>{ticket.team || "Unassigned"}</strong>
          </div>
          <div className="ticket-summary-card">
            <span className="ticket-summary-label">Issue Type</span>
            <strong>{ticket.category}</strong>
          </div>
          <div className="ticket-summary-card">
            <span className="ticket-summary-label">Assigned To</span>
            <strong>{ticket.technician_email || "Unassigned"}</strong>
          </div>
        </div>
      </div>

      <div className={`workspace-grid ticket-details-layout ${detailsOpen ? "details-open" : ""}`}>
        <section className="workspace-main">
          <SectionCard className="panel-card conversation-panel">
            <div className="conversation-header">
              <div>
                <h3>Conversation</h3>
                <p>
                  {messages.length === 0
                    ? "No replies yet. Your next message will start the thread."
                    : `${messages.length} message${messages.length === 1 ? "" : "s"} in this ticket thread.`}
                </p>
              </div>
              <div className="conversation-header-meta">
                <span>Created {fmtDate(ticket.created_at)}</span>
                <span>Updated {fmtDate(ticket.updated_at)}</span>
              </div>
              <button
                type="button"
                className="details-toggle-btn"
                onClick={() => setDetailsOpen((open) => !open)}
                aria-expanded={detailsOpen}
                aria-controls="ticket-details-panel"
              >
                {detailsOpen ? "Hide ticket details" : "Show ticket details"}
              </button>
            </div>

            <div className="chat-box conversation-feed">
              <div className="chat-message left">
                <div className="chat-sender">Original ticket request</div>
                <div className="chat-content">
                  {ticket.description?.trim() || "No description was provided for this ticket."}
                </div>
                <div className="chat-time">{fmtDate(ticket.created_at)}</div>
              </div>

              {messages.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  description="The original issue is shown above. Use the composer below to add an update, ask for help, or attach a file related to this ticket."
                />
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
                      <div
                        className="chat-content"
                        onClick={
                          msg.attachment_name
                            ? () => downloadAttachment(msg.id, msg.attachment_name)
                            : undefined
                        }
                        style={{
                          cursor: msg.attachment_name ? "pointer" : "default",
                          textDecoration: msg.attachment_name ? "underline" : "none",
                        }}
                        title={msg.attachment_name ? "Click to download attachment" : ""}
                      >
                        {msg.attachment_name
                          ? `${msg.content || ""}${msg.content ? " | " : ""}${msg.attachment_name}`
                          : msg.content || "(empty message)"}
                      </div>
                      <div className="chat-time">{fmtDate(msg.created_at)}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="message-compose compose-dock">
              <textarea
                className="ticket-input"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleMessageKeyDown}
                rows={4}
              />
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />

              <div className="compose-private">
                <div className="compose-actions-row">
                  {canSendPrivateAssist ? (
                    <label className="compose-private-toggle">
                      <input
                        type="checkbox"
                        checked={isPrivateMessage}
                        onChange={(e) => setIsPrivateMessage(e.target.checked)}
                      />{" "}
                      Send as private assist message
                    </label>
                  ) : (
                    <span className="compose-hint">Messages in this thread are visible on the ticket.</span>
                  )}

                  <button
                    type="button"
                    onClick={openFilePicker}
                    title="Attach file"
                    aria-label="Attach file"
                    className="compose-attach-btn"
                  >
                    <span aria-hidden="true">&#128206;</span>
                  </button>
                </div>

                {selectedFile && <span className="compose-file-name">{selectedFile.name}</span>}

                {canSendPrivateAssist && isPrivateMessage && (
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

              <div className="compose-footer">
                <span className="compose-hint">
                  Private assist messages stay limited to the selected staff recipient.
                </span>
                <button className="ticket-button" onClick={sendMessage}>
                  Send Message
                </button>
              </div>
            </div>
          </SectionCard>
        </section>

        <aside
          id="ticket-details-panel"
          className={`workspace-side ticket-details-side ${detailsOpen ? "open" : ""}`}
        >
          <SectionCard title="Ticket Snapshot" className="panel-card">
            <div className="snapshot-list">
              <div>
                <span>Status</span>
                <strong>{ticket.status}</strong>
              </div>
              <div>
                <span>Team</span>
                <strong>{ticket.team || "Unassigned"}</strong>
              </div>
              <div>
                <span>Issue Type</span>
                <strong>{ticket.category}</strong>
              </div>
              <div>
                <span>Description</span>
                <strong>{ticket.description?.trim() || "No description provided"}</strong>
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
          </SectionCard>

          <SectionCard title="Routing and Priority" className="panel-card">
            {priorityExplanation ? (
              <div className="snapshot-list">
                <div>
                  <span>Current Priority</span>
                  <strong>{priorityExplanation.currentPriority}</strong>
                </div>
                <div>
                  <span>Base Priority</span>
                  <strong>{priorityExplanation.basePriority}</strong>
                </div>
                <div>
                  <span>Team Rule</span>
                  <strong>{priorityExplanation.team}</strong>
                </div>
                <div>
                  <span>Why This Team</span>
                  <strong>{priorityExplanation.reason}</strong>
                </div>
                <div>
                  <span>Age Escalation</span>
                  <strong>{priorityExplanation.escalation}</strong>
                </div>
              </div>
            ) : (
              <p>Explanation unavailable.</p>
            )}
          </SectionCard>

          <SectionCard title="Activity Timeline" className="panel-card">
            {timeline.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Ticket events and message activity will appear here."
              />
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
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

export default TicketDetails;
