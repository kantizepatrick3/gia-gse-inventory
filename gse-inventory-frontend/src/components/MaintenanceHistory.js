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

  const API_URL = process.env.REACT_APP_API_URL || 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/gse-maintenance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEquipment(response.data.equipment || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      alert('Error loading equipment data');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (equipmentId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/gse-maintenance/${equipmentId}/history?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(response.data.history || []);
      setSelectedEquipment(response.data.equipment);
    } catch (error) {
      console.error('Error fetching history:', error);
      alert('Error loading history data');
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
    return badges[status] || status;
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

  const filteredEquipment = equipment.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (searchTerm && !item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const exportCSV = () => {
    if (history.length === 0) {
      alert('No history data to export');
      return;
    }
    
    setExportLoading(true);
    
    try {
      const headers = ['Service Date', 'Service Performed', 'Technician', 'Hours at Service', 'Next Service Due', 'Interval (Months)', 'Notes'];
      const rows = history.map(h => [
        h.service_date || '',
        h.service_performed || '',
        h.technician || '',
        h.hours_at_service || 0,
        h.next_service_due || '',
        h.interval_months || 0,
        h.notes || ''
      ]);
      
      let csv = headers.join(',') + '\n';
      rows.forEach(row => {
        csv += row.join(',') + '\n';
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maintenance_history_${selectedEquipment?.name || 'equipment'}_${new Date().toISOString().split('T')[0]}.csv`;
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
      const response = await axios.get(`${API_URL}/api/reports/maintenance-history-all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data.equipment_history || [];
      if (data.length === 0) {
        alert('No data to export');
        setExportLoading(false);
        return;
      }
      
      let csv = 'Equipment,Type,Status,Last Service,Next Service,Current Hours,Target Hours,History Count\n';
      data.forEach(item => {
        csv += `${item.equipment.name},${item.equipment.type || 'N/A'},${item.equipment.status},${item.equipment.last_service_date},${item.equipment.next_service_date},${item.equipment.current_hours},${item.equipment.target_hours},${item.history_count}\n`;
        // Add history rows
        item.history.forEach(h => {
          csv += `,,,${h.service_date},${h.service_performed},${h.technician},${h.hours_at_service}\n`;
        });
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
      <h2>Maintenance History</h2>
      
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
            {filteredEquipment.map(item => (
              <tr key={item.id} onClick={() => fetchHistory(item.id)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.equipment_name}</strong></td>
                <td>{item.equipment_type || 'N/A'}</td>
                <td>
                  <span style={{ color: getStatusColor(item.status) }}>
                    {getStatusBadge(item.status)}
                  </span>
                </td>
                <td>{item.last_service_date || 'Never'}</td>
                <td>{item.next_service_date || 'Not scheduled'}</td>
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
            History for {selectedEquipment.name}
            <button className="close-history" onClick={() => { setSelectedEquipment(null); setHistory([]); }}>✕</button>
          </h3>
          <div className="history-actions">
            <button onClick={exportCSV} disabled={exportLoading || history.length === 0} className="export-btn">
              {exportLoading ? 'Exporting...' : '📄 Export CSV'}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="no-history">No history records found for this equipment.</p>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Service Date</th>
                  <th>Service Performed</th>
                  <th>Technician</th>
                  <th>Hours at Service</th>
                  <th>Next Service Due</th>
                  <th>Interval (Months)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{h.service_date || 'N/A'}</td>
                    <td>{h.service_performed || 'Maintenance recorded'}</td>
                    <td>{h.technician || 'System'}</td>
                    <td>{h.hours_at_service || 0}</td>
                    <td>{h.next_service_due || 'TBD'}</td>
                    <td>{h.interval_months || 0}</td>
                    <td>{h.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default MaintenanceHistory;