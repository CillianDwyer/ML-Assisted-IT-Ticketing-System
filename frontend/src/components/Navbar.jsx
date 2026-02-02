import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

function Navbar() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const email = localStorage.getItem("email") || "Account";

  const navigate = useNavigate();

  const [showConfirm, setShowConfirm] = useState(false);

  // User menu dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  // Close dropdown on outside click / Esc
  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    const onEsc = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
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

    setTimeout(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("email");
      navigate("/login");
    }, 200);
  };

  // Helper: nicer role label
  const roleLabel =
    role === "admin" ? "Admin" : role === "technician" ? "Technician" : "User";

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
            {/* User menu (only when logged in) */}
            {token && (
              <div className="user-menu" ref={menuRef}>
                <button
                  className="user-chip"
                  onClick={() => setMenuOpen((v) => !v)}
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
