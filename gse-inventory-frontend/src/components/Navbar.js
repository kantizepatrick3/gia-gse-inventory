import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ChangePassword from './ChangePassword';

const Navbar = ({ user, token, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const isApprover = user?.role === 'admin' || user?.role === 'manager';

  return (
    <nav style={{
      backgroundColor: '#2c3e50',
      padding: '14px 25px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '10px'
    }}>
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>🏠 Dashboard</Link>
        <Link to="/parts" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>📦 Parts</Link>
        <Link to="/receive" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>📥 Receive</Link>
        <Link to="/issue" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>📤 Issue</Link>
        {isApprover && (
          <Link to="/approvals" style={{ color: '#f39c12', textDecoration: 'none', fontWeight: 'bold', padding: '6px 12px' }}>⏳ Approvals</Link>
        )}
        <Link to="/maintenance" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>🔧 Maintenance</Link>
        <Link to="/transactions" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>📜 History</Link>
        <Link to="/reports" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>📊 Reports</Link>
        {user?.role === 'admin' && (
          <Link to="/users" style={{ color: 'white', textDecoration: 'none', padding: '6px 12px' }}>👥 Users</Link>
        )}
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '15px'
      }}>
        <div style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>👋 {user?.username} ({user?.role === 'admin' ? 'Admin' : user?.role === 'manager' ? 'Mgr' : 'SK'})</span>
          <ChangePassword token={token} user={user} onLogout={onLogout} />
        </div>
        <button 
          onClick={handleLogout} 
          style={{
            padding: '6px 12px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;