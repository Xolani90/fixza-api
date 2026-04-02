import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// Find app.listen position
const listenLine = 'app.listen(PORT, () => {';
const listenIndex = content.indexOf(listenLine);

if (listenIndex !== -1) {
  // Check if payment routes are already there
  if (!content.includes('app.use(\'/payments\'')) {
    // Insert payment routes right before app.listen
    const routesToAdd = `
// Mount payment routes
app.use('/payments', paymentRoutes);

`;
    content = content.slice(0, listenIndex) + routesToAdd + content.slice(listenIndex);
    console.log('✅ Added payment routes before app.listen');
    
    fs.writeFileSync('server.js', content, 'utf8');
    console.log('✅ Server.js updated successfully!');
  } else {
    console.log('✅ Payment routes already exist');
  }
} else {
  console.log('❌ Could not find app.listen');
}
