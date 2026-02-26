// Main react component
// Defines all routes (pages)
// Wraps protected pages with PrivateRoute so only logged-in users can access them

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer"; // ✅ NEW
import TicketForm from "./components/TicketForm";
import MyTickets from "./components/Mytickets"; // ✅ fixed casing
import About from "./components/About";
import Login from "./components/Login";
import Register from "./components/Register";
import AdminDashboard from "./components/AdminDashboard";
import TechDashboard from "./components/TechDashboard";
import TicketDetails from "./components/TicketDetails";
import Overview from "./components/Overview";
import "./App.css";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

function RoleRoute({ allowedRoles, children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" />;
  return children;
}

function App() {
  return (
    <Router>
      <Navbar />

      {/* ✅ Use theme-based layout wrapper instead of Tailwind classes */}
      <div className="app-shell">
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Overview />
              </PrivateRoute>
            }
          />

          <Route
            path="/tickets/new"
            element={
              <PrivateRoute>
                <TicketForm />
              </PrivateRoute>
            }
          />

          <Route
            path="/mytickets"
            element={
              <PrivateRoute>
                <MyTickets />
              </PrivateRoute>
            }
          />

          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/admin"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </RoleRoute>
            }
          />

          <Route
            path="/tech"
            element={
              <RoleRoute allowedRoles={["technician"]}>
                <TechDashboard />
              </RoleRoute>
            }
          />

          <Route
            path="/tickets/:id"
            element={
              <PrivateRoute>
                <TicketDetails />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>

      {/* ✅ NEW */}
      <Footer />
    </Router>
  );
}

export default App;
