import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PriceHistory = ({ token }) => {
  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = 'https://gia-gse-inventory.onrender.com';

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

  const fetchPriceHistory = async (partId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/price-history/${partId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPriceHistory(response.data || []);
      const part = parts.find(p => p.id === partId);
      setSelectedPart(part);
    } catch (err) {
      console.error('Error fetching price history:', err);
      setError('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price) => {
    return `$${parseFloat(price || 0).toFixed(2)}`;
  };

  const getPriceChange = (currentPrice, previousPrice) => {
    if (!previousPrice) return null;
    const change = currentPrice - previousPrice;
    const percent = (change / previousPrice) * 100;
    return {
      change,
      percent,
      isPositive: change >= 0
    };
  };

  const filteredParts = parts.filter(part =>
    part.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
        📊 Price History
      </h2>

      {/* Search and Parts List */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Parts List Sidebar */}
        <div style={{
          flex: '0 0 350px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          padding: '15px',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Search parts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            />
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>}

          <div>
            {filteredParts.map(part => (
              <div
                key={part.id}
                onClick={() => fetchPriceHistory(part.id)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: selectedPart?.id === part.id ? '#e3f2fd' : '#f8f9fa',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: selectedPart?.id === part.id ? '2px solid #1976d2' : '2px solid transparent',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  if (selectedPart?.id !== part.id) {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPart?.id !== part.id) {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{part.part_number}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{part.description || 'No description'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: '#1976d2' }}>
                      {formatPrice(part.current_price || part.unit_price)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      Stock: {part.quantity_on_hand || 0}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price History Detail */}
        <div style={{
          flex: 1,
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          padding: '20px',
          minHeight: '400px'
        }}>
          {selectedPart ? (
            <>
              {/* Part Info */}
              <div style={{
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>{selectedPart.part_number}</h3>
                    <p style={{ margin: '5px 0 0 0', color: '#666' }}>{selectedPart.description}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                      {formatPrice(selectedPart.current_price || selectedPart.unit_price)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Current Price
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666' }}>Stock:</span>
                    <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>{selectedPart.quantity_on_hand || 0}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666' }}>Min Stock:</span>
                    <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>{selectedPart.min_stock || 0}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666' }}>Location:</span>
                    <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>{selectedPart.location_bin || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666' }}>Manufacturer:</span>
                    <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>{selectedPart.manufacturer || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Price History Table */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading price history...</div>
              ) : (
                <>
                  {priceHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      No price history available for this part.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>#</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Date</th>
                            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Price</th>
                            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Change</th>
                            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>% Change</th>
                            <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>Quantity</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Type</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceHistory.map((record, index) => {
                            const previousPrice = index < priceHistory.length - 1 
                              ? priceHistory[index + 1].price 
                              : null;
                            const change = getPriceChange(record.price, previousPrice);
                            
                            return (
                              <tr key={record.id || index} style={{
                                backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white'
                              }}>
                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                  {index + 1}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                  {formatDate(record.created_at)}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                                  {formatPrice(record.price)}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                  {change ? (
                                    <span style={{
                                      color: change.isPositive ? '#28a745' : '#dc3545',
                                      fontWeight: 'bold'
                                    }}>
                                      {change.isPositive ? '+' : ''}{formatPrice(change.change)}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                  {change ? (
                                    <span style={{
                                      color: change.isPositive ? '#28a745' : '#dc3545',
                                      fontWeight: 'bold'
                                    }}>
                                      {change.isPositive ? '+' : ''}{change.percent.toFixed(2)}%
                                    </span>
                                  ) : '-'}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                  {record.quantity || 1}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '3px 10px',
                                    borderRadius: '4px',
                                    backgroundColor: record.transaction_type === 'RECEIVE' ? '#d4edda' :
                                                  record.transaction_type === 'ISSUE' ? '#f8d7da' :
                                                  record.transaction_type === 'INITIAL' ? '#e3f2fd' : '#e9ecef',
                                    color: record.transaction_type === 'RECEIVE' ? '#155724' :
                                           record.transaction_type === 'ISSUE' ? '#721c24' :
                                           record.transaction_type === 'INITIAL' ? '#0d47a1' : '#6c757d',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}>
                                    {record.transaction_type || 'MANUAL'}
                                  </span>
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                  {record.notes || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '400px',
              color: '#666'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
              <h3>Select a part to view price history</h3>
              <p style={{ color: '#999' }}>Click on any part from the list on the left</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceHistory;