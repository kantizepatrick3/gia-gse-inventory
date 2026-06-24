import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PartsList = ({ token }) => {
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    const response = await axios.get('http://172.16.0.4:5000/api/parts', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setParts(response.data);
  };

  return (
    <div>
      <h2>Parts Catalog</h2>
      <input
        type="text"
        placeholder="Search parts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ margin: '20px 0', padding: '8px', width: '300px' }}
      />
      <table className="data-table">
        <thead>
          <tr><th>Part #</th><th>Description</th><th>Manufacturer</th><th>Location</th><th>Stock</th><th>Min</th></tr>
        </thead>
        <tbody>
          {parts.filter(p => p.part_number.includes(search) || p.description.includes(search)).map(part => (
            <tr key={part.id} className={part.quantity_on_hand <= part.min_stock ? 'alert-row' : ''}>
              <td>{part.part_number}</td><td>{part.description}</td><td>{part.manufacturer}</td>
              <td>{part.location_bin}</td><td>{part.quantity_on_hand}</td><td>{part.min_stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PartsList;
