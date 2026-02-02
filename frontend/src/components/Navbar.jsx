import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../api";

function Navbar() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const email = localStorage.getItem("email") || "Account";

  const navigate = useNavigate();

  const [showConfirm, setShowConfirm] = useState(false);

  // User menu dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Notifications dropdown
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);

  // 🌙 Dark mode state
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  // Apply saved theme on first load
  useEffect(() => {
    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark");
    }
  }, []);

  // Helper: nicer role label
  const roleLabel =
    role === "admin" ? "Admin" : role === "technician" ? "Technician" : "User";

  // ---- Notifications: API calls ----
  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const res = await api.get("/notifications/unread-count");
      setNotifCount(res.data?.count ?? 0);
    } catch {
      // silent (polling)
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    setNotifLoading(true);
    try {
      const res = await api.get("/notifications?limit=20");
      setNotifications(res.data || []);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    } finally {
      setNotifLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Failed to mark all read:", e);
    }
  };

  const openNotification = async (n) => {
    try {
      if (!n.is_read) {
        await api.put(`/notifications/${n.id}/read`);
      }
    } catch {
      // ignore
    }

    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
    );

    fetchUnreadCount();
    setNotifOpen(false);

    if (n.ticket_id) navigate(`/tickets/${n.ticket_id}`);
  };

  // Poll unread count every 15 seconds
  useEffect(() => {
    if (!token) {
      setNotifCount(0);
      setNotifications([]);
      return;
    }

    fetchUnreadCount(); // initial
    const id = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(id);
  }, [token]);

  // Load list when opening dropdown
  useEffect(() => {
    if (notifOpen) fetchNotifications();
  }, [notifOpen]);

  // Close dropdowns on outside click / Esc
  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };

    const onEsc = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (newMode) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Logout logic
  const handleLogout = () => {
    setShowConfirm(false);
    setMenuOpen(false);
    setNotifOpen(false);

    setTimeout(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("email");
      navigate("/login");
    }, 200);
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-inner">
          {/* LEFT: Navigation links */}
          <ul className="nav-list">
            {token && (
              <>
                <li>
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      isActive ? "nav-item active" : "nav-item"
                    }
                  >
                    Submit Ticket
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/mytickets"
                    className={({ isActive }) =>
                      isActive ? "nav-item active" : "nav-item"
                    }
                  >
                    My Tickets
                  </NavLink>
                </li>

                {role === "admin" && (
                  <li>
                    <NavLink
                      to="/admin"
                      className={({ isActive }) =>
                        isActive ? "nav-item active" : "nav-item"
                      }
                    >
                      Admin Dashboard
                    </NavLink>
                  </li>
                )}

                {role === "technician" && (
                  <li>
                    <NavLink
                      to="/tech"
                      className={({ isActive }) =>
                        isActive ? "nav-item active" : "nav-item"
                      }
                    >
                      My Assignments
                    </NavLink>
                  </li>
                )}
              </>
            )}

            <li>
              <NavLink
                to="/about"
                className={({ isActive }) =>
                  isActive ? "nav-item active" : "nav-item"
                }
              >
                About
              </NavLink>
            </li>

            {!token && (
              <>
                <li>
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      isActive ? "nav-item active" : "nav-item"
                    }
                  >
                    Login
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/register"
                    className={({ isActive }) =>
                      isActive ? "nav-item active" : "nav-item"
                    }
                  >
                    Register
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          {/* RIGHT: Actions */}
          <div className="nav-actions">
            {/* 🔔 Notifications (only when logged in) */}
            {token && (
              <div className="notif-wrap" ref={notifRef}>
                <button
                  className="notif-btn"
                  title="Notifications"
                  onClick={() => {
                    setMenuOpen(false);
                    setNotifOpen((v) => !v);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={notifOpen}
                >
                  🔔
                  {notifCount > 0 && (
                    <span className="notif-badge">
                      {notifCount > 99 ? "99+" : notifCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="notif-dropdown" role="menu">
                    <div className="notif-header">
                      <span>Notifications</span>
                      <button
                        className="notif-clear"
                        onClick={markAllRead}
                        disabled={notifCount === 0}
                        title="Mark all as read"
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="notif-list">
                      {notifLoading ? (
                        <div className="notif-empty">Loading…</div>
                      ) : notifications.length === 0 ? (
                        <div className="notif-empty">No notifications yet.</div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            className={`notif-item ${n.is_read ? "" : "unread"}`}
                            onClick={() => openNotification(n)}
                            role="menuitem"
                          >
                            <div className="notif-text">{n.content}</div>
                            <div className="notif-time">
                              {new Date(n.created_at).toLocaleString()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User menu (only when logged in) */}
            {token && (
              <div className="user-menu" ref={menuRef}>
                <button
                  className="user-chip"
                  onClick={() => {
                    setNotifOpen(false);
                    setMenuOpen((v) => !v);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Account menu"
                >
                  <span className="user-email">{email}</span>
                  <span className="user-role">{roleLabel}</span>
                  <span className="user-caret">{menuOpen ? "▲" : "▼"}</span>
                </button>

                {menuOpen && (
                  <div className="user-dropdown" role="menu">
                    <div className="user-dropdown-header">
                      <div className="user-dropdown-email">{email}</div>
                      <div className="user-dropdown-role">{roleLabel}</div>
                    </div>

                    <div className="user-dropdown-divider" />

                    {/* Quick links */}
                    <button
                      className="user-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/mytickets");
                      }}
                      role="menuitem"
                    >
                      My Tickets
                    </button>

                    {role === "admin" && (
                      <button
                        className="user-dropdown-item"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/admin");
                        }}
                        role="menuitem"
                      >
                        Admin Dashboard
                      </button>
                    )}

                    {role === "technician" && (
                      <button
                        className="user-dropdown-item"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/tech");
                        }}
                        role="menuitem"
                      >
                        My Assignments
                      </button>
                    )}

                    <div className="user-dropdown-divider" />

                    <button
                      className="user-dropdown-item danger"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowConfirm(true);
                      }}
                      role="menuitem"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 🌙 Theme toggle */}
            <button
              onClick={toggleDarkMode}
              className="theme-toggle"
              title="Toggle dark mode"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </nav>

      {/* 🔐 Logout Confirmation */}
      {showConfirm && (
        <div className="logout-overlay">
          <div className="logout-popup">
            <h3>Are you sure you want to logout?</h3>
            <div className="logout-buttons">
              <button className="yes-btn" onClick={handleLogout}>
                Yes
              </button>
              <button className="no-btn" onClick={() => setShowConfirm(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
