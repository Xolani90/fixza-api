const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Remove the commented duplicate line
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Skip lines that are commented duplicates
  if (line.includes('// DUPLICATE REMOVED:') && line.includes('const updateStatus')) {
    console.log(`Removing duplicate line ${i + 1}`);
    continue;
  }
  newLines.push(line);
}

content = newLines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Removed duplicate commented line');

// Verify
const count = (content.match(/const updateStatus/g) || []).length;
console.log(`Now have ${count} declaration(s) of updateStatus`);
