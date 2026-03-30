import Database from 'better-sqlite3';
const db = new Database('fixza.db');

try {
  // Check all fixers
  const fixers = db.prepare(`SELECT id, fullName, latitude, longitude FROM users WHERE role = 'fixer'`).all();
  console.log('All fixers:');
  console.log(JSON.stringify(fixers, null, 2));
  
  // Check fixers with location
  const fixersWithLocation = db.prepare(`SELECT id, fullName, latitude, longitude FROM users WHERE role = 'fixer' AND latitude IS NOT NULL`).all();
  console.log('\nFixers with location:');
  console.log(JSON.stringify(fixersWithLocation, null, 2));
  
} catch (error) {
  console.error('Error:', error.message);
}