import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);

console.log('\n📋 Current users:');
const users = db.prepare('SELECT id, email, fullName, role FROM users').all();
console.table(users);

if (users.length === 0) {
  console.log('\n⚠️ No users found. Please register a user first through the app.');
  console.log('After registering, run this script again.');
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

db.close();
console.log('\n🎉 Admin setup complete! You can now access the Admin Panel from the Profile screen.');
