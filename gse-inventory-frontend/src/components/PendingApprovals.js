import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PendingApprovals = ({ token, user }) => {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState({});

  const API_URL = process.env.REACT_APP_API_URL || 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      console.log('📋 Fetching pending approvals...');
      // ✅ FIX: Use /api/approvals/pending instead of /api/requests/pending
      const response = await axios.get(`${API_URL}/api/approvals/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Pending approvals loaded:', response.data);
      setRequests(response.data || []);
    } catch (err) {
      console.error('❌ Error fetching requests:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setLoading(true);
    try {
      console.log(`✅ Approving request ${requestId}...`);
      // ✅ FIX: Use PUT /api/approvals/:id/approve
      const response = await axios.put(`${API_URL}/api/approvals/${requestId}/approve`, {
        comment: comment[requestId] || 'Approved by admin'
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Approve response:', response.data);
      setMessage('✅ Request approved successfully! Stock deducted.');
      await fetchPendingRequests();
      setComment({});
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('❌ Error approving request:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || 'Error approving request');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    setLoading(true);
    try {
      console.log(`❌ Rejecting request ${requestId}...`);
      // ✅ FIX: Use PUT /api/approvals/:id/reject
      const response = await axios.put(`${API_URL}/api/approvals/${requestId}/reject`, {
        comment: comment[requestId] || 'Rejected by admin'
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Reject response:', response.data);
      setMessage('❌ Request rejected.');
      await fetchPendingRequests();
      setComment({});
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('❌ Error rejecting request:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || 'Error rejecting request');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract maintenance type from notes
  const getMaintenanceType = (notes) => {
    if (!notes) return null;
    if (notes.includes('Preventive Maintenance')) {
      return { type: 'preventive', label: '🔧 Preventive', color: '#27ae60', bg: '#d4edda' };
    }
    if (notes.includes('Corrective Maintenance')) {
      return { type: 'corrective', label: '🛠️ Corrective', color: '#e74c3c', bg: '#fdeaea' };
    }
    return null;
  };

  // Clean notes for display
  const cleanNotes = (notes) => {
    if (!notes) return notes;
    return notes.replace('🔧 Preventive Maintenance - ', '').replace('🛠️ Corrective Maintenance - ', '');
  };

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>⛔ Access Denied</h3>
        <p>Only Managers and Admins can access this page.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ color: '#2c3e50', borderBottom: '2px solid #f39c12', paddingBottom: '10px' }}>
          📋 Pending Issue Approvals
        </h2>
        <button
          onClick={fetchPendingRequests}
          disabled={loading}
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
        </button>
      </div>
      
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Review and approve/reject issue requests from storekeepers.
      </p>
      
      {message && (
        <div style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '15px',
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
          padding: '15px',
          borderRadius: '5px',
          margin: '10px 0',
          border: '1px solid #f5c6cb'
        }}>
          ❌ {error}
        </div>
      )}
      
      {loading && !requests.length ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{
          backgroundColor: '#f9f9f9',
          padding: '60px',
          textAlign: 'center',
          borderRadius: '8px',
          border: '1px dashed #ddd'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>✅</div>
          <p style={{ fontSize: '16px', color: '#666' }}>No pending requests to approve.</p>
          <p style={{ fontSize: '14px', color: '#999' }}>All requests have been processed.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>#</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Requested By</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Part</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>Qty</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Maintenance Type</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>GSE Reg</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Technician</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, index) => {
                const maintType = getMaintenanceType(req.notes);
                return (
                  <tr key={req.id || index} style={{
                    backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white'
                  }}>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{index + 1}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {req.created_at ? new Date(req.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{req.requested_by_name || 'Unknown'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}><strong>{req.part_number}</strong></td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }}>{req.quantity}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {maintType ? (
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '4px',
                          backgroundColor: maintType.bg,
                          color: maintType.color,
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {maintType.label}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{req.gse_registration || '-'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{req.technician_name || '-'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <div style={{ marginBottom: '5px' }}>
                        <input
                          type="text"
                          placeholder="Comment"
                          value={comment[req.id] || ''}
                          onChange={(e) => setComment({...comment, [req.id]: e.target.value})}
                          style={{
                            width: '120px',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            border: '1px solid #ddd',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={loading}
                        style={{
                          backgroundColor: '#27ae60',
                          color: 'white',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: '3px',
                          marginRight: '5px',
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={loading}
                        style={{
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: '3px',
                          cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ❌ Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;