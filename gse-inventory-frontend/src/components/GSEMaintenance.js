// FORCE DEPLOY: next_service_date fix - June 22, 2026
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ============================================================
// MAINTENANCE INFO COMPONENT (Collapsible - Saves Space)
// ============================================================
const MaintenanceInfo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginBottom: '15px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 20px',
          backgroundColor: isOpen ? '#e8f4fd' : '#2196f3',
          color: isOpen ? '#0d47a1' : 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
          width: '100%',
          justifyContent: 'space-between',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          {isOpen ? 'Hide Maintenance Information' : 'Show Maintenance Information'}
        </span>
        <span style={{ 
          fontSize: '18px',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{
          marginTop: '10px',
          padding: '20px',
          backgroundColor: '#f0f7ff',
          border: '1px solid #b3d4fc',
          borderRadius: '8px',
          animation: 'slideDown 0.3s ease'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px',
            fontSize: '14px'
          }}>
            <div>
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#0d47a1', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📅</span> Date Condition
                </h4>
                <p style={{ margin: '0 0 5px 20px', color: '#333', fontSize: '13px' }}>
                  Enter service date + months interval
                </p>
                <p style={{ margin: '0 0 5px 20px', color: '#555', fontSize: '12px' }}>
                  → Auto-calculates next service date
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#0d47a1', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏱️</span> Hours Condition
                </h4>
                <p style={{ margin: '0 0 5px 20px', color: '#333', fontSize: '13px' }}>
                  Enter current hours + target hours
                </p>
                <p style={{ margin: '0 0 5px 20px', color: '#555', fontSize: '12px' }}>
                  → System compares current vs target
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#0d47a1', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔔</span> Alert System
                </h4>
                <p style={{ margin: '0 0 5px 20px', color: '#333', fontSize: '13px' }}>
                  Triggers on whichever condition comes FIRST
                </p>
                <p style={{ margin: '0 0 5px 20px', color: '#555', fontSize: '12px' }}>
                  (Date OR Hours condition)
                </p>
              </div>
            </div>

            <div>
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#0d47a1', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📝</span> Daily Updates
                </h4>
                <p style={{ margin: '0 0 5px 20px', color: '#333', fontSize: '13px' }}>
                  Use <strong>"Update Hours"</strong> button
                </p>
                <p style={{ margin: '0 0 5px 20px', color: '#555', fontSize: '12px' }}>
                  Record daily meter readings
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#0d47a1', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📊</span> Status Indicators
                </h4>
                <div style={{ marginLeft: '20px' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>
                    <span style={{ color: '#f39c12', fontWeight: 'bold' }}>🟡 Due Soon:</span>
                    <span style={{ color: '#555', fontSize: '12px', marginLeft: '5px' }}>
                      ≤ 4 days to date OR ≤ 40 hours to target
                    </span>
                  </p>
                  <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>
                    <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>🔴 Overdue:</span>
                    <span style={{ color: '#555', fontSize: '12px', marginLeft: '5px' }}>
                      Date passed OR hours exceeded target
                    </span>
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ color: '#0d47a1', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📎</span> Attachments
                </h4>
                <p style={{ margin: '0 0 5px 20px', color: '#333', fontSize: '13px' }}>
                  Click file to open in new tab
                </p>
              </div>

              <div>
                <h4 style={{ color: '#0d47a1', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📅</span> Month-based Maintenance
                </h4>
                <p style={{ margin: '0 0 5px 20px', color: '#333', fontSize: '13px' }}>
                  Enter custom number of months
                </p>
                <p style={{ margin: '0 0 5px 20px', color: '#555', fontSize: '12px' }}>
                  (1, 2, 3, 4, 6, 12, etc.) - NO fixed default
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

// ============================================================
// MAIN GSEMAINTENANCE COMPONENT
// ============================================================
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
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (e) {
      return 'Not scheduled';
    }
  };
  
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
    service_interval_years: '',
    maintenance_category: 'preventive',
    selectedServices: [],
    customService: '',
    customServices: []
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

  const API_URL = 'https://gia-gse-inventory.onrender.com';

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
        await axios.post(`${API_URL}/api/maintenance-attachments`, {
          maintenance_id: maintenanceId,
          filename: file.name,
          original_filename: file.name,
          file_data: base64String,
          file_type: file.type,
          file_size: file.size
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage('✅ File uploaded successfully!');
        fetchAttachments(maintenanceId);
        setTimeout(() => setMessage(''), 3000);
      } catch (err) {
        console.error('Upload error:', err);
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
      const response = await fetch(`${API_URL}/api/maintenance-attachments/${attachmentId}/download`, {
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
      
      if (!serviceData.service_performed || serviceData.service_performed.trim() === '') {
        setError('Please select at least one service performed.');
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
        months_interval: serviceData.months_interval,
        service_interval_months: serviceData.service_interval_months || serviceData.months_interval,
        service_interval_years: serviceData.service_interval_years,
        maintenance_category: serviceData.maintenance_category || 'preventive'
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
        service_interval_years: '',
        maintenance_category: 'preventive',
        selectedServices: [],
        customService: '',
        customServices: []
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
        if (editData.last_service_date && editData.service_interval_months) {
          const nextDate = new Date(editData.last_service_date);
          nextDate.setMonth(nextDate.getMonth() + parseInt(editData.service_interval_months));
          payload.next_service_date = nextDate.toISOString().split('T')[0];
        }
      } else if (editData.maintenance_type === 'year') {
        payload.service_interval_years = parseInt(editData.service_interval_years);
        payload.last_service_year = editData.last_service_year;
        payload.last_service_full_date = editData.last_service_full_date;
        if (editData.last_service_full_date && editData.service_interval_years) {
          const nextDate = new Date(editData.last_service_full_date);
          nextDate.setFullYear(nextDate.getFullYear() + parseInt(editData.service_interval_years));
          payload.next_service_date = nextDate.toISOString().split('T')[0];
        }
      }
      
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
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
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

      <MaintenanceInfo />

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
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px', fontWeight: 'bold', color: statusStyle.color === '#e74c3c' ? '#e74c3c' : (statusStyle.color === '#f39c12' ? '#f39c12' : '#0066cc') }}>
                    {formatDate(eq.next_service_date)}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold', color: statusStyle.color }}>{getRemainingDisplay(eq)}{eq.alert_reason && <div style={{ fontSize: '10px' }}>{eq.alert_reason}</div>}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><span style={{ color: statusStyle.color, fontWeight: 'bold' }}>{statusStyle.text}</span></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {eq.maintenance_type === 'hour' && (<button onClick={() => { setHoursUpdate({[eq.id]: eq.current_hours || 0}); setShowHoursModal(eq); }} style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>📝 Update Hours</button>)}
                    <button onClick={() => { setShowAttachmentsModal(eq); fetchAttachments(eq.id); }} style={{ backgroundColor: '#9b59b6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>📎 Files</button>
                    <button onClick={() => openEditModal(eq)} style={{ backgroundColor: '#ffc107', color: '#333', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>✏️ Edit</button>
                    {!isNoMaintenance && (
                      <button 
                        onClick={() => { 
                          setShowServiceForm(eq); 
                          // Pre-populate with current equipment data
                          setServiceData({ 
                            service_performed: eq.service_performed || '',
                            technician_name: eq.technician_name || '',
                            notes: eq.notes || '',
                            service_date: new Date().toISOString().split('T')[0], 
                            current_hours: eq.current_hours || '',
                            target_hours: eq.target_hours || eq.service_interval_hours || '',
                            months_interval: eq.service_interval_months || '',
                            service_interval_months: eq.service_interval_months || '',
                            service_interval_years: eq.service_interval_years || '',
                            maintenance_category: 'preventive',
                            selectedServices: eq.service_performed ? eq.service_performed.split(', ').filter(s => s.trim()) : [],
                            customService: '',
                            customServices: []
                          }); 
                        }} 
                        style={{ 
                          backgroundColor: '#3498db', 
                          color: 'white', 
                          border: 'none', 
                          padding: '5px 10px', 
                          borderRadius: '3px', 
                          marginRight: '5px', 
                          cursor: 'pointer' 
                        }}
                      >
                        🔧 Record Service
                      </button>
                    )}
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

      {/* Edit Modal */}
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

      {/* ============================================================
          RECORD SERVICE MODAL - All three types with full preview
      ============================================================ */}
      {showServiceForm && showServiceForm.maintenance_type !== 'none' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '750px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>🔧 Record Service for: {showServiceForm.equipment_name}</h3>
            <p>Maintenance Type: <strong>{getMaintenanceTypeIcon(showServiceForm)}</strong></p>
            <form onSubmit={(e) => handleRecordService(e, showServiceForm.id)}>
              
              {/* Service Date */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>📅 Service Date *</label>
                <input 
                  type="date" 
                  required 
                  value={serviceData.service_date} 
                  onChange={(e) => setServiceData({...serviceData, service_date: e.target.value})} 
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} 
                />
                <small style={{ color: '#666' }}>Date when service was performed</small>
              </div>

              {/* MAINTENANCE CATEGORY */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                  📋 Maintenance Category *
                </label>
                <div style={{ 
                  display: 'flex', 
                  gap: '15px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    backgroundColor: serviceData.maintenance_category === 'preventive' ? '#e3f2fd' : 'transparent',
                    border: serviceData.maintenance_category === 'preventive' ? '2px solid #1976d2' : '2px solid transparent',
                    flex: 1,
                    justifyContent: 'center'
                  }}>
                    <input
                      type="radio"
                      name="maintenance_category"
                      value="preventive"
                      checked={serviceData.maintenance_category === 'preventive'}
                      onChange={() => setServiceData(prev => ({ ...prev, maintenance_category: 'preventive' }))}
                    />
                    <span>🛡️ Preventive</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>(Scheduled)</span>
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    backgroundColor: serviceData.maintenance_category === 'corrective' ? '#fce4ec' : 'transparent',
                    border: serviceData.maintenance_category === 'corrective' ? '2px solid #c62828' : '2px solid transparent',
                    flex: 1,
                    justifyContent: 'center'
                  }}>
                    <input
                      type="radio"
                      name="maintenance_category"
                      value="corrective"
                      checked={serviceData.maintenance_category === 'corrective'}
                      onChange={() => setServiceData(prev => ({ ...prev, maintenance_category: 'corrective' }))}
                    />
                    <span>🔧 Corrective</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>(Unscheduled)</span>
                  </label>
                </div>
                {serviceData.maintenance_category === 'corrective' && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    backgroundColor: '#fff3e0', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#e65100',
                    border: '1px solid #ffe0b2'
                  }}>
                    ⚠️ <strong>Note:</strong> Corrective maintenance will NOT change the scheduled preventive maintenance dates.
                  </div>
                )}
                {serviceData.maintenance_category === 'preventive' && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    backgroundColor: '#e8f5e9', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#2e7d32',
                    border: '1px solid #c8e6c9'
                  }}>
                    ✅ <strong>Note:</strong> Preventive maintenance will update the next scheduled service date.
                  </div>
                )}
              </div>

              {/* ============================================================
                  HOUR-BASED FIELDS - WITH FULL PREVIEW
              ============================================================ */}
              {showServiceForm.maintenance_type === 'hour' && serviceData.maintenance_category === 'preventive' && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      ⏱️ Current Hours (Meter Reading) *
                    </label>
                    <input 
                      type="number" 
                      value={serviceData.current_hours || ''} 
                      onChange={(e) => setServiceData({...serviceData, current_hours: e.target.value})} 
                      placeholder="Enter current meter reading" 
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} 
                    />
                    <small style={{ color: '#666' }}>Current hour meter reading at time of service</small>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      🎯 Target Hours (Next service at X hours) *
                    </label>
                    <input 
                      type="number" 
                      value={serviceData.target_hours || ''} 
                      onChange={(e) => setServiceData({...serviceData, target_hours: e.target.value})} 
                      placeholder="Enter target hours for next service (e.g., 250, 500, 1000)" 
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} 
                    />
                    <small style={{ color: '#666' }}>
                      <strong>Enter the target hours until next service (NO fixed default)</strong>
                      <br />
                      Current target in database: {showServiceForm.target_hours || showServiceForm.service_interval_hours || 'Not set'} hours
                    </small>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      📅 Months Interval (Optional - for date-based condition)
                    </label>
                    <input 
                      type="number" 
                      value={serviceData.months_interval || ''} 
                      onChange={(e) => {
                        const interval = e.target.value;
                        setServiceData({
                          ...serviceData, 
                          months_interval: interval
                        });
                      }} 
                      placeholder="Enter months for date-based condition (e.g., 6)" 
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} 
                    />
                    <small style={{ color: '#666' }}>
                      Enter 0 or leave empty for hours only, or enter months for dual condition
                      <br />
                      Current interval in database: {showServiceForm.service_interval_months || 'Not set'} months
                    </small>
                  </div>

                  {/* HOUR-BASED CALCULATION PREVIEW */}
                  <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    backgroundColor: '#e8f4fd', 
                    borderRadius: '8px', 
                    border: '2px solid #2196f3',
                    boxShadow: '0 2px 4px rgba(33, 150, 243, 0.15)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div>
                        <span style={{ color: '#666', fontSize: '12px' }}>⏱️ Current Hours:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                          {serviceData.current_hours || '?'}
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', color: '#2196f3' }}>→</div>
                      <div>
                        <span style={{ color: '#666', fontSize: '12px' }}>🎯 Target Hours:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                          {serviceData.target_hours || '?'}
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', color: '#2196f3' }}>→</div>
                      <div style={{ 
                        backgroundColor: serviceData.current_hours && serviceData.target_hours && parseInt(serviceData.target_hours) > parseInt(serviceData.current_hours)
                          ? '#e8f5e9' 
                          : '#f5f5f5',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: serviceData.current_hours && serviceData.target_hours && parseInt(serviceData.target_hours) > parseInt(serviceData.current_hours)
                          ? '2px solid #27ae60'
                          : '2px dashed #ccc'
                      }}>
                        <span style={{ color: '#666', fontSize: '12px' }}>⏳ Hours Remaining:</span>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '16px',
                          color: serviceData.current_hours && serviceData.target_hours && parseInt(serviceData.target_hours) > parseInt(serviceData.current_hours)
                            ? '#27ae60'
                            : serviceData.current_hours && serviceData.target_hours && parseInt(serviceData.target_hours) <= parseInt(serviceData.current_hours)
                              ? '#e74c3c'
                              : '#999'
                        }}>
                          {serviceData.current_hours && serviceData.target_hours 
                            ? `${parseInt(serviceData.target_hours) - parseInt(serviceData.current_hours)} hours`
                            : 'Enter values to calculate'}
                        </div>
                      </div>
                    </div>
                    
                    {serviceData.months_interval && parseInt(serviceData.months_interval) > 0 && serviceData.service_date && (
                      <div style={{ 
                        marginTop: '10px', 
                        padding: '10px 15px', 
                        backgroundColor: '#fff3e0', 
                        borderRadius: '4px',
                        border: '1px solid #ffe0b2',
                        fontSize: '13px'
                      }}>
                        <strong>📅 Date-based condition (Dual Mode):</strong>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px',
                          marginTop: '5px'
                        }}>
                          <span>
                            Service Date: <strong>{new Date(serviceData.service_date).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric'
                            })}</strong>
                          </span>
                          <span style={{ fontSize: '20px', color: '#f39c12' }}>+</span>
                          <span>
                            {serviceData.months_interval} month{parseInt(serviceData.months_interval) > 1 ? 's' : ''}
                          </span>
                          <span style={{ fontSize: '20px', color: '#f39c12' }}>→</span>
                          <span style={{ 
                            backgroundColor: '#e8f5e9', 
                            padding: '4px 12px', 
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            color: '#27ae60'
                          }}>
                            {new Date(new Date(serviceData.service_date).setMonth(
                              new Date(serviceData.service_date).getMonth() + parseInt(serviceData.months_interval)
                            )).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#795548', marginTop: '5px' }}>
                          ⚠️ Service is due when EITHER hours OR date condition is met (whichever comes first)
                        </div>
                      </div>
                    )}
                    
                    {serviceData.months_interval && parseInt(serviceData.months_interval) > 0 && !serviceData.service_date && (
                      <div style={{ 
                        marginTop: '10px', 
                        padding: '10px 15px', 
                        backgroundColor: '#fff3e0', 
                        borderRadius: '4px',
                        border: '1px solid #ffe0b2',
                        fontSize: '13px',
                        color: '#e65100'
                      }}>
                        ⚠️ Please enter a Service Date to calculate the date-based condition.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ============================================================
                  MONTH-BASED FIELDS - WITH FULL PREVIEW
              ============================================================ */}
              {showServiceForm.maintenance_type === 'month' && serviceData.maintenance_category === 'preventive' && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      📅 Service Interval (months) *
                    </label>
                    <input 
                      type="number" 
                      value={serviceData.months_interval || ''} 
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
                      <strong>Enter the number of months until next service (NO fixed default)</strong>
                      <br />
                      Current interval in database: {showServiceForm.service_interval_months || 'Not set'} months
                    </small>
                  </div>

                  {/* MONTH-BASED CALCULATION PREVIEW */}
                  <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    backgroundColor: '#e8f4fd', 
                    borderRadius: '8px', 
                    border: '2px solid #2196f3',
                    boxShadow: '0 2px 4px rgba(33, 150, 243, 0.15)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div>
                        <span style={{ color: '#666', fontSize: '12px' }}>📅 Service Date:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                          {serviceData.service_date ? new Date(serviceData.service_date).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                          }) : 'Not set'}
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', color: '#2196f3' }}>→</div>
                      <div>
                        <span style={{ color: '#666', fontSize: '12px' }}>⏱️ Interval:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                          {serviceData.months_interval && parseInt(serviceData.months_interval) > 0 
                            ? `${serviceData.months_interval} month${parseInt(serviceData.months_interval) > 1 ? 's' : ''}`
                            : '? months'}
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', color: '#2196f3' }}>→</div>
                      <div style={{ 
                        backgroundColor: serviceData.service_date && serviceData.months_interval && parseInt(serviceData.months_interval) > 0 
                          ? '#e8f5e9' 
                          : '#f5f5f5',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: serviceData.service_date && serviceData.months_interval && parseInt(serviceData.months_interval) > 0
                          ? '2px solid #27ae60'
                          : '2px dashed #ccc'
                      }}>
                        <span style={{ color: '#666', fontSize: '12px' }}>📊 Next Service:</span>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '16px',
                          color: serviceData.service_date && serviceData.months_interval && parseInt(serviceData.months_interval) > 0
                            ? '#27ae60'
                            : '#999'
                        }}>
                          {serviceData.service_date && serviceData.months_interval && parseInt(serviceData.months_interval) > 0
                            ? new Date(new Date(serviceData.service_date).setMonth(
                                new Date(serviceData.service_date).getMonth() + parseInt(serviceData.months_interval)
                              )).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'Enter interval to preview'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ============================================================
                  YEAR-BASED FIELDS - WITH FULL PREVIEW
              ============================================================ */}
              {showServiceForm.maintenance_type === 'year' && serviceData.maintenance_category === 'preventive' && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                      📆 Service Interval (years) *
                    </label>
                    <input 
                      type="number" 
                      value={serviceData.service_interval_years || ''} 
                      onChange={(e) => {
                        const years = e.target.value;
                        setServiceData({
                          ...serviceData, 
                          service_interval_years: years
                        });
                      }} 
                      placeholder="Enter number of years (e.g., 1, 2, 3, 5)"
                      min="1"
                      step="1"
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                    />
                    <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                      <strong>Enter the number of years until next service (NO fixed default)</strong>
                      <br />
                      Current interval in database: {showServiceForm.service_interval_years || 'Not set'} years
                    </small>
                  </div>

                  {/* YEAR-BASED CALCULATION PREVIEW */}
                  <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    backgroundColor: '#e8f4fd', 
                    borderRadius: '8px', 
                    border: '2px solid #2196f3',
                    boxShadow: '0 2px 4px rgba(33, 150, 243, 0.15)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div>
                        <span style={{ color: '#666', fontSize: '12px' }}>📅 Service Date:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                          {serviceData.service_date ? new Date(serviceData.service_date).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                          }) : 'Not set'}
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', color: '#2196f3' }}>→</div>
                      <div>
                        <span style={{ color: '#666', fontSize: '12px' }}>⏱️ Interval:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                          {serviceData.service_interval_years && parseInt(serviceData.service_interval_years) > 0 
                            ? `${serviceData.service_interval_years} year${parseInt(serviceData.service_interval_years) > 1 ? 's' : ''}`
                            : '? years'}
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', color: '#2196f3' }}>→</div>
                      <div style={{ 
                        backgroundColor: serviceData.service_date && serviceData.service_interval_years && parseInt(serviceData.service_interval_years) > 0 
                          ? '#e8f5e9' 
                          : '#f5f5f5',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: serviceData.service_date && serviceData.service_interval_years && parseInt(serviceData.service_interval_years) > 0
                          ? '2px solid #27ae60'
                          : '2px dashed #ccc'
                      }}>
                        <span style={{ color: '#666', fontSize: '12px' }}>📊 Next Service:</span>
                        <div style={{ 
                          fontWeight: 'bold', 
                          fontSize: '16px',
                          color: serviceData.service_date && serviceData.service_interval_years && parseInt(serviceData.service_interval_years) > 0
                            ? '#27ae60'
                            : '#999'
                        }}>
                          {serviceData.service_date && serviceData.service_interval_years && parseInt(serviceData.service_interval_years) > 0
                            ? new Date(new Date(serviceData.service_date).setFullYear(
                                new Date(serviceData.service_date).getFullYear() + parseInt(serviceData.service_interval_years)
                              )).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'Enter interval to preview'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* CORRECTIVE INFO - SHOW WHEN CORRECTIVE IS SELECTED */}
              {serviceData.maintenance_category === 'corrective' && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px', 
                  backgroundColor: '#fff3e0', 
                  borderRadius: '8px', 
                  border: '2px solid #ff9800'
                }}>
                  <strong style={{ fontSize: '14px', color: '#e65100' }}>📌 Corrective Maintenance - Audit Only</strong>
                  <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#555' }}>
                    This service is for <strong>audit purposes only</strong>. 
                    The preventive maintenance schedule will <strong>NOT</strong> be affected.
                    <br />
                    <span style={{ color: '#e65100' }}>✓ Service date will be recorded for audit trail</span>
                    <br />
                    <span style={{ color: '#e65100' }}>✓ Next service date will remain unchanged</span>
                    <br />
                    <span style={{ color: '#e65100' }}>✓ No interval or calculation required</span>
                  </p>
                </div>
              )}

              {/* SERVICE CHECKLIST */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                  🔧 Services Performed * (Select all that apply)
                </label>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '8px',
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  {[
                    'Inspection', 'Testing', 'Cleaning', 'Calibration', 'Replacement',
                    'Repair', 'Maintenance', 'Check Pressure', 'Check Date',
                    'Visual Inspection', 'Functional Test', 'Safety Check',
                    'Oil Change', 'Filter Replacement', 'Brake Inspection',
                    'Tire Check', 'Battery Test', 'Hydraulic Fluid Check',
                    'Electrical System Check', 'Cooling System Check',
                    'Lubrication', 'Parts Replacement'
                  ].map(service => (
                    <label key={service} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '5px 10px',
                      borderRadius: '4px',
                      backgroundColor: serviceData.selectedServices?.includes(service) ? '#e3f2fd' : 'transparent',
                      transition: 'background-color 0.2s',
                      fontSize: '13px'
                    }}>
                      <input
                        type="checkbox"
                        checked={serviceData.selectedServices?.includes(service) || false}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setServiceData(prev => {
                            let updatedServices = [...(prev.selectedServices || [])];
                            if (isChecked) {
                              updatedServices.push(service);
                            } else {
                              updatedServices = updatedServices.filter(s => s !== service);
                            }
                            const allServices = [...updatedServices];
                            if (prev.customServices && prev.customServices.length > 0) {
                              allServices.push(...prev.customServices);
                            }
                            return {
                              ...prev,
                              selectedServices: updatedServices,
                              service_performed: allServices.join(', ')
                            };
                          });
                        }}
                      />
                      <span>{service}</span>
                    </label>
                  ))}
                </div>

                {/* Custom Service Input */}
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={serviceData.customService || ''}
                    onChange={(e) => setServiceData(prev => ({ ...prev, customService: e.target.value }))}
                    placeholder="Enter custom service not listed above..."
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const customService = serviceData.customService?.trim();
                      if (customService) {
                        setServiceData(prev => {
                          const updatedCustom = [...(prev.customServices || []), customService];
                          const allServices = [...(prev.selectedServices || []), ...updatedCustom];
                          return {
                            ...prev,
                            customServices: updatedCustom,
                            customService: '',
                            service_performed: allServices.join(', ')
                          };
                        });
                      }
                    }}
                    style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    + Add Custom
                  </button>
                </div>

                {/* Display custom services */}
                {serviceData.customServices && serviceData.customServices.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <small style={{ color: '#666' }}>Custom services added:</small>
                    <div style={{ marginTop: '5px' }}>
                      {serviceData.customServices.map((svc, idx) => (
                        <span key={idx} style={{
                          display: 'inline-block',
                          backgroundColor: '#e8f5e9',
                          color: '#2e7d32',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          margin: '3px 5px 3px 0',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {svc}
                          <button
                            type="button"
                            onClick={() => {
                              setServiceData(prev => {
                                const updatedCustom = prev.customServices.filter((_, i) => i !== idx);
                                const allServices = [...(prev.selectedServices || []), ...updatedCustom];
                                return {
                                  ...prev,
                                  customServices: updatedCustom,
                                  service_performed: allServices.join(', ')
                                };
                              });
                            }}
                            style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', marginLeft: '5px', fontSize: '14px', fontWeight: 'bold' }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {serviceData.service_performed && (
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '13px', border: '1px solid #bbdefb' }}>
                    <strong>✅ Selected Services:</strong> {serviceData.service_performed}
                  </div>
                )}
              </div>

              {/* Technician Name */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>👨‍🔧 Technician Name</label>
                <input 
                  type="text" 
                  value={serviceData.technician_name} 
                  onChange={(e) => setServiceData({...serviceData, technician_name: e.target.value})} 
                  placeholder="Enter technician name"
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} 
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>📝 Notes</label>
                <textarea 
                  value={serviceData.notes} 
                  onChange={(e) => setServiceData({...serviceData, notes: e.target.value})} 
                  rows="2" 
                  placeholder="Additional notes about service"
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} 
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  disabled={loading} 
                  style={{ 
                    backgroundColor: '#27ae60', 
                    color: 'white', 
                    border: 'none', 
                    padding: '12px 24px', 
                    borderRadius: '5px', 
                    cursor: loading ? 'not-allowed' : 'pointer', 
                    flex: 1, 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? '⏳ Saving...' : '✅ Record Service'}
                </button>
                <button 
                  type="button" 
                  onClick={() => { 
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
                      service_interval_years: '',
                      maintenance_category: 'preventive',
                      selectedServices: [],
                      customService: '',
                      customServices: []
                    }); 
                  }} 
                  style={{ 
                    backgroundColor: '#95a5a6', 
                    color: 'white', 
                    border: 'none', 
                    padding: '12px 24px', 
                    borderRadius: '5px', 
                    cursor: 'pointer', 
                    fontSize: '16px' 
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSEMaintenance;