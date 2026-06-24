import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = ({ token }) => {
  const [lowStockParts, setLowStockParts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [lowStockRes, transactionsRes] = await Promise.all([
        axios.get('http://172.16.0.4:5000/api/reports/low-stock', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://172.16.0.4:5000/api/transactions?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setLowStockParts(lowStockRes.data);
      setRecentTransactions(transactionsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      <h1>GSE Inventory Dashboard</h1>
      
      <div className="alert-section">
        <h3>⚠️ Low Stock Alerts</h3>
        {lowStockParts.length === 0 ? (
          <p>All stock levels are good</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Part Number</th><th>Description</th><th>On Hand</th><th>Min Stock</th><th>Location</th></tr>
            </thead>
            <tbody>
              {lowStockParts.map(part => (
                <tr key={part.part_number} className="alert-row">
                  <td>{part.part_number}</td><td>{part.description}</td>
                  <td>{part.quantity_on_hand}</td><td>{part.min_stock}</td><td>{part.location_bin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="recent-section">
        <h3>📋 Recent Transactions</h3>
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Part</th><th>Type</th><th>Quantity</th><th>GSE/Reference</th><th>By</th></tr>
          </thead>
          <tbody>
            {recentTransactions.map(tx => (
              <tr key={tx.id}>
                <td>{new Date(tx.created_at).toLocaleString()}</td>
                <td>{tx.part_number}</td>
                <td className={`tx-type-${tx.transaction_type.toLowerCase()}`}>{tx.transaction_type}</td>
                <td>{tx.quantity}</td>
                <td>{tx.gse_registration || tx.reference_number || '-'}</td>
                <td>{tx.created_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
