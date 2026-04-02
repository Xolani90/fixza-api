import fs from 'fs';

let content = fs.readFileSync('server.js', 'utf8');

// Add imports if not present
if (!content.includes('paystackService')) {
  const importsToAdd = `
import paystackService from './services/paystackService.js';
import notificationService from './services/notificationService.js';
import paymentRoutes from './routes/payments.js';
import locationRoutes from './routes/location.js';
`;
  content = content.replace('import { Expo } from \'expo-server-sdk\';', `import { Expo } from 'expo-server-sdk';${importsToAdd}`);
  console.log('✅ Added imports');
}

// Add routes if not present
if (!content.includes("app.use('/payments'")) {
  const routesToAdd = `
// Mount new routes
app.use('/payments', paymentRoutes);
app.use('/location', locationRoutes);

// Notification endpoints
app.get('/notifications', authenticate, (req, res) => {
  const notifications = notificationService.getUserNotifications(req.user.id);
  const unreadCount = notificationService.getUnreadCount(req.user.id);
  res.json({ success: true, notifications, unreadCount });
});

app.patch('/notifications/:id/read', authenticate, (req, res) => {
  notificationService.markAsRead(parseInt(req.params.id), req.user.id);
  res.json({ success: true });
});
`;
  content = content.replace('// ========== 404 HANDLER ==========', `${routesToAdd}\n\n// ========== 404 HANDLER ==========`);
  console.log('✅ Added routes');
}

fs.writeFileSync('server.js', content, 'utf8');
console.log('✅ Server.js updated successfully!');
