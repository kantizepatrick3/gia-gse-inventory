import React, { useState, useEffect } from 'react';
import axios from 'axios';

const IssuePart = ({ token, user }) => {
  const [parts, setParts] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    part_number: '',
    quantity: '',
    gse_registration: '',
    technician_name: '',
    work_order: '',
    notes: '',
    maintenance_type: 'preventive' // NEW: preventive or corrective
  });

  const API_URL = 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchParts();
    fetchMyRequests();
  }, []);

  const fetchParts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/parts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParts(response.data);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setError('Failed to load parts');
    }
  };

  const fetchMyRequests = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/requests/my-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyRequests(response.data.requests || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Add maintenance type to notes if needed
    let finalNotes = formData.notes;
    if (formData.maintenance_type) {
      const maintTypeText = formData.maintenance_type === 'preventive' ? '🔧 Preventive Maintenance' : '🛠️ Corrective Maintenance';
      finalNotes = finalNotes ? `${maintTypeText} - ${finalNotes}` : maintTypeText;
    }
    
    try {
      await axios.post(`${API_URL}/api/requests/issue`, {
        part_number: formData.part_number,
        quantity: parseInt(formData.quantity),
        gse_registration: formData.gse_registration,
        technician_name: formData.technician_name,
        work_order: formData.work_order,
        notes: finalNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage('✅ Issue request submitted for approval!');
      setFormData({
        part_number: '',
        quantity: '',
        gse_registration: '',
        technician_name: '',
        work_order: '',
        notes: '',
        maintenance_type: 'preventive'
      });
      fetchMyRequests();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error submitting request');
      setTimeout(() => setError(''), 3000);
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

  // Helper to extract maintenance type from notes for display
  const getMaintenanceTypeFromNotes = (notes) => {
    if (notes && notes.includes('Preventive Maintenance')) {
      return '🔧 Preventive';
    }
    if (notes && notes.includes('Corrective Maintenance')) {
      return '🛠️ Corrective';
    }
    return '';
  };

  // Helper to clean notes (remove maintenance type prefix for display)
  const cleanNotes = (notes) => {
    if (notes) {
      return notes.replace('🔧 Preventive Maintenance - ', '').replace('🛠️ Corrective Maintenance - ', '');
    }
    return notes;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        {/* Submit Request Form */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2>📤 Issue Spare Parts</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Submit an issue request for approval. Stock will be deducted only after a Manager or Admin approves.
          </p>
          
          <form onSubmit={handleSubmit} style={{
            backgroundColor: '#f9f9f9',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Part Number *</label>
              <select
                value={formData.part_number}
                onChange={(e) => setFormData({...formData, part_number: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value="">-- Select a part --</option>
                {parts.map(part => (
                  <option key={part.id} value={part.part_number}>
                    {part.part_number} - {part.description} (Stock: {part.quantity_on_hand})
                  </option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                min="1"
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* NEW: Maintenance Type Selection */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Maintenance Type *</label>
              <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 15px', borderRadius: '5px', backgroundColor: formData.maintenance_type === 'preventive' ? '#d4edda' : '#f5f5f5', border: formData.maintenance_type === 'preventive' ? '1px solid #27ae60' : '1px solid #ddd' }}>
                  <input
                    type="radio"
                    name="maintenance_type"
                    value="preventive"
                    checked={formData.maintenance_type === 'preventive'}
                    onChange={(e) => setFormData({...formData, maintenance_type: e.target.value})}
                  />
                  <span>🔧 Preventive Maintenance</span>
                  <small style={{ fontSize: '11px', color: '#666', marginLeft: '5px' }}>(Scheduled / Routine)</small>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 15px', borderRadius: '5px', backgroundColor: formData.maintenance_type === 'corrective' ? '#fdeaea' : '#f5f5f5', border: formData.maintenance_type === 'corrective' ? '1px solid #e74c3c' : '1px solid #ddd' }}>
                  <input
                    type="radio"
                    name="maintenance_type"
                    value="corrective"
                    checked={formData.maintenance_type === 'corrective'}
                    onChange={(e) => setFormData({...formData, maintenance_type: e.target.value})}
                  />
                  <span>🛠️ Corrective Maintenance</span>
                  <small style={{ fontSize: '11px', color: '#666', marginLeft: '5px' }}>(Unscheduled / Repair)</small>
                </label>
              </div>
              <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                Specify whether this part is for preventive (scheduled) or corrective (repair) maintenance
              </small>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>GSE Registration *</label>
              <input
                type="text"
                value={formData.gse_registration}
                onChange={(e) => setFormData({...formData, gse_registration: e.target.value})}
                placeholder="e.g., GSE-1234"
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Technician Name</label>
              <input
                type="text"
                value={formData.technician_name}
                onChange={(e) => setFormData({...formData, technician_name: e.target.value})}
                placeholder="Enter technician name"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Work Order</label>
              <input
                type="text"
                value={formData.work_order}
                onChange={(e) => setFormData({...formData, work_order: e.target.value})}
                placeholder="e.g., WO-12345"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows="3"
                placeholder="Reason for issue, additional details..."
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#f39c12',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              {loading ? 'Submitting...' : '📋 Submit for Approval'}
            </button>
          </form>
        </div>
        
        {/* My Requests List */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2>📋 My Requests</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Track your submitted requests and their approval status.
          </p>
          
          {myRequests.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>No requests submitted yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2' }}>
                    <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Part</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Type</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Qty</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>GSE</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Status</th>
                    <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map(req => {
                    const statusStyle = getStatusBadge(req.status);
                    const maintType = getMaintenanceTypeFromNotes(req.notes);
                    const cleanNote = cleanNotes(req.notes);
                    return (
                      <tr key={req.id}>
                        <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{req.part_number}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                          {maintType || '-'}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{req.quantity}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>{req.gse_registration || '-'}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          <span style={{ color: statusStyle.color, fontWeight: 'bold' }}>{statusStyle.text}</span>
                          {req.admin_comment && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>
                              Comment: {req.admin_comment}
                            </div>
                          )}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
               </table>
            </div>
          )}
        </div>
      </div>
      
      {message && <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px', borderRadius: '5px', margin: '10px 0', border: '1px solid #c3e6cb' }}>{message}</div>}
      {error && <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '5px', margin: '10px 0', border: '1px solid #f5c6cb' }}>{error}</div>}
    </div>
  );
};

export default IssuePart;