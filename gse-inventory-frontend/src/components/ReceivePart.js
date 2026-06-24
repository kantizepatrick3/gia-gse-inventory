import React, { useState } from 'react';
import axios from 'axios';

const ReceivePart = ({ token, onReceiveComplete }) => {
  const [mode, setMode] = useState('receive');
  const [formData, setFormData] = useState({
    part_number: '',
    quantity: '',
    reference_number: '',
    notes: ''
  });
  const [showNewPartForm, setShowNewPartForm] = useState(false);
  const [newPartData, setNewPartData] = useState({
    part_number: '',
    description: '',
    manufacturer: '',
    compatible_gse: '',
    location_bin: '',
    min_stock: 5,
    maintenance_type: 'hour',
    service_interval_hours: 250,
    service_interval_months: 6,
    service_interval_years: 1,
    contact_person: '',
    contact_phone: '',
    contact_email: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = 'https://gia-gse-inventory.onrender.com';

  const handleReceive = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API_URL}/api/transactions/receive`, {
        part_number: formData.part_number,
        quantity: parseInt(formData.quantity),
        reference_number: formData.reference_number,
        notes: formData.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage(`✓ Part "${formData.part_number}" received successfully!`);
      setFormData({ part_number: '', quantity: '', reference_number: '', notes: '' });
      
      // 🔄 Refresh Parts List and Maintenance after successful receive
      if (onReceiveComplete) {
        onReceiveComplete();
      }
      
      setTimeout(() => setMessage(''), 3000);
      
    } catch (err) {
      if (err.response?.data?.error === 'Part not found') {
        setShowNewPartForm(true);
        setNewPartData(prev => ({ ...prev, part_number: formData.part_number }));
        setError(`Part "${formData.part_number}" not found. Please add its details below.`);
      } else {
        setError(err.response?.data?.error || 'Error receiving parts');
      }
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndReceive = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // First create the part with maintenance type
      await axios.post(`${API_URL}/api/parts`, {
        part_number: newPartData.part_number,
        description: newPartData.description,
        manufacturer: newPartData.manufacturer,
        compatible_gse: newPartData.compatible_gse,
        location_bin: newPartData.location_bin,
        min_stock: newPartData.min_stock,
        maintenance_type: newPartData.maintenance_type,
        service_interval_hours: newPartData.service_interval_hours,
        service_interval_months: newPartData.service_interval_months,
        service_interval_years: newPartData.service_interval_years,
        contact_person: newPartData.contact_person,
        contact_phone: newPartData.contact_phone,
        contact_email: newPartData.contact_email
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Then receive the quantity
      await axios.post(`${API_URL}/api/transactions/receive`, {
        part_number: newPartData.part_number,
        quantity: parseInt(formData.quantity),
        reference_number: formData.reference_number,
        notes: formData.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage(`✓ Part "${newPartData.part_number}" created and ${formData.quantity} units received successfully!`);
      setShowNewPartForm(false);
      setFormData({ part_number: '', quantity: '', reference_number: '', notes: '' });
      setNewPartData({
        part_number: '',
        description: '',
        manufacturer: '',
        compatible_gse: '',
        location_bin: '',
        min_stock: 5,
        maintenance_type: 'hour',
        service_interval_hours: 250,
        service_interval_months: 6,
        service_interval_years: 1,
        contact_person: '',
        contact_phone: '',
        contact_email: ''
      });
      
      // 🔄 Refresh Parts List and Maintenance after creating new part
      if (onReceiveComplete) {
        onReceiveComplete();
      }
      
      setTimeout(() => setMessage(''), 4000);
      
    } catch (err) {
      console.error('Error creating part:', err);
      setError('Error creating part. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Receive Parts</h2>
      
      {!showNewPartForm ? (
        <>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Enter a part number to receive stock. If the part doesn't exist, you'll be prompted to add it.
          </p>
          
          <form onSubmit={handleReceive} style={{
            backgroundColor: '#f9f9f9',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Part Number *</label>
              <input
                type="text"
                placeholder="Enter part number"
                value={formData.part_number}
                onChange={(e) => setFormData({...formData, part_number: e.target.value.toUpperCase()})}
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
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>PO / Reference Number</label>
              <input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                placeholder="e.g., PO-12345"
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
                placeholder="Any additional notes..."
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
                backgroundColor: '#28a745',
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
              {loading ? 'Processing...' : '✓ Receive Parts'}
            </button>
          </form>
        </>
      ) : (
        <div>
          <div style={{
            backgroundColor: '#fff3cd',
            color: '#856404',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '20px',
            border: '1px solid #ffeeba'
          }}>
            <strong>⚠️ Part Not Found</strong><br />
            Part "{newPartData.part_number}" does not exist. Please fill in the details below to create it.
          </div>
          
          <form onSubmit={handleCreateAndReceive} style={{
            backgroundColor: '#f9f9f9',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <h3>New Part Information</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Part Number *</label>
              <input
                type="text"
                value={newPartData.part_number}
                readOnly
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: '#e9ecef',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description *</label>
              <input
                type="text"
                value={newPartData.description}
                onChange={(e) => setNewPartData({...newPartData, description: e.target.value})}
                required
                placeholder="Enter part description"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Manufacturer</label>
              <input
                type="text"
                value={newPartData.manufacturer}
                onChange={(e) => setNewPartData({...newPartData, manufacturer: e.target.value})}
                placeholder="Manufacturer name"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Compatible GSE</label>
              <input
                type="text"
                value={newPartData.compatible_gse}
                onChange={(e) => setNewPartData({...newPartData, compatible_gse: e.target.value})}
                placeholder="e.g., Tow Tractor, GPU"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Bin Location</label>
              <input
                type="text"
                value={newPartData.location_bin}
                onChange={(e) => setNewPartData({...newPartData, location_bin: e.target.value})}
                placeholder="e.g., A-12"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Minimum Stock Alert</label>
              <input
                type="number"
                value={newPartData.min_stock}
                onChange={(e) => setNewPartData({...newPartData, min_stock: parseInt(e.target.value) || 5})}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>

            <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>🔧 Maintenance Type *</h4>
            <div style={{ marginBottom: '15px' }}>
              <select
                value={newPartData.maintenance_type}
                onChange={(e) => setNewPartData({...newPartData, maintenance_type: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value="hour">⏱️ Hour-based (operating hours)</option>
                <option value="month">📅 Month-based (calendar months)</option>
                <option value="year">📆 Year-based (calendar years)</option>
                <option value="none">⭕ No maintenance required</option>
              </select>
            </div>

            {newPartData.maintenance_type === 'hour' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Service Interval (hours)</label>
                <input
                  type="number"
                  value={newPartData.service_interval_hours}
                  onChange={(e) => setNewPartData({...newPartData, service_interval_hours: parseInt(e.target.value) || 250})}
                  placeholder="e.g., 250 hours"
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>How many operating hours before service is needed?</p>
              </div>
            )}

            {newPartData.maintenance_type === 'month' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Service Interval (months)</label>
                <input
                  type="number"
                  value={newPartData.service_interval_months}
                  onChange={(e) => setNewPartData({...newPartData, service_interval_months: parseInt(e.target.value) || 6})}
                  placeholder="e.g., 6 months"
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>How many months before service is needed?</p>
              </div>
            )}

            {newPartData.maintenance_type === 'year' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Service Interval (years)</label>
                <input
                  type="number"
                  value={newPartData.service_interval_years}
                  onChange={(e) => setNewPartData({...newPartData, service_interval_years: parseInt(e.target.value) || 1})}
                  placeholder="e.g., 1 year"
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>How many years before service is needed?</p>
              </div>
            )}

            {newPartData.maintenance_type === 'none' && (
              <div style={{ marginBottom: '15px', backgroundColor: '#e8f4fd', padding: '10px', borderRadius: '5px' }}>
                <p style={{ fontSize: '13px', color: '#2c3e50', margin: 0 }}>ℹ️ This part does not require scheduled maintenance. It will be marked as "No Maintenance" in the schedule.</p>
              </div>
            )}

            <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>📞 Contact Details (Optional)</h4>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Person</label>
              <input
                type="text"
                value={newPartData.contact_person}
                onChange={(e) => setNewPartData({...newPartData, contact_person: e.target.value})}
                placeholder="Contact person name"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Phone</label>
              <input
                type="tel"
                value={newPartData.contact_phone}
                onChange={(e) => setNewPartData({...newPartData, contact_phone: e.target.value})}
                placeholder="Phone number"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Email</label>
              <input
                type="email"
                value={newPartData.contact_email}
                onChange={(e) => setNewPartData({...newPartData, contact_email: e.target.value})}
                placeholder="Email address"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Initial Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                required
                placeholder="How many units?"
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
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>PO / Reference Number</label>
              <input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                placeholder="Purchase order number"
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
                placeholder="Any additional notes..."
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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowNewPartForm(false);
                  setError('');
                  setNewPartData({
                    part_number: '',
                    description: '',
                    manufacturer: '',
                    compatible_gse: '',
                    location_bin: '',
                    min_stock: 5,
                    maintenance_type: 'hour',
                    service_interval_hours: 250,
                    service_interval_months: 6,
                    service_interval_years: 1,
                    contact_person: '',
                    contact_phone: '',
                    contact_email: ''
                  });
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
                  flex: 1
                }}
              >
                {loading ? 'Creating...' : '✅ Create Part & Receive Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

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
      
      {error && !showNewPartForm && (
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
    </div>
  );
};

export default ReceivePart;