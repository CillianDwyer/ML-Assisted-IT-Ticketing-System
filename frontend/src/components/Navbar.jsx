import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

function Navbar() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const navigate = useNavigate();

  const [showConfirm, setShowConfirm] = useState(false);

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

            {!token ? (
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
            ) : (
              <li>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="nav-logout"
                >
                  Logout
                </button>
              </li>
            )}
          </ul>

          {/* RIGHT: Theme toggle */}
          <div className="nav-actions">
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
              <button
                className="no-btn"
                onClick={() => setShowConfirm(false)}
              >
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
