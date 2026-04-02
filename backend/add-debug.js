import fs from 'fs';
let content = fs.readFileSync('routes/payments.js', 'utf8');

// Add debug middleware right after router creation
const debugMiddleware = `
// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log('🔍 [Payments Router] Request:', req.method, req.url);
  next();
});
`;

// Insert after router initialization
content = content.replace('const router = express.Router();', `const router = express.Router();\n${debugMiddleware}`);

fs.writeFileSync('routes/payments.js', content, 'utf8');
console.log('✅ Added debug middleware to payments router');
