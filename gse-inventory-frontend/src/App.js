import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PartsList from './components/PartsList';
import ReceivePart from './components/ReceivePart';
import IssuePart from './components/IssuePart';
import PendingApprovals from './components/PendingApprovals';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
import Users from './components/Users';
import GSEMaintenance from './components/GSEMaintenance';
import MaintenanceHistory from './components/MaintenanceHistory';
import PriceHistory from './components/PriceHistory';
import GSEStatus from './components/GSEStatus'; // NEW: Import GSE Status component
import Navbar from './components/Navbar';
import './App.css';

function App() {
  const [token, setToken] = React.useState(localStorage.getItem('token'));
  const [user, setUser] = React.useState(JSON.parse(localStorage.getItem('user') || 'null'));

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
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
      <div>
        <Navbar user={user} token={token} onLogout={handleLogout} />
        <div style={{ padding: '20px' }}>
          <Routes>
            <Route path="/" element={<Dashboard token={token} user={user} />} />
            <Route path="/dashboard" element={<Dashboard token={token} user={user} />} />
            <Route path="/parts" element={<PartsList token={token} user={user} />} />
            <Route path="/receive" element={<ReceivePart token={token} />} />
            <Route path="/issue" element={<IssuePart token={token} user={user} />} />
            <Route path="/approvals" element={<PendingApprovals token={token} user={user} />} />
            <Route path="/transactions" element={<Transactions token={token} />} />
            <Route path="/reports" element={<Reports token={token} />} />
            <Route path="/users" element={<Users token={token} user={user} />} />
            <Route path="/maintenance" element={<GSEMaintenance token={token} user={user} />} />
            <Route path="/maintenance-history" element={<MaintenanceHistory token={token} />} />
            <Route path="/price-history" element={<PriceHistory token={token} />} />
            <Route path="/gse-status" element={<GSEStatus token={token} user={user} />} /> {/* NEW: GSE Status Route */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;