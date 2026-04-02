import Database from 'better-sqlite3';

const db = new Database('fixza.db');

// Find the haircut job
const job = db.prepare("SELECT id, title, status, fixerId, customerId FROM jobs WHERE title LIKE '%haircut%' OR title LIKE '%Haircut%'").get();

if (job) {
  console.log('📋 Job found:');
  console.log(`   ID: ${job.id}`);
  console.log(`   Title: ${job.title}`);
  console.log(`   Status: ${job.status}`);
  console.log(`   Fixer ID: ${job.fixerId || 'Not assigned'}`);
  console.log(`   Customer ID: ${job.customerId}`);
} else {
  console.log('❌ No haircut job found');
  // Show all jobs
  const allJobs = db.prepare("SELECT id, title, status FROM jobs").all();
  console.log('\n📋 All jobs:');
  console.table(allJobs);
}

db.close();
