//Main react componenet
//Defines all routs (pages) 
//wraps pages with private route so only logged in users can access them

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import TicketForm from "./components/TicketForm";
import MyTickets from "./components/Mytickets";
import About from "./components/About";
import Login from "./components/Login";
import Register from "./components/Register";
import AdminDashboard from "./components/AdminDashboard";
import TechDashboard from "./components/TechDashboard";
import TicketDetails from "./components/TicketDetails";
import "./App.css";


function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <Navbar />
      <div className="min-h-screen p-6 bg-blue-50">
        <Routes>
          <Route
            path="/"
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
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/tech"
            element={
              <PrivateRoute>
                <TechDashboard />
              </PrivateRoute>
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
    </Router>
  );
}

export default App;
