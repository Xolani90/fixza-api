const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'fixza.db');
const db = new Database(dbPath);

console.log('Adding new columns for OTP verification and admin features...');

// Add isPhoneVerified column to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN isPhoneVerified INTEGER DEFAULT 0`);
  console.log('✅ Added isPhoneVerified column');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('isPhoneVerified column already exists');
  } else {
    console.log('Error adding isPhoneVerified:', e.message);
  }
}

// Add isBanned column to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN isBanned INTEGER DEFAULT 0`);
  console.log('✅ Added isBanned column');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('isBanned column already exists');
  } else {
    console.log('Error adding isBanned:', e.message);
  }
}

// Add banReason column to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN banReason TEXT`);
  console.log('✅ Added banReason column');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('banReason column already exists');
  } else {
    console.log('Error adding banReason:', e.message);
  }
}

// Add bannedAt column to users
try {
  db.exec(`ALTER TABLE users ADD COLUMN bannedAt DATETIME`);
  console.log('✅ Added bannedAt column');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('bannedAt column already exists');
  } else {
    console.log('Error adding bannedAt:', e.message);
  }
}

// Add rating column to jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN rating INTEGER`);
  console.log('✅ Added rating column to jobs');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('rating column already exists');
  } else {
    console.log('Error adding rating:', e.message);
  }
}

// Add review column to jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN review TEXT`);
  console.log('✅ Added review column to jobs');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('review column already exists');
  } else {
    console.log('Error adding review:', e.message);
  }
}

// Add reviewedAt column to jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN reviewedAt DATETIME`);
  console.log('✅ Added reviewedAt column to jobs');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('reviewedAt column already exists');
  } else {
    console.log('Error adding reviewedAt:', e.message);
  }
}

// Add isReported column to jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN isReported INTEGER DEFAULT 0`);
  console.log('✅ Added isReported column to jobs');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('isReported column already exists');
  } else {
    console.log('Error adding isReported:', e.message);
  }
}

// Add reportReason column to jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN reportReason TEXT`);
  console.log('✅ Added reportReason column to jobs');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('reportReason column already exists');
  } else {
    console.log('Error adding reportReason:', e.message);
  }
}

// Add reportedAt column to jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN reportedAt DATETIME`);
  console.log('✅ Added reportedAt column to jobs');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('reportedAt column already exists');
  } else {
    console.log('Error adding reportedAt:', e.message);
  }
}

// Add reportedBy column to jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN reportedBy INTEGER`);
  console.log('✅ Added reportedBy column to jobs');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('reportedBy column already exists');
  } else {
    console.log('Error adding reportedBy:', e.message);
  }
}

console.log('Migration completed!');
db.close();
