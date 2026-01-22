import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const currentUserEmail = localStorage.getItem("email");

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
      setMessages(res.data);
    } catch (err) {
      console.error("Error loading messages", err);
    }
  };

  useEffect(() => {
    fetchTicket();
    fetchMessages();
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await api.post(`/tickets/${id}/messages`, {
        content: newMessage
      });

      setNewMessage("");
      fetchMessages();
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  if (!ticket) return <p>Loading ticket...</p>;

  return (
    <div className="ticket-card">

      {/* 🔙 Back Button */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* 🎫 Ticket Details */}
      <div className="ticket-details">
        <h2>{ticket.title}</h2>
        <p>{ticket.description}</p>

        <div className="ticket-meta">
          <span><b>Status:</b> {ticket.status}</span>
          <span><b>Category:</b> {ticket.category}</span>
          <span>
            <b>Assigned to:</b>{" "}
            {ticket.technician_email || "Unassigned"}
          </span>
        </div>
      </div>

      <hr />

      {/* 💬 Conversation */}
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
                className={`chat-message ${isMine ? "left" : "right"}`}
              >
                <div className="chat-sender">{msg.sender_email}</div>
                <div className="chat-content">{msg.content}</div>
                <div className="chat-time">
                  {new Date(msg.created_at).toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✍ Message Input */}
      <textarea
        className="ticket-input"
        placeholder="Type your message..."
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        rows={3}
      />

      <button className="ticket-button" onClick={sendMessage}>
        Send Message
      </button>
    </div>
  );
}

export default TicketDetails;
