const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Check for misplaced return statements
const lines = content.split('\n');
let fixed = false;

for (let i = 0; i < lines.length; i++) {
  // Look for return statements that might be outside a function
  if (lines[i].includes('if (loading) return') && 
      lines[i-1] && !lines[i-1].includes('=>') && 
      !lines[i-1].includes('{') &&
      !lines[i-2]?.includes('=>')) {
    console.log(`Found potential misplaced return at line ${i + 1}`);
    // This is likely fine if inside JobDetailsScreen
  }
}

// Ensure the JobDetailsScreen is properly structured
const jobDetailsStart = content.indexOf('function JobDetailsScreen');
if (jobDetailsStart !== -1) {
  // Check if there's a closing brace
  const afterJobDetails = content.substring(jobDetailsStart);
  const openBraces = (afterJobDetails.match(/{/g) || []).length;
  const closeBraces = (afterJobDetails.match(/}/g) || []).length;
  console.log(`JobDetailsScreen has ${openBraces} opening and ${closeBraces} closing braces`);
}

console.log('✅ Return statement check completed');
