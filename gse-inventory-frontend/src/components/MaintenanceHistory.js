import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MaintenanceHistory = ({ token }) => {
  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const API_URL = 'https://gia-gse-inventory.onrender.com';

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
    } catch (err) {
      console.error('Error fetching equipment:', err);
      setError('Failed to load equipment list');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (equipId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/gse-maintenance/${equipId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoryData(response.data.history || []);
      setShowModal(true);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to load service history');
    } finally {
      setLoading(false);
    }
  };

  const openHistory = (equip) => {
    setSelectedEquipment(equip);
    fetchHistory(equip.id);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEquipment(null);
    setHistoryData([]);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'overdue': return { color: '#e74c3c', text: '🔴 OVERDUE', bg: '#fdeaea' };
      case 'due_soon': return { color: '#f39c12', text: '🟡 DUE SOON', bg: '#fef5e7' };
      case 'serviced': return { color: '#27ae60', text: '✅ SERVICED', bg: '#eafaf1' };
      case 'no_maintenance': return { color: '#95a5a6', text: '⚪ NO MAINTENANCE', bg: '#f5f5f5' };
      default: return { color: '#95a5a6', text: status || 'UNKNOWN', bg: '#f5f5f5' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'Not scheduled';
    }
  };

  if (loading && equipment.length === 0) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading maintenance records...</div>;
  }

  return (
    <div>
      <h2>📋 Service History</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        View service history for all GSE equipment.
      </p>

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '5px',
          margin: '10px 0',
          border: '1px solid #f5c6cb'
        }}>
          ❌ {error}
        </div>
      )}

      {equipment.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          border: '1px dashed #ddd'
        }}>
          <p style={{ fontSize: '18px', color: '#666' }}>No maintenance records found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Equipment</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Last Service</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Next Service</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Service Performed</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Maintenance Category</th>
                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map(eq => {
                const statusStyle = getStatusBadge(eq.status);
                // Get last service info
                const lastService = eq.last_service_date || eq.date_performed || eq.last_service_year || 'Not recorded';
                const lastServiceDisplay = typeof lastService === 'string' && lastService.includes('-') 
                  ? formatDate(lastService) 
                  : lastService;
                
                // Get category display for main table
                let categoryDisplay = 'Not specified';
                let categoryColor = '#95a5a6';
                let categoryBg = '#f5f5f5';
                
                if (eq.maintenance_category) {
                  const cat = eq.maintenance_category.toLowerCase();
                  if (cat === 'preventive') {
                    categoryDisplay = '🛡️ Preventive';
                    categoryColor = '#27ae60';
                    categoryBg = '#eafaf1';
                  } else if (cat === 'corrective') {
                    categoryDisplay = '🔧 Corrective';
                    categoryColor = '#e74c3c';
                    categoryBg = '#fdeaea';
                  } else {
                    categoryDisplay = eq.maintenance_category;
                  }
                }
                
                return (
                  <tr key={eq.id} style={{ backgroundColor: statusStyle.bg }}>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                      {eq.equipment_name}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      {eq.equipment_type || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      <span style={{ color: statusStyle.color, fontWeight: 'bold' }}>
                        {statusStyle.text}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {lastServiceDisplay}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                      {formatDate(eq.next_service_date)}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {eq.service_performed || 'No service recorded'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      <span style={{
                        backgroundColor: categoryBg,
                        color: categoryColor,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {categoryDisplay}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => openHistory(eq)}
                        style={{
                          backgroundColor: '#3498db',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        📋 View History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Service History Modal */}
      {showModal && selectedEquipment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0 }}>📋 Service History for {selectedEquipment.equipment_name}</h3>
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Equipment Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '15px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <div>
                <strong>Equipment:</strong> {selectedEquipment.equipment_name}
              </div>
              <div>
                <strong>Type:</strong> {selectedEquipment.equipment_type || '-'}
              </div>
              <div>
                <strong>Status:</strong> {getStatusBadge(selectedEquipment.status).text}
              </div>
              <div>
                <strong>Hours:</strong> {selectedEquipment.current_hours || 0} / {selectedEquipment.target_hours || selectedEquipment.service_interval_hours || 0}
              </div>
              <div>
                <strong>Last Service:</strong> {formatDate(selectedEquipment.last_service_date)}
              </div>
              <div>
                <strong>Next Service:</strong> {formatDate(selectedEquipment.next_service_date)}
              </div>
            </div>

            {/* Total Services Count */}
            <div style={{
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#e3f2fd',
              borderRadius: '5px',
              fontSize: '14px'
            }}>
              <strong>Total Services:</strong> {historyData.length}
            </div>

            {/* Service History Table */}
            {historyData.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
                border: '1px dashed #ddd'
              }}>
                <p style={{ fontSize: '16px', color: '#666' }}>No service history recorded for this equipment.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                      <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Service Date</th>
                      <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Service Performed</th>
                      <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Technician</th>
                      <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Hours</th>
                      <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((record, index) => {
                      // Determine category display
                      let categoryDisplay = 'Not specified';
                      let categoryColor = '#95a5a6';
                      let categoryBg = '#f5f5f5';
                      
                      if (record.maintenance_category) {
                        const category = record.maintenance_category.toLowerCase();
                        if (category === 'preventive') {
                          categoryDisplay = '🛡️ Preventive';
                          categoryColor = '#27ae60';
                          categoryBg = '#eafaf1';
                        } else if (category === 'corrective') {
                          categoryDisplay = '🔧 Corrective';
                          categoryColor = '#e74c3c';
                          categoryBg = '#fdeaea';
                        } else {
                          categoryDisplay = record.maintenance_category;
                        }
                      }
                      
                      return (
                        <tr key={record.id || index} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                            {index + 1}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                            {record.service_date ? new Date(record.service_date).toLocaleString() : '-'}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                            {record.service_performed || '-'}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                            {record.technician_name || '-'}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                            <span style={{
                              backgroundColor: categoryBg,
                              color: categoryColor,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {categoryDisplay}
                            </span>
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                            {record.current_hours || 0}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                            {record.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{
                  marginTop: '10px',
                  padding: '8px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#666',
                  textAlign: 'right'
                }}>
                  Showing {historyData.length} service records
                </div>
              </div>
            )}

            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceHistory;