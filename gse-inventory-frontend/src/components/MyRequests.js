import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MyRequests = ({ token }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get(`${API_URL}/api/requests/my-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRequests(response.data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to load your requests');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved':
        return { color: '#27ae60', bg: '#eafaf1', text: '✅ APPROVED' };
      case 'rejected':
        return { color: '#e74c3c', bg: '#fdeaea', text: '❌ REJECTED' };
      case 'pending':
        return { color: '#f39c12', bg: '#fef5e7', text: '⏳ PENDING' };
      default:
        return { color: '#95a5a6', bg: '#f5f5f5', text: status };
    }
  };

  const getMaintenanceType = (notes) => {
    if (notes && notes.includes('Preventive Maintenance')) {
      return '🔧 Preventive';
    }
    if (notes && notes.includes('Corrective Maintenance')) {
      return '🛠️ Corrective';
    }
    return '-';
  };

  const cleanNotes = (notes) => {
    if (notes) {
      return notes
        .replace('🔧 Preventive Maintenance - ', '')
        .replace('🛠️ Corrective Maintenance - ', '');
    }
    return notes;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div>
        <h2>📋 My Requests</h2>
        <p>Loading your requests...</p>
        <div style={{ 
          backgroundColor: '#f0f0f0', 
          padding: '20px', 
          borderRadius: '8px',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          <div style={{ height: '20px', backgroundColor: '#e0e0e0', borderRadius: '4px', marginBottom: '10px' }}></div>
          <div style={{ height: '20px', backgroundColor: '#e0e0e0', borderRadius: '4px', marginBottom: '10px' }}></div>
          <div style={{ height: '20px', backgroundColor: '#e0e0e0', borderRadius: '4px' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2>📋 My Requests</h2>
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p>{error}</p>
          <button 
            onClick={fetchMyRequests}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>📋 My Requests</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Track your submitted requests and their approval status.
      </p>

      {requests.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          border: '1px dashed #ddd'
        }}>
          <p style={{ fontSize: '18px', color: '#666' }}>No requests submitted yet.</p>
          <p style={{ fontSize: '14px', color: '#999' }}>Go to "Issue Part" to create a new request.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>#</th>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Part Number</th>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Type</th>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Qty</th>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>GSE</th>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Technician</th>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, index) => {
                const statusStyle = getStatusBadge(req.status);
                const maintType = getMaintenanceType(req.notes);
                const cleanNote = cleanNotes(req.notes);
                
                return (
                  <tr key={req.id}>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                      {index + 1}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                      {req.part_number}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {maintType}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                      {req.quantity}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {req.gse_registration || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {req.technician_name || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      <span style={{ 
                        color: statusStyle.color, 
                        fontWeight: 'bold',
                        display: 'block'
                      }}>
                        {statusStyle.text}
                      </span>
                      {req.admin_comment && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#666', 
                          display: 'block',
                          marginTop: '3px'
                        }}>
                          📝 {req.admin_comment}
                        </span>
                      )}
                      {cleanNote && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: '#888', 
                          display: 'block',
                          marginTop: '3px'
                        }}>
                          📌 {cleanNote}
                        </span>
                      )}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {formatDate(req.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: '#f9f9f9', 
            borderRadius: '5px',
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
            fontSize: '14px'
          }}>
            <span>
              <span style={{ color: '#f39c12', fontWeight: 'bold' }}>⏳ {requests.filter(r => r.status === 'pending').length}</span> Pending
            </span>
            <span>
              <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ {requests.filter(r => r.status === 'approved').length}</span> Approved
            </span>
            <span>
              <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>❌ {requests.filter(r => r.status === 'rejected').length}</span> Rejected
            </span>
            <span>
              <span style={{ fontWeight: 'bold' }}>{requests.length}</span> Total
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRequests;