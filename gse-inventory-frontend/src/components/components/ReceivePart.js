import React, { useState } from 'react';
import axios from 'axios';

const ReceivePart = ({ token }) => {
  const [formData, setFormData] = useState({
    part_number: '',
    quantity: '',
    reference_number: '',
    notes: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://172.16.0.4:5000/api/transactions/receive', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Parts received successfully!');
      setError('');
      setFormData({ part_number: '', quantity: '', reference_number: '', notes: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error receiving parts');
      setMessage('');
    }
  };

  return (
    <div>
      <h2>Receive Spare Parts</h2>
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
          <label>PO / Reference Number</label>
          <input
            type="text"
            value={formData.reference_number}
            onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
          />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
          />
        </div>
        <button type="submit">Receive Parts</button>
        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
};

export default ReceivePart;
