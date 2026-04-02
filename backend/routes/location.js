import express from 'express';
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'fixza.db');
const db = new Database(dbPath);

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fixza-super-secret-key-change-this-later';

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

// Update location
router.post('/update/:jobId', authenticate, (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND fixerId = ?').get(jobId, req.user.id);
    if (!job) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare(`
      INSERT INTO location_tracking (jobId, providerId, lat, lng, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, req.user.id, lat, lng, job.status);

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Track location
router.get('/track/:jobId', authenticate, (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const job = db.prepare('SELECT customerId, fixerId FROM jobs WHERE id = ?').get(jobId);
    
    if (!job || (job.customerId !== req.user.id && job.fixerId !== req.user.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const latest = db.prepare(`
      SELECT lat, lng, status, recordedAt
      FROM location_tracking
      WHERE jobId = ?
      ORDER BY recordedAt DESC
      LIMIT 1
    `).get(jobId);

    const history = db.prepare(`
      SELECT lat, lng, status, recordedAt
      FROM location_tracking
      WHERE jobId = ?
      ORDER BY recordedAt DESC
      LIMIT 50
    `).all(jobId);

    res.json({ success: true, current: latest, history });
  } catch (error) {
    console.error('Track location error:', error);
    res.status(500).json({ error: 'Failed to track location' });
  }
});

export default router;
