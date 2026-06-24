import React, { useState } from 'react';
import axios from 'axios';

const ServiceHistoryReport = ({ token }) => {
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('2025-12-20');
  const [endDate, setEndDate] = useState('2026-06-20');
  const [equipment, setEquipment] = useState('');
  const [technician, setTechnician] = useState('');
  const [category, setCategory] = useState('All Categories');

  const API_URL = 'https://gia-gse-inventory.onrender.com';

  const fetchServiceHistory = async (params) => {
    setLoading(true);
    setError(null);
    
    if (!token) {
      setError('Please login first');
      setLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${API_URL}/api/service-history/all?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 35000
          }
        );
        setServiceHistory(response.data);
        setLoading(false);
        return;
      } catch (err) {
        attempts++;
        if (attempts === maxAttempts) {
          setError(`Failed after ${maxAttempts} attempts: ${err.message}`);
          setLoading(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
      }
    }
  };

  const handleGenerateReport = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (equipment) params.append('equipmentName', equipment);
    if (technician) params.append('technician', technician);
    if (category && category !== 'All Categories') params.append('category', category);
    fetchServiceHistory(params.toString());
  };

  const handleReset = () => {
    setStartDate('2025-12-20');
    setEndDate('2026-06-20');
    setEquipment('');
    setTechnician('');
    setCategory('All Categories');
    setServiceHistory([]);
    setError(null);
  };

  const exportCSV = () => {
    if (serviceHistory.length === 0) {
      alert('No data to export');
      return;
    }
    const headers = ['Equipment', 'Type', 'Maint Type', 'Category', 'Services Performed', 'Current Hours', 'Target Hours', 'Service Date', 'Technician', 'Notes', 'Status', 'Next Service'];
    const rows = serviceHistory.map(item => [
      item.equipment_name || '',
      item.equipment_type || '',
      item.maintenance_type || '',
      item.category || '',
      item.services_performed || '',
      item.current_hours || '',
      item.target_hours || '',
      item.service_date ? new Date(item.service_date).toLocaleDateString() : '',
      item.technician || '',
      item.notes || '',
      item.status || '',
      item.next_service_date ? new Date(item.next_service_date).toLocaleDateString() : ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-history-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Calculate statistics
  const totalRecords = serviceHistory.length;
  const uniqueEquipment = new Set(serviceHistory.map(item => item.equipment_name)).size;
  const uniqueTechnicians = new Set(serviceHistory.map(item => item.technician)).size;
  const totalServices = serviceHistory.filter(item => item.status === 'SERVICED').length;

  return (
    <div style={{ padding: '20px', maxWidth: '100%' }}>
      <h2 style={{ marginBottom: '20px' }}>📋 Service History Report</h2>
      
      {/* Filter Form */}
      <form onSubmit={handleGenerateReport} style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        gap: '15px', 
        flexWrap: 'wrap',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
        alignItems: 'flex-end'
      }}>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '150px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '150px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Equipment</label>
          <input 
            type="text" 
            placeholder="Search equipment..." 
            value={equipment} 
            onChange={(e) => setEquipment(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '180px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Technician</label>
          <input 
            type="text" 
            placeholder="Search technician..." 
            value={technician} 
            onChange={(e) => setTechnician(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '180px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Category</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', width: '150px' }}
          >
            <option>All Categories</option>
            <option>Preventive</option>
            <option>Corrective</option>
            <option>Emergency</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            type="submit" 
            style={{ 
              padding: '10px 25px', 
              backgroundColor: '#2196f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            🔍 Apply
          </button>
          <button 
            type="button" 
            onClick={handleReset}
            style={{ 
              padding: '10px 25px', 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Reset
          </button>
        </div>
      </form>

      {/* Export Buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={exportCSV} 
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📥 Export CSV
        </button>
        <button 
          onClick={() => alert('PDF export coming soon!')} 
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📄 Export PDF
        </button>
      </div>

      {/* Loading and Error States */}
      {loading && <div style={{ textAlign: 'center', padding: '40px', fontSize: '16px' }}>⏳ Loading service history...</div>}
      {error && <div style={{ color: 'red', padding: '15px', backgroundColor: '#fdeaea', borderRadius: '4px', marginBottom: '20px' }}>❌ Error: {error}</div>}

      {/* Statistics */}
      {serviceHistory.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ padding: '15px 25px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '1px solid #bbdefb', flex: '1', minWidth: '150px' }}>
            <h4 style={{ margin: 0, color: '#1565c0' }}>📊 Total Records</h4>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#1565c0' }}>{totalRecords}</p>
          </div>
          <div style={{ padding: '15px 25px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #c8e6c9', flex: '1', minWidth: '150px' }}>
            <h4 style={{ margin: 0, color: '#2e7d32' }}>🛠️ Unique Equipment</h4>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#2e7d32' }}>{uniqueEquipment}</p>
          </div>
          <div style={{ padding: '15px 25px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ffe0b2', flex: '1', minWidth: '150px' }}>
            <h4 style={{ margin: 0, color: '#e65100' }}>👨‍🔧 Unique Technicians</h4>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#e65100' }}>{uniqueTechnicians}</p>
          </div>
          <div style={{ padding: '15px 25px', backgroundColor: '#f3e5f5', borderRadius: '8px', border: '1px solid '#e1bee7', flex: '1', minWidth: '150px' }}>
            <h4 style={{ margin: 0, color: '#6a1b9a' }}>✅ Total Services</h4>
            <p style={{ fontSize: '28px', fontWeight: 'bold', margin: '5px 0 0 0', color: '#6a1b9a' }}>{totalServices}</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      {serviceHistory.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            fontSize: '13px',
            backgroundColor: 'white'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>#</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Equipment</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Type</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Maint Type</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Category</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Services Performed</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Current Hours</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Target Hours</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Service Date</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Technician</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Status</th>
                <th style={{ border: '1px solid #ddd', padding: '10px' }}>Next Service</th>
              </tr>
            </thead>
            <tbody>
              {serviceHistory.map((item, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{item.equipment_name || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.equipment_type || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.maintenance_type || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.category || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.services_performed || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.current_hours || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.target_hours || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {item.service_date ? new Date(item.service_date).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.technician || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <span style={{ 
                      padding: '3px 10px', 
                      borderRadius: '4px', 
                      backgroundColor: item.status === 'SERVICED' ? '#d4edda' : 
                                     item.status === 'DUE SOON' ? '#fff3cd' : 
                                     item.status === 'OVERDUE' ? '#f8d7da' : '#e9ecef',
                      color: item.status === 'SERVICED' ? '#155724' : 
                             item.status === 'DUE SOON' ? '#856404' : 
                             item.status === 'OVERDUE' ? '#721c24' : '#6c757d',
                      fontWeight: 'bold',
                      fontSize: '11px'
                    }}>
                      {item.status || '-'}
                    </span>
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {item.next_service_date ? new Date(item.next_service_date).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ServiceHistoryReport;