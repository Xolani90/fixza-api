import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { Expo } from 'expo-server-sdk';
import paystackService from './services/paystackService.js';
import notificationService from './services/notificationService.js';
import paymentRoutes from './routes/payments.js';
import locationRoutes from './routes/location.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'fixza-super-secret-key-change-this-later';

let expo = new Expo();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

const publicDir = join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
app.use(express.static(publicDir));

// ========== DATABASE SETUP ==========
const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    fullName TEXT NOT NULL,
    phone TEXT,
    role TEXT CHECK(role IN ('customer', 'fixer', 'admin')) NOT NULL,
    avatar TEXT,
    pushToken TEXT,
    latitude REAL,
    longitude REAL,
    address TEXT,
    isPhoneVerified INTEGER DEFAULT 0,
    isBanned INTEGER DEFAULT 0,
    isApproved INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fixer_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER UNIQUE NOT NULL,
    skills TEXT,
    bio TEXT,
    experience TEXT,
    education TEXT,
    hourlyRate INTEGER,
    pricingType TEXT DEFAULT 'quote',
    isAvailable INTEGER DEFAULT 1,
    completedJobs INTEGER DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    budget INTEGER,
    customerId INTEGER NOT NULL,
    fixerId INTEGER,
    status TEXT DEFAULT 'open',
    paymentStatus TEXT DEFAULT 'pending',
    photo_url TEXT,
    photos TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME,
    FOREIGN KEY (customerId) REFERENCES users(id),
    FOREIGN KEY (fixerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    fixerId INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id),
    FOREIGN KEY (fixerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    senderId INTEGER NOT NULL,
    receiverId INTEGER NOT NULL,
    content TEXT NOT NULL,
    isRead BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id),
    FOREIGN KEY (senderId) REFERENCES users(id),
    FOREIGN KEY (receiverId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER UNIQUE NOT NULL,
    reviewerId INTEGER NOT NULL,
    revieweeId INTEGER NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id),
    FOREIGN KEY (reviewerId) REFERENCES users(id),
    FOREIGN KEY (revieweeId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporterId INTEGER NOT NULL,
    reportedUserId INTEGER,
    jobId INTEGER,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'open',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporterId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    code TEXT NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    isRead BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customerId);
  CREATE INDEX IF NOT EXISTS idx_jobs_fixer ON jobs(fixerId);
  CREATE INDEX IF NOT EXISTS idx_messages_job ON messages(jobId);
  CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(revieweeId);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId);
  CREATE INDEX IF NOT EXISTS idx_quotes_job ON quotes(jobId);
`);

// Safe column additions for existing databases
const safeAlter = (sql) => { try { db.exec(sql); } catch (e) { /* column exists */ } };
safeAlter(`ALTER TABLE users ADD COLUMN pushToken TEXT`);
safeAlter(`ALTER TABLE users ADD COLUMN isPhoneVerified INTEGER DEFAULT 0`);
safeAlter(`ALTER TABLE users ADD COLUMN isBanned INTEGER DEFAULT 0`);
safeAlter(`ALTER TABLE users ADD COLUMN isApproved INTEGER DEFAULT 1`);
safeAlter(`ALTER TABLE jobs ADD COLUMN paymentStatus TEXT DEFAULT 'pending'`);
safeAlter(`ALTER TABLE jobs ADD COLUMN photo_url TEXT`);
safeAlter(`ALTER TABLE jobs ADD COLUMN photos TEXT`);

console.log('✅ Database initialized at:', dbPath);

// ========== HELPERS ==========
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createNotification(userId, title, body, data = null) {
  try {
    db.prepare(`INSERT INTO notifications (userId, title, body, data) VALUES (?, ?, ?, ?)`)
      .run(userId, title, body, data ? JSON.stringify(data) : null);
    const user = db.prepare('SELECT pushToken FROM users WHERE id = ?').get(userId);
    if (user?.pushToken && Expo.isExpoPushToken(user.pushToken)) {
      expo.sendPushNotificationsAsync([{
        to: user.pushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
      }]).catch(err => console.error('Push error:', err));
    }
  } catch (error) {
    console.error('Notification error:', error);
  }
}

// ========== AUTH MIDDLEWARE ==========
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare(
      'SELECT id, email, fullName, role, phone, avatar, pushToken, latitude, longitude, address, isPhoneVerified, isBanned, isApproved, createdAt FROM users WHERE id = ?'
    ).get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isBanned) return res.status(403).json({ error: 'Account banned. Contact support.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ========== PUBLIC ROUTES ==========
app.get('/', (req, res) => {
  res.json({
    message: 'FixZA API is running!',
    version: '3.0.0',
    endpoints: {
      health: 'GET /health',
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      sendOtp: 'POST /auth/send-otp',
      verifyOtp: 'POST /auth/verify-otp',
      jobs: 'GET /jobs',
      fixers: 'GET /fixers',
      admin: 'GET /admin.html'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime(), database: 'connected' });
});

// ========== AUTH ROUTES ==========
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, role, avatar } = req.body;
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Missing required fields', required: ['email', 'password', 'fullName', 'role'] });
    }
    if (!['customer', 'fixer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "customer" or "fixer"' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, password, fullName, phone, role, avatar, isPhoneVerified, isBanned, isApproved) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1)'
    ).run(email, hashedPassword, fullName, phone || null, role, avatar || null);

    const userId = result.lastInsertRowid;

    // Create fixer profile skeleton
    if (role === 'fixer') {
      db.prepare('INSERT OR IGNORE INTO fixer_profiles (userId) VALUES (?)').run(userId);
    }

    // Generate OTP for phone verification if phone provided
    if (phone) {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.prepare('DELETE FROM otp_codes WHERE userId = ?').run(userId);
      db.prepare('INSERT INTO otp_codes (userId, code, expiresAt) VALUES (?, ?, ?)').run(userId, otp, expiresAt);
      console.log(`📱 OTP for ${phone}: ${otp}`); // In production, send via SMS

      return res.status(201).json({
        success: true,
        message: 'Account created. Please verify your phone.',
        userId,
        requiresVerification: true
      });
    }

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: { id: userId, email, fullName, phone: phone || null, role, avatar: avatar || null, isPhoneVerified: 0, createdAt: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBanned) return res.status(403).json({ error: 'Account banned. Contact support.' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, message: 'Login successful', token, user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/auth/send-otp', async (req, res) => {
  try {
    const { phone, userId } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    let targetUserId = userId;
    if (!targetUserId) {
      const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (!user) return res.status(404).json({ error: 'No account found with this phone number' });
      targetUserId = user.id;
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM otp_codes WHERE userId = ?').run(targetUserId);
    db.prepare('INSERT INTO otp_codes (userId, code, expiresAt) VALUES (?, ?, ?)').run(targetUserId, otp, expiresAt);

    console.log(`📱 OTP for ${phone}: ${otp}`); // Replace with real SMS (Twilio, Africa's Talking)

    res.json({ success: true, message: 'OTP sent', userId: targetUserId });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) return res.status(400).json({ error: 'userId and otp required' });

    const record = db.prepare('SELECT * FROM otp_codes WHERE userId = ? ORDER BY createdAt DESC LIMIT 1').get(userId);
    if (!record) return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    if (new Date(record.expiresAt) < new Date()) return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    if (record.code !== otp.toString()) return res.status(400).json({ error: 'Invalid OTP' });

    db.prepare('UPDATE users SET isPhoneVerified = 1 WHERE id = ?').run(userId);
    db.prepare('DELETE FROM otp_codes WHERE userId = ?').run(userId);

    const user = db.prepare('SELECT id, email, fullName, role, phone, avatar, isPhoneVerified, createdAt FROM users WHERE id = ?').get(userId);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, message: 'Phone verified successfully', token, user });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/auth/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/users/:userId/push-token', authenticate, (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ error: 'Push token required' });
    db.prepare('UPDATE users SET pushToken = ? WHERE id = ?').run(pushToken, req.params.userId);
    res.json({ success: true, message: 'Push token saved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

app.patch('/auth/location', authenticate, (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    db.prepare('UPDATE users SET latitude = ?, longitude = ?, address = ? WHERE id = ?')
      .run(latitude || null, longitude || null, address || null, req.user.id);
    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// ========== JOB ROUTES ==========
app.get('/jobs', (req, res) => {
  try {
    const { status, category } = req.query;
    let query = `
      SELECT j.*,
             u.fullName as customerName, u.phone as customerPhone,
             f.fullName as fixerName,
             (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
      FROM jobs j
      LEFT JOIN users u ON j.customerId = u.id
      LEFT JOIN users f ON j.fixerId = f.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND j.status = ?'; params.push(status); }
    if (category) { query += ' AND j.category = ?'; params.push(category); }
    query += ' ORDER BY j.createdAt DESC';

    const jobs = db.prepare(query).all(...params);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

app.get('/jobs/:id', (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const job = db.prepare(`
      SELECT j.*,
             u.fullName as customerName, u.phone as customerPhone, u.avatar as customerAvatar,
             f.fullName as fixerName, f.avatar as fixerAvatar,
             (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
      FROM jobs j
      LEFT JOIN users u ON j.customerId = u.id
      LEFT JOIN users f ON j.fixerId = f.id
      WHERE j.id = ?
    `).get(jobId);

    if (!job) return res.status(404).json({ error: 'Job not found' });

    const messages = db.prepare(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar
      FROM messages m JOIN users u ON m.senderId = u.id
      WHERE m.jobId = ? ORDER BY m.createdAt ASC
    `).all(jobId);

    const quotes = db.prepare(`
      SELECT q.*, u.fullName as fixerName, u.avatar as fixerAvatar,
             COALESCE((SELECT AVG(rating) FROM reviews WHERE revieweeId = q.fixerId), 0) as fixerRating
      FROM quotes q JOIN users u ON q.fixerId = u.id
      WHERE q.jobId = ? ORDER BY q.createdAt DESC
    `).all(jobId);

    res.json({ success: true, job: { ...job, messages, quotes } });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

app.post('/jobs', authenticate, (req, res) => {
  try {
    const { title, description, category, location, budget, photo_url, photos } = req.body;
    if (!title || !description || !category || !location) {
      return res.status(400).json({ error: 'Missing required fields', required: ['title', 'description', 'category', 'location'] });
    }

    const result = db.prepare(`
      INSERT INTO jobs (title, description, category, location, budget, customerId, status, paymentStatus, photo_url, photos)
      VALUES (?, ?, ?, ?, ?, ?, 'open', 'pending', ?, ?)
    `).run(title, description, category, location, budget ? parseInt(budget) : null,
           req.user.id, photo_url || null, photos ? JSON.stringify(photos) : null);

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);

    const fixers = db.prepare("SELECT id FROM users WHERE role = 'fixer' AND isBanned = 0").all();
    for (const fixer of fixers) {
      createNotification(fixer.id, 'New Job Available', `${req.user.fullName} posted: ${title}`, { jobId: job.id });
    }

    res.status(201).json({ success: true, message: 'Job posted successfully', job });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

app.patch('/jobs/:id/accept', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'fixer') return res.status(403).json({ error: 'Only fixers can accept jobs' });

    const jobId = parseInt(req.params.id);
    const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND status = 'open'").get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not available' });

    db.prepare("UPDATE jobs SET fixerId = ?, status = 'assigned' WHERE id = ?").run(req.user.id, jobId);
    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);

    createNotification(job.customerId, 'Job Accepted', `${req.user.fullName} accepted your job: ${job.title}`, { jobId });

    res.json({ success: true, message: 'Job accepted', job: updatedJob });
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({ error: 'Failed to accept job' });
  }
});

app.patch('/jobs/:id/status', authenticate, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status', valid: validStatuses });

    const jobId = parseInt(req.params.id);
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.customerId !== req.user.id && job.fixerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    db.prepare('UPDATE jobs SET status = ?, completedAt = ? WHERE id = ?').run(status, completedAt, jobId);

    if (status === 'completed' && job.fixerId) {
      db.prepare('UPDATE fixer_profiles SET completedJobs = completedJobs + 1 WHERE userId = ?').run(job.fixerId);
    }

    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    const notifyUserId = req.user.id === job.customerId ? job.fixerId : job.customerId;
    if (notifyUserId) createNotification(notifyUserId, 'Job Status Update', `"${job.title}" is now ${status}`, { jobId });

    res.json({ success: true, message: `Job marked as ${status}`, job: updatedJob });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

app.patch('/jobs/:id/payment', authenticate, (req, res) => {
  try {
    const { paymentStatus, paymentMethod } = req.body;
    const validStatuses = ['pending', 'paid', 'cash'];
    if (!validStatuses.includes(paymentStatus)) return res.status(400).json({ error: 'Invalid payment status' });

    const jobId = parseInt(req.params.id);
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.customerId !== req.user.id) return res.status(403).json({ error: 'Only the customer can update payment' });

    db.prepare('UPDATE jobs SET paymentStatus = ? WHERE id = ?').run(paymentStatus, jobId);

    if (job.fixerId) {
      createNotification(job.fixerId, 'Payment Update', `Payment marked as ${paymentStatus} for "${job.title}"`, { jobId });
    }

    res.json({ success: true, message: 'Payment status updated' });
  } catch (error) {
    console.error('Payment update error:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

app.post('/jobs/:id/report', authenticate, (req, res) => {
  try {
    const { reason, details } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required' });

    const jobId = parseInt(req.params.id);
    db.prepare('INSERT INTO reports (reporterId, jobId, reason, details) VALUES (?, ?, ?, ?)').run(req.user.id, jobId, reason, details || null);

    res.json({ success: true, message: 'Report submitted. We will investigate.' });
  } catch (error) {
    console.error('Report job error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

app.post('/jobs/:id/review', authenticate, (req, res) => {
  try {
    const { rating, review, comment } = req.body;
    const reviewText = review || comment;
    const jobId = parseInt(req.params.id);

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Valid rating (1-5) required' });

    const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND status = 'completed'").get(jobId);
    if (!job) return res.status(400).json({ error: 'Job must be completed to review' });
    if (job.customerId !== req.user.id) return res.status(403).json({ error: 'Only customers can review' });

    const existing = db.prepare('SELECT id FROM reviews WHERE jobId = ?').get(jobId);
    if (existing) return res.status(400).json({ error: 'Already reviewed this job' });

    db.prepare('INSERT INTO reviews (jobId, reviewerId, revieweeId, rating, comment) VALUES (?, ?, ?, ?, ?)').run(jobId, req.user.id, job.fixerId, rating, reviewText || null);

    const avgRating = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE revieweeId = ?').get(job.fixerId);
    createNotification(job.fixerId, 'New Review ⭐', `${req.user.fullName} rated you ${rating} stars`, { jobId, rating });

    res.status(201).json({ success: true, message: 'Review submitted', averageRating: avgRating.avg || 0, totalReviews: avgRating.count || 0 });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

app.get('/my-jobs', authenticate, (req, res) => {
  try {
    let query, params = [req.user.id];
    if (req.user.role === 'customer') {
      query = `
        SELECT j.*, u.fullName as fixerName,
               (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
        FROM jobs j LEFT JOIN users u ON j.fixerId = u.id
        WHERE j.customerId = ? ORDER BY j.createdAt DESC
      `;
    } else {
      query = `
        SELECT j.*, u.fullName as customerName, u.phone as customerPhone,
               (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
        FROM jobs j LEFT JOIN users u ON j.customerId = u.id
        WHERE j.fixerId = ? OR j.status = ?
        ORDER BY CASE WHEN j.fixerId = ? THEN 1 ELSE 2 END, j.createdAt DESC
      `;
      params = [req.user.id, 'open', req.user.id];
    }
    const jobs = db.prepare(query).all(...params);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ========== QUOTES ROUTES ==========
app.post('/jobs/:id/quote', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'fixer') return res.status(403).json({ error: 'Only fixers can send quotes' });
    const { amount, message } = req.body;
    if (!amount) return res.status(400).json({ error: 'Quote amount required' });

    const jobId = parseInt(req.params.id);
    const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND status = 'open'").get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not available' });

    const existing = db.prepare('SELECT id FROM quotes WHERE jobId = ? AND fixerId = ?').get(jobId, req.user.id);
    if (existing) {
      db.prepare('UPDATE quotes SET amount = ?, message = ?, status = ? WHERE id = ?').run(amount, message || null, 'pending', existing.id);
    } else {
      db.prepare('INSERT INTO quotes (jobId, fixerId, amount, message) VALUES (?, ?, ?, ?)').run(jobId, req.user.id, amount, message || null);
    }

    createNotification(job.customerId, 'New Quote Received', `${req.user.fullName} sent a quote of R${amount}`, { jobId });

    res.status(201).json({ success: true, message: 'Quote sent' });
  } catch (error) {
    console.error('Send quote error:', error);
    res.status(500).json({ error: 'Failed to send quote' });
  }
});

app.patch('/quotes/:id/accept', authenticate, (req, res) => {
  try {
    const quote = db.prepare('SELECT q.*, j.customerId FROM quotes q JOIN jobs j ON q.jobId = j.id WHERE q.id = ?').get(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    if (quote.customerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    db.prepare("UPDATE quotes SET status = 'accepted' WHERE id = ?").run(quote.id);
    db.prepare("UPDATE quotes SET status = 'rejected' WHERE jobId = ? AND id != ?").run(quote.jobId, quote.id);
    db.prepare("UPDATE jobs SET fixerId = ?, status = 'assigned', budget = ? WHERE id = ?").run(quote.fixerId, quote.amount, quote.jobId);

    createNotification(quote.fixerId, 'Quote Accepted! 🎉', 'Your quote was accepted. Get ready to work!', { jobId: quote.jobId });

    res.json({ success: true, message: 'Quote accepted and fixer assigned' });
  } catch (error) {
    console.error('Accept quote error:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

// ========== MESSAGE ROUTES ==========
app.post('/messages', authenticate, (req, res) => {
  try {
    const { jobId, receiverId, content } = req.body;
    if (!jobId || !receiverId || !content) return res.status(400).json({ error: 'Missing required fields' });

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.customerId !== req.user.id && job.fixerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this job' });
    }

    const result = db.prepare('INSERT INTO messages (jobId, senderId, receiverId, content) VALUES (?, ?, ?, ?)').run(jobId, req.user.id, receiverId, content);
    const message = db.prepare(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar
      FROM messages m JOIN users u ON m.senderId = u.id WHERE m.id = ?
    `).get(result.lastInsertRowid);

    createNotification(receiverId, 'New Message 💬', `${req.user.fullName}: ${content.substring(0, 50)}`, { jobId });

    res.status(201).json({ success: true, message: 'Message sent', data: message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/messages/:jobId', authenticate, (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job || (job.customerId !== req.user.id && job.fixerId !== req.user.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    db.prepare('UPDATE messages SET isRead = 1 WHERE jobId = ? AND receiverId = ? AND isRead = 0').run(jobId, req.user.id);
    const messages = db.prepare(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar
      FROM messages m JOIN users u ON m.senderId = u.id
      WHERE m.jobId = ? ORDER BY m.createdAt ASC
    `).all(jobId);
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/messages/unread/count', authenticate, (req, res) => {
  try {
    const count = db.prepare(`
      SELECT COUNT(*) as unreadCount FROM messages m
      JOIN jobs j ON m.jobId = j.id
      WHERE (j.customerId = ? OR j.fixerId = ?) AND m.receiverId = ? AND m.isRead = 0
    `).get(req.user.id, req.user.id, req.user.id);
    res.json({ success: true, unreadCount: count.unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ========== REVIEW ROUTES ==========
app.post('/reviews', authenticate, (req, res) => {
  try {
    const { jobId, rating, comment } = req.body;
    if (!jobId || !rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Valid rating (1-5) required' });

    const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND status = 'completed'").get(jobId);
    if (!job) return res.status(400).json({ error: 'Job must be completed to review' });
    if (job.customerId !== req.user.id) return res.status(403).json({ error: 'Only customers can review fixers' });

    const existing = db.prepare('SELECT id FROM reviews WHERE jobId = ?').get(jobId);
    if (existing) return res.status(400).json({ error: 'Already reviewed this job' });

    db.prepare('INSERT INTO reviews (jobId, reviewerId, revieweeId, rating, comment) VALUES (?, ?, ?, ?, ?)').run(jobId, req.user.id, job.fixerId, rating, comment || null);

    const avgRating = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE revieweeId = ?').get(job.fixerId);
    createNotification(job.fixerId, 'New Review ⭐', `${req.user.fullName} rated you ${rating} stars`, { jobId, rating });

    res.status(201).json({ success: true, message: 'Review submitted', averageRating: avgRating.avg || 0, totalReviews: avgRating.count || 0 });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

app.get('/reviews/:fixerId', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.fullName as reviewerName, u.avatar as reviewerAvatar
      FROM reviews r JOIN users u ON r.reviewerId = u.id
      WHERE r.revieweeId = ? ORDER BY r.createdAt DESC
    `).all(req.params.fixerId);
    const avg = db.prepare('SELECT AVG(rating) as average, COUNT(*) as total FROM reviews WHERE revieweeId = ?').get(req.params.fixerId);
    res.json({ success: true, reviews, averageRating: avg.average || 0, totalReviews: avg.total || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ========== FIXER ROUTES ==========
app.get('/fixers', (req, res) => {
  try {
    const fixers = db.prepare(`
      SELECT u.id, u.email, u.fullName, u.phone, u.avatar, u.latitude, u.longitude, u.address, u.isPhoneVerified,
             fp.skills, fp.bio, fp.hourlyRate, fp.pricingType, fp.experience, fp.isAvailable, fp.completedJobs,
             COALESCE(AVG(r.rating), 0) as rating,
             COUNT(r.id) as totalReviews
      FROM users u
      LEFT JOIN fixer_profiles fp ON u.id = fp.userId
      LEFT JOIN reviews r ON u.id = r.revieweeId
      WHERE u.role = 'fixer' AND u.isBanned = 0
      GROUP BY u.id
      ORDER BY rating DESC
    `).all();
    res.json({ success: true, count: fixers.length, fixers });
  } catch (error) {
    console.error('Get fixers error:', error);
    res.status(500).json({ error: 'Failed to fetch fixers' });
  }
});

app.get('/fixers/nearby', (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Latitude and longitude required' });

    const fixers = db.prepare(`
      SELECT u.id, u.fullName, u.email, u.phone, u.avatar, u.latitude, u.longitude, u.address,
             fp.skills, fp.bio, fp.hourlyRate, fp.pricingType, fp.isAvailable,
             COALESCE((SELECT AVG(rating) FROM reviews WHERE revieweeId = u.id), 0) as rating,
             (SELECT COUNT(*) FROM reviews WHERE revieweeId = u.id) as totalReviews
      FROM users u
      LEFT JOIN fixer_profiles fp ON u.id = fp.userId
      WHERE u.role = 'fixer' AND u.isBanned = 0 AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    `).all();

    const nearby = fixers
      .filter(f => getDistance(parseFloat(lat), parseFloat(lng), f.latitude, f.longitude) <= parseFloat(radius))
      .map(f => ({ ...f, distance: getDistance(parseFloat(lat), parseFloat(lng), f.latitude, f.longitude).toFixed(1) }))
      .sort((a, b) => a.distance - b.distance);

    res.json({ success: true, count: nearby.length, fixers: nearby });
  } catch (error) {
    console.error('Nearby fixers error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby fixers' });
  }
});

app.get('/fixers/:fixerId', (req, res) => {
  try {
    const fixer = db.prepare(`
      SELECT u.id, u.email, u.fullName, u.phone, u.avatar, u.latitude, u.longitude, u.isPhoneVerified,
             fp.skills, fp.bio, fp.hourlyRate, fp.pricingType, fp.experience, fp.education, fp.isAvailable, fp.completedJobs,
             COALESCE((SELECT AVG(rating) FROM reviews WHERE revieweeId = u.id), 0) as rating,
             (SELECT COUNT(*) FROM reviews WHERE revieweeId = u.id) as totalReviews
      FROM users u
      LEFT JOIN fixer_profiles fp ON u.id = fp.userId
      WHERE u.id = ? AND u.role = 'fixer'
    `).get(req.params.fixerId);
    if (!fixer) return res.status(404).json({ error: 'Fixer not found' });
    res.json({ success: true, fixer });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fixer' });
  }
});

app.patch('/fixers/profile', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'fixer') return res.status(403).json({ error: 'Only fixers can update fixer profiles' });
    const { skills, bio, experience, education, hourlyRate, pricingType, isAvailable } = req.body;

    db.prepare('INSERT OR IGNORE INTO fixer_profiles (userId) VALUES (?)').run(req.user.id);
    db.prepare(`
      UPDATE fixer_profiles SET
        skills = COALESCE(?, skills),
        bio = COALESCE(?, bio),
        experience = COALESCE(?, experience),
        education = COALESCE(?, education),
        hourlyRate = COALESCE(?, hourlyRate),
        pricingType = COALESCE(?, pricingType),
        isAvailable = COALESCE(?, isAvailable)
      WHERE userId = ?
    `).run(skills || null, bio || null, experience || null, education || null,
           hourlyRate ? parseInt(hourlyRate) : null, pricingType || null,
           isAvailable !== undefined ? (isAvailable ? 1 : 0) : null, req.user.id);

    const profile = db.prepare('SELECT * FROM fixer_profiles WHERE userId = ?').get(req.user.id);
    res.json({ success: true, message: 'Profile updated', profile });
  } catch (error) {
    console.error('Update fixer profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/fixers/:fixerId/rating', (req, res) => {
  try {
    const stats = db.prepare('SELECT COALESCE(AVG(rating), 0) as averageRating, COUNT(*) as totalReviews FROM reviews WHERE revieweeId = ?').get(req.params.fixerId);
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rating' });
  }
});

// ========== REPORT ROUTES ==========
app.post('/users/:userId/report', authenticate, (req, res) => {
  try {
    const { reason, details } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required' });
    db.prepare('INSERT INTO reports (reporterId, reportedUserId, reason, details) VALUES (?, ?, ?, ?)').run(req.user.id, req.params.userId, reason, details || null);
    res.json({ success: true, message: 'Report submitted. We will investigate.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ========== NOTIFICATION ROUTES ==========
app.get('/notifications', authenticate, (req, res) => {
  try {
    const notifications = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50').all(req.user.id);
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.patch('/notifications/:id/read', authenticate, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.get('/notifications/unread/count', authenticate, (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as unreadCount FROM notifications WHERE userId = ? AND isRead = 0').get(req.user.id);
    res.json({ success: true, unreadCount: count.unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ========== ADMIN ROUTES ==========
app.get('/admin/stats', authenticate, adminOnly, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const totalFixers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'fixer'").get();
    const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get();
    const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get();
    const openJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'open'").get();
    const completedJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'").get();
    const totalReviews = db.prepare('SELECT COUNT(*) as count FROM reviews').get();
    const avgRating = db.prepare('SELECT AVG(rating) as avg FROM reviews').get();
    const openReports = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'open'").get();

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.count, totalFixers: totalFixers.count,
        totalCustomers: totalCustomers.count, totalJobs: totalJobs.count,
        openJobs: openJobs.count, completedJobs: completedJobs.count,
        totalReviews: totalReviews.count, averageRating: avgRating.avg || 0,
        openReports: openReports.count
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/admin/users', authenticate, adminOnly, (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, email, fullName, role, phone, avatar, isPhoneVerified, isBanned, isApproved, createdAt FROM users ORDER BY createdAt DESC'
    ).all();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/admin/jobs', authenticate, adminOnly, (req, res) => {
  try {
    const jobs = db.prepare(`
      SELECT j.*, u.fullName as customerName, f.fullName as fixerName
      FROM jobs j LEFT JOIN users u ON j.customerId = u.id LEFT JOIN users f ON j.fixerId = f.id
      ORDER BY j.createdAt DESC
    `).all();
    res.json({ success: true, jobs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

app.get('/admin/reports', authenticate, adminOnly, (req, res) => {
  try {
    const reports = db.prepare(`
      SELECT r.*, u.fullName as reporterName, ru.fullName as reportedUserName
      FROM reports r
      JOIN users u ON r.reporterId = u.id
      LEFT JOIN users ru ON r.reportedUserId = ru.id
      ORDER BY r.createdAt DESC
    `).all();
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.post('/admin/users/:id/ban', authenticate, adminOnly, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot ban admins' });
    db.prepare('UPDATE users SET isBanned = 1 WHERE id = ?').run(req.params.id);
    createNotification(req.params.id, 'Account Suspended', 'Your account has been suspended. Contact support.', {});
    res.json({ success: true, message: 'User banned' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

app.post('/admin/users/:id/unban', authenticate, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE users SET isBanned = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'User unbanned' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

app.post('/admin/fixers/:id/approve', authenticate, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE users SET isApproved = 1 WHERE id = ? AND role = ?').run(req.params.id, 'fixer');
    createNotification(req.params.id, 'Profile Approved ✅', 'Your fixer profile has been approved! You can now receive jobs.', {});
    res.json({ success: true, message: 'Fixer approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve fixer' });
  }
});

app.patch('/admin/reports/:id/resolve', authenticate, adminOnly, (req, res) => {
  try {
    db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: 'Report resolved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

app.delete('/admin/jobs/:id', authenticate, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM messages WHERE jobId = ?').run(req.params.id);
    db.prepare('DELETE FROM reviews WHERE jobId = ?').run(req.params.id);
    db.prepare('DELETE FROM quotes WHERE jobId = ?').run(req.params.id);
    db.prepare('DELETE FROM reports WHERE jobId = ?').run(req.params.id);
    db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

app.delete('/admin/users/:id', authenticate, adminOnly, (req, res) => {
  try {
    const userJobs = db.prepare('SELECT id FROM jobs WHERE customerId = ? OR fixerId = ?').all(req.params.id, req.params.id);
    for (const job of userJobs) {
      db.prepare('DELETE FROM messages WHERE jobId = ?').run(job.id);
      db.prepare('DELETE FROM reviews WHERE jobId = ?').run(job.id);
      db.prepare('DELETE FROM quotes WHERE jobId = ?').run(job.id);
    }
    db.prepare('DELETE FROM reviews WHERE reviewerId = ? OR revieweeId = ?').run(req.params.id, req.params.id);
    db.prepare('DELETE FROM jobs WHERE customerId = ? OR fixerId = ?').run(req.params.id, req.params.id);
    db.prepare('DELETE FROM notifications WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM reports WHERE reporterId = ? OR reportedUserId = ?').run(req.params.id, req.params.id);
    db.prepare('DELETE FROM fixer_profiles WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM otp_codes WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ========== DEBUG ROUTES ==========
app.get('/debug/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, fullName, role, avatar, pushToken, isPhoneVerified, isBanned, createdAt FROM users ORDER BY createdAt DESC').all();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.use('/payments', paymentRoutes);
// ========== 404 & ERROR HANDLERS ==========
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========

// Mount payment routes

app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚀 FixZA API v3.0 is running!');
  console.log('=================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`💾 Database: ${dbPath}`);
  console.log('=================================');
  console.log('\n✨ Features:');
  console.log('   👤 Accounts & OTP Verification');
  console.log('   🔧 Fixer Profiles with Skills & Bio');
  console.log('   📩 Jobs with Photo Support');
  console.log('   💬 Quotes System');
  console.log('   💸 Payment Status Tracking');
  console.log('   ⭐ Ratings & Reviews');
  console.log('   🚨 Reports & Safety Controls');
  console.log('   📊 Full Admin Panel');
  console.log('   🔔 Push Notifications');
  console.log('=================================\n');
});
