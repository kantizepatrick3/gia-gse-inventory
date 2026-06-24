import React, { useState } from 'react';
import axios from 'axios';

const IssuePart = ({ token }) => {
  const [formData, setFormData] = useState({
    part_number: '',
    quantity: '',
    gse_registration: '',
    technician_name: '',
    work_order: '',
    notes: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://172.16.0.4:5000/api/transactions/issue', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Parts issued successfully!');
      setError('');
      setFormData({
        part_number: '',
        quantity: '',
        gse_registration: '',
        technician_name: '',
        work_order: '',
        notes: ''
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Error issuing parts');
      setMessage('');
    }
  };

  return (
    <div>
      <h2>Issue Spare Parts</h2>
      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-group">
          <label>Part Number *</label>
          <input
            type="text"
            placeholder="Scan or type part number"
            value={formData.part_number}
            onChange={(e) => setFormData({...formData, part_number: e.target.value})}
            required
          />
        </div>
        <div className="form-group">
          <label>Quantity *</label>
          <input
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({...formData, quantity: e.target.value})}
            required
          />
        </div>
        <div className="form-group">
          <label>GSE Registration Number *</label>
          <input
            type="text"
            placeholder="e.g., TB200-05, GPU-102"
            value={formData.gse_registration}
            onChange={(e) => setFormData({...formData, gse_registration: e.target.value})}
            required
          />
        </div>
        <div className="form-group">
          <label>Technician Name</label>
          <input
            type="text"
            value={formData.technician_name}
            onChange={(e) => setFormData({...formData, technician_name: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Work Order Number</label>
          <input
            type="text"
            value={formData.work_order}
            onChange={(e) => setFormData({...formData, work_order: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
          />
        </div>
        <button type="submit">Issue Parts</button>
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
};

export default IssuePart;
