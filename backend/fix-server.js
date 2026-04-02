import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// Remove the misplaced payment route (after app.listen)
content = content.replace(/app\.use\('\/payments', paymentRoutes\);\n/g, '');

// Find app.listen position
const listenIndex = content.indexOf('app.listen(PORT, () => {');

if (listenIndex !== -1) {
  // Insert payment routes before app.listen
  const routesToAdd = `
// Mount payment routes
app.use('/payments', paymentRoutes);

`;
  content = content.slice(0, listenIndex) + routesToAdd + content.slice(listenIndex);
  console.log('✅ Moved payment routes before app.listen');
} else {
  console.log('❌ Could not find app.listen');
}

fs.writeFileSync('server.js', content, 'utf8');
console.log('✅ server.js fixed!');
