const fs = require('fs');

const files = [
  'ReceivePart.js', 
  'IssuePart.js', 
  'Transactions.js', 
  'Reports.js', 
  'Users.js', 
  'ChangePassword.js'
];

const dynamicApiCode = `
  // Dynamic API URL - works on localhost AND network
  const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'http://172.16.0.4:5000';
`;

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if already has dynamic API
    if (!content.includes('const API_URL = window.location.hostname')) {
      // Find where to insert API_URL (after imports)
      const lines = content.split('\n');
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ') && (!lines[i+1] || !lines[i+1].startsWith('import '))) {
          insertIndex = i + 1;
          break;
        }
      }
      
      // Insert API_URL
      lines.splice(insertIndex, 0, dynamicApiCode);
      content = lines.join('\n');
      
      // Replace localhost URLs
      content = content.replace(/http:\/\/localhost:5000/g, '${API_URL}');
      
      fs.writeFileSync(file, content);
      console.log('✅ Updated: ' + file);
    } else {
      console.log('⚠️ Already has dynamic API: ' + file);
    }
  } else {
    console.log('❌ File not found: ' + file);
  }
});

console.log('\n🎉 All files updated successfully!');