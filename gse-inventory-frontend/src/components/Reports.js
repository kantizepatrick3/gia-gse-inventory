import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Reports = ({ token }) => {
  const [lowStockParts, setLowStockParts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = 'https://gia-gse-inventory.onrender.com';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lowStockRes, transactionsRes] = await Promise.all([
          axios.get(`${API_URL}/api/reports/low-stock`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_URL}/api/transactions?limit=100`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        setLowStockParts(lowStockRes.data);
        setRecentTransactions(transactionsRes.data);
      } catch (err) {
        console.error('Error fetching reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const exportToCSV = () => {
    const headers = ['Date', 'Part Number', 'Description', 'Type', 'Quantity', 'GSE/Reference', 'Technician', 'Created By'];
    const rows = recentTransactions.map(tx => [
      new Date(tx.created_at).toLocaleString(),
      tx.part_number,
      tx.description,
      tx.transaction_type,
      tx.quantity,
      tx.gse_registration || tx.reference_number || '-',
      tx.technician_name || '-',
      tx.created_by
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gse_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div>Loading reports...</div>;

  const totalReceives = recentTransactions.filter(t => t.transaction_type === 'RECEIVE').reduce((sum, t) => sum + t.quantity, 0);
  const totalIssues = recentTransactions.filter(t => t.transaction_type === 'ISSUE').reduce((sum, t) => sum + t.quantity, 0);

  return (
    <div>
      <h2>Reports Dashboard</h2>
      <button onClick={exportToCSV}>📥 Export to CSV</button>
      
      <h3>⚠️ Low Stock Alert Report</h3>
      {lowStockParts.length === 0 ? <p>All stock levels are good</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Part Number</th><th>Description</th><th>On Hand</th><th>Min Stock</th><th>Location</th><th>Need to Order</th>
            </tr>
          </thead>
          <tbody>
            {lowStockParts.map(part => (
              <tr key={part.part_number}>
                <td>{part.part_number}</td>
                <td>{part.description}</td>
                <td>{part.quantity_on_hand}</td>
                <td>{part.min_stock}</td>
                <td>{part.location_bin || '-'}</td>
                <td>{Math.max(0, part.min_stock - part.quantity_on_hand)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>📊 Transaction Summary</h3>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div><h4>Total Receives</h4><p style={{ fontSize: '24px', color: 'green' }}>{totalReceives}</p></div>
        <div><h4>Total Issues</h4><p style={{ fontSize: '24px', color: 'red' }}>{totalIssues}</p></div>
        <div><h4>Total Transactions</h4><p style={{ fontSize: '24px' }}>{recentTransactions.length}</p></div>
      </div>

      <h3>📋 Recent Activity</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th><th>Part Number</th><th>Description</th><th>Type</th><th>Quantity</th><th>GSE/Reference</th><th>Technician</th><th>By</th>
          </tr>
        </thead>
        <tbody>
          {recentTransactions.map(tx => (
            <tr key={tx.id}>
              <td>{new Date(tx.created_at).toLocaleString()}</td>
              <td>{tx.part_number}</td>
              <td>{tx.description}</td>
              <td className={`tx-type-${tx.transaction_type.toLowerCase()}`}>{tx.transaction_type}</td>
              <td>{tx.quantity}</td>
              <td>{tx.gse_registration || tx.reference_number || '-'}</td>
              <td>{tx.technician_name || '-'}</td>
              <td>{tx.created_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Reports;