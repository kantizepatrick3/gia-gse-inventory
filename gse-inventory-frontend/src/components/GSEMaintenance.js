import React, { useState, useEffect } from 'react';
import axios from 'axios';

const GSEMaintenance = ({ token, user, onMaintenanceUpdate }) => {
  const [equipment, setEquipment] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(null);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [hoursUpdate, setHoursUpdate] = useState({});
  const [showHoursModal, setShowHoursModal] = useState(null);
  
  const [newEquipment, setNewEquipment] = useState({
    equipment_name: '',
    equipment_type: '',
    maintenance_type: 'hour',
    service_interval_hours: 250,
    service_interval_months: 6,
    service_interval_years: 1,
    service_interval_months_for_hour: 0,
    last_service_date: new Date().toISOString().split('T')[0],
    last_service_hours: 0,
    last_service_year: new Date().getFullYear(),
    service_performed: '',
    technician_name: '',
    notes: ''
  });
  
  const [serviceData, setServiceData] = useState({
    service_performed: '',
    technician_name: '',
    notes: '',
    service_date: new Date().toISOString().split('T')[0],
    current_hours: '',
    target_hours: '',
    months_interval: '',
    service_interval_months: '',
    service_interval_years: 1
  });

  const [editData, setEditData] = useState({
    id: null,
    equipment_name: '',
    equipment_type: '',
    maintenance_type: 'hour',
    service_interval_hours: 250,
    service_interval_months: 6,
    service_interval_years: 1,
    service_interval_months_for_hour: 0,
    last_service_date: '',
    last_service_full_date: '',
    last_service_hours: 0,
    last_service_year: null
  });

  const API_URL = 'https://gse-backend.onrender.com';

  useEffect(() => {
    fetchEquipment();
    const interval = setInterval(() => {
      fetchEquipment();
      setLastUpdate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchEquipment = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/gse-maintenance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEquipment(response.data.equipment || []);
    } catch (err) {
      console.error('Error fetching equipment:', err);
      setError('Failed to load maintenance data');
    }
  };

  const fetchAttachments = async (maintenanceId) => {
    try {
      const response = await axios.get(`${API_URL}/api/maintenance-attachments/${maintenanceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttachments(response.data);
    } catch (err) {
      console.error('Error fetching attachments:', err);
    }
  };

  const handleFileUpload = async (maintenanceId, file) => {
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result.split(',')[1];
      try {
        await axios.post(`${API_URL}/api/maintenance-attachment/${maintenanceId}`, {
          filename: file.name,
          file_data: base64String,
          file_type: file.type
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage('✅ File uploaded successfully!');
        fetchAttachments(maintenanceId);
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        setError(err.response?.data?.error || 'Error uploading file');
        setTimeout(() => setError(''), 3000);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (window.confirm('Delete this attachment?')) {
      try {
        await axios.delete(`${API_URL}/api/maintenance-attachment/${attachmentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage('✅ Attachment deleted successfully!');
        if (showAttachmentsModal) {
          fetchAttachments(showAttachmentsModal.id);
        }
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        setError(err.response?.data?.error || 'Error deleting attachment');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const downloadAttachment = async (attachmentId, filename) => {
    try {
      const response = await fetch(`${API_URL}/api/maintenance-attachment/${attachmentId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download file');
      setTimeout(() => setError(''), 3000);
    }
  };

  const updateCurrentHours = async (equipId, currentHours) => {
    try {
      await axios.put(`${API_URL}/api/gse-maintenance/${equipId}/hours`, {
        current_hours: parseInt(currentHours)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ Hours updated successfully!');
      fetchEquipment();
      setShowHoursModal(null);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating hours');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        equipment_name: newEquipment.equipment_name,
        equipment_type: newEquipment.equipment_type,
        maintenance_type: newEquipment.maintenance_type,
        service_performed: newEquipment.service_performed,
        technician_name: newEquipment.technician_name,
        notes: newEquipment.notes
      };
      if (newEquipment.maintenance_type === 'hour') {
        payload.service_interval_hours = parseInt(newEquipment.service_interval_hours);
        payload.service_interval_months_for_hour = parseInt(newEquipment.service_interval_months_for_hour) || 0;
        payload.last_service_date = newEquipment.last_service_date;
        payload.last_service_hours = parseInt(newEquipment.last_service_hours) || 0;
      } else if (newEquipment.maintenance_type === 'month') {
        payload.service_interval_months = parseInt(newEquipment.service_interval_months);
        payload.last_service_date = newEquipment.last_service_date;
      } else if (newEquipment.maintenance_type === 'year') {
        payload.service_interval_years = parseInt(newEquipment.service_interval_years);
        payload.last_service_year = parseInt(newEquipment.last_service_year);
        payload.last_service_date = newEquipment.last_service_date;
      }
      await axios.post(`${API_URL}/api/gse-maintenance`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✅ Equipment added to maintenance schedule!');
      setShowAddForm(false);
      setNewEquipment({
        equipment_name: '',
        equipment_type: '',
        maintenance_type: 'hour',
        service_interval_hours: 250,
        service_interval_months: 6,
        service_interval_years: 1,
        service_interval_months_for_hour: 0,
        last_service_date: new Date().toISOString().split('T')[0],
        last_service_hours: 0,
        last_service_year: new Date().getFullYear(),
        service_performed: '',
        technician_name: '',
        notes: ''
      });
      fetchEquipment();
      if (onMaintenanceUpdate) onMaintenanceUpdate();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error adding equipment');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordService = async (e, equipId) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentEquip = equipment.find(eq => eq.id === equipId);
      if (currentEquip.maintenance_type === 'none') {
        setError('This item requires no maintenance. Cannot record service.');
        setTimeout(() => setError(''), 3000);
        setLoading(false);
        return;
      }
      
      const payload = {
        service_performed: serviceData.service_performed,
        technician_name: serviceData.technician_name,
        notes: serviceData.notes,
        service_date: serviceData.service_date,
        current_hours: serviceData.current_hours,
        target_hours: serviceData.target_hours,
        months_interval: serviceData.months_interval
      };
      
      const response = await axios.post(`${API_URL}/api/gse-maintenance/${equipId}/service`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage(response.data.message || '✅ Service recorded successfully!');
      setShowServiceForm(null);
      setServiceData({
        service_performed: '',
        technician_name: '',
        notes: '',
        service_date: new Date().toISOString().split('T')[0],
        current_hours: '',
        target_hours: '',
        months_interval: '',
        service_interval_months: '',
        service_interval_years: 1
      });
      fetchEquipment();
      if (onMaintenanceUpdate) onMaintenanceUpdate();
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('Error recording service:', err);
      setError(err.response?.data?.error || 'Error recording service');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleEditEquipment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        equipment_name: editData.equipment_name,
        equipment_type: editData.equipment_type,
        maintenance_type: editData.maintenance_type
      };
      
      if (editData.maintenance_type === 'hour') {
        payload.service_interval_hours = parseInt(editData.service_interval_hours);
        payload.service_interval_months_for_hour = parseInt(editData.service_interval_months_for_hour) || 0;
        payload.last_service_date = editData.last_service_date;
        payload.last_service_hours = parseInt(editData.last_service_hours) || 0;
        payload.target_hours = parseInt(editData.service_interval_hours);
      } else if (editData.maintenance_type === 'month') {
        payload.service_interval_months = parseInt(editData.service_interval_months);
        payload.last_service_date = editData.last_service_date;
        // Update next_service_date based on new interval
        if (editData.last_service_date && editData.service_interval_months) {
          const nextDate = new Date(editData.last_service_date);
          nextDate.setMonth(nextDate.getMonth() + parseInt(editData.service_interval_months));
          payload.next_service_date = nextDate.toISOString().split('T')[0];
        }
      } else if (editData.maintenance_type === 'year') {
        payload.service_interval_years = parseInt(editData.service_interval_years);
        payload.last_service_year = editData.last_service_year;
        payload.last_service_full_date = editData.last_service_full_date;
        // Update next_service_date based on new interval
        if (editData.last_service_full_date && editData.service_interval_years) {
          const nextDate = new Date(editData.last_service_full_date);
          nextDate.setFullYear(nextDate.getFullYear() + parseInt(editData.service_interval_years));
          payload.next_service_date = nextDate.toISOString().split('T')[0];
        }
      }
      
      console.log('📝 Updating equipment with payload:', payload);
      
      const response = await axios.put(`${API_URL}/api/gse-maintenance/${editData.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage(response.data.message || '✅ Equipment updated successfully!');
      setEditMode(null);
      fetchEquipment();
      if (onMaintenanceUpdate) onMaintenanceUpdate();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error updating equipment:', err);
      setError(err.response?.data?.error || 'Error updating equipment');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEquipment = async (equipId, equipName) => {
    if (window.confirm(`Delete "${equipName}" from maintenance schedule?`)) {
      try {
        await axios.delete(`${API_URL}/api/gse-maintenance/${equipId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage(`"${equipName}" removed from schedule`);
        fetchEquipment();
        if (onMaintenanceUpdate) onMaintenanceUpdate();
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        setError(err.response?.data?.error || 'Error deleting equipment');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const openEditModal = (eq) => {
    setEditData({
      id: eq.id,
      equipment_name: eq.equipment_name,
      equipment_type: eq.equipment_type || '',
      maintenance_type: eq.maintenance_type,
      service_interval_hours: eq.service_interval_hours || 250,
      service_interval_months: eq.service_interval_months || 6,
      service_interval_years: eq.service_interval_years || 1,
      service_interval_months_for_hour: eq.service_interval_months_for_hour || 0,
      last_service_date: eq.last_service_date || '',
      last_service_full_date: eq.last_service_full_date || '',
      last_service_hours: eq.last_service_hours || 0,
      last_service_year: eq.last_service_year || null
    });
    setEditMode(eq);
  };

  const getMaintenanceTypeIcon = (eq) => {
    if (eq.maintenance_type === 'hour') {
      if (eq.next_service_date && eq.target_hours > 0) return '⏱️+📅 Dual (Hours & Date)';
      if (eq.next_service_date) return '📅 Date + Hours';
      return '⏱️ Hour-based';
    }
    if (eq.maintenance_type === 'month') return '📅 Month-based';
    if (eq.maintenance_type === 'year') return '📆 Year-based';
    if (eq.maintenance_type === 'none') return '⭕ No Maintenance';
    return eq.maintenance_type;
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'overdue': return { color: '#e74c3c', text: '🔴 OVERDUE', bg: '#fdeaea' };
      case 'due_soon': return { color: '#f39c12', text: '🟡 DUE SOON', bg: '#fef5e7' };
      case 'serviced': return { color: '#27ae60', text: '✅ SERVICED', bg: '#eafaf1' };
      case 'no_maintenance': return { color: '#95a5a6', text: '⚪ NO MAINTENANCE', bg: '#f5f5f5' };
      default: return { color: '#95a5a6', text: status, bg: '#f5f5f5' };
    }
  };

  const getRemainingDisplay = (eq) => {
    if (eq.maintenance_type === 'none') return '⚪ No maintenance';
    if (eq.maintenance_type === 'hour') {
      const hrs = eq.remaining_hours || 0;
      const days = eq.days_remaining || 0;
      if (eq.status === 'overdue') {
        if (hrs > 0 && days > 0) return `🔴 ${Math.abs(hrs)} hrs overdue / ${Math.abs(days)} days overdue`;
        if (hrs > 0) return `🔴 ${Math.abs(hrs)} hrs overdue`;
        if (days > 0) return `🔴 ${Math.abs(days)} days overdue`;
        return '🔴 OVERDUE';
      }
      if (eq.status === 'due_soon') {
        if (hrs > 0 && days > 0) return `🟡 ${hrs} hrs remaining / ${days} days remaining - DUE SOON!`;
        if (hrs > 0) return `🟡 ${hrs} hrs remaining - DUE SOON!`;
        if (days > 0) return `🟡 ${days} days remaining - DUE SOON!`;
        return '🟡 DUE SOON!';
      }
      if (hrs > 0 && days > 0) return `✅ ${hrs} hrs remaining / ${days} days remaining`;
      if (hrs > 0) return `✅ ${hrs} hrs remaining`;
      if (days > 0) return `✅ ${days} days remaining`;
      return '✅ Up to date';
    }
    if (eq.maintenance_type === 'month') {
      const days = eq.days_remaining || 0;
      const weeks = (days / 7).toFixed(1);
      if (eq.status === 'overdue') return `🔴 ${eq.daysOverdue || 0} days overdue`;
      if (eq.status === 'due_soon') return `🟡 ${days} days (${weeks} weeks) - DUE SOON!`;
      return `✅ ${days} days (${weeks} weeks)`;
    }
    if (eq.maintenance_type === 'year') {
      if (eq.status === 'overdue') return '🔴 OVERDUE';
      if (eq.status === 'due_soon') return '🟡 DUE THIS YEAR';
      return `✅ ${eq.years_remaining || 0} yrs`;
    }
    return 'N/A';
  };

  const getMonthPreview = (serviceDate, monthsInterval) => {
    if (serviceDate && monthsInterval && parseInt(monthsInterval) > 0) {
      const date = new Date(serviceDate);
      date.setMonth(date.getMonth() + parseInt(monthsInterval));
      return date.toLocaleDateString();
    }
    return 'Enter interval to see preview';
  };

  const getEditMonthPreview = () => {
    if (editData.last_service_date && editData.service_interval_months) {
      const date = new Date(editData.last_service_date);
      date.setMonth(date.getMonth() + parseInt(editData.service_interval_months));
      return date.toLocaleDateString();
    }
    return 'Select date and interval';
  };

  const filteredEquipment = equipment.filter(eq => {
    if (filter !== 'all' && eq.status !== filter) return false;
    if (maintenanceTypeFilter !== 'all' && eq.maintenance_type !== maintenanceTypeFilter) return false;
    return true;
  });

  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2>🔧 GSE Maintenance Schedule</h2>
        <div>
          <span style={{ fontSize: '12px', color: '#666', marginRight: '10px' }}>🔄 Auto-updated: {lastUpdate.toLocaleTimeString()}</span>
          <button onClick={() => setShowAddForm(!showAddForm)} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>{showAddForm ? 'Cancel' : '+ Add Equipment'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={{ backgroundColor: filter === 'all' ? '#3498db' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>All Status</button>
        <button onClick={() => setFilter('overdue')} style={{ backgroundColor: filter === 'overdue' ? '#e74c3c' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>🔴 Overdue</button>
        <button onClick={() => setFilter('due_soon')} style={{ backgroundColor: filter === 'due_soon' ? '#f39c12' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>🟡 Due Soon</button>
        <button onClick={() => setFilter('serviced')} style={{ backgroundColor: filter === 'serviced' ? '#27ae60' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>✅ Serviced</button>
        <button onClick={() => setFilter('no_maintenance')} style={{ backgroundColor: filter === 'no_maintenance' ? '#95a5a6' : '#bdc3c7', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>⚪ No Maintenance</button>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => setMaintenanceTypeFilter('all')} style={{ backgroundColor: maintenanceTypeFilter === 'all' ? '#3498db' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>All Types</button>
        <button onClick={() => setMaintenanceTypeFilter('hour')} style={{ backgroundColor: maintenanceTypeFilter === 'hour' ? '#3498db' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>⏱️ Hour-based</button>
        <button onClick={() => setMaintenanceTypeFilter('month')} style={{ backgroundColor: maintenanceTypeFilter === 'month' ? '#3498db' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>📅 Month-based</button>
        <button onClick={() => setMaintenanceTypeFilter('year')} style={{ backgroundColor: maintenanceTypeFilter === 'year' ? '#3498db' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>📆 Year-based</button>
        <button onClick={() => setMaintenanceTypeFilter('none')} style={{ backgroundColor: maintenanceTypeFilter === 'none' ? '#3498db' : '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>⭕ No Maintenance</button>
      </div>

      <div style={{ backgroundColor: '#d1ecf1', padding: '10px', borderRadius: '5px', marginBottom: '20px', border: '1px solid #bee5eb' }}>
        <p style={{ margin: 0, fontSize: '13px' }}>
          <strong>📊 Dual Condition Hour-based Maintenance:</strong><br />
          📅 <strong>Date Condition:</strong> Enter service date + months interval → Auto-calculates next service date<br />
          ⏱️ <strong>Hours Condition:</strong> Enter current hours + target hours → System compares current vs target<br />
          🔔 <strong>Alert:</strong> Triggers on whichever condition comes FIRST (date OR hours)<br />
          📝 <strong>Daily Update:</strong> Use "Update Hours" button to record daily meter readings<br />
          🟡 <strong>Due Soon:</strong> ≤ 4 days to date OR ≤ 40 hours to target<br />
          🔴 <strong>Overdue:</strong> Date passed OR hours exceeded target<br />
          📎 <strong>Attachments:</strong> Click file to open in new tab<br />
          📅 <strong>Month-based:</strong> Enter custom number of months (1, 2, 3, 4, 6, 12, etc.) - NO fixed default
        </p>
      </div>

      {message && <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px', borderRadius: '5px', margin: '10px 0', border: '1px solid #c3e6cb', whiteSpace: 'pre-line' }}>{message}</div>}
      {error && <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '5px', margin: '10px 0', border: '1px solid #f5c6cb' }}>{error}</div>}

      {/* Add Equipment Form */}
      {showAddForm && (
        <form onSubmit={handleAddEquipment} style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
          <h3>Add GSE Equipment</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div><label style={{ fontWeight: 'bold' }}>Equipment Name *</label><input type="text" required value={newEquipment.equipment_name} onChange={(e) => setNewEquipment({...newEquipment, equipment_name: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
            <div><label style={{ fontWeight: 'bold' }}>Equipment Type</label><input type="text" value={newEquipment.equipment_type} onChange={(e) => setNewEquipment({...newEquipment, equipment_type: e.target.value})} placeholder="e.g., Tow Tractor, GPU" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
            <div><label style={{ fontWeight: 'bold' }}>Maintenance Type *</label>
              <select value={newEquipment.maintenance_type} onChange={(e) => setNewEquipment({...newEquipment, maintenance_type: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                <option value="hour">⏱️ Hour-based (Dual: Date + Hours)</option>
                <option value="month">📅 Month-based</option>
                <option value="year">📆 Year-based</option>
                <option value="none">⭕ No maintenance</option>
              </select>
            </div>
            <div></div>
          </div>
          
          {newEquipment.maintenance_type === 'hour' && (
            <>
              <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Target Hours (Next service at X hours)</label><input type="number" value={newEquipment.service_interval_hours} onChange={(e) => setNewEquipment({...newEquipment, service_interval_hours: parseInt(e.target.value) || 250})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /><small>⚠️ Due Soon when current hours ≤ 40 hours to target</small></div>
              <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Optional: Months Interval (Date-based condition)</label><input type="number" value={newEquipment.service_interval_months_for_hour} onChange={(e) => setNewEquipment({...newEquipment, service_interval_months_for_hour: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /><small>Enter 0 for hours only, or enter months to add date-based condition</small></div>
            </>
          )}
          
          {newEquipment.maintenance_type === 'month' && (
            <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Service Interval (months)</label><input type="number" value={newEquipment.service_interval_months} onChange={(e) => setNewEquipment({...newEquipment, service_interval_months: parseInt(e.target.value) || 6})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          )}
          
          {newEquipment.maintenance_type === 'year' && (
            <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Service Interval (years)</label><input type="number" value={newEquipment.service_interval_years} onChange={(e) => setNewEquipment({...newEquipment, service_interval_years: parseInt(e.target.value) || 1})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          )}
          
          <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Last Service Date</label><input type="date" value={newEquipment.last_service_date} onChange={(e) => setNewEquipment({...newEquipment, last_service_date: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          
          {newEquipment.maintenance_type === 'hour' && (
            <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Current Hours (Meter Reading)</label><input type="number" value={newEquipment.last_service_hours} onChange={(e) => setNewEquipment({...newEquipment, last_service_hours: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          )}
          
          {newEquipment.maintenance_type === 'year' && (
            <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Last Service Year</label><input type="number" value={newEquipment.last_service_year} onChange={(e) => setNewEquipment({...newEquipment, last_service_year: parseInt(e.target.value) || new Date().getFullYear()})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          )}
          
          <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Initial Service Performed</label><input type="text" value={newEquipment.service_performed} onChange={(e) => setNewEquipment({...newEquipment, service_performed: e.target.value})} placeholder="e.g., Initial inspection" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Technician Name</label><input type="text" value={newEquipment.technician_name} onChange={(e) => setNewEquipment({...newEquipment, technician_name: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          <div style={{ marginTop: '15px' }}><label style={{ fontWeight: 'bold' }}>Notes</label><textarea value={newEquipment.notes} onChange={(e) => setNewEquipment({...newEquipment, notes: e.target.value})} rows="2" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
          
          <button type="submit" disabled={loading} style={{ marginTop: '15px', backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>Add Equipment</button>
        </form>
      )}

      {/* Equipment Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Equipment</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Type</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Maint Type</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>📅 Last Service</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Current / Target</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>📊 Next Service</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>⏰ Remaining</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Status</th>
              <th style={{ border: '1px solid #ddd', padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEquipment.map(eq => {
              const statusStyle = getStatusBadge(eq.status);
              const isNoMaintenance = eq.maintenance_type === 'none';
              return (
                <tr key={eq.id} style={{ backgroundColor: statusStyle.bg }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{eq.equipment_name}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{eq.equipment_type || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{getMaintenanceTypeIcon(eq)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>{eq.current_service_display || eq.last_service_date || eq.last_service_year || 'Not recorded'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>{eq.maintenance_type === 'hour' && `${eq.current_hours || 0} / ${eq.target_hours || eq.service_interval_hours || 0} hrs`}{eq.maintenance_type !== 'hour' && '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px', fontWeight: 'bold', color: statusStyle.color === '#e74c3c' ? '#e74c3c' : (statusStyle.color === '#f39c12' ? '#f39c12' : '#0066cc') }}>{eq.next_service_column || eq.next_due_display || 'Not scheduled'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold', color: statusStyle.color }}>{getRemainingDisplay(eq)}{eq.alert_reason && <div style={{ fontSize: '10px' }}>{eq.alert_reason}</div>}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><span style={{ color: statusStyle.color, fontWeight: 'bold' }}>{statusStyle.text}</span></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {eq.maintenance_type === 'hour' && (<button onClick={() => { setHoursUpdate({[eq.id]: eq.current_hours || 0}); setShowHoursModal(eq); }} style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>📝 Update Hours</button>)}
                    <button onClick={() => { setShowAttachmentsModal(eq); fetchAttachments(eq.id); }} style={{ backgroundColor: '#9b59b6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>📎 Files</button>
                    <button onClick={() => openEditModal(eq)} style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>✏️ Edit</button>
                    {!isNoMaintenance && (<button onClick={() => { setShowServiceForm(eq); setServiceData({ ...serviceData, service_date: new Date().toISOString().split('T')[0], current_hours: eq.current_hours || 0, target_hours: eq.target_hours || eq.service_interval_hours || 0, months_interval: '', service_interval_months: '' }); }} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>🔧 Record Service</button>)}
                    {canDelete && (<button onClick={() => handleDeleteEquipment(eq.id, eq.equipment_name)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}>🗑️ Delete</button>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Update Hours Modal */}
      {showHoursModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
            <h3>📝 Update Current Hours</h3>
            <p>Equipment: <strong>{showHoursModal.equipment_name}</strong></p>
            <p>Target Hours: <strong>{showHoursModal.target_hours || showHoursModal.service_interval_hours} hrs</strong></p>
            <p>Current Hours: <strong>{showHoursModal.current_hours} hrs</strong></p>
            {showHoursModal.next_service_date && <p>Next Service Date: <strong>{new Date(showHoursModal.next_service_date).toLocaleDateString()}</strong></p>}
            <div style={{ marginBottom: '20px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>New Current Hours:</label><input type="number" value={hoursUpdate[showHoursModal.id] || showHoursModal.current_hours} onChange={(e) => setHoursUpdate({...hoursUpdate, [showHoursModal.id]: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }} /></div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => updateCurrentHours(showHoursModal.id, hoursUpdate[showHoursModal.id] || showHoursModal.current_hours)} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', flex: 1 }}>✅ Update</button>
              <button onClick={() => setShowHoursModal(null)} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {showAttachmentsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '500px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3>📎 Attachments for: {showAttachmentsModal.equipment_name}</h3>
            
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Upload New File:</label>
              <input type="file" onChange={(e) => { if (e.target.files[0]) { handleFileUpload(showAttachmentsModal.id, e.target.files[0]); } }} disabled={uploading} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              {uploading && <div style={{ marginTop: '10px', color: '#3498db' }}>Uploading...</div>}
              <small style={{ color: '#666' }}>Supported: PDF, Images (JPG, PNG), Documents</small>
            </div>
            
            <h4>Existing Attachments:</h4>
            {attachments.length === 0 ? (
              <p style={{ color: '#666' }}>No attachments yet.</p>
            ) : (
              <div>
                {attachments.map(att => (
                  <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div>
                      <button
                        onClick={() => downloadAttachment(att.id, att.original_filename)}
                        style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px', fontWeight: 'bold', padding: 0 }}
                      >
                        📄 {att.original_filename}
                      </button>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                        Uploaded by {att.uploaded_by} on {new Date(att.created_at).toLocaleDateString()}
                        {att.file_size && <span> | {(att.file_size / 1024).toFixed(2)} KB</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAttachment(att.id)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}>🗑️ Delete</button>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAttachmentsModal(null); setAttachments([]); }} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - FIXED to update maintenance table */}
      {editMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>✏️ Edit Equipment: {editMode.equipment_name}</h3>
            <form onSubmit={handleEditEquipment}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Equipment Name *</label>
                <input type="text" required value={editData.equipment_name} onChange={(e) => setEditData({...editData, equipment_name: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Equipment Type</label>
                <input type="text" value={editData.equipment_type} onChange={(e) => setEditData({...editData, equipment_type: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Maintenance Type *</label>
                <select value={editData.maintenance_type} onChange={(e) => setEditData({...editData, maintenance_type: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <option value="hour">⏱️ Hour-based (Dual: Date + Hours)</option>
                  <option value="month">📅 Month-based</option>
                  <option value="year">📆 Year-based</option>
                  <option value="none">⭕ No Maintenance</option>
                </select>
              </div>
              
              {editData.maintenance_type === 'hour' && (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Service Interval (hours) *</label>
                    <input type="number" required value={editData.service_interval_hours} onChange={(e) => setEditData({...editData, service_interval_hours: parseInt(e.target.value) || 250})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    <small>Target hours until next service</small>
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Months Interval (Date condition)</label>
                    <input type="number" value={editData.service_interval_months_for_hour} onChange={(e) => setEditData({...editData, service_interval_months_for_hour: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    <small>Enter 0 for hours only, or enter months for dual condition</small>
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Last Service Date</label>
                    <input type="date" value={editData.last_service_date || ''} onChange={(e) => setEditData({...editData, last_service_date: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Last Service Hours</label>
                    <input type="number" value={editData.last_service_hours || 0} onChange={(e) => setEditData({...editData, last_service_hours: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </div>
                </>
              )}
              
              {editData.maintenance_type === 'month' && (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Service Interval (months) *</label>
                    <input type="number" required value={editData.service_interval_months} onChange={(e) => setEditData({...editData, service_interval_months: parseInt(e.target.value) || 6})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    <small>Number of months until next service</small>
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Last Service Date *</label>
                    <input type="date" required value={editData.last_service_date || ''} onChange={(e) => setEditData({...editData, last_service_date: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </div>
                  <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e8f4fd', borderRadius: '5px' }}>
                    <small>📅 Preview: Next service will be due on: <strong>{getEditMonthPreview()}</strong></small>
                  </div>
                </>
              )}
              
              {editData.maintenance_type === 'year' && (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Service Interval (years) *</label>
                    <input type="number" required value={editData.service_interval_years} onChange={(e) => setEditData({...editData, service_interval_years: parseInt(e.target.value) || 1})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Last Service Full Date</label>
                    <input type="date" value={editData.last_service_full_date || ''} onChange={(e) => setEditData({...editData, last_service_full_date: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </div>
                </>
              )}
              
              <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
                <small style={{ color: '#856404' }}>⚠️ Note: Changes will update both maintenance schedule and parts list.</small>
              </div>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <button type="submit" disabled={loading} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '5px', cursor: 'pointer', flex: 1, fontSize: '16px', fontWeight: 'bold' }}>
                  {loading ? 'Saving...' : '✅ Save Changes'}
                </button>
                <button type="button" onClick={() => { setEditMode(null); }} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Service Modal */}
      {showServiceForm && showServiceForm.maintenance_type !== 'none' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '650px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>🔧 Record Service for: {showServiceForm.equipment_name}</h3>
            <p>Maintenance Type: <strong>{getMaintenanceTypeIcon(showServiceForm)}</strong></p>
            <form onSubmit={(e) => handleRecordService(e, showServiceForm.id)}>
              <div style={{ marginBottom: '20px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>📅 Service Date *</label><input type="date" required value={serviceData.service_date} onChange={(e) => setServiceData({...serviceData, service_date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /><small style={{ color: '#666' }}>Date when service was performed</small></div>
              
              {showServiceForm.maintenance_type === 'hour' && (
                <>
                  <div style={{ marginBottom: '20px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>⏱️ Current Hours (Meter Reading)</label><input type="number" value={serviceData.current_hours} onChange={(e) => setServiceData({...serviceData, current_hours: e.target.value})} placeholder="Enter current meter reading" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /><small style={{ color: '#666' }}>Current hour meter reading at time of service</small></div>
                  <div style={{ marginBottom: '20px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🎯 Target Hours (Next service at X hours)</label><input type="number" value={serviceData.target_hours} onChange={(e) => setServiceData({...serviceData, target_hours: e.target.value})} placeholder="Enter target hours for next service" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /><small style={{ color: '#666' }}>Example: 600 hours - system will compare current vs target</small></div>
                  <div style={{ marginBottom: '20px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>📅 Months Interval (Optional - for date-based condition)</label><input type="number" value={serviceData.months_interval} onChange={(e) => setServiceData({...serviceData, months_interval: e.target.value})} placeholder="Enter months for date-based condition" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /><small style={{ color: '#666' }}>Example: 6 months - next service date will be calculated automatically</small></div>
                </>
              )}
              
              {showServiceForm.maintenance_type === 'month' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>📅 Service Interval (months) *</label>
                  <input 
                    type="number" 
                    value={serviceData.months_interval} 
                    onChange={(e) => {
                      const interval = e.target.value;
                      setServiceData({
                        ...serviceData, 
                        months_interval: interval,
                        service_interval_months: interval
                      });
                    }} 
                    placeholder="Enter number of months (e.g., 1, 2, 3, 4, 6, 12)"
                    min="1"
                    step="1"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                  />
                  <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                    Current interval in database: {showServiceForm.service_interval_months || 'Not set'} months
                    <br />
                    <strong>Enter the number of months until next service (NO fixed default)</strong>
                  </small>
                </div>
              )}
              
              {showServiceForm.maintenance_type === 'year' && (
                <div style={{ marginBottom: '20px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Service Interval (years)</label><input type="number" value={serviceData.service_interval_years} onChange={(e) => setServiceData({...serviceData, service_interval_years: e.target.value})} placeholder={`Current: ${showServiceForm.service_interval_years || 1} years`} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /></div>
              )}
              
              {showServiceForm.maintenance_type === 'month' && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4fd', borderRadius: '8px', border: '2px solid #2196f3' }}>
                  <strong style={{ fontSize: '14px' }}>📋 Calculation Preview:</strong><br />
                  <span style={{ fontSize: '13px' }}>Service Date: <strong>{serviceData.service_date}</strong><br />Interval: <strong>{serviceData.months_interval || '?'}</strong> months<br />→ Next service due on: <strong>{getMonthPreview(serviceData.service_date, serviceData.months_interval)}</strong></span>
                </div>
              )}
              
              <div style={{ marginBottom: '15px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Service Performed *</label><input type="text" required value={serviceData.service_performed} onChange={(e) => setServiceData({...serviceData, service_performed: e.target.value})} placeholder="e.g., Oil change, Inspection, Calibration" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /></div>
              
              <div style={{ marginBottom: '15px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Technician Name</label><input type="text" value={serviceData.technician_name} onChange={(e) => setServiceData({...serviceData, technician_name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /></div>
              
              <div style={{ marginBottom: '15px' }}><label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Notes</label><textarea value={serviceData.notes} onChange={(e) => setServiceData({...serviceData, notes: e.target.value})} rows="2" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} /></div>
              
              <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '5px', cursor: 'pointer', flex: 1, fontSize: '16px', fontWeight: 'bold' }}>{loading ? 'Saving...' : '✅ Record Service'}</button>
                <button type="button" onClick={() => { setShowServiceForm(null); setServiceData({ service_performed: '', technician_name: '', notes: '', service_date: new Date().toISOString().split('T')[0], current_hours: '', target_hours: '', months_interval: '', service_interval_months: '', service_interval_years: 1 }); }} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSEMaintenance;