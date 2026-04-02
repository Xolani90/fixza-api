const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find all updateStatus declarations
const lines = content.split('\n');
let updateStatusLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const updateStatus = async (status) => {')) {
    updateStatusLines.push(i + 1);
  }
}

console.log('Found updateStatus at lines:', updateStatusLines);

if (updateStatusLines.length > 1) {
  // Keep the first one, remove others
  console.log('Removing duplicate declarations...');
  
  // We'll keep the first one and comment out the others
  let foundCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const updateStatus = async (status) => {')) {
      foundCount++;
      if (foundCount > 1) {
        // Comment out this duplicate
        lines[i] = '// DUPLICATE REMOVED: ' + lines[i];
        console.log(`Commented out duplicate at line ${i + 1}`);
      }
    }
  }
  
  content = lines.join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Duplicates removed');
} else {
  console.log('No duplicates found');
}
