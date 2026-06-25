import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_URL from '../config/api';

const PartsList = ({ token, user }) => {
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [pricePart, setPricePart] = useState(null); // Separate state for price modal
  const [historyPart, setHistoryPart] = useState(null); // Separate state for history modal
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceData, setPriceData] = useState({
    price: '',
    quantity: 1,
    transaction_type: 'MANUAL',
    notes: ''
  });
  const [priceHistory, setPriceHistory] = useState([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [newPart, setNewPart] = useState({
    part_number: '',
    description: '',
    manufacturer: '',
    compatible_gse: '',
    location_bin: '',
    min_stock: 5,
    contact_person: '',
    contact_phone: '',
    contact_email: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingPrice, setUpdatingPrice] = useState(false);

  // ============================================================
  // FETCH PARTS
  // ============================================================
  const fetchParts = useCallback(async () => {
    try {
      console.log('🔧 Fetching parts from:', `${API_URL}/api/parts`);
      const response = await axios.get(`${API_URL}/api/parts?_=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      console.log('🔧 Parts loaded:', response.data.length);
      setParts(response.data);
    } catch (err) {
      console.error('🔧 Error fetching parts:', err);
      console.error('🔧 Error response:', err.response?.data);
      setError('Failed to load parts');
      setTimeout(() => setError(''), 3000);
    }
  }, [token]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // ============================================================
  // ADD PART
  // ============================================================
  const handleAddPart = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/parts`, newPart, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('✓ Part added successfully!');
      setShowAddForm(false);
      setNewPart({
        part_number: '',
        description: '',
        manufacturer: '',
        compatible_gse: '',
        location_bin: '',
        min_stock: 5,
        contact_person: '',
        contact_phone: '',
        contact_email: ''
      });
      await fetchParts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Error adding part: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setError(''), 3000);
    }
  };

  // ============================================================
  // EDIT PART
  // ============================================================
  const handleEditPart = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/parts/${editingPart.id}`, {
        contact_person: editingPart.contact_person,
        contact_phone: editingPart.contact_phone,
        contact_email: editingPart.contact_email,
        location_bin: editingPart.location_bin,
        min_stock: editingPart.min_stock
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(`✓ Part "${editingPart.part_number}" updated successfully!`);
      setShowEditForm(false);
      setEditingPart(null);
      await fetchParts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Error updating part: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setError(''), 3000);
    }
  };

  // ============================================================
  // DELETE PART
  // ============================================================
  const handleDeletePart = async (part) => {
    try {
      console.log('🗑️ Deleting part:', part);
      await axios.delete(`${API_URL}/api/parts/${part.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage(`✓ Part "${part.part_number}" deleted successfully!`);
      setShowDeleteConfirm(null);
      await fetchParts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Delete error details:', err.response?.data);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Error deleting part';
      setError(errorMsg);
      setTimeout(() => setError(''), 3000);
    }
  };

  // ============================================================
  // PRICE HISTORY FUNCTIONS
  // ============================================================
  
  const fetchPriceHistory = async (partId, part) => {
    try {
      setHistoryPart(part);
      console.log('📊 Fetching price history for part:', partId);
      const response = await axios.get(`${API_URL}/api/price-history/${partId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📊 Price history loaded:', response.data.length);
      setPriceHistory(response.data || []);
      setShowPriceHistory(true);
    } catch (err) {
      console.error('Error fetching price history:', err);
      if (err.response?.status === 404) {
        setPriceHistory([]);
        setShowPriceHistory(true);
      } else {
        setError('Failed to load price history: ' + (err.response?.data?.error || err.message));
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    setUpdatingPrice(true);
    
    try {
      // Validate price
      const priceValue = parseFloat(priceData.price);
      if (isNaN(priceValue) || priceValue < 0) {
        throw new Error('Please enter a valid price');
      }
      
      const payload = {
        part_id: pricePart.id,
        price: priceValue,
        quantity: parseInt(priceData.quantity) || 1,
        transaction_type: priceData.transaction_type || 'MANUAL',
        notes: priceData.notes || ''
      };

      console.log('💰 Updating price with payload:', payload);
      
      const response = await axios.post(`${API_URL}/api/price-history`, payload, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('💰 Price update response:', response.data);
      
      setMessage(`✓ Price updated for ${pricePart.part_number} successfully!`);
      setShowPriceModal(false);
      setPricePart(null);
      setPriceData({
        price: '',
        quantity: 1,
        transaction_type: 'MANUAL',
        notes: ''
      });
      await fetchParts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error updating price:', err);
      console.error('Error response:', err.response?.data);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to update price';
      setError('Failed to update price: ' + errorMsg);
      setTimeout(() => setError(''), 3000);
    } finally {
      setUpdatingPrice(false);
    }
  };

  const openPriceModal = (part) => {
    setPricePart(part);
    setPriceData({
      price: part.current_price || part.unit_price || 0,
      quantity: 1,
      transaction_type: 'MANUAL',
      notes: ''
    });
    setShowPriceModal(true);
  };

  const formatPrice = (price) => {
    return `$${parseFloat(price || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
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
      return 'Invalid Date';
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchParts();
    setRefreshing(false);
    setMessage('✓ List refreshed!');
    setTimeout(() => setMessage(''), 2000);
  };

  const handleExcelImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    
    import('xlsx').then((XLSX) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          console.log('📊 Excel data:', jsonData.length, 'rows');
          
          let successCount = 0;
          let failCount = 0;
          
          for (const row of jsonData) {
            const partData = {
              part_number: row['Part Number'] || row['PartNumber'] || row['part_number'],
              description: row['Description'] || row['description'] || '',
              manufacturer: row['Manufacturer'] || row['manufacturer'] || '',
              compatible_gse: row['Compatible GSE'] || row['compatible_gse'] || '',
              location_bin: row['Location Bin'] || row['location_bin'] || '',
              min_stock: parseInt(row['Min Stock'] || row['min_stock'] || 5),
              quantity_on_hand: parseInt(row['Quantity On Hand'] || row['quantity_on_hand'] || 0),
              contact_person: row['Contact Person'] || row['contact_person'] || '',
              contact_phone: row['Contact Phone'] || row['contact_phone'] || '',
              contact_email: row['Contact Email'] || row['contact_email'] || '',
            };
            
            if (!partData.part_number) {
              failCount++;
              continue;
            }
            
            try {
              await axios.post(`${API_URL}/api/parts`, partData, {
                headers: { Authorization: `Bearer ${token}` }
              });
              successCount++;
            } catch (err) {
              console.error('Error importing row:', err);
              failCount++;
            }
          }
          
          setMessage(`✓ Import complete! ${successCount} parts added, ${failCount} failed.`);
          setImporting(false);
          await fetchParts();
          setTimeout(() => setMessage(''), 5000);
          event.target.value = '';
        } catch (err) {
          console.error('Error processing Excel:', err);
          setError('Error processing Excel file');
          setImporting(false);
          setTimeout(() => setError(''), 3000);
        }
      };
      
      reader.onerror = () => {
        setError('Error reading file');
        setImporting(false);
        setTimeout(() => setError(''), 3000);
      };
      
      reader.readAsArrayBuffer(file);
    }).catch((err) => {
      console.error('Failed to load Excel library:', err);
      setError('Failed to load Excel import feature');
      setImporting(false);
      setTimeout(() => setError(''), 3000);
    });
  };

  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  const showContactDetails = (part) => {
    setSelectedPart(part);
  };

  const closeContactDetails = () => {
    setSelectedPart(null);
  };

  const openEditForm = (part) => {
    setEditingPart({ ...part });
    setShowEditForm(true);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2>📦 Parts Catalog</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleManualRefresh} 
            disabled={refreshing}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '5px',
              cursor: 'pointer',
              opacity: refreshing ? 0.6 : 1
            }}
          >
            {refreshing ? '⟳ Refreshing...' : '🔄 Refresh'}
          </button>
          
          <label htmlFor="excel-import-input" style={{
            backgroundColor: '#2c3e50',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer',
            display: 'inline-block'
          }}>
            📂 Import from Excel
          </label>
          <input
            type="file"
            id="excel-import-input"
            accept=".xlsx, .xls, .csv"
            onChange={handleExcelImport}
            style={{ display: 'none' }}
            disabled={importing}
          />
          <button onClick={() => setShowAddForm(!showAddForm)} style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>
            {showAddForm ? 'Cancel' : '+ Add New Part'}
          </button>
        </div>
      </div>

      {importing && (
        <div style={{
          backgroundColor: '#e8f4fd',
          color: '#2196f3',
          padding: '10px',
          borderRadius: '5px',
          margin: '10px 0',
          textAlign: 'center'
        }}>
          ⏳ Importing parts from Excel... Please wait.
        </div>
      )}

      {refreshing && (
        <div style={{
          backgroundColor: '#e8f4fd',
          color: '#2196f3',
          padding: '10px',
          borderRadius: '5px',
          margin: '10px 0',
          textAlign: 'center'
        }}>
          ⟳ Refreshing parts list...
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddPart} style={{
          backgroundColor: '#f9f9f9',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          marginBottom: '20px'
        }}>
          <h3>Add New Spare Part</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Part Number *</label>
              <input type="text" required value={newPart.part_number} onChange={(e) => setNewPart({...newPart, part_number: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description *</label>
              <input type="text" required value={newPart.description} onChange={(e) => setNewPart({...newPart, description: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Manufacturer</label>
              <input type="text" value={newPart.manufacturer} onChange={(e) => setNewPart({...newPart, manufacturer: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Compatible GSE</label>
              <input type="text" value={newPart.compatible_gse} onChange={(e) => setNewPart({...newPart, compatible_gse: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Bin Location</label>
              <input type="text" value={newPart.location_bin} onChange={(e) => setNewPart({...newPart, location_bin: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Minimum Stock</label>
              <input type="number" value={newPart.min_stock} onChange={(e) => setNewPart({...newPart, min_stock: parseInt(e.target.value) || 5})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Person</label>
              <input type="text" value={newPart.contact_person} onChange={(e) => setNewPart({...newPart, contact_person: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Phone</label>
              <input type="tel" value={newPart.contact_phone} onChange={(e) => setNewPart({...newPart, contact_phone: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Email</label>
              <input type="email" value={newPart.contact_email} onChange={(e) => setNewPart({...newPart, contact_email: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
          </div>
          <button type="submit" style={{ marginTop: '15px', backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>Save Part</button>
        </form>
      )}

      {showEditForm && editingPart && (
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
          <form onSubmit={handleEditPart} style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '500px',
            maxWidth: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3>Edit Part: {editingPart.part_number}</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Person</label>
              <input type="text" value={editingPart.contact_person || ''} onChange={(e) => setEditingPart({...editingPart, contact_person: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Phone</label>
              <input type="tel" value={editingPart.contact_phone || ''} onChange={(e) => setEditingPart({...editingPart, contact_phone: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contact Email</label>
              <input type="email" value={editingPart.contact_email || ''} onChange={(e) => setEditingPart({...editingPart, contact_email: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Bin Location</label>
              <input type="text" value={editingPart.location_bin || ''} onChange={(e) => setEditingPart({...editingPart, location_bin: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Minimum Stock</label>
              <input type="number" value={editingPart.min_stock || 5} onChange={(e) => setEditingPart({...editingPart, min_stock: parseInt(e.target.value) || 5})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={{ backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>Save Changes</button>
              <button type="button" onClick={() => { setShowEditForm(false); setEditingPart(null); }} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {message && <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px', borderRadius: '5px', margin: '10px 0', border: '1px solid #c3e6cb' }}>{message}</div>}
      {error && <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '5px', margin: '10px 0', border: '1px solid #f5c6cb' }}>{error}</div>}

      <input
        type="text"
        placeholder="🔍 Search parts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ margin: '20px 0', padding: '10px', width: '300px', borderRadius: '5px', border: '1px solid #ddd' }}
      />
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Part #</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Description</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Manufacturer</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Location</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Stock</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Current Price</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Min</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parts.filter(p => p.part_number.toLowerCase().includes(search.toLowerCase()) || 
              (p.description && p.description.toLowerCase().includes(search.toLowerCase()))).map(part => (
              <tr key={part.id} style={{ backgroundColor: part.quantity_on_hand <= part.min_stock ? '#fff3cd' : 'white' }}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.part_number}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.description || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.manufacturer || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.location_bin || '-'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold', color: part.quantity_on_hand <= part.min_stock ? '#dc3545' : '#28a745' }}>
                  {part.quantity_on_hand}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold', color: '#1976d2' }}>
                  ${parseFloat(part.current_price || part.unit_price || 0).toFixed(2)}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{part.min_stock}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  <button 
                    onClick={() => openPriceModal(part)} 
                    style={{ 
                      backgroundColor: '#ffc107', 
                      color: '#333', 
                      border: 'none', 
                      padding: '5px 10px', 
                      borderRadius: '3px', 
                      marginRight: '5px',
                      cursor: 'pointer' 
                    }}
                  >
                    💰 Price
                  </button>
                  <button 
                    onClick={() => fetchPriceHistory(part.id, part)} 
                    style={{ 
                      backgroundColor: '#9b59b6', 
                      color: 'white', 
                      border: 'none', 
                      padding: '5px 10px', 
                      borderRadius: '3px', 
                      marginRight: '5px',
                      cursor: 'pointer' 
                    }}
                  >
                    📊 History
                  </button>
                  <button onClick={() => showContactDetails(part)} style={{ backgroundColor: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>
                    📞 Contact
                  </button>
                  <button onClick={() => openEditForm(part)} style={{ backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', marginRight: '5px', cursor: 'pointer' }}>
                    ✏️ Edit
                  </button>
                  {canDelete && (
                    <button onClick={() => setShowDeleteConfirm(part)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}>
                      🗑️ Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contact Details Modal */}
      {selectedPart && !showPriceModal && !showPriceHistory && (
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
            maxWidth: '450px',
            width: '90%'
          }}>
            <h3>📞 Manufacturer Contact</h3>
            <hr />
            <p><strong>Part Number:</strong> {selectedPart.part_number}</p>
            <p><strong>Description:</strong> {selectedPart.description}</p>
            <p><strong>Manufacturer:</strong> {selectedPart.manufacturer || 'N/A'}</p>
            <hr />
            <h4>Contact Details:</h4>
            <p><strong>👤 Contact Person:</strong> {selectedPart.contact_person || 'Not provided'}</p>
            <p><strong>📞 Phone:</strong> {selectedPart.contact_phone || 'Not provided'}</p>
            <p><strong>📧 Email:</strong> {selectedPart.contact_email || 'Not provided'}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={closeContactDetails} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '3px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Price Update Modal */}
      {showPriceModal && pricePart && (
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
            maxWidth: '450px',
            width: '90%'
          }}>
            <h3>💰 Update Price</h3>
            <p><strong>Part:</strong> {pricePart.part_number} - {pricePart.description}</p>
            <p><strong>Current Price:</strong> {formatPrice(pricePart.current_price || pricePart.unit_price || 0)}</p>
            <hr />
            <form onSubmit={handleUpdatePrice}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>New Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={priceData.price}
                  onChange={(e) => setPriceData({ ...priceData, price: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={priceData.quantity}
                  onChange={(e) => setPriceData({ ...priceData, quantity: parseInt(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Transaction Type</label>
                <select
                  value={priceData.transaction_type}
                  onChange={(e) => setPriceData({ ...priceData, transaction_type: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="MANUAL">Manual</option>
                  <option value="RECEIVE">Receive</option>
                  <option value="ISSUE">Issue</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Notes</label>
                <input
                  type="text"
                  value={priceData.notes}
                  onChange={(e) => setPriceData({ ...priceData, notes: e.target.value })}
                  placeholder="Reason for price change"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="submit" 
                  disabled={updatingPrice}
                  style={{ 
                    flex: 1, 
                    backgroundColor: updatingPrice ? '#90caf9' : '#2196f3', 
                    color: 'white', 
                    border: 'none', 
                    padding: '10px 15px', 
                    borderRadius: '5px', 
                    cursor: updatingPrice ? 'not-allowed' : 'pointer' 
                  }}
                >
                  {updatingPrice ? '⏳ Updating...' : '💰 Update Price'}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowPriceModal(false); setPricePart(null); }} 
                  style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Modal */}
      {showPriceHistory && historyPart && (
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
            maxWidth: '800px',
            width: '95%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3>📊 Price History</h3>
            <p><strong>Part:</strong> {historyPart.part_number} - {historyPart.description}</p>
            <hr />
            {priceHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <p style={{ fontSize: '48px', margin: '0' }}>📭</p>
                <p>No price history available for this part.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>#</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Date</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Price</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Quantity</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Type</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((record, index) => (
                    <tr key={record.id || index}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatDate(record.created_at)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#1976d2' }}>
                        {formatPrice(record.price)}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{record.quantity || 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: record.transaction_type === 'RECEIVE' ? '#d4edda' :
                                        record.transaction_type === 'ISSUE' ? '#f8d7da' :
                                        record.transaction_type === 'INITIAL' ? '#e3f2fd' : '#e9ecef',
                          color: record.transaction_type === 'RECEIVE' ? '#155724' :
                                 record.transaction_type === 'ISSUE' ? '#721c24' :
                                 record.transaction_type === 'INITIAL' ? '#0d47a1' : '#6c757d',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {record.transaction_type || 'MANUAL'}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                onClick={() => { setShowPriceHistory(false); setHistoryPart(null); }} 
                style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
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
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3>⚠️ Confirm Delete</h3>
            <p>Are you sure you want to delete:</p>
            <p><strong>{showDeleteConfirm.part_number}</strong><br/>{showDeleteConfirm.description}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
              <button onClick={() => handleDeletePart(showDeleteConfirm)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '3px', cursor: 'pointer' }}>
                Yes, Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(null)} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '3px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartsList;