import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔐 Admin Password Reset\n');

// Show admin users
const adminUsers = db.prepare('SELECT id, email, fullName, role FROM users WHERE role = ?').all('admin');

if (adminUsers.length === 0) {
  console.log('❌ No admin users found. Please create one first.');
  db.close();
  rl.close();
  process.exit(0);
}

console.log('📋 Admin users:');
adminUsers.forEach((user, index) => {
  console.log(`   ${index + 1}. ${user.email} (${user.fullName})`);
});

if (adminUsers.length === 1) {
  const admin = adminUsers[0];
  console.log(`\n✅ Found admin: ${admin.email}`);
  
  rl.question('Enter new password: ', async (password) => {
    if (!password || password.length < 4) {
      console.log('❌ Password must be at least 4 characters');
      db.close();
      rl.close();
      process.exit(0);
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, admin.id);
    
    console.log(`\n✅ Password reset for ${admin.email}`);
    console.log(`   New password: ${password}`);
    console.log('\n📱 You can now log in with:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${password}`);
    
    db.close();
    rl.close();
  });
} else {
  rl.question('Enter the number of the admin user to reset password: ', (choice) => {
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < adminUsers.length) {
      const admin = adminUsers[index];
      rl.question('Enter new password: ', async (password) => {
        if (!password || password.length < 4) {
          console.log('❌ Password must be at least 4 characters');
          db.close();
          rl.close();
          process.exit(0);
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, admin.id);
        
        console.log(`\n✅ Password reset for ${admin.email}`);
        console.log(`   New password: ${password}`);
        console.log('\n📱 You can now log in with:');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Password: ${password}`);
        
        db.close();
        rl.close();
      });
    } else {
      console.log('❌ Invalid choice');
      db.close();
      rl.close();
    }
  });
}
