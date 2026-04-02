import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const db = new Database('fixza.db');
const JWT_SECRET = 'fixza-super-secret-key-change-this-later';

// Get the fixer user (ID: 2)
const fixer = db.prepare("SELECT id, email FROM users WHERE id = 2").get();
if (!fixer) {
  console.log('❌ Fixer not found');
  process.exit(0);
}

console.log(`🔧 Fixer: ${fixer.email} (ID: ${fixer.id})`);

// Get job ID 1
const job = db.prepare("SELECT id, status FROM jobs WHERE id = 1").get();
console.log(`📋 Job ID: ${job.id}, Current Status: ${job.status}`);

// Create token for fixer
const token = jwt.sign({ userId: fixer.id }, JWT_SECRET);

console.log(`\n📤 Sending request to update job ${job.id} to 'in_progress'...`);

try {
  const response = await fetch(`http://localhost:4000/jobs/${job.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'in_progress' })
  });

  const data = await response.json();
  console.log(`Response Status: ${response.status}`);
  console.log(`Response Data:`, data);

  if (response.ok) {
    console.log('\n✅ Status updated successfully!');
    // Verify the update
    const updated = db.prepare("SELECT id, status FROM jobs WHERE id = ?").get(job.id);
    console.log(`Job ${updated.id} status is now: ${updated.status}`);
  } else {
    console.log('\n❌ Failed to update status');
    console.log('Error details:', data);
  }
} catch (error) {
  console.error('Error:', error.message);
}

db.close();
