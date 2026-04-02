const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the Mark Complete button with debug logging
const newCompleteButton = `{user.role === 'fixer' && job.status === 'in_progress' && job.fixerId === user.id && (
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => {
              console.log('🔴 Mark Complete button pressed');
              console.log('   Job ID:', jobId);
              console.log('   Current status:', job.status);
              console.log('   User ID:', user.id);
              console.log('   Fixer ID:', job.fixerId);
              updateStatus('completed');
            }}
          >
            <Text style={styles.actionBtnText}>✅ Mark Complete</Text>
          </TouchableOpacity>
        )}`;

// Find the existing complete button and replace it
const completeButtonRegex = /{user\.role === 'fixer' && job\.status === 'in_progress' && job\.fixerId === user\.id && \(\s*<TouchableOpacity[^>]*>[\s\S]*?<\/TouchableOpacity>\s*\)}/;
if (content.match(completeButtonRegex)) {
  content = content.replace(completeButtonRegex, newCompleteButton);
  console.log('✅ Updated Mark Complete button with debug logging');
} else {
  console.log('⚠️ Could not find Mark Complete button, searching...');
  // Alternative search
  if (content.includes('Mark Complete')) {
    console.log('Found "Mark Complete" text, but pattern mismatch');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Fix applied! Refresh your app and try the Mark Complete button.');
