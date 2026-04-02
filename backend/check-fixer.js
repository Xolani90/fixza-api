import Database from 'better-sqlite3';
const db = new Database('fixza.db');

// Get fixer profile with rating
const fixer = db.prepare(`
  SELECT u.fullName, u.email, fp.rating, fp.totalReviews, fp.completedJobs
  FROM users u 
  JOIN fixer_profiles fp ON u.id = fp.userId 
  WHERE u.id = 2
`).get();

console.log('\n📊 Fixer Profile:');
console.log(`   Name: ${fixer.fullName}`);
console.log(`   Email: ${fixer.email}`);
console.log(`   Rating: ${fixer.rating} ⭐`);
console.log(`   Total Reviews: ${fixer.totalReviews}`);
console.log(`   Completed Jobs: ${fixer.completedJobs}`);

// Get the job status
const job = db.prepare('SELECT id, title, status, paymentStatus FROM jobs WHERE id = 2').get();
console.log(`\n📋 Job #${job.id}: ${job.title}`);
console.log(`   Status: ${job.status}`);
console.log(`   Payment Status: ${job.paymentStatus}`);

// Get the review
const review = db.prepare('SELECT rating, comment FROM reviews WHERE jobId = 2').get();
if (review) {
  console.log(`\n📝 Review:`);
  console.log(`   Rating: ${review.rating} ⭐`);
  console.log(`   Comment: ${review.comment}`);
}

db.close();
