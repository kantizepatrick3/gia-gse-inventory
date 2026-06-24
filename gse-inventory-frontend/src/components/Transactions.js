import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Transactions = ({ token }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [summary, setSummary] = useState({
    totalReceives: 0,
    totalIssues: 0,
    totalQuantityReceived: 0,
    totalQuantityIssued: 0,
    preventiveCount: 0,
    correctiveCount: 0,
    uniqueParts: 0,
    uniqueTechnicians: 0,
    uniqueGSE: 0
  });

  const API_URL = 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data);
      calculateSummary(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setLoading(false);
    }
  };

  const calculateSummary = (data) => {
    const receives = data.filter(t => t.transaction_type === 'RECEIVE');
    const issues = data.filter(t => t.transaction_type === 'ISSUE');
    
    const uniqueParts = [...new Set(data.map(t => t.part_number))];
    const uniqueTechnicians = [...new Set(data.map(t => t.technician_name).filter(name => name))];
    const uniqueGSE = [...new Set(data.map(t => t.gse_registration).filter(gse => gse))];
    
    setSummary({
      totalReceives: receives.length,
      totalIssues: issues.length,
      totalQuantityReceived: receives.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
      totalQuantityIssued: issues.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0),
      preventiveCount: data.filter(t => t.notes && t.notes.toLowerCase().includes('preventive')).length,
      correctiveCount: data.filter(t => t.notes && t.notes.toLowerCase().includes('corrective')).length,
      uniqueParts: uniqueParts.length,
      uniqueTechnicians: uniqueTechnicians.length,
      uniqueGSE: uniqueGSE.length
    });
  };

  const getTransactionTypeBadge = (type) => {
    if (type === 'RECEIVE') {
      return { color: '#27ae60', bg: '#eafaf1', text: '📥 RECEIVE', icon: '📥' };
    } else {
      return { color: '#e74c3c', bg: '#fdeaea', text: '📤 ISSUE', icon: '📤' };
    }
  };

  const getMaintenanceType = (notes) => {
    if (!notes) return null;
    
    if (notes.toLowerCase().includes('preventive')) {
      return { type: 'preventive', icon: '🔧', text: 'Preventive Maintenance', color: '#27ae60', bg: '#eafaf1' };
    }
    if (notes.toLowerCase().includes('corrective')) {
      return { type: 'corrective', icon: '🛠️', text: 'Corrective Maintenance', color: '#e74c3c', bg: '#fdeaea' };
    }
    if (notes.toLowerCase().includes('emergency')) {
      return { type: 'emergency', icon: '🚨', text: 'Emergency Repair', color: '#e67e22', bg: '#fef5e7' };
    }
    return null;
  };

  const cleanNotes = (notes) => {
    if (!notes) return '';
    return notes
      .replace(/🔧 Preventive Maintenance - /gi, '')
      .replace(/🛠️ Corrective Maintenance - /gi, '')
      .replace(/🚨 Emergency Repair - /gi, '')
      .replace(/🔧 Preventive Maintenance/gi, '')
      .replace(/🛠️ Corrective Maintenance/gi, '')
      .replace(/🚨 Emergency Repair/gi, '');
  };

  const filteredTransactions = transactions.filter(trans => {
    if (filter !== 'all' && trans.transaction_type !== filter) return false;
    
    if (dateRange.start) {
      const transDate = new Date(trans.created_at).toISOString().split('T')[0];
      if (dateRange.start && transDate < dateRange.start) return false;
      if (dateRange.end && transDate > dateRange.end) return false;
    }
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (trans.part_number && trans.part_number.toLowerCase().includes(searchLower)) ||
        (trans.description && trans.description.toLowerCase().includes(searchLower)) ||
        (trans.gse_registration && trans.gse_registration.toLowerCase().includes(searchLower)) ||
        (trans.technician_name && trans.technician_name.toLowerCase().includes(searchLower)) ||
        (trans.work_order && trans.work_order.toLowerCase().includes(searchLower)) ||
        (trans.created_by && trans.created_by.toLowerCase().includes(searchLower)) ||
        (trans.notes && trans.notes.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Part Number', 'Description', 'Maintenance Type', 'Quantity', 'GSE Registration', 'Technician', 'Work Order', 'Notes', 'Created By'];
    const rows = filteredTransactions.map(trans => {
      const maintType = getMaintenanceType(trans.notes);
      return [
        new Date(trans.created_at).toLocaleString(),
        trans.transaction_type,
        trans.part_number,
        trans.description || '',
        maintType ? maintType.text : '',
        trans.transaction_type === 'RECEIVE' ? `+${trans.quantity}` : `-${trans.quantity}`,
        trans.gse_registration || '',
        trans.technician_name || '',
        trans.work_order || '',
        cleanNotes(trans.notes),
        trans.created_by || ''
      ];
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading transactions...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2>📜 Transaction History</h2>
        <button 
          onClick={exportToCSV}
          style={{
            backgroundColor: '#2c3e50',
            color: 'white',
            border: 'none',
            padding: '8px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          📎 Export to CSV
        </button>
      </div>

      {/* Filters Section */}
      <div style={{
        backgroundColor: '#f9f9f9',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #ddd'
      }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Search</label>
            <input
              type="text"
              placeholder="🔍 Search by part, GSE, technician..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                width: '250px'
              }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Transaction Type</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="all">All Transactions</option>
              <option value="RECEIVE">📥 Receive Only</option>
              <option value="ISSUE">📤 Issue Only</option>
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>From Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>To Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilter('all');
              setDateRange({ start: '', end: '' });
            }}
            style={{
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              padding: '8px 15px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>No transactions found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Date</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Type</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Part Number</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Description</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Maintenance Type</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Quantity</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>GSE Registration</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Technician</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Work Order</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Notes</th>
                <th style={{ border: '1px solid #ddd', padding: '12px' }}>Created By</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(trans => {
                const typeStyle = getTransactionTypeBadge(trans.transaction_type);
                const maintType = getMaintenanceType(trans.notes);
                const cleanNote = cleanNotes(trans.notes);
                
                return (
                  <tr key={trans.id}>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {new Date(trans.created_at).toLocaleString()}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      <span style={{ color: typeStyle.color, fontWeight: 'bold' }}>{typeStyle.text}</span>
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                      {trans.part_number}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {trans.description || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      {maintType ? (
                        <span style={{ 
                          backgroundColor: maintType.bg, 
                          color: maintType.color, 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          display: 'inline-block'
                        }}>
                          {maintType.icon} {maintType.text}
                        </span>
                      ) : (
                        <span style={{ color: '#95a5a6', fontSize: '11px' }}>-</span>
                      )}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                      {trans.transaction_type === 'RECEIVE' ? `+${trans.quantity}` : `-${trans.quantity}`}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {trans.gse_registration || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {trans.technician_name || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {trans.work_order || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {cleanNote || '-'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', fontSize: '12px' }}>
                      {trans.created_by || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Report Footer */}
      {filteredTransactions.length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h4>📊 Report Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div>
              <strong>Showing:</strong> {filteredTransactions.length} of {transactions.length} transactions
            </div>
            <div>
              <strong>Date Range:</strong> 
              {filteredTransactions.length > 0 && (
                <>
                  {' '}{new Date(filteredTransactions[filteredTransactions.length - 1]?.created_at).toLocaleDateString()} - 
                  {' '}{new Date(filteredTransactions[0]?.created_at).toLocaleDateString()}
                </>
              )}
            </div>
            <div>
              <strong>Net Stock Change:</strong> 
              {' '}{summary.totalQuantityReceived - summary.totalQuantityIssued} units
            </div>
            <div>
              <strong>Maintenance:</strong> 🔧 {summary.preventiveCount} Preventive | 🛠️ {summary.correctiveCount} Corrective
            </div>
            <div>
              <strong>Total Receives:</strong> {summary.totalReceives} ({summary.totalQuantityReceived} units)
            </div>
            <div>
              <strong>Total Issues:</strong> {summary.totalIssues} ({summary.totalQuantityIssued} units)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;