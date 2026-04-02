const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the button and add debug logging
const oldButton = /{user\.role === 'fixer' && job\.status === 'assigned' && job\.fixerId === user\.id && \(\s*<TouchableOpacity style={styles\.actionBtn} onPress={\(\) => updateStatus\('in_progress'\)}>\s*<Text style={styles\.actionBtnText}>🚀 Start Work<\/Text>\s*<\/TouchableOpacity>\s*\)}/;
const newButton = `{user.role === 'fixer' && job.status === 'assigned' && job.fixerId === user.id && (
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => {
              console.log('🔴 Start Work button pressed');
              console.log('   Job ID:', jobId);
              console.log('   Current status:', job.status);
              console.log('   User ID:', user.id);
              console.log('   Fixer ID:', job.fixerId);
              updateStatus('in_progress');
            }}
          >
            <Text style={styles.actionBtnText}>🚀 Start Work</Text>
          </TouchableOpacity>
        )}`;

if (content.includes('Start Work')) {
  // Replace the button
  const startWorkRegex = /{user\.role === 'fixer' && job\.status === 'assigned' && job\.fixerId === user\.id && \(\s*<TouchableOpacity[^>]*>[\s\S]*?<\/TouchableOpacity>\s*\)}/;
  content = content.replace(startWorkRegex, newButton);
  console.log('✅ Updated Start Work button with debug logging');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('\n✅ Fix applied!');
} else {
  console.log('⚠️ Could not find the Start Work button');
}
