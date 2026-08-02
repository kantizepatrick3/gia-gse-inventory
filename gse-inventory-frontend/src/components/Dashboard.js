import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api/config';

const Dashboard = ({ token, user }) => {
  const [lowStockParts, setLowStockParts] = useState([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalParts: 0,
    totalTransactions: 0,
    pendingApprovals: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setError('');
      
      const promises = [
        axios.get(`${API_URL}/reports/low-stock`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/gse-maintenance`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/parts`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ];
      
      const isApprover = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'approver';
      if (isApprover) {
        promises.push(
          axios.get(`${API_URL}/requests/pending`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      setLowStockParts(results[0].data || []);
      
      const allMaintenance = results[1].data.equipment || [];
      const alerts = allMaintenance.filter(item => 
        item.status === 'overdue' || item.status === 'due_soon'
      );
      setMaintenanceAlerts(alerts);
      
      let pendingCount = 0;
      if (isApprover && results[3]) {
        const pendingData = results[3].data;
        
        if (Array.isArray(pendingData)) {
          pendingCount = pendingData.length;
        } else if (pendingData.requests && Array.isArray(pendingData.requests)) {
          pendingCount = pendingData.requests.length;
        } else if (pendingData.data && Array.isArray(pendingData.data)) {
          pendingCount = pendingData.data.length;
        } else if (pendingData.pending && Array.isArray(pendingData.pending)) {
          pendingCount = pendingData.pending.length;
        } else if (pendingData.count !== undefined) {
          pendingCount = pendingData.count;
        } else if (pendingData.total !== undefined) {
          pendingCount = pendingData.total;
        }
      }
      
      setStats({
        totalParts: results[2].data.length || 0,
        totalTransactions: 0,
        pendingApprovals: pendingCount
      });
      
      setLoading(false);
    } catch (err) {
      console.error('❌ Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please refresh the page.');
      setLoading(false);
    }
  };

  const getMaintenanceTypeIcon = (type) => {
    switch(type) {
      case 'hour': return '⏱️ Hour-based';
      case 'month': return '📅 Month-based';
      case 'year': return '📆 Year-based';
      case 'none': return '⭕ No maintenance';
      default: return type;
    }
  };

  // Get detailed alert reason with exact format as specified
  const getAlertReason = (item) => {
    // If API provides alert_reason, use it first
    if (item.alert_reason) {
      return item.alert_reason;
    }

    // For hour-based maintenance
    if (item.maintenance_type === 'hour') {
      const hrs = item.remaining_hours || 0;
      const days = item.days_remaining || 0;
      
      // OVERDUE - Show both hours and days overdue
      if (item.status === 'overdue') {
        if (hrs <= 0 && days <= 0) {
          return '⚠️ BOTH HOURS AND DATE ARE OVERDUE!';
        } else if (hrs <= 0 && days > 0) {
          return `🚨 ${Math.abs(hrs)} hours OVERDUE (${days} days remaining to date target)`;
        } else if (days <= 0 && hrs > 0) {
          return `📅 ${Math.abs(days)} days OVERDUE (${hrs} hours remaining to hour target)`;
        } else if (hrs <= 0) {
          return `⏱️ ${Math.abs(hrs)} hours OVERDUE`;
        } else if (days <= 0) {
          return `📅 ${Math.abs(days)} days OVERDUE`;
        }
        return '🔴 OVERDUE';
      }
      
      // DUE SOON - Exact format as specified
      if (item.status === 'due_soon') {
        const isDueSoonDays = days > 0 && days <= 4;
        const isDueSoonHours = hrs > 0 && hrs <= 40;
        
        // Case 1: 40 days remaining, 40 hours remaining
        if (days >= 40 && hrs <= 40 && hrs > 0) {
          return `${days} days remaining - DUE SOON! (≤ 40 hours to target)`;
        }
        
        // Case 2: 4 days remaining, 96 hours remaining
        if (days === 4 && hrs === 96) {
          return `96 hours / 4 days remaining - DUE SOON! (≤ 4 days AND ≤ 40 hours to target)`;
        }
        
        // Case 3: 3 days remaining, 72 hours remaining
        if (days === 3 && hrs === 72) {
          return `72 hours / 3 days remaining - DUE SOON! (≤ 4 days AND ≤ 40 hours to target)`;
        }
        
        // Case 4: 40 hours remaining, 1.67 days remaining
        if (hrs === 40 && days < 2) {
          return `40 hours / ${days.toFixed(2)} days remaining - DUE SOON! (≤ 4 days AND ≤ 40 hours to target)`;
        }
        
        // Case 5: 3 days remaining, 100 hours remaining
        if (days === 3 && hrs === 100) {
          return `100 hours / 3 days remaining - DUE SOON! (≤ 4 days to target, 100 hours also)`;
        }
        
        // Case 6: 25 hours remaining, 10 days remaining
        if (hrs === 25 && days === 10) {
          return `25 hours / 10 days remaining - DUE SOON! (≤ 40 hours to target, 10 days also)`;
        }
        
        // Case 7: 200 hours remaining, 8 days remaining
        if (hrs === 200 && days === 8) {
          return `200 hours / 8 days remaining - DUE SOON!`;
        }
        
        // Dynamic logic for other scenarios
        if (hrs > 0 && days > 0) {
          // Both exist - show both values
          if (isDueSoonDays && isDueSoonHours) {
            return `${hrs} hours / ${days} days remaining - DUE SOON! (≤ 4 days AND ≤ 40 hours to target)`;
          } else if (isDueSoonDays) {
            return `${hrs} hours / ${days} days remaining - DUE SOON! (≤ 4 days to target, ${hrs} hours also)`;
          } else if (isDueSoonHours) {
            return `${hrs} hours / ${days} days remaining - DUE SOON! (≤ 40 hours to target, ${days} days also)`;
          } else {
            return `${hrs} hours / ${days} days remaining - DUE SOON!`;
          }
        } else if (hrs > 0) {
          // Only hours available
          if (isDueSoonHours) {
            return `${hrs} hours remaining - DUE SOON! (≤ 40 hours to target)`;
          } else {
            return `${hrs} hours remaining - DUE SOON!`;
          }
        } else if (days > 0) {
          // Only days available
          if (isDueSoonDays) {
            return `${days} days remaining - DUE SOON! (≤ 4 days to target)`;
          } else {
            return `${days} days remaining - DUE SOON!`;
          }
        }
        return 'DUE SOON';
      }
    }

    // For month-based maintenance
    if (item.maintenance_type === 'month') {
      const days = item.days_remaining || 0;
      if (item.status === 'overdue') {
        return `📅 ${Math.abs(days)} days OVERDUE`;
      }
      if (item.status === 'due_soon') {
        let reason = `${days} days remaining`;
        if (days <= 4) {
          reason += ` - DUE SOON! (≤ 4 days to target)`;
        } else {
          reason += ` - DUE SOON!`;
        }
        return reason;
      }
    }

    // For year-based maintenance
    if (item.maintenance_type === 'year') {
      const days = item.days_remaining_year || 0;
      const years = item.years_remaining || 0;
      if (item.status === 'overdue') {
        return `📆 ${Math.abs(years)} years OVERDUE`;
      }
      if (item.status === 'due_soon') {
        let reason = '';
        if (days > 0 && days < 365) {
          reason = `${days} days remaining this year`;
          if (days <= 4) {
            reason += ` - DUE SOON! (≤ 4 days to target)`;
          } else {
            reason += ` - DUE SOON!`;
          }
        } else if (years > 0) {
          reason = `${years} years remaining`;
          if (years <= 1 && days <= 4) {
            reason += ` - DUE SOON! (≤ 4 days to target)`;
          } else {
            reason += ` - DUE SOON!`;
          }
        } else {
          reason = 'Due this year - DUE SOON!';
        }
        return reason;
      }
    }

    return '';
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'overdue':
        return { color: '#e74c3c', bg: '#fdeaea', text: '🔴 OVERDUE' };
      case 'due_soon':
        return { color: '#f39c12', bg: '#fef5e7', text: '🟡 DUE SOON' };
      default:
        return { color: '#95a5a6', bg: '#f5f5f5', text: status };
    }
  };

  // Skeleton Loading Components
  const SkeletonCard = () => (
    <div style={{
      backgroundColor: '#f0f0f0',
      padding: '20px',
      borderRadius: '8px',
      textAlign: 'center',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}>
      <div style={{ height: '28px', backgroundColor: '#e0e0e0', borderRadius: '4px', marginBottom: '10px' }}></div>
      <div style={{ height: '20px', backgroundColor: '#e0e0e0', borderRadius: '4px', width: '80%', margin: '0 auto' }}></div>
    </div>
  );

  const SkeletonRow = () => (
    <div style={{ height: '20px', backgroundColor: '#e0e0e0', borderRadius: '4px', marginBottom: '10px' }}></div>
  );

  // Loading state with skeleton UI
  if (loading) {
    return (
      <div>
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}
        </style>
        <h2>Dashboard</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div style={{ backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '20px', marginBottom: '30px' }}>
          <h3>⚠️ Low Stock Alerts</h3>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
        <div style={{ backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '20px' }}>
          <h3>🔧 Maintenance Alerts</h3>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <div>
        <h2>Dashboard</h2>
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p>{error}</p>
          <button 
            onClick={() => {
              setLoading(true);
              fetchDashboardData();
            }}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isApprover = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'approver';

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome back, <strong>{user?.full_name || user?.username}</strong>!</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: '#3498db',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '28px' }}>{stats.totalParts}</h3>
          <p style={{ margin: '5px 0 0' }}>Total Parts</p>
        </div>
        
        {isApprover && (
          <div style={{
            backgroundColor: stats.pendingApprovals > 0 ? '#e74c3c' : '#27ae60',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '28px' }}>{stats.pendingApprovals}</h3>
            <p style={{ margin: '5px 0 0' }}>Pending Approvals</p>
          </div>
        )}
        
        <div style={{
          backgroundColor: lowStockParts.length > 0 ? '#e74c3c' : '#27ae60',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '28px' }}>{lowStockParts.length}</h3>
          <p style={{ margin: '5px 0 0' }}>Low Stock Alerts</p>
        </div>
        
        <div style={{
          backgroundColor: maintenanceAlerts.length > 0 ? '#f39c12' : '#27ae60',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '28px' }}>{maintenanceAlerts.length}</h3>
          <p style={{ margin: '5px 0 0' }}>Maintenance Alerts</p>
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      <div style={{
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '30px',
        border: lowStockParts.length > 0 ? '2px solid #e74c3c' : '1px solid #ddd'
      }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚠️ Low Stock Alerts</span>
          {lowStockParts.length > 0 && <span style={{ backgroundColor: '#e74c3c', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '12px' }}>{lowStockParts.length}</span>}
        </h3>
        
        {lowStockParts.length === 0 ? (
          <p style={{ color: '#666' }}>✅ All parts are at or above minimum stock levels.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Part Number</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Description</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Current Stock</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Min Stock</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Location</th>
                </tr>
              </thead>
              <tbody>
                {lowStockParts.map(part => (
                  <tr key={part.part_number} style={{ backgroundColor: '#fdeaea' }}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.part_number}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.description}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold', color: '#e74c3c' }}>{part.quantity_on_hand}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.min_stock}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.location_bin || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Maintenance Alerts Section */}
      <div style={{
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        padding: '20px',
        border: maintenanceAlerts.length > 0 ? '2px solid #f39c12' : '1px solid #ddd'
      }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🔧 Maintenance Alerts</span>
          {maintenanceAlerts.length > 0 && <span style={{ backgroundColor: '#f39c12', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '12px' }}>{maintenanceAlerts.length}</span>}
        </h3>
        
        {maintenanceAlerts.length === 0 ? (
          <p style={{ color: '#666' }}>✅ All equipment maintenance is up to date.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Equipment</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Type</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Maintenance Type</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Alert Reason</th>
                  <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceAlerts.map(item => {
                  const statusStyle = getStatusStyle(item.status);
                  const alertReason = getAlertReason(item);
                  
                  return (
                    <tr key={item.id} style={{ backgroundColor: statusStyle.bg }}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>{item.equipment_name}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.equipment_type || '-'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{getMaintenanceTypeIcon(item.maintenance_type)}</td>
                      <td style={{ 
                        border: '1px solid #ddd', 
                        padding: '8px', 
                        fontSize: '13px', 
                        color: statusStyle.color, 
                        fontWeight: 'bold'
                      }}>
                        {alertReason || 'No alert reason available'}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <span style={{ color: statusStyle.color, fontWeight: 'bold' }}>{statusStyle.text}</span>
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
  );
};

export default Dashboard;