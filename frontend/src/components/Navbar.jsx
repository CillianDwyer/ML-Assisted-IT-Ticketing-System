import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../api";
import logo from "../assets/logo1.png";
import { PREFERENCE_KEYS, getPreference, setThemePreference } from "../utils/preferences";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M12 3a4 4 0 0 0-4 4v1.2c0 1.2-.4 2.4-1.2 3.3L5.4 13a1 1 0 0 0 .7 1.7h11.8a1 1 0 0 0 .7-1.7l-1.4-1.5A4.9 4.9 0 0 1 16 8.2V7a4 4 0 0 0-4-4Zm0 18a2.7 2.7 0 0 0 2.5-1.7h-5A2.7 2.7 0 0 0 12 21Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M20.2 14.1A8.5 8.5 0 0 1 9.9 3.8a8.8 8.8 0 1 0 10.3 10.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        d="M12 1.8v2.5M12 19.7v2.5M4.3 4.3l1.8 1.8M17.9 17.9l1.8 1.8M1.8 12h2.5M19.7 12h2.5M4.3 19.7l1.8-1.8M17.9 6.1l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path
        d="M10.9 2.8h2.2l.5 2a7.8 7.8 0 0 1 1.9.8l1.8-1 1.6 1.6-1 1.8c.33.6.6 1.23.8 1.9l2 .5v2.2l-2 .5a7.8 7.8 0 0 1-.8 1.9l1 1.8-1.6 1.6-1.8-1a7.8 7.8 0 0 1-1.9.8l-.5 2h-2.2l-.5-2a7.8 7.8 0 0 1-1.9-.8l-1.8 1-1.6-1.6 1-1.8a7.8 7.8 0 0 1-.8-1.9l-2-.5v-2.2l2-.5a7.8 7.8 0 0 1 .8-1.9l-1-1.8 1.6-1.6 1.8 1a7.8 7.8 0 0 1 1.9-.8l.5-2Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3.1" fill="var(--card)" />
    </svg>
  );
}

const NOTIF_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "message", label: "Messages" },
  { id: "assignment", label: "Assignments" },
  { id: "status", label: "Status" },
];

function getNotificationLabel(type) {
  if (type === "message") return "Message";
  if (type === "assignment") return "Assignment";
  if (type === "status") return "Status";
  return "Update";
}

function Navbar() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const email = localStorage.getItem("email") || "Account";

  const navigate = useNavigate();

  const [showConfirm, setShowConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifFilter, setNotifFilter] = useState("all");
  const notifRef = useRef(null);

  const [darkMode, setDarkMode] = useState(getPreference(PREFERENCE_KEYS.theme, "light") === "dark");

  const roleLabel =
    role === "admin" ? "Admin" : role === "technician" ? "Technician" : "User";

  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const res = await api.get("/notifications/unread-count");
      setNotifCount(res.data?.count ?? 0);
    } catch {}
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
    } catch {}

    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
    );

    fetchUnreadCount();
    setNotifOpen(false);
    setMobileNavOpen(false);

    if (n.ticket_id) navigate(`/tickets/${n.ticket_id}`);
  };

  useEffect(() => {
    if (!token) {
      setNotifCount(0);
      setNotifications([]);
      return;
    }

    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (notifOpen) fetchNotifications();
  }, [notifOpen]);

  const filteredNotifications = useMemo(() => {
    if (notifFilter === "all") return notifications;
    if (notifFilter === "unread") return notifications.filter((n) => !n.is_read);
    return notifications.filter((n) => n.type === notifFilter);
  }, [notifications, notifFilter]);

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
        setMobileNavOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    const onPreferenceChange = (event) => {
      if (event.detail?.key === PREFERENCE_KEYS.theme) {
        setDarkMode(event.detail.value === "dark");
      }
    };

    window.addEventListener("app:preferences-changed", onPreferenceChange);
    return () => {
      window.removeEventListener("app:preferences-changed", onPreferenceChange);
    };
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    setThemePreference(newMode ? "dark" : "light");
  };

  const handleLogout = () => {
    setShowConfirm(false);
    setMenuOpen(false);
    setNotifOpen(false);
    setMobileNavOpen(false);

    setTimeout(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("email");
      navigate("/login");
    }, 200);
  };

  const closeMenus = () => {
    setMobileNavOpen(false);
    setMenuOpen(false);
    setNotifOpen(false);
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-inner">
          <div className="nav-main">
            <div className="nav-brand-row">
              <img
                src={logo}
                alt="Logo"
                className="nav-logo"
                onClick={() => {
                  closeMenus();
                  navigate("/");
                }}
              />

              <button
                type="button"
                className="nav-mobile-toggle"
                aria-label="Toggle navigation"
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                <MenuIcon />
              </button>
            </div>

            <div className={`nav-links-wrap ${mobileNavOpen ? "open" : ""}`}>
              <ul className="nav-list">
                {token && (
                  <>
                    <li>
                      <NavLink
                        to="/overview"
                        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                        onClick={closeMenus}
                      >
                        Overview
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/tickets/new"
                        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                        onClick={closeMenus}
                      >
                        Submit Ticket
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/mytickets"
                        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                        onClick={closeMenus}
                      >
                        My Tickets
                      </NavLink>
                    </li>
                    {role === "admin" && (
                      <li>
                        <NavLink
                          to="/admin"
                          className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                          onClick={closeMenus}
                        >
                          Admin Dashboard
                        </NavLink>
                      </li>
                    )}
                    {role === "technician" && (
                      <li>
                        <NavLink
                          to="/tech"
                          className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                          onClick={closeMenus}
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
                    className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                    onClick={closeMenus}
                  >
                    About
                  </NavLink>
                </li>

                {!token && (
                  <>
                    <li>
                      <NavLink
                        to="/login"
                        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                        onClick={closeMenus}
                      >
                        Login
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/register"
                        className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                        onClick={closeMenus}
                      >
                        Register
                      </NavLink>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <div className="nav-actions">
            {token && (
              <div className="notif-wrap" ref={notifRef}>
                <button
                  className="notif-btn"
                  aria-label="Open notifications"
                  title="Notifications"
                  onClick={() => {
                    setMenuOpen(false);
                    setNotifOpen((v) => !v);
                  }}
                >
                  <BellIcon />
                  {notifCount > 0 && (
                    <span className="notif-badge">{notifCount > 99 ? "99+" : notifCount}</span>
                  )}
                </button>

                {notifOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <span>Notifications</span>
                      <button
                        className="notif-clear"
                        onClick={markAllRead}
                        disabled={notifCount === 0}
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="notif-filter-bar">
                      {NOTIF_FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          className={`notif-filter-chip ${notifFilter === filter.id ? "active" : ""}`}
                          onClick={() => setNotifFilter(filter.id)}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>

                    <div className="notif-list">
                      {notifLoading ? (
                        <div className="notif-empty">
                          <strong>Loading notifications</strong>
                          <span>Pulling the latest updates from your workspace.</span>
                        </div>
                      ) : filteredNotifications.length === 0 ? (
                        <div className="notif-empty">
                          <strong>
                            {notifFilter === "all" ? "No notifications yet" : "Nothing in this view"}
                          </strong>
                          <span>
                            {notifFilter === "all"
                              ? "Assignments, messages, and status changes will appear here."
                              : "Try a different filter to widen the notification view."}
                          </span>
                        </div>
                      ) : (
                        filteredNotifications.map((n) => (
                          <button
                            key={n.id}
                            className={`notif-item ${n.is_read ? "" : "unread"}`}
                            onClick={() => openNotification(n)}
                          >
                            <div className="notif-item-head">
                              <span className={`notif-type-pill ${n.type || "update"}`}>
                                {getNotificationLabel(n.type)}
                              </span>
                              {!n.is_read && <span className="notif-item-dot" aria-hidden="true" />}
                            </div>
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

            {token && (
              <div className="user-menu" ref={menuRef}>
                <button
                  className="user-chip"
                  onClick={() => {
                    setNotifOpen(false);
                    setMenuOpen((v) => !v);
                  }}
                >
                  <span className="user-email">{email}</span>
                  <span className="user-role">{roleLabel}</span>
                  <span className="user-caret">{menuOpen ? "^" : "v"}</span>
                </button>

                {menuOpen && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-header">
                      <div className="user-dropdown-email">{email}</div>
                      <div className="user-dropdown-role">{roleLabel}</div>
                    </div>
                    <div className="user-dropdown-divider" />
                    <button
                      className="user-dropdown-item"
                      onClick={() => {
                        closeMenus();
                        navigate("/settings");
                      }}
                    >
                      <GearIcon /> Settings
                    </button>
                    <button className="user-dropdown-item" onClick={toggleDarkMode}>
                      {darkMode ? (
                        <>
                          <MoonIcon /> Light Mode
                        </>
                      ) : (
                        <>
                          <SunIcon /> Dark Mode
                        </>
                      )}
                    </button>
                    <button
                      className="user-dropdown-item danger"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowConfirm(true);
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {showConfirm && (
        <div className="logout-overlay">
          <div className="logout-popup">
            <div className="logout-popup-eyebrow">Sign out</div>
            <h3>Sign out of your workspace?</h3>
            <p className="logout-popup-copy">
              You will return to the login screen and need to sign in again to access tickets, notifications, and dashboards.
            </p>
            <div className="logout-buttons">
              <button className="no-btn" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="yes-btn" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
