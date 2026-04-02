const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Check if updateStatus is properly defined
const updateStatusPattern = /const updateStatus = async \(status\) => \{[\s\S]*?\n  \};/;

if (!content.match(updateStatusPattern)) {
  console.log('⚠️ updateStatus function not found properly, adding robust version...');
  
  const robustUpdateStatus = `
  const updateStatus = async (status) => {
    console.log('📤 updateStatus called with:', status);
    console.log('   Job ID:', jobId);
    console.log('   API_URL:', API_URL);
    
    Alert.alert(
      'Confirm Action',
      \`Mark this job as \${status}?\`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              console.log('🔄 Sending PATCH request to:', \`\${API_URL}/jobs/\${jobId}/status\`);
              const response = await fetch(\`\${API_URL}/jobs/\${jobId}/status\`, {
                method: 'PATCH',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': \`Bearer \${token}\` 
                },
                body: JSON.stringify({ status }),
              });
              console.log('📥 Response status:', response.status);
              const data = await response.json();
              console.log('📥 Response data:', data);
              
              if (data.success) {
                Alert.alert('Success!', \`Job marked as \${status}\`);
                // Reload the job to update UI
                loadJob();
              } else {
                Alert.alert('Error', data.error || 'Failed to update status');
              }
            } catch (error) {
              console.error('❌ Error in updateStatus:', error);
              Alert.alert('Error', 'Connection failed: ' + error.message);
            }
          }
        }
      ]
    );
  };`;
  
  // Find where to insert - after loadJob function or at the beginning of JobDetailsScreen
  if (content.includes('const loadJob = async () => {')) {
    content = content.replace(/const loadJob = async \(\) => \{[\s\S]*?\n  \};/, (match) => {
      return match + robustUpdateStatus;
    });
    console.log('✅ Added updateStatus function after loadJob');
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
} else {
  console.log('✅ updateStatus function already exists');
}
