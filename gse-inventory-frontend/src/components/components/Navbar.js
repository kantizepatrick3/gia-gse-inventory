import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ user, onLogout }) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">GSE Spare Parts Inventory</div>
      <ul className="navbar-menu">
        <li><Link to="/">Dashboard</Link></li>
        <li><Link to="/parts">Parts</Link></li>
        <li><Link to="/receive">Receive</Link></li>
        <li><Link to="/issue">Issue</Link></li>
        <li><Link to="/transactions">Transactions</Link></li>
      </ul>
      <div className="user-info">
        <span>{user?.full_name} ({user?.role})</span>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;
