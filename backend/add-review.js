import Database from 'better-sqlite3';
const db = new Database('fixza.db');

// Check if a review already exists
const existingReview = db.prepare('SELECT * FROM reviews WHERE jobId = ?').get(2);

if (!existingReview) {
  // Add a 5-star review for the fixer (fixer ID: 2, customer ID: 3)
  db.prepare('INSERT INTO reviews (jobId, reviewerId, revieweeId, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(2, 3, 2, 5, 'Excellent work! Very professional and timely.');
  console.log('✅ 5-star review added for job 2');

  // Update fixer's average rating
  const avgRating = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews WHERE revieweeId = ?').get(2);
  db.prepare('UPDATE fixer_profiles SET rating = ?, totalReviews = ? WHERE userId = ?')
    .run(avgRating.avg || 0, avgRating.count || 0, 2);
  console.log('✅ Fixer rating updated to:', avgRating.avg);
  console.log('✅ Total reviews:', avgRating.count);
} else {
  console.log('Review already exists for this job');
  console.log('Review:', existingReview);
}

db.close();
