import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ReceivePart.css';

const ReceivePart = ({ token }) => {
  const [parts, setParts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPart, setSelectedPart] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [updatePrice, setUpdatePrice] = useState(false);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/parts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParts(response.data || []);
    } catch (err) {
      console.error('Error fetching parts:', err);
      setError('Failed to load parts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPart) {
      setError('Please select a part');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        items: [{
          part_id: selectedPart.id,
          part_number: selectedPart.part_number,
          quantity: parseInt(quantity),
          unit_price: updatePrice ? parseFloat(unitPrice) : 0,
          location_bin: location,
          supplier: supplier,
          po_number: poNumber,
          notes: notes
        }]
      };

      console.log('📥 Receiving part:', payload);

      const response = await axios.post(`${API_URL}/api/receive-parts`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('✅ Receive response:', response.data);

      setSuccess(true);
      
      if (updatePrice) {
        setMessage(`✅ Successfully received ${quantity} of ${selectedPart.part_number} with price updated to $${parseFloat(unitPrice).toFixed(2)}`);
      } else {
        setMessage(`✅ Successfully received ${quantity} of ${selectedPart.part_number}`);
      }
      
      // Reset form
      setSelectedPart(null);
      setQuantity(1);
      setUnitPrice(0);
      setUpdatePrice(false);
      setNotes('');
      setLocation('');
      setSupplier('');
      setPoNumber('');
      setSearchTerm('');

      // Refresh parts list
      await fetchParts();

      setTimeout(() => {
        setMessage('');
        setSuccess(false);
      }, 5000);

    } catch (err) {
      console.error('Error receiving part:', err);
      setError(err.response?.data?.error || 'Failed to receive part');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(part =>
    part.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="receive-part-container">
      <h2>📥 Receive Parts</h2>

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="receive-form">
        {/* Part Selection */}
        <div className="form-group">
          <label>Search Part *</label>
          <input
            type="text"
            placeholder="🔍 Search by part number or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <div className="parts-list">
            {filteredParts.length === 0 ? (
              <div className="no-parts">No parts found</div>
            ) : (
              filteredParts.map(part => (
                <div
                  key={part.id}
                  onClick={() => {
                    setSelectedPart(part);
                    setSearchTerm(`${part.part_number} - ${part.description}`);
                    setUnitPrice(part.current_price || part.unit_price || 0);
                  }}
                  className={`part-item ${selectedPart?.id === part.id ? 'selected' : ''}`}
                >
                  <div>
                    <strong>{part.part_number}</strong>
                    <span className="part-description">{part.description}</span>
                  </div>
                  <div className="part-price">
                    ${(part.current_price || part.unit_price || 0).toFixed(2)}
                    <span className="part-stock">Stock: {part.quantity_on_hand || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {selectedPart && (
            <div className="selected-part">
              <strong>Selected:</strong> {selectedPart.part_number} - {selectedPart.description}
              <span className="current-stock">Current Stock: {selectedPart.quantity_on_hand || 0}</span>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className="form-group">
          <label>Quantity *</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            required
          />
        </div>

        {/* Price Update Toggle */}
        <div className="price-update-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={updatePrice}
              onChange={(e) => setUpdatePrice(e.target.checked)}
            />
            <span className="checkbox-text">💰 Update price when receiving</span>
          </label>
          {updatePrice && (
            <div className="price-input-group">
              <label>New Unit Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required={updatePrice}
              />
              {selectedPart && (
                <div className="current-price-info">
                  Current price: ${(selectedPart.current_price || selectedPart.unit_price || 0).toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Additional Fields */}
        <div className="form-row">
          <div className="form-group">
            <label>Location Bin</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., A-01"
            />
          </div>
          <div className="form-group">
            <label>Supplier</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Supplier name"
            />
          </div>
        </div>

        <div className="form-group">
          <label>PO Number</label>
          <input
            type="text"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="Purchase Order #"
          />
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows="3"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !selectedPart}
          className="submit-btn"
        >
          {loading ? '⏳ Processing...' : '📥 Receive Part'}
        </button>
      </form>
    </div>
  );
};

export default ReceivePart;