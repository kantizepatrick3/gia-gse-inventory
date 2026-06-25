import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (equipmentId) => {
    try {
      setLoading(true);
      setError('');
      console.log(`📊 Fetching history for equipment ID: ${equipmentId}`);
      
      const response = await axios.get(`${API_URL}/api/gse-maintenance/${equipmentId}/history?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ History response:', response.data);
      
      let equipmentData = response.data.equipment || null;
      let historyData = response.data.history || [];
      
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
            target_hours: found.target_hours,
            maintenance_type: found.maintenance_type,
            maintenance_category: found.maintenance_category,
            category: found.maintenance_category || found.category
          };
        }
      }
      
      setHistory(historyData);
      setSelectedEquipment(equipmentData);
      setShowHistoryModal(true);
      
      if (!equipmentData) {
        console.warn('⚠️ No equipment data found for ID:', equipmentId);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setError('Failed to load history data');
      setHistory([]);
      setSelectedEquipment(null);
    } finally {
      setLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedEquipment(null);
    setHistory([]);
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

  // ============================================================
  // EXPORT TO EXCEL - Full Equipment History
  // ============================================================
  const exportToExcel = () => {
    if (history.length === 0) {
      alert('No history data to export');
      return;
    }
    
    setExportLoading(true);
    
    try {
      // Prepare data for Excel
      const excelData = history.map((h, index) => ({
        '#': index + 1,
        'Service Date': h.service_date ? formatFullDate(h.service_date) : 'N/A',
        'Service Performed': h.service_performed || 'Maintenance recorded',
        'Technician': h.technician || h.technician_name || 'System',
        'Category': h.category || 'Not specified',
        'Hours at Service': h.hours_at_service || h.current_hours || 0,
        'Next Service Due': h.next_service_due ? formatDate(h.next_service_due) : 'TBD',
        'Interval (Months)': h.interval_months || h.service_interval_months || 0,
        'Notes': h.notes || ''
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 20 },  // Service Date
        { wch: 30 },  // Service Performed
        { wch: 20 },  // Technician
        { wch: 15 },  // Category
        { wch: 15 },  // Hours at Service
        { wch: 20 },  // Next Service Due
        { wch: 18 },  // Interval (Months)
        { wch: 30 }   // Notes
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Maintenance History');
      
      // Generate filename
      const fileName = `maintenance_history_${selectedEquipment?.name || selectedEquipment?.equipment_name || 'equipment'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting data to Excel');
    } finally {
      setExportLoading(false);
    }
  };

  // ============================================================
  // EXPORT TO EXCEL - All Equipment History
  // ============================================================
  const exportAllToExcel = async () => {
    try {
      setExportLoading(true);
      const response = await axios.get(`${API_URL}/api/service-history/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data || [];
      if (data.length === 0) {
        alert('No data to export');
        setExportLoading(false);
        return;
      }
      
      // Prepare data for Excel
      const excelData = data.map((item, index) => ({
        '#': index + 1,
        'Equipment': item.equipment_name || 'N/A',
        'Type': item.equipment_type || 'N/A',
        'Status': item.status || 'N/A',
        'Service Date': item.service_date ? formatFullDate(item.service_date) : 'N/A',
        'Service Performed': item.service_performed || '',
        'Technician': item.technician_name || '',
        'Category': item.category || '',
        'Hours': item.current_hours || 0,
        'Notes': item.notes || ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 20 },  // Equipment
        { wch: 15 },  // Type
        { wch: 15 },  // Status
        { wch: 20 },  // Service Date
        { wch: 30 },  // Service Performed
        { wch: 20 },  // Technician
        { wch: 15 },  // Category
        { wch: 10 },  // Hours
        { wch: 30 }   // Notes
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'All Maintenance History');
      
      const fileName = `all_maintenance_history_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting all data to Excel');
    } finally {
      setExportLoading(false);
    }
  };

  // ============================================================
  // EXPORT TO EXCEL - Single Equipment History (CSV fallback)
  // ============================================================
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
        <button onClick={exportAllToExcel} disabled={exportLoading} className="export-btn">
          {exportLoading ? 'Exporting...' : '📊 Export All to Excel'}
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {/* ============================================================
          MAIN TABLE - Equipment List with All Columns
          ============================================================ */}
      <div className="equipment-list">
        <table className="maintenance-table">
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last Service</th>
              <th>Next Service</th>
              <th>Maintenance Category</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEquipment.length === 0 && !loading && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  No equipment found
                </td>
              </tr>
            )}
            {filteredEquipment.map(item => {
              const categoryBadge = getCategoryBadge(item.maintenance_category || item.category);
              return (
                <tr key={item.id}>
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
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      backgroundColor: categoryBadge.bg,
                      color: categoryBadge.color,
                      border: `1px solid ${categoryBadge.border}`,
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'inline-block'
                    }}>
                      {categoryBadge.text}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="view-history-btn"
                      onClick={() => fetchHistory(item.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      View History
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ============================================================
          HISTORY MODAL - Shows when View History is clicked
          ============================================================ */}
      {showHistoryModal && selectedEquipment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '1200px',
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '25px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #3498db',
              paddingBottom: '15px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>
                📋 Maintenance History for {selectedEquipment.name || selectedEquipment.equipment_name || 'Equipment'}
              </h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  onClick={exportToExcel}
                  disabled={exportLoading || history.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: exportLoading || history.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {exportLoading ? '⏳...' : '📊 Export Excel'}
                </button>
                <button 
                  onClick={exportCSV}
                  disabled={exportLoading || history.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: exportLoading || history.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {exportLoading ? '⏳...' : '📄 Export CSV'}
                </button>
                <button 
                  onClick={closeHistoryModal}
                  style={{
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Equipment Info Card */}
            <div style={{
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              marginBottom: '20px',
              border: '1px solid #e9ecef',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px'
            }}>
              <div>
                <span style={{ fontSize: '12px', color: '#666' }}>Equipment:</span>
                <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>
                  {selectedEquipment.name || selectedEquipment.equipment_name}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#666' }}>Type:</span>
                <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>
                  {selectedEquipment.type || selectedEquipment.equipment_type || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#666' }}>Status:</span>
                <span style={{ fontWeight: 'bold', marginLeft: '5px', color: getStatusColor(selectedEquipment.status) }}>
                  {getStatusBadge(selectedEquipment.status)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#666' }}>Maintenance Category:</span>
                <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>
                  {selectedEquipment.maintenance_category || selectedEquipment.category || 'Not specified'}
                </span>
              </div>
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
            </div>

            {/* History Table */}
            {history.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                📭 No history records found for this equipment.
              </p>
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
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Service Date</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Service Performed</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Technician</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>Category</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>Hours</th>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, index) => {
                      const categoryBadge = getCategoryBadge(h.category);
                      return (
                        <tr key={index} style={{
                          backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white'
                        }}>
                          <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            {h.service_date ? formatFullDate(h.service_date) : 'N/A'}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            {h.service_performed || 'Maintenance recorded'}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            {h.technician || h.technician_name || 'System'}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '20px',
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
                          <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                            {h.hours_at_service || h.current_hours || 0}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                            {h.notes || '-'}
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
      )}
    </div>
  );
};

export default MaintenanceHistory;