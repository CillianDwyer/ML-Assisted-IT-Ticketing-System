import { useEffect } from "react";
// Main react component
// Defines all routes (pages)
// Wraps protected pages with PrivateRoute so only logged-in users can access them

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import TicketForm from "./components/TicketForm";
import MyTickets from "./components/Mytickets";
import About from "./components/About";
import Login from "./components/Login";
import Register from "./components/Register";
import AdminDashboard from "./components/AdminDashboard";
import TechDashboard from "./components/TechDashboard";
import TicketDetails from "./components/TicketDetails";
import Overview from "./components/Overview";
import Settings from "./components/Settings";
import { getPreferredHomeRoute, initializeStoredPreferences } from "./utils/preferences";
import "./App.css";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

function HomeRoute() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" />;
  return <Navigate to={getPreferredHomeRoute(role)} replace />;
}

function RoleRoute({ allowedRoles, children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;

  return (
    <div key={routeKey} className="route-transition-shell">
      <Routes location={location}>
        <Route
          path="/"
          element={
            <HomeRoute />
          }
        />

        <Route
          path="/overview"
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

        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
}

function App() {
  useEffect(() => {
    initializeStoredPreferences();
  }, []);

  return (
    <Router>
      <Navbar />

      <div className="app-shell">
        <AppRoutes />
      </div>

      <Footer />
    </Router>
  );
}

export default App;
