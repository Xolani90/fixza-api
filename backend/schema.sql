-- Users table
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

-- Fixer profiles table
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
  rating REAL DEFAULT 0,
  totalReviews INTEGER DEFAULT 0,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
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

-- Add other tables as needed...
