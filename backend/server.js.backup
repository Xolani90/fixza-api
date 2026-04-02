import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { Expo } from 'expo-server-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'fixza-super-secret-key-change-this-later';

// Initialize Expo for push notifications
let expo = new Expo();

// CORS configuration - Allow all origins for admin dashboard
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Serve static files for admin dashboard and landing page
const publicDir = join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}
app.use(express.static(publicDir));

// ========== DATABASE SETUP ==========
const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Create tables if they don't exist (add pushToken column)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    fullName TEXT NOT NULL,
    phone TEXT,
    role TEXT CHECK(role IN ('customer', 'fixer')) NOT NULL,
    avatar TEXT,
    pushToken TEXT,
    latitude REAL,
    longitude REAL,
    address TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
    photo_url TEXT,
    photos TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME,
    FOREIGN KEY (customerId) REFERENCES users(id),
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
`);

// Add pushToken column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN pushToken TEXT`);
  console.log('✅ Added pushToken column to users table');
} catch (e) {
  // Column already exists, ignore
}

console.log('✅ Database initialized at:', dbPath);

// ========== HELPER FUNCTIONS ==========
// Calculate distance between two points (in km)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Create notification helper with push notifications
function createNotification(userId, title, body, data = null) {
  try {
    // Save to database
    db.prepare(`
      INSERT INTO notifications (userId, title, body, data)
      VALUES (?, ?, ?, ?)
    `).run(userId, title, body, data ? JSON.stringify(data) : null);
    
    // Send push notification
    const user = db.prepare('SELECT pushToken FROM users WHERE id = ?').get(userId);
    if (user && user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
      const messages = [{
        to: user.pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
      }];
      
      expo.sendPushNotificationsAsync(messages).catch(err => {
        console.error('Push notification error:', err);
      });
    }
  } catch (error) {
    console.error('Create notification error:', error);
  }
}

// ========== AUTH MIDDLEWARE ==========
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, fullName, role, phone, avatar, pushToken, latitude, longitude, address, createdAt FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ========== PUBLIC ROUTES ==========
app.get('/', (req, res) => {
  res.json({ 
    message: 'FixZA API is running!', 
    version: '2.2.0',
    endpoints: {
      health: 'GET /health',
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      jobs: 'GET /jobs',
      createJob: 'POST /jobs (auth required)',
      reviews: 'GET /reviews/:fixerId',
      nearby: 'GET /fixers/nearby?lat=&lng=&radius=',
      admin: 'GET /admin.html'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected'
  });
});

// ========== AUTH ROUTES ==========
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, role, avatar } = req.body;
    
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'fullName', 'role']
      });
    }
    
    if (!['customer', 'fixer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "customer" or "fixer"' });
    }
    
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = db.prepare(
      'INSERT INTO users (email, password, fullName, phone, role, avatar) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(email, hashedPassword, fullName, phone || null, role, avatar || null);
    
    const userId = result.lastInsertRowid;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: { id: userId, email, fullName, phone, role, avatar, createdAt: new Date().toISOString() }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/auth/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Save push token for user
app.post('/users/:userId/push-token', authenticate, (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ error: 'Push token required' });
    }
    db.prepare('UPDATE users SET pushToken = ? WHERE id = ?').run(pushToken, req.params.userId);
    res.json({ success: true, message: 'Push token saved' });
  } catch (error) {
    console.error('Save push token error:', error);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// Update user location
app.patch('/auth/location', authenticate, (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    db.prepare('UPDATE users SET latitude = ?, longitude = ?, address = ? WHERE id = ?')
      .run(latitude || null, longitude || null, address || null, req.user.id);
    
    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// ========== JOB ROUTES ==========
app.get('/jobs', (req, res) => {
  try {
    const { status, category, lat, lng, radius } = req.query;
    
    let query = `
      SELECT j.*, 
             u.fullName as customerName, 
             u.phone as customerPhone,
             f.fullName as fixerName,
             (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
      FROM jobs j
      LEFT JOIN users u ON j.customerId = u.id
      LEFT JOIN users f ON j.fixerId = f.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND j.status = ?';
      params.push(status);
    }
    
    if (category) {
      query += ' AND j.category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY j.createdAt DESC';
    
    let jobs = db.prepare(query).all(...params);
    
    if (lat && lng && radius) {
      jobs = jobs.filter(job => {
        const jobLocation = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(job.customerId);
        if (!jobLocation?.latitude || !jobLocation?.longitude) return false;
        return getDistance(parseFloat(lat), parseFloat(lng), 
                          jobLocation.latitude, jobLocation.longitude) <= parseFloat(radius);
      });
    }
    
    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
    
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
             u.fullName as customerName, 
             u.phone as customerPhone,
             u.avatar as customerAvatar,
             f.fullName as fixerName,
             f.avatar as fixerAvatar,
             (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
      FROM jobs j
      LEFT JOIN users u ON j.customerId = u.id
      LEFT JOIN users f ON j.fixerId = f.id
      WHERE j.id = ?
    `).get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const messages = db.prepare(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.jobId = ?
      ORDER BY m.createdAt ASC
    `).all(jobId);
    
    const reviews = db.prepare(`
      SELECT r.*, u.fullName as reviewerName, u.avatar as reviewerAvatar
      FROM reviews r
      JOIN users u ON r.reviewerId = u.id
      WHERE r.revieweeId = ?
      ORDER BY r.createdAt DESC
      LIMIT 5
    `).all(job.fixerId);
    
    res.json({ success: true, job: { ...job, messages, reviews } });
    
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

app.post('/jobs', authenticate, (req, res) => {
  try {
    const { title, description, category, location, budget, photo_url, photos } = req.body;
    
    if (!title || !description || !category || !location) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'description', 'category', 'location']
      });
    }
    
    const result = db.prepare(`
      INSERT INTO jobs (title, description, category, location, budget, customerId, status, photo_url, photos)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(title, description, category, location, budget ? parseInt(budget) : null, 
           req.user.id, photo_url || null, photos ? JSON.stringify(photos) : null);
    
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
    
    const fixers = db.prepare('SELECT id FROM users WHERE role = ?').all('fixer');
    for (const fixer of fixers) {
      createNotification(fixer.id, 'New Job Available', `${req.user.fullName} posted: ${title}`, { jobId: job.id });
    }
    
    res.status(201).json({
      success: true,
      message: 'Job posted successfully',
      job
    });
    
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

app.patch('/jobs/:id/accept', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'fixer') {
      return res.status(403).json({ error: 'Only fixers can accept jobs' });
    }
    
    const jobId = parseInt(req.params.id);
    const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND status = ?').get(jobId, 'open');
    
    if (!job) {
      return res.status(404).json({ error: 'Job not available' });
    }
    
    db.prepare('UPDATE jobs SET fixerId = ?, status = ? WHERE id = ?').run(req.user.id, 'assigned', jobId);
    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    
    createNotification(job.customerId, 'Job Accepted', `${req.user.fullName} accepted your job: ${job.title}`, { jobId });
    
    res.json({
      success: true,
      message: 'Job accepted successfully',
      job: updatedJob
    });
    
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({ error: 'Failed to accept job' });
  }
});

app.patch('/jobs/:id/status', authenticate, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['in_progress', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        valid: validStatuses
      });
    }
    
    const jobId = parseInt(req.params.id);
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.customerId !== req.user.id && job.fixerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    db.prepare('UPDATE jobs SET status = ?, completedAt = ? WHERE id = ?').run(status, completedAt, jobId);
    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    
    const notifyUserId = req.user.id === job.customerId ? job.fixerId : job.customerId;
    if (notifyUserId) {
      createNotification(notifyUserId, 'Job Status Update', `Job "${job.title}" is now ${status}`, { jobId });
    }
    
    res.json({
      success: true,
      message: `Job marked as ${status}`,
      job: updatedJob
    });
    
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

app.get('/my-jobs', authenticate, (req, res) => {
  try {
    let query;
    let params = [req.user.id];
    
    if (req.user.role === 'customer') {
      query = `
        SELECT j.*, u.fullName as fixerName,
               (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
        FROM jobs j
        LEFT JOIN users u ON j.fixerId = u.id
        WHERE j.customerId = ?
        ORDER BY j.createdAt DESC
      `;
    } else {
      query = `
        SELECT j.*, u.fullName as customerName, u.phone as customerPhone,
               (SELECT AVG(rating) FROM reviews WHERE revieweeId = j.fixerId) as fixerRating
        FROM jobs j
        LEFT JOIN users u ON j.customerId = u.id
        WHERE j.fixerId = ? OR j.status = ?
        ORDER BY 
          CASE WHEN j.fixerId = ? THEN 1 ELSE 2 END,
          j.createdAt DESC
      `;
      params = [req.user.id, 'open', req.user.id];
    }
    
    const jobs = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
    
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ========== MESSAGE ROUTES ==========
app.post('/messages', authenticate, (req, res) => {
  try {
    const { jobId, receiverId, content } = req.body;
    
    if (!jobId || !receiverId || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['jobId', 'receiverId', 'content']
      });
    }
    
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.customerId !== req.user.id && job.fixerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized for this job' });
    }
    
    const result = db.prepare(`
      INSERT INTO messages (jobId, senderId, receiverId, content)
      VALUES (?, ?, ?, ?)
    `).run(jobId, req.user.id, receiverId, content);
    
    const message = db.prepare(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
    
    createNotification(receiverId, 'New Message', `${req.user.fullName}: ${content.substring(0, 50)}...`, { jobId, messageId: message.id });
    
    res.status(201).json({
      success: true,
      message: 'Message sent',
      data: message
    });
    
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
    
    db.prepare(`
      UPDATE messages SET isRead = 1 
      WHERE jobId = ? AND receiverId = ? AND isRead = 0
    `).run(jobId, req.user.id);
    
    const messages = db.prepare(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar
      FROM messages m
      JOIN users u ON m.senderId = u.id
      WHERE m.jobId = ?
      ORDER BY m.createdAt ASC
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
      SELECT COUNT(*) as unreadCount
      FROM messages m
      JOIN jobs j ON m.jobId = j.id
      WHERE (j.customerId = ? OR j.fixerId = ?)
        AND m.receiverId = ?
        AND m.isRead = 0
    `).get(req.user.id, req.user.id, req.user.id);
    
    res.json({ success: true, unreadCount: count.unreadCount });
    
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ========== REVIEW ROUTES ==========
app.post('/reviews', authenticate, (req, res) => {
  try {
    const { jobId, rating, comment } = req.body;
    
    if (!jobId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) required' });
    }
    
    const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND status = ?').get(jobId, 'completed');
    if (!job) {
      return res.status(400).json({ error: 'Job must be completed to review' });
    }
    
    if (job.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Only customers can review fixers' });
    }
    
    const existing = db.prepare('SELECT id FROM reviews WHERE jobId = ?').get(jobId);
    if (existing) {
      return res.status(400).json({ error: 'Already reviewed this job' });
    }
    
    db.prepare(
      'INSERT INTO reviews (jobId, reviewerId, revieweeId, rating, comment) VALUES (?, ?, ?, ?, ?)'
    ).run(jobId, req.user.id, job.fixerId, rating, comment || null);
    
    const avgRating = db.prepare(`
      SELECT AVG(rating) as avg, COUNT(*) as count
      FROM reviews
      WHERE revieweeId = ?
    `).get(job.fixerId);
    
    createNotification(job.fixerId, 'New Review', `${req.user.fullName} rated you ${rating} stars: ${comment || 'No comment'}`, { jobId, rating });
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      averageRating: avgRating.avg || 0,
      totalReviews: avgRating.count || 0
    });
    
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

app.get('/reviews/:fixerId', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.fullName as reviewerName, u.avatar as reviewerAvatar
      FROM reviews r
      JOIN users u ON r.reviewerId = u.id
      WHERE r.revieweeId = ?
      ORDER BY r.createdAt DESC
    `).all(req.params.fixerId);
    
    const avg = db.prepare(`
      SELECT AVG(rating) as average, COUNT(*) as total
      FROM reviews
      WHERE revieweeId = ?
    `).get(req.params.fixerId);
    
    res.json({
      success: true,
      reviews,
      averageRating: avg.average || 0,
      totalReviews: avg.total || 0
    });
    
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ========== FIXER ROUTES ==========
app.get('/fixers', (req, res) => {
  try {
    const fixers = db.prepare(`
      SELECT u.id, u.email, u.fullName, u.phone, u.avatar, u.latitude, u.longitude, u.address,
             COALESCE(AVG(r.rating), 0) as rating,
             COUNT(r.id) as totalReviews
      FROM users u
      LEFT JOIN reviews r ON u.id = r.revieweeId
      WHERE u.role = 'fixer'
      GROUP BY u.id
      ORDER BY rating DESC
    `).all();
    
    res.json({
      success: true,
      count: fixers.length,
      fixers
    });
    
  } catch (error) {
    console.error('Get fixers error:', error);
    res.status(500).json({ error: 'Failed to fetch fixers' });
  }
});

app.get('/fixers/nearby', (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    
    const fixers = db.prepare(`
      SELECT u.id, u.fullName, u.email, u.phone, u.avatar, u.latitude, u.longitude, u.address,
             COALESCE((SELECT AVG(rating) FROM reviews WHERE revieweeId = u.id), 0) as rating,
             (SELECT COUNT(*) FROM reviews WHERE revieweeId = u.id) as totalReviews
      FROM users u
      WHERE u.role = 'fixer' AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    `).all();
    
    const nearby = fixers.filter(fixer => {
      const distance = getDistance(parseFloat(lat), parseFloat(lng), 
                                   fixer.latitude, fixer.longitude);
      return distance <= parseFloat(radius);
    }).map(fixer => ({
      ...fixer,
      distance: getDistance(parseFloat(lat), parseFloat(lng), 
                           fixer.latitude, fixer.longitude).toFixed(1)
    }));
    
    res.json({
      success: true,
      count: nearby.length,
      fixers: nearby.sort((a, b) => a.distance - b.distance)
    });
    
  } catch (error) {
    console.error('Nearby fixers error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby fixers' });
  }
});

app.get('/fixers/:fixerId/rating', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        COALESCE(AVG(rating), 0) as averageRating,
        COUNT(*) as totalReviews
      FROM reviews
      WHERE revieweeId = ?
    `).get(req.params.fixerId);
    
    res.json({
      success: true,
      ...stats
    });
    
  } catch (error) {
    console.error('Get rating error:', error);
    res.status(500).json({ error: 'Failed to fetch rating' });
  }
});

// ========== NOTIFICATION ROUTES ==========
app.get('/notifications', authenticate, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT 50
    `).all(req.user.id);
    
    res.json({ success: true, notifications });
    
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.patch('/notifications/:id/read', authenticate, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?')
      .run(req.params.id, req.user.id);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.get('/notifications/unread/count', authenticate, (req, res) => {
  try {
    const count = db.prepare(`
      SELECT COUNT(*) as unreadCount
      FROM notifications
      WHERE userId = ? AND isRead = 0
    `).get(req.user.id);
    
    res.json({ success: true, unreadCount: count.unreadCount });
    
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ========== ADMIN ROUTES ==========
app.get('/debug/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, fullName, role, avatar, pushToken, latitude, longitude, address, createdAt FROM users ORDER BY createdAt DESC').all();
    res.json({ users });
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/admin/jobs/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM messages WHERE jobId = ?').run(req.params.id);
    db.prepare('DELETE FROM reviews WHERE jobId = ?').run(req.params.id);
    db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

app.delete('/admin/users/:id', (req, res) => {
  try {
    const userJobs = db.prepare('SELECT id FROM jobs WHERE customerId = ? OR fixerId = ?').all(req.params.id, req.params.id);
    for (const job of userJobs) {
      db.prepare('DELETE FROM messages WHERE jobId = ?').run(job.id);
      db.prepare('DELETE FROM reviews WHERE jobId = ?').run(job.id);
    }
    db.prepare('DELETE FROM reviews WHERE reviewerId = ? OR revieweeId = ?').run(req.params.id, req.params.id);
    db.prepare('DELETE FROM jobs WHERE customerId = ? OR fixerId = ?').run(req.params.id, req.params.id);
    db.prepare('DELETE FROM notifications WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('/admin/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const totalFixers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('fixer');
    const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('customer');
    const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get();
    const openJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = ?').get('open');
    const completedJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = ?').get('completed');
    const totalReviews = db.prepare('SELECT COUNT(*) as count FROM reviews').get();
    const avgRating = db.prepare('SELECT AVG(rating) as avg FROM reviews').get();
    
    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers.count,
        totalFixers: totalFixers.count,
        totalCustomers: totalCustomers.count,
        totalJobs: totalJobs.count,
        openJobs: openJobs.count,
        completedJobs: completedJobs.count,
        totalReviews: totalReviews.count,
        averageRating: avgRating.avg || 0
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚀 FixZA MVP API is running!');
  console.log('=================================');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`💾 Database: ${dbPath}`);
  console.log('=================================');
  console.log('\n✨ Features:');
  console.log('   ⭐ Ratings & Reviews');
  console.log('   💬 Enhanced Messaging');
  console.log('   📸 Job Photos Support');
  console.log('   📍 Location Services');
  console.log('   🔔 Push Notifications');
  console.log('=================================\n');
});