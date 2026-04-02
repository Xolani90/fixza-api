import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);

console.log('🗄️ Creating complete database with all features...');

// Drop existing tables if they exist (for clean start)
db.exec(`
  PRAGMA foreign_keys = OFF;
  DROP TABLE IF EXISTS location_tracking;
  DROP TABLE IF EXISTS payments;
  DROP TABLE IF EXISTS notifications;
  DROP TABLE IF EXISTS penalty_config;
  DROP TABLE IF EXISTS reports;
  DROP TABLE IF EXISTS reviews;
  DROP TABLE IF EXISTS messages;
  DROP TABLE IF EXISTS quotes;
  DROP TABLE IF EXISTS otp_codes;
  DROP TABLE IF EXISTS fixer_profiles;
  DROP TABLE IF EXISTS jobs;
  DROP TABLE IF EXISTS users;
  PRAGMA foreign_keys = ON;
`);

console.log('✅ Cleaned existing tables');

// Create all tables with new schema
db.exec(`
  CREATE TABLE users (
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

  CREATE TABLE fixer_profiles (
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
    rating REAL DEFAULT 0,
    totalReviews INTEGER DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    budget INTEGER,
    customerId INTEGER NOT NULL,
    fixerId INTEGER,
    status TEXT DEFAULT 'requested',
    paymentStatus TEXT DEFAULT 'pending',
    photo_url TEXT,
    photos TEXT,
    statusHistory TEXT DEFAULT '[]',
    lockVersion INTEGER DEFAULT 0,
    paymentIntentId TEXT,
    paymentAmount INTEGER,
    platformFee INTEGER,
    providerAmount INTEGER,
    cancellationReason TEXT,
    cancelledBy INTEGER,
    cancelledAt DATETIME,
    penaltyAmount INTEGER DEFAULT 0,
    rating INTEGER,
    review TEXT,
    reviewedAt DATETIME,
    isReported INTEGER DEFAULT 0,
    reportReason TEXT,
    reportedAt DATETIME,
    reportedBy INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME,
    FOREIGN KEY (customerId) REFERENCES users(id),
    FOREIGN KEY (fixerId) REFERENCES users(id)
  );

  CREATE TABLE quotes (
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

  CREATE TABLE messages (
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

  CREATE TABLE reviews (
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

  CREATE TABLE reports (
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

  CREATE TABLE otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    code TEXT NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE payments (
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

  CREATE TABLE location_tracking (
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

  CREATE TABLE notifications (
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

  CREATE TABLE penalty_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT UNIQUE NOT NULL,
    penalty_percent INTEGER NOT NULL,
    description TEXT
  );

  CREATE INDEX idx_jobs_status ON jobs(status);
  CREATE INDEX idx_jobs_customer ON jobs(customerId);
  CREATE INDEX idx_jobs_fixer ON jobs(fixerId);
  CREATE INDEX idx_messages_job ON messages(jobId);
  CREATE INDEX idx_reviews_reviewee ON reviews(revieweeId);
  CREATE INDEX idx_notifications_user ON notifications(userId);
  CREATE INDEX idx_quotes_job ON quotes(jobId);
  CREATE INDEX idx_payments_job ON payments(jobId);
  CREATE INDEX idx_payments_intent ON payments(paymentIntentId);
  CREATE INDEX idx_location_job ON location_tracking(jobId);
`);

// Insert penalty configuration
db.exec(`
  INSERT OR IGNORE INTO penalty_config (status, penalty_percent, description) VALUES
    ('requested', 0, 'No penalty for cancellation before acceptance'),
    ('accepted', 10, '10% penalty for cancellation after acceptance'),
    ('on_the_way', 25, '25% penalty if provider is on the way'),
    ('arrived', 50, '50% penalty if provider has arrived');
`);

console.log('\n✅ Complete database created with all features!');
console.log('   - Users with role support (customer/fixer/admin)');
console.log('   - Jobs with status tracking and optimistic locking');
console.log('   - Payments with Paystack integration');
console.log('   - Location tracking for providers');
console.log('   - Notifications system');
console.log('   - Penalty configuration');
console.log('   - Reviews and ratings');
console.log('   - Reports system');

// Verify tables were created
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\n📋 Created tables:');
tables.forEach(t => console.log(`   - ${t.name}`));

db.close();
