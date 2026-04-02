const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Create the updated reportJob function with debug
const newReportJob = `  const reportJob = () => {
    console.log('🔴 Report button pressed! Job ID:', jobId);
    Alert.alert(
      'Report Job',
      'Why are you reporting this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Scam / Fraud', 
          onPress: () => {
            console.log('🔴 Selected: Scam / Fraud');
            submitReport('Scam or fraud');
          }
        },
        { 
          text: 'Inappropriate content', 
          onPress: () => {
            console.log('🔴 Selected: Inappropriate content');
            submitReport('Inappropriate content');
          }
        },
        { 
          text: 'Other', 
          onPress: () => {
            console.log('🔴 Selected: Other');
            submitReport('Other');
          }
        },
      ]
    );
  };`;

// Create the updated submitReport function with debug
const newSubmitReport = `  const submitReport = async (reason) => {
    console.log('📤 Submitting report...');
    console.log('   Job ID:', jobId);
    console.log('   Reason:', reason);
    console.log('   API_URL:', API_URL);
    try {
      const response = await fetch(\`\${API_URL}/jobs/\${jobId}/report\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ reason }),
      });
      console.log('   Response status:', response.status);
      const data = await response.json();
      console.log('   Response data:', data);
      if (data.success) {
        Alert.alert('Reported', 'Thank you. We will investigate.');
      } else {
        Alert.alert('Error', data.error || 'Failed to submit report');
      }
    } catch (error) {
      console.error('   Report error:', error);
      Alert.alert('Error', 'Connection failed: ' + error.message);
    }
  };`;

// Replace the functions
let updated = false;

// Check if the functions exist and replace them
if (content.includes('const reportJob = () => {')) {
  const reportRegex = /const reportJob = \(\) => \{[^}]*?\n  \};/s;
  content = content.replace(reportRegex, newReportJob);
  updated = true;
  console.log('✅ Updated reportJob function');
}

if (content.includes('const submitReport = async (reason) => {')) {
  const submitRegex = /const submitReport = async \(reason\) => \{[^}]*?\n  \};/s;
  content = content.replace(submitRegex, newSubmitReport);
  updated = true;
  console.log('✅ Updated submitReport function');
}

if (updated) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\n✅ Debug code added to report functions!');
  console.log('\n📱 Next steps:');
  console.log('   1. Refresh your app (press r in Expo terminal)');
  console.log('   2. Open the debugger:');
  console.log('      - Press Ctrl+M (Android) or Cmd+D (iOS)');
  console.log('      - Select "Debug JS Remotely"');
  console.log('   3. Try pressing the "Report Issue" button');
  console.log('   4. Check the console for logs');
} else {
  console.log('❌ Could not find the functions to replace');
}

