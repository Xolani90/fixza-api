const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the JobDetailsScreen component and extract it
const jobDetailsStart = content.indexOf('function JobDetailsScreen({ route, navigation })');
const jobDetailsEnd = content.indexOf('function ', jobDetailsStart + 1);

if (jobDetailsStart === -1) {
  console.log('Could not find JobDetailsScreen');
  process.exit(1);
}

console.log(`Found JobDetailsScreen at line ${jobDetailsStart}`);

// Create a clean version of the updateStatus function
const cleanUpdateStatus = `
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
                loadJob();
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

// Find and remove duplicate updateStatus declarations
const lines = content.split('\n');
let newLines = [];
let inJobDetails = false;
let braceCount = 0;
let updateStatusCount = 0;
let skipUntil = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Track if we're in JobDetailsScreen
  if (line.includes('function JobDetailsScreen({ route, navigation })')) {
    inJobDetails = true;
    braceCount = 0;
    newLines.push(line);
    continue;
  }
  
  if (inJobDetails) {
    // Count braces to know when the component ends
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    
    // Skip duplicate updateStatus declarations (keep only first)
    if (line.includes('const updateStatus = async (status) => {')) {
      updateStatusCount++;
      if (updateStatusCount === 1) {
        // Keep the first one
        newLines.push(line);
      } else {
        // Skip duplicates
        console.log(`Skipping duplicate updateStatus at line ${i + 1}`);
        // Also skip the function body
        let skipBraceCount = 0;
        let skipStarted = false;
        while (i + 1 < lines.length) {
          i++;
          for (const char of lines[i]) {
            if (char === '{') skipBraceCount++;
            if (char === '}') skipBraceCount--;
          }
          if (skipStarted && skipBraceCount === 0) break;
          if (!skipStarted && lines[i].includes('{')) skipStarted = true;
        }
        continue;
      }
    } else {
      newLines.push(line);
    }
    
    // Check if component ends
    if (braceCount === 0 && line.includes('}')) {
      inJobDetails = false;
    }
  } else {
    newLines.push(line);
  }
}

content = newLines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed duplicate updateStatus declarations');
