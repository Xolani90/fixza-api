import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// Find the 404 handler and the payments route
const lines = content.split('\n');
let newLines = [];
let paymentsRouteIndex = -1;
let notFoundIndex = -1;

// Find the indices
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("app.use('/payments'")) {
    paymentsRouteIndex = i;
  }
  if (lines[i].includes("app.use((req, res) => {") && lines[i+1] && lines[i+1].includes("404")) {
    notFoundIndex = i;
  }
}

console.log(`Payments route at line: ${paymentsRouteIndex + 1}`);
console.log(`404 handler at line: ${notFoundIndex + 1}`);

if (paymentsRouteIndex > notFoundIndex) {
  console.log('Moving payments route before 404 handler...');
  
  // Remove the payments route and insert it before the 404 handler
  const paymentsLine = lines[paymentsRouteIndex];
  lines.splice(paymentsRouteIndex, 1);
  lines.splice(notFoundIndex - 1, 0, paymentsLine);
  
  content = lines.join('\n');
  fs.writeFileSync('server.js', content, 'utf8');
  console.log('✅ Routes reordered!');
} else {
  console.log('Routes are already in correct order');
}
