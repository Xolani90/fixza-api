import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);

console.log('🔧 Adding advanced features to database...');

// Start transaction
db.exec('BEGIN TRANSACTION;');

try {
  // Add job status tracking fields
  db.exec(`
    ALTER TABLE jobs ADD COLUMN statusHistory TEXT DEFAULT '[]';
    ALTER TABLE jobs ADD COLUMN lockVersion INTEGER DEFAULT 0;
    ALTER TABLE jobs ADD COLUMN paymentIntentId TEXT;
    ALTER TABLE jobs ADD COLUMN paymentAmount INTEGER;
    ALTER TABLE jobs ADD COLUMN platformFee INTEGER;
    ALTER TABLE jobs ADD COLUMN providerAmount INTEGER;
    ALTER TABLE jobs ADD COLUMN cancellationReason TEXT;
    ALTER TABLE jobs ADD COLUMN cancelledBy INTEGER;
    ALTER TABLE jobs ADD COLUMN cancelledAt DATETIME;
    ALTER TABLE jobs ADD COLUMN penaltyAmount INTEGER DEFAULT 0;
  `);
} catch (e) {
  console.log('Some columns already exist:', e.message);
}

// Create payments table
db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    paymentIntentId TEXT UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    platformFee INTEGER NOT NULL,
    providerAmount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    customerId INTEGER NOT NULL,
    providerId INTEGER,
    paymentMethod TEXT,
    paidAt DATETIME,
    refundedAt DATETIME,
    refundAmount INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id),
    FOREIGN KEY (customerId) REFERENCES users(id),
    FOREIGN KEY (providerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS location_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobId INTEGER NOT NULL,
    providerId INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT NOT NULL,
    recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jobId) REFERENCES jobs(id),
    FOREIGN KEY (providerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    isRead BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_payments_job ON payments(jobId);
  CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(paymentIntentId);
  CREATE INDEX IF NOT EXISTS idx_location_job ON location_tracking(jobId);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(isRead);
`);

// Add status enum values (SQLite doesn't support enum, so we just document)
console.log('✅ Added status values: requested, accepted, on_the_way, arrived, in_progress, completed, cancelled');

// Add penalty configuration table
db.exec(`
  CREATE TABLE IF NOT EXISTS penalty_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT UNIQUE NOT NULL,
    penalty_percent INTEGER NOT NULL,
    description TEXT
  );

  INSERT OR IGNORE INTO penalty_config (status, penalty_percent, description) VALUES
    ('requested', 0, 'No penalty for cancellation before acceptance'),
    ('accepted', 10, '10% penalty for cancellation after acceptance'),
    ('on_the_way', 25, '25% penalty if provider is on the way'),
    ('arrived', 50, '50% penalty if provider has arrived');
`);

db.exec('COMMIT;');
console.log('✅ Database migration completed!');
db.close();
