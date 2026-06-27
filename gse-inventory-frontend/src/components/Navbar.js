import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ user, token, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const navStyle = {
    backgroundColor: '#2c3e50',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const linkStyle = {
    color: '#ecf0f1',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  };

  const linkHoverStyle = {
    backgroundColor: '#34495e'
  };

  const userInfoStyle = {
    color: '#ecf0f1',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  };

  const logoutButtonStyle = {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  };

  const logoutButtonHoverStyle = {
    backgroundColor: '#c0392b'
  };

  const [hoveredLink, setHoveredLink] = React.useState(null);
  const [isLogoutHovered, setIsLogoutHovered] = React.useState(false);

  // Base links for all users
  const baseLinks = [
    { path: '/', label: '🏠 Dashboard' },
    { path: '/parts', label: '📦 Parts' },
    { path: '/receive', label: '📥 Receive' },
    { path: '/issue', label: '📤 Issue' },
    { path: '/maintenance', label: '🔧 Maintenance' },
    { path: '/transactions', label: '📜 Parts History' },
    { path: '/maintenance-history', label: '📋 Service History' },
    { path: '/price-history', label: '💰 Price History' },
    { path: '/gse-status', label: '📊 GSE Status' },
  ];

  // Admin/Manager only links
  const adminManagerLinks = [
    { path: '/approvals', label: '⏳ Approvals' },
  ];

  // Users link only for Admin
  const userLinks = [
    { path: '/users', label: '👥 Users' },
  ];

  // Build final links array based on user role
  let links = [...baseLinks];

  // Add Approvals for Admin and Manager
  if (user?.role === 'admin' || user?.role === 'manager') {
    links = [...links, ...adminManagerLinks];
  }

  // Add Users only for Admin
  if (user?.role === 'admin') {
    links = [...links, ...userLinks];
  }

  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              style={{
                ...linkStyle,
                ...(hoveredLink === link.path ? linkHoverStyle : {})
              }}
              onMouseEnter={() => setHoveredLink(link.path)}
              onMouseLeave={() => setHoveredLink(null)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div style={userInfoStyle}>
        <span>👋 {user?.full_name || user?.username || 'User'} ({user?.role || 'Role'})</span>
        <button
          style={{
            ...logoutButtonStyle,
            ...(isLogoutHovered ? logoutButtonHoverStyle : {})
          }}
          onMouseEnter={() => setIsLogoutHovered(true)}
          onMouseLeave={() => setIsLogoutHovered(false)}
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;