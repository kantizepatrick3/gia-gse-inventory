import React, { useState, useEffect } from 'react';
import axios from 'axios';

const GSEStatus = ({ token, user }) => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ total: 0, in_service: 0, out_of_service: 0 });
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchEquipment();
    fetchSummary();
  }, []);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/gse-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEquipment(response.data || []);
    } catch (err) {
      console.error('Error fetching equipment:', err);
      setError('Failed to load equipment data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/gse-status/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(response.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      setLoading(true);
      await axios.put(`${API_URL}/api/gse-status/${id}`, 
        { gse_status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`✅ Status updated to "${newStatus}"`);
      fetchEquipment();
      fetchSummary();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating status');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      window.open(`${API_URL}/api/gse-status/export?token=${token}`, '_blank');
    } catch (err) {
      setError('Failed to export report');
      setTimeout(() => setError(''), 3000);
    }
  };

  const filteredEquipment = equipment.filter(eq => {
    if (filter !== 'all' && eq.gse_status !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return eq.equipment_name.toLowerCase().includes(term) ||
             (eq.equipment_type && eq.equipment_type.toLowerCase().includes(term));
    }
    return true;
  });

  const getStatusStyle = (status) => {
    if (status === 'In-Service') {
      return { color: '#27ae60', bg: '#d4edda', icon: '🟢' };
    }
    return { color: '#e74c3c', bg: '#fdeaea', icon: '🔴' };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <h2>📊 GSE Equipment Status</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={exportReport}
            style={{
              backgroundColor: '#2c3e50',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            📎 Export to Excel
          </button>
          <button
            onClick={() => { fetchEquipment(); fetchSummary(); }}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{
          backgroundColor: '#3498db',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '24px' }}>{summary.total}</h3>
          <p style={{ margin: '5px 0 0' }}>Total Equipment</p>
        </div>
        <div style={{
          backgroundColor: '#27ae60',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '24px' }}>{summary.in_service}</h3>
          <p style={{ margin: '5px 0 0' }}>🟢 In-Service</p>
        </div>
        <div style={{
          backgroundColor: '#e74c3c',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '24px' }}>{summary.out_of_service}</h3>
          <p style={{ margin: '5px 0 0' }}>🔴 Out-of-Service</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="🔍 Search equipment..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            flex: '1',
            minWidth: '200px'
          }}
        />
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              backgroundColor: filter === 'all' ? '#3498db' : '#95a5a6',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('In-Service')}
            style={{
              backgroundColor: filter === 'In-Service' ? '#27ae60' : '#95a5a6',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🟢 In-Service
          </button>
          <button
            onClick={() => setFilter('Out-of-Service')}
            style={{
              backgroundColor: filter === 'Out-of-Service' ? '#e74c3c' : '#95a5a6',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔴 Out-of-Service
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '12px',
          borderRadius: '5px',
          marginBottom: '15px',
          border: '1px solid #c3e6cb'
        }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '12px',
          borderRadius: '5px',
          marginBottom: '15px',
          border: '1px solid #f5c6cb'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Equipment Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>#</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Equipment</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>GSE Status</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Last Updated</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Maintenance Status</th>
              <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                  Loading...
                </td>
              </tr>
            ) : filteredEquipment.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                  No equipment found.
                </td>
              </tr>
            ) : (
              filteredEquipment.map((eq, index) => {
                const statusStyle = getStatusStyle(eq.gse_status);
                const isInService = eq.gse_status === 'In-Service';
                
                return (
                  <tr key={eq.id} style={{ backgroundColor: statusStyle.bg }}>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                      {index + 1}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                      {eq.equipment_name}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      {eq.equipment_type || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      <span style={{
                        color: statusStyle.color,
                        fontWeight: 'bold',
                        backgroundColor: statusStyle.bg,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        display: 'inline-block'
                      }}>
                        {statusStyle.icon} {eq.gse_status}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {eq.gse_status_updated_at ? new Date(eq.gse_status_updated_at).toLocaleString() : '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      {eq.maintenance_status || eq.status || 'Unknown'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => updateStatus(eq.id, isInService ? 'Out-of-Service' : 'In-Service')}
                        disabled={loading}
                        style={{
                          backgroundColor: isInService ? '#e74c3c' : '#27ae60',
                          color: 'white',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {isInService ? '🔴 Mark Out-of-Service' : '🟢 Mark In-Service'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GSEStatus;