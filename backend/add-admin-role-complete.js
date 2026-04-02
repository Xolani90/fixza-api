import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);

console.log('\n🔧 Updating users table to allow admin role...');

try {
  // Turn off foreign key constraints temporarily
  db.exec('PRAGMA foreign_keys = OFF;');
  
  // Start a transaction
  db.exec('BEGIN TRANSACTION;');

  // Create a temporary table with the new schema
  db.exec(`
    CREATE TABLE users_new (
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
  `);

  // Copy data from old table to new table
  db.exec(`
    INSERT INTO users_new (id, email, password, fullName, phone, role, avatar, pushToken, latitude, longitude, address, isPhoneVerified, isBanned, isApproved, createdAt)
    SELECT id, email, password, fullName, phone, role, avatar, pushToken, latitude, longitude, address, isPhoneVerified, isBanned, isApproved, createdAt
    FROM users;
  `);

  // Drop the old table
  db.exec('DROP TABLE users;');

  // Rename the new table to users
  db.exec('ALTER TABLE users_new RENAME TO users;');

  // Recreate indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);

  // Commit the transaction
  db.exec('COMMIT;');
  
  // Turn foreign keys back on
  db.exec('PRAGMA foreign_keys = ON;');
  
  console.log('✅ Users table updated to allow admin role');

  // Show current users
  console.log('\n📋 Current users:');
  const users = db.prepare('SELECT id, email, fullName, role FROM users').all();
  console.table(users);

  if (users.length === 0) {
    console.log('\n⚠️ No users found.');
    db.close();
    process.exit(0);
  }

  // Make the first user an admin
  const firstUser = users[0];
  console.log(`\n✅ Making user "${firstUser.email}" an admin...`);
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', firstUser.id);
  console.log(`✅ User ${firstUser.email} is now an admin!`);

  // Verify the update
  const updated = db.prepare('SELECT id, email, fullName, role FROM users WHERE id = ?').get(firstUser.id);
  console.log('\n📋 Updated user:');
  console.table([updated]);

} catch (error) {
  console.error('Error:', error.message);
  db.exec('ROLLBACK;');
  db.exec('PRAGMA foreign_keys = ON;');
} finally {
  db.close();
}

console.log('\n🎉 Admin setup complete! You can now access the Admin Panel from the Profile screen.');
