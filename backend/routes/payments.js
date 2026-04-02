console.log('🔧 PAYMENTS ROUTER IS BEING LOADED...');

import express from 'express';
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import paystackService from '../services/paystackService.js';
import notificationService from '../services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'fixza.db');
const db = new Database(dbPath);

const router = express.Router();

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log('🔍 [Payments Router] Request:', req.method, req.url);
  next();
});

const PLATFORM_FEE_PERCENT = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'fixza-super-secret-key-change-this-later';

// Simple test route
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Payments router is working!' });
});

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, fullName, role FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Initialize payment
router.post('/initialize/:jobId', authenticate, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const job = db.prepare(`
      SELECT j.*, u.email as customerEmail 
      FROM jobs j 
      JOIN users u ON j.customerId = u.id 
      WHERE j.id = ? AND j.customerId = ?
    `).get(jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job must be completed before payment' });
    }

    const amount = job.budget || 500;
    const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT / 100);
    const providerAmount = amount - platformFee;

    const paymentIntent = await paystackService.initializePayment(
      job.customerEmail,
      amount,
      { jobId, customerId: req.user.id, providerId: job.fixerId }
    );

    if (!paymentIntent.success) {
      return res.status(500).json({ error: 'Failed to initialize payment' });
    }

    db.prepare(`
      INSERT INTO payments (jobId, paymentIntentId, amount, platformFee, providerAmount, customerId, providerId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(jobId, paymentIntent.reference, amount, platformFee, providerAmount, req.user.id, job.fixerId);

    res.json({
      success: true,
      authorization_url: paymentIntent.authorization_url,
      reference: paymentIntent.reference
    });
  } catch (error) {
    console.error('Payment init error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

// Mock payment success endpoint
router.get('/mock-success', (req, res) => {
  res.send(`
    <html>
      <head><title>Payment Success</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>✅ Payment Successful!</h1>
        <p>Your payment has been processed.</p>
        <p>Reference: ${req.query.reference || 'N/A'}</p>
        <p>You can close this window and return to the app.</p>
        <script>
          setTimeout(() => { window.close(); }, 3000);
        </script>
      </body>
    </html>
  `);
});

export default router;
