import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);
const JWT_SECRET = 'fixza-super-secret-key-change-this-later';

// Get admin user
const user = db.prepare('SELECT id, email FROM users WHERE id = 1').get();
if (!user) {
  console.log('❌ No user found');
  process.exit(0);
}

// Create token
const token = jwt.sign({ userId: user.id }, JWT_SECRET);

// Get a job
const job = db.prepare('SELECT id FROM jobs LIMIT 1').get();
if (!job) {
  console.log('❌ No jobs found');
  process.exit(0);
}

console.log(`Testing report for job ${job.id} by user ${user.email}`);

try {
  const response = await fetch(`http://localhost:4000/jobs/${job.id}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ reason: 'Test report' })
  });
  
  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', data);
  
  if (response.ok) {
    console.log('\n✅ Report endpoint is working!');
  }
} catch (error) {
  console.error('Error:', error.message);
}

db.close();
