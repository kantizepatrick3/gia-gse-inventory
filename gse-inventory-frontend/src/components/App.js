import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PartsList from './components/PartsList';
import ReceivePart from './components/ReceivePart';
import IssuePart from './components/IssuePart';
import Transactions from './components/Transactions';
import ServiceHistoryReport from './components/ServiceHistoryReport';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(userData);
    }
  }, [token]);

  const handleLogin = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard token={token} />} />
          <Route path="/parts" element={<PartsList token={token} />} />
          <Route path="/receive" element={<ReceivePart token={token} />} />
          <Route path="/issue" element={<IssuePart token={token} />} />
          <Route path="/transactions" element={<Transactions token={token} />} />
          <Route path="/service-history" element={<ServiceHistoryReport token={token} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;