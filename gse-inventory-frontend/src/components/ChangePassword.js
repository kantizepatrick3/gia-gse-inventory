import React, { useState } from 'react';
import axios from 'axios';

const ChangePassword = ({ token, user, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDefaultPasswords, setShowDefaultPasswords] = useState(false);

  // Use Render backend URL
  const API_URL = 'https://gse-backend.onrender.com';

  // Default passwords based on role
  const getDefaultPassword = () => {
    if (user?.role === 'admin') return 'admin123';
    if (user?.role === 'manager') return 'manager123';
    if (user?.role === 'storekeeper') return 'keeper123';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('❌ New passwords do not match');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (newPassword.length < 4) {
      setError('❌ Password must be at least 4 characters');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    if (currentPassword === newPassword && currentPassword !== getDefaultPassword()) {
      setError('❌ New password cannot be the same as current password');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setLoading(true);
    
    try {
      await axios.post(`${API_URL}/api/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage('✅ Password changed successfully! Logging out...');
      setError('');
      
      setTimeout(() => {
        onLogout();
      }, 2000);
      
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error changing password';
      setError(`❌ ${errorMsg}`);
      setMessage('');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const fillDefaultPassword = () => {
    setCurrentPassword(getDefaultPassword());
  };

  const fillSampleNewPassword = () => {
    setNewPassword('newpassword123');
    setConfirmPassword('newpassword123');
  };

  return (
    <div>
      <button 
        onClick={() => setShowForm(!showForm)} 
        style={{ 
          backgroundColor: '#3498db', 
          padding: '8px 15px', 
          fontSize: '14px', 
          marginLeft: '10px',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          transition: 'background-color 0.3s'
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
        onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
      >
        🔑 Change Password
      </button>

      {showForm && (
        <div style={{
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '8px', 
            width: '500px',
            maxWidth: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50' }}>Change Password</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
              User: <strong style={{ color: '#3498db' }}>{user?.username}</strong> ({user?.role})
            </p>
            
            {/* Info box about default passwords */}
            <div style={{
              backgroundColor: '#e8f4fd',
              padding: '12px',
              borderRadius: '5px',
              marginBottom: '20px',
              borderLeft: '4px solid #3498db'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>ℹ️ Your default password is:</span>
                <button 
                  type="button"
                  onClick={() => setShowDefaultPasswords(!showDefaultPasswords)}
                  style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    padding: '3px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  {showDefaultPasswords ? 'Hide' : 'Show'}
                </button>
              </div>
              {showDefaultPasswords && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ margin: '5px 0', fontSize: '13px' }}>
                    <strong>Your default password:</strong> {getDefaultPassword()}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>
                    * Admin: admin123 | Manager: manager123 | Storekeeper: keeper123
                  </p>
                </div>
              )}
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  Current Password *
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="password" 
                    value={currentPassword} 
                    onChange={(e) => setCurrentPassword(e.target.value)} 
                    required
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={fillDefaultPassword}
                    style={{
                      backgroundColor: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      padding: '0 15px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Use Default
                  </button>
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  New Password * (min 4 characters)
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    required
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={fillSampleNewPassword}
                    style={{
                      backgroundColor: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      padding: '0 15px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Sample
                  </button>
                </div>
                {newPassword && newPassword.length < 4 && (
                  <p style={{ fontSize: '12px', color: '#e74c3c', marginTop: '5px' }}>
                    ⚠️ Password must be at least 4 characters
                  </p>
                )}
                {newPassword && newPassword.length >= 4 && (
                  <p style={{ fontSize: '12px', color: '#27ae60', marginTop: '5px' }}>
                    ✓ Password strength: {newPassword.length >= 8 ? 'Strong' : newPassword.length >= 6 ? 'Medium' : 'Weak'}
                  </p>
                )}
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
                  Confirm New Password *
                </label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p style={{ fontSize: '12px', color: '#e74c3c', marginTop: '5px' }}>
                    ⚠️ Passwords do not match
                  </p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length >= 4 && (
                  <p style={{ fontSize: '12px', color: '#27ae60', marginTop: '5px' }}>
                    ✓ Passwords match
                  </p>
                )}
              </div>
              
              {message && (
                <div style={{
                  backgroundColor: '#d4edda',
                  color: '#155724',
                  padding: '10px',
                  borderRadius: '5px',
                  margin: '10px 0',
                  border: '1px solid #c3e6cb'
                }}>
                  {message}
                </div>
              )}
              
              {error && (
                <div style={{
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  padding: '10px',
                  borderRadius: '5px',
                  margin: '10px 0',
                  border: '1px solid #f5c6cb'
                }}>
                  {error}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    flex: 1,
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Processing...' : 'Change Password'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForm(false);
                    setMessage('');
                    setError('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowDefaultPasswords(false);
                  }} 
                  style={{
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
            
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee', fontSize: '12px', color: '#999', textAlign: 'center' }}>
              <p>💡 Tips:</p>
              <p>• Use the "Use Default" button to fill your current default password</p>
              <p>• Use the "Sample" button to try a sample new password</p>
              <p>• After changing password, you'll be logged out and need to login with new password</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangePassword;