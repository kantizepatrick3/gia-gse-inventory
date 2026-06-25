import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MaintenanceHistory.css';

const MaintenanceHistory = ({ token }) => {
  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📊 Fetching equipment list...');
      const response = await axios.get(`${API_URL}/api/gse-maintenance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Equipment loaded:', response.data.equipment?.length || 0);
      setEquipment(response.data.equipment || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      setError('Failed to load equipment data');
      alert('Error loading equipment data');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (equipmentId) => {
    try {
      setLoading(true);
      setError('');
      console.log(`📊 Fetching history for equipment ID: ${equipmentId}`);
      
      const response = await axios.get(`${API_URL}/api/gse-maintenance/${equipmentId}/history?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ History response:', response.data);
      
      // Handle the response format - equipment data might be in different locations
      let equipmentData = response.data.equipment || null;
      let historyData = response.data.history || [];
      
      // If equipment is null but we have data, try to find it
      if (!equipmentData && equipmentId) {
        const found = equipment.find(e => e.id === equipmentId);
        if (found) {
          equipmentData = {
            id: found.id,
            name: found.equipment_name,
            type: found.equipment_type,
            status: found.status,
            last_service_date: found.last_service_date,
            next_service_date: found.next_service_date,
            current_hours: found.current_hours,
            target_hours: found.target_hours
          };
        }
      }
      
      setHistory(historyData);
      setSelectedEquipment(equipmentData);
      
      if (!equipmentData) {
        console.warn('⚠️ No equipment data found for ID:', equipmentId);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setError('Failed to load history data');
      alert('Error loading history data');
      setHistory([]);
      setSelectedEquipment(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'overdue': '🔴 Overdue',
      'due_soon': '🟡 Due Soon',
      'serviced': '✅ Serviced',
      'no_maintenance': '⚪ No Maintenance'
    };
    return badges[status] || status || 'Unknown';
  };

  const getStatusColor = (status) => {
    const colors = {
      'overdue': '#e74c3c',
      'due_soon': '#f39c12',
      'serviced': '#27ae60',
      'no_maintenance': '#95a5a6'
    };
    return colors[status] || '#95a5a6';
  };

  const getCategoryBadge = (category) => {
    if (!category) {
      return {
        bg: '#e9ecef',
        color: '#6c757d',
        text: 'Not specified',
        border: '#ced4da'
      };
    }
    const cat = category.toLowerCase();
    if (cat === 'preventive') {
      return {
        bg: '#e8f5e9',
        color: '#2e7d32',
        text: '🛡️ Preventive',
        border: '#a5d6a7'
      };
    } else if (cat === 'corrective') {
      return {
        bg: '#fce4ec',
        color: '#c62828',
        text: '🔧 Corrective',
        border: '#ef9a9a'
      };
    }
    return {
      bg: '#e9ecef',
      color: '#6c757d',
      text: category || 'Unknown',
      border: '#ced4da'
    };
  };

  const filteredEquipment = equipment.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (searchTerm && !item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatFullDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const exportCSV = () => {
    if (history.length === 0) {
      alert('No history data to export');
      return;
    }
    
    setExportLoading(true);
    
    try {
      const headers = ['Service Date', 'Service Performed', 'Technician', 'Category', 'Hours at Service', 'Next Service Due', 'Interval (Months)', 'Notes'];
      const rows = history.map(h => [
        h.service_date || '',
        h.service_performed || '',
        h.technician || h.technician_name || '',
        h.category || 'Not specified',
        h.hours_at_service || h.current_hours || 0,
        h.next_service_due || '',
        h.interval_months || h.service_interval_months || 0,
        h.notes || ''
      ]);
      
      let csv = headers.join(',') + '\n';
      rows.forEach(row => {
        // Escape commas in fields
        const escapedRow = row.map(field => `"${String(field).replace(/"/g, '""')}"`);
        csv += escapedRow.join(',') + '\n';
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maintenance_history_${selectedEquipment?.name || selectedEquipment?.equipment_name || 'equipment'}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting data');
    } finally {
      setExportLoading(false);
    }
  };

  const exportAllCSV = async () => {
    try {
      setExportLoading(true);
      // Use the /api/service-history/all endpoint
      const response = await axios.get(`${API_URL}/api/service-history/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data || [];
      if (data.length === 0) {
        alert('No data to export');
        setExportLoading(false);
        return;
      }
      
      let csv = 'Equipment,Type,Status,Service Date,Service Performed,Technician,Category,Hours,Notes\n';
      data.forEach(item => {
        csv += `${item.equipment_name || 'N/A'},${item.equipment_type || 'N/A'},${item.status || 'N/A'},${item.service_date || 'N/A'},${item.service_performed || ''},${item.technician_name || ''},${item.category || ''},${item.current_hours || 0},${item.notes || ''}\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_maintenance_history_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting all data');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="maintenance-history-container">
      <h2>📋 Maintenance History</h2>
      
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          borderRadius: '5px',
          margin: '10px 0',
          border: '1px solid #f5c6cb'
        }}>
          ❌ {error}
          <button 
            onClick={() => setError('')}
            style={{
              float: 'right',
              background: 'none',
              border: 'none',
              color: '#721c24',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <label>Filter by Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="overdue">Overdue</option>
            <option value="due_soon">Due Soon</option>
            <option value="serviced">Serviced</option>
            <option value="no_maintenance">No Maintenance</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Search Equipment:</label>
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={exportAllCSV} disabled={exportLoading} className="export-btn">
          {exportLoading ? 'Exporting...' : '📊 Export All History'}
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      <div className="equipment-list">
        <table>
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last Service</th>
              <th>Next Service</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEquipment.length === 0 && !loading && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  No equipment found
                </td>
              </tr>
            )}
            {filteredEquipment.map(item => (
              <tr key={item.id} onClick={() => fetchHistory(item.id)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.equipment_name}</strong></td>
                <td>{item.equipment_type || 'N/A'}</td>
                <td>
                  <span style={{ color: getStatusColor(item.status) }}>
                    {getStatusBadge(item.status)}
                  </span>
                </td>
                <td>{item.last_service_date ? formatDate(item.last_service_date) : 'Never'}</td>
                <td>{item.next_service_date ? formatDate(item.next_service_date) : 'Not scheduled'}</td>
                <td>
                  <button 
                    className="view-history-btn"
                    onClick={(e) => { e.stopPropagation(); fetchHistory(item.id); }}
                  >
                    View History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEquipment && (
        <div className="history-detail">
          <h3>
            History for {selectedEquipment.name || selectedEquipment.equipment_name || 'Equipment'}
            <button className="close-history" onClick={() => { setSelectedEquipment(null); setHistory([]); }}>✕</button>
          </h3>
          
          {/* Equipment Info Card */}
          <div style={{
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            marginBottom: '15px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#666' }}>Status:</span>
                <span style={{ fontWeight: 'bold', marginLeft: '5px', color: getStatusColor(selectedEquipment.status) }}>
                  {getStatusBadge(selectedEquipment.status)}
                </span>
              </div>
              {selectedEquipment.current_hours !== undefined && (
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Current Hours:</span>
                  <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>
                    {selectedEquipment.current_hours} hrs
                    {selectedEquipment.target_hours && (
                      <span style={{ color: '#666', marginLeft: '5px', fontSize: '12px' }}>
                        (target: {selectedEquipment.target_hours} hrs)
                      </span>
                    )}
                  </span>
                </div>
              )}
              {selectedEquipment.last_service_date && (
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Last Service:</span>
                  <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>
                    {formatFullDate(selectedEquipment.last_service_date)}
                  </span>
                </div>
              )}
              {selectedEquipment.next_service_date && (
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Next Service:</span>
                  <span style={{ fontWeight: 'bold', marginLeft: '5px', color: '#1976d2' }}>
                    {formatFullDate(selectedEquipment.next_service_date)}
                  </span>
                </div>
              )}
              {selectedEquipment.maintenance_type && (
                <div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Type:</span>
                  <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>
                    {selectedEquipment.maintenance_type}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="history-actions">
            <button onClick={exportCSV} disabled={exportLoading || history.length === 0} className="export-btn">
              {exportLoading ? 'Exporting...' : '📄 Export CSV'}
            </button>
          </div>
          
          {history.length === 0 ? (
            <p className="no-history">📭 No history records found for this equipment.</p>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Service Date</th>
                  <th>Service Performed</th>
                  <th>Technician</th>
                  <th>Category</th>
                  <th>Hours at Service</th>
                  <th>Next Service Due</th>
                  <th>Interval (Months)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, index) => {
                  const categoryBadge = getCategoryBadge(h.category);
                  return (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{h.service_date ? formatFullDate(h.service_date) : 'N/A'}</td>
                      <td>{h.service_performed || 'Maintenance recorded'}</td>
                      <td>{h.technician || h.technician_name || 'System'}</td>
                      <td>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '4px',
                          backgroundColor: categoryBadge.bg,
                          color: categoryBadge.color,
                          border: `1px solid ${categoryBadge.border}`,
                          fontSize: '11px',
                          fontWeight: 'bold',
                          display: 'inline-block'
                        }}>
                          {categoryBadge.text}
                        </span>
                      </td>
                      <td>{h.hours_at_service || h.current_hours || 0}</td>
                      <td>{h.next_service_due ? formatDate(h.next_service_due) : 'TBD'}</td>
                      <td>{h.interval_months || h.service_interval_months || 0}</td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default MaintenanceHistory;