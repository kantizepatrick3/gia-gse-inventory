import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logo from '../assets/logo.png';

// Import your 5 local GSE images (copy these to CAS assets folder first)
import gse1 from '../assets/gse2.jpg';
import gse2 from '../assets/gse2.jpg';
import gse3 from '../assets/gse3.jpg';
import gse4 from '../assets/gse4.jpg';
import gse5 from '../assets/gse5.jpg';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  // Array of 6 GSE background images (5 local + 1 Unsplash)
  const backgroundImages = [
    {
      url: gse1,
      title: '🛞 Ground Support Equipment',
      description: 'GSE equipment servicing aircraft on tarmac'
    },
    {
      url: gse2,
      title: '🛻 Baggage Handling',
      description: 'Baggage carts and tugs in operation'
    },
    {
      url: gse3,
      title: '✈️ Airport Tarmac Operations',
      description: 'Ground crew and GSE equipment preparing aircraft'
    },
    {
      url: gse4,
      title: '🚛 GSE Service Vehicles',
      description: 'Multiple service vehicles supporting aircraft'
    },
    {
      url: gse5,
      title: '👥 Passenger Boarding',
      description: 'Passengers boarding aircraft through jet bridge'
    },
    {
      url: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1920&h=1080&fit=crop',
      title: '🛞 Tow Tractor Towing Aircraft',
      description: 'GSE tow tractor moving aircraft to gate'
    }
  ];

  // Preload images for smooth transitions
  useEffect(() => {
    backgroundImages.forEach((img) => {
      const preloadImg = new Image();
      preloadImg.src = img.url;
    });
  }, []);

  // Rotate background images every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBgIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // CAS BACKEND URL
  const API_URL = 'https://gia-gse-inventory.onrender.com';

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/login`, { username, password });
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/forgot-password`, { username: resetUsername });
      setResetMessage('If account exists, reset code has been sent.');
      setResetError('');
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetMessage('');
        setResetUsername('');
      }, 3000);
    } catch (err) {
      setResetError('Error requesting password reset');
      setResetMessage('');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setResetError('Password must be at least 4 characters');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/reset-password`, {
        username: resetUsername,
        reset_code: resetToken,
        new_password: newPassword
      });
      setResetMessage('Password reset successful! Please login with your new password.');
      setResetError('');
      setTimeout(() => {
        setShowResetForm(false);
        setShowForgotPassword(false);
        setResetMessage('');
        setResetUsername('');
        setNewPassword('');
        setConfirmPassword('');
        setResetToken('');
      }, 3000);
    } catch (err) {
      setResetError(err.response?.data?.error || 'Error resetting password');
      setResetMessage('');
    }
  };

  const currentImage = backgroundImages[currentBgIndex];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Image Container with Brightness (No Zoom Animation) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${currentImage.url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(1.3) contrast(1.1)'
        }} />
      </div>

      {/* Very Light Overlay for Better Visibility */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 100%)',
        zIndex: 1
      }} />

      {/* Login Box */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        margin: '20px',
        animation: 'slideUp 0.5s ease-out'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img 
            src={logo} 
            alt="CAS Ground Services" 
            style={{ 
              width: '220px',
              height: 'auto',
              maxWidth: '100%',
              marginBottom: '20px'
            }}
          />
        </div>
        
        <h2 style={{ 
          textAlign: 'center', 
          color: '#2c3e50', 
          marginBottom: '25px',
          fontSize: '20px',
          fontWeight: 'bold'
        }}>GSE Spare Parts and Maintenance Management</h2>
        
        {!showForgotPassword ? (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                transition: 'border-color 0.3s ease',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3498db'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                transition: 'border-color 0.3s ease',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3498db'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
            <button 
              type="submit" 
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#2980b9'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#3498db'}
            >
              Login
            </button>
            {error && (
              <div style={{ 
                color: '#e74c3c', 
                textAlign: 'center', 
                marginTop: '15px',
                fontSize: '13px',
                padding: '8px',
                backgroundColor: '#fdeaea',
                borderRadius: '6px'
              }}>
                {error}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => setShowForgotPassword(true)}
                style={{ 
                  background: 'none', 
                  color: '#3498db', 
                  padding: '12px 0 0 0', 
                  fontSize: '12px', 
                  border: 'none', 
                  cursor: 'pointer',
                  transition: 'color 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#2980b9'}
                onMouseLeave={(e) => e.target.style.color = '#3498db'}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        ) : !showResetForm ? (
          <form onSubmit={handleRequestReset}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Reset Password</h3>
            <p style={{ fontSize: '13px', marginBottom: '20px', textAlign: 'center', color: '#666' }}>
              Enter your username to receive a reset code
            </p>
            <input
              type="text"
              placeholder="Username"
              value={resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <button 
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Send Reset Code
            </button>
            {resetMessage && (
              <div style={{ color: '#27ae60', textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
                {resetMessage}
              </div>
            )}
            {resetError && (
              <div style={{ color: '#e74c3c', textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
                {resetError}
              </div>
            )}
            <button 
              type="button" 
              onClick={() => {
                setShowForgotPassword(false);
                setResetMessage('');
                setResetError('');
              }}
              style={{ 
                background: 'none', 
                color: '#666', 
                marginTop: '15px', 
                border: 'none', 
                cursor: 'pointer', 
                width: '100%',
                fontSize: '13px'
              }}
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Create New Password</h3>
            <p style={{ fontSize: '13px', marginBottom: '20px', textAlign: 'center', color: '#666' }}>
              Enter your reset code and new password
            </p>
            <input
              type="text"
              placeholder="Reset Code"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="password"
              placeholder="New Password (min 4 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <button 
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Reset Password
            </button>
            {resetMessage && (
              <div style={{ color: '#27ae60', textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
                {resetMessage}
              </div>
            )}
            {resetError && (
              <div style={{ color: '#e74c3c', textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
                {resetError}
              </div>
            )}
            <button 
              type="button" 
              onClick={() => {
                setShowResetForm(false);
                setResetMessage('');
                setResetError('');
              }}
              style={{ 
                background: 'none', 
                color: '#666', 
                marginTop: '15px', 
                border: 'none', 
                cursor: 'pointer', 
                width: '100%',
                fontSize: '13px'
              }}
            >
              Back
            </button>
          </form>
        )}
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default Login;