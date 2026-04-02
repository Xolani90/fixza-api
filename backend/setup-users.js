import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const db = new Database('fixza.db');

console.log('\n🔧 Setting up test users...\n');

// Create admin user
const adminEmail = 'admin@fixza.com';
const adminPassword = 'admin123';
const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!adminExists) {
  db.prepare(`
    INSERT INTO users (email, password, fullName, phone, role, isPhoneVerified)
    VALUES (?, ?, ?, ?, 'admin', 1)
  `).run(adminEmail, hashedAdminPassword, 'Admin User', '0712345678');
  console.log('✅ Admin user created!');
  console.log('   Email: admin@fixza.com');
  console.log('   Password: admin123');
} else {
  console.log('✅ Admin user already exists');
}

// Create fixer user
const fixerEmail = 'fixer@fixza.com';
const fixerPassword = 'fixer123';
const hashedFixerPassword = await bcrypt.hash(fixerPassword, 10);

const fixerExists = db.prepare('SELECT id FROM users WHERE email = ?').get(fixerEmail);
if (!fixerExists) {
  const result = db.prepare(`
    INSERT INTO users (email, password, fullName, phone, role, isPhoneVerified, isApproved)
    VALUES (?, ?, ?, ?, 'fixer', 1, 1)
  `).run(fixerEmail, hashedFixerPassword, 'Fixer User', '0712345679');
  
  db.prepare(`
    INSERT INTO fixer_profiles (userId, skills, hourlyRate, bio)
    VALUES (?, ?, ?, ?)
  `).run(result.lastInsertRowid, 'Plumbing, Electrical, Painting', 350, 'Experienced handyman with 5+ years experience');
  
  console.log('✅ Fixer user created!');
  console.log('   Email: fixer@fixza.com');
  console.log('   Password: fixer123');
} else {
  console.log('✅ Fixer user already exists');
}

// Create customer user
const customerEmail = 'customer@fixza.com';
const customerPassword = 'customer123';
const hashedCustomerPassword = await bcrypt.hash(customerPassword, 10);

const customerExists = db.prepare('SELECT id FROM users WHERE email = ?').get(customerEmail);
if (!customerExists) {
  db.prepare(`
    INSERT INTO users (email, password, fullName, phone, role, isPhoneVerified)
    VALUES (?, ?, ?, ?, 'customer', 1)
  `).run(customerEmail, hashedCustomerPassword, 'Customer User', '0712345680');
  console.log('✅ Customer user created!');
  console.log('   Email: customer@fixza.com');
  console.log('   Password: customer123');
} else {
  console.log('✅ Customer user already exists');
}

// Verify all users
const users = db.prepare('SELECT id, email, fullName, role FROM users').all();
console.log('\n📋 All users in database:');
console.table(users);

db.close();
console.log('\n✅ Setup complete! You can now log into the app.\n');
