const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the JobDetailsScreen component and add updateStatus function
const updateStatusFunction = `
  const updateStatus = async (status) => {
    console.log('📤 updateStatus called with:', status);
    console.log('   Job ID:', jobId);
    
    Alert.alert(
      'Confirm Action',
      \`Mark this job as \${status}?\`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              console.log('🔄 Sending request to update status...');
              const response = await fetch(\`\${API_URL}/jobs/\${jobId}/status\`, {
                method: 'PATCH',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': \`Bearer \${token}\` 
                },
                body: JSON.stringify({ status }),
              });
              const data = await response.json();
              console.log('📥 Response:', data);
              if (data.success) {
                Alert.alert('Success', \`Job marked as \${status}\`);
                loadJob(); // Reload the job to update UI
              } else {
                Alert.alert('Error', data.error || 'Failed to update status');
              }
            } catch (error) {
              console.error('❌ Error:', error);
              Alert.alert('Error', 'Connection failed');
            }
          }
        }
      ]
    );
  };`;

// Find where to insert - after the loadJob function definition
const loadJobPattern = /const loadJob = async \(\) => \{[\s\S]*?\n  \};/;
if (content.match(loadJobPattern)) {
  // Insert updateStatus after loadJob
  content = content.replace(loadJobPattern, (match) => {
    return match + '\n\n' + updateStatusFunction;
  });
  console.log('✅ Added updateStatus function after loadJob');
} else {
  console.log('⚠️ Could not find loadJob function, searching for alternative location...');
  
  // Alternative: Insert at the beginning of JobDetailsScreen
  const jobDetailsStart = /const JobDetailsScreen = \(.*?\) => \{/;
  if (content.match(jobDetailsStart)) {
    content = content.replace(jobDetailsStart, (match) => {
      return match + '\n' + updateStatusFunction;
    });
    console.log('✅ Added updateStatus function at start of JobDetailsScreen');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Fix applied! Refresh your app and try again.');
console.log('   In the console, type: typeof updateStatus - should now show "function"');
