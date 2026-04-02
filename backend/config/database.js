import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

if (process.env.NODE_ENV === 'production') {
  console.log('⚠️ Using in-memory SQLite - data will reset on each deploy');
  db = new Database(':memory:');
  
  // Initialize tables from schema
  import fs from 'fs';
  const schemaPath = join(__dirname, '..', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('✅ Schema loaded into memory');
  }
} else {
  const dbPath = join(__dirname, '..', 'fixza.db');
  db = new Database(dbPath);
  console.log('✅ Connected to SQLite locally');
}

export default db;
