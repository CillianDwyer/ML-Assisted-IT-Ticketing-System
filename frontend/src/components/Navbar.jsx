import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

function Navbar() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = () => {
  setShowConfirm(false);
  setTimeout(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("email");
    navigate("/login");
  }, 200); // waits 200ms before redirect
};

  return (
    <>
      <nav className="navbar">
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

              {/* Admin dashboard */}
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

              {/* Technician dashboard */}
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
      </nav>

      {/* Logout Confirmation Popup */}
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
