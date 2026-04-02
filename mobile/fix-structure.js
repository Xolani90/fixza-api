const fs = require('fs');
const filePath = 'App.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the JobDetailsScreen function
const startMarker = 'function JobDetailsScreen({ route, navigation }) {';
const startIdx = content.indexOf(startMarker);

if (startIdx === -1) {
  console.log('Could not find JobDetailsScreen');
  process.exit(1);
}

// Find the end of the function (look for the matching closing brace)
let braceCount = 0;
let endIdx = startIdx;
let foundStart = false;

for (let i = startIdx; i < content.length; i++) {
  const char = content[i];
  if (char === '{') {
    braceCount++;
    foundStart = true;
  } else if (char === '}') {
    braceCount--;
    if (foundStart && braceCount === 0) {
      endIdx = i + 1;
      break;
    }
  }
}

console.log(`Found JobDetailsScreen from ${startIdx} to ${endIdx}`);

// Extract the old function
const oldFunction = content.substring(startIdx, endIdx);

// Create a clean version with proper updateStatus function
const cleanFunction = `function JobDetailsScreen({ route, navigation }) {
  const { jobId } = route.params;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMsg, setQuoteMsg] = useState('');
  const [sendingQuote, setSendingQuote] = useState(false);
  const { user, token } = useContext(AuthContext);

  useEffect(() => { loadJob(); }, []);

  const loadJob = async () => {
    try {
      const response = await fetch(\`\${API_URL}/jobs/\${jobId}\`, { headers: { Authorization: \`Bearer \${token}\` } });
      const data = await response.json();
      setJob(data.job);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const shareJob = async () => {
    try {
      await Share.share({ message: \`🔧 FixZA Job: \${job.title}\\n📍 \${job.location}\\n💰 R\${job.budget || 'Negotiable'}\\n\\nDownload FixZA!\` });
    } catch (e) { console.error(e); }
  };

  const acceptJob = async () => {
    try {
      const response = await fetch(\`\${API_URL}/jobs/\${jobId}/accept\`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }
      });
      const data = await response.json();
      if (data.success) { Alert.alert('Success', 'Job accepted!'); loadJob(); }
      else { Alert.alert('Error', data.error || 'Failed to accept job'); }
    } catch { Alert.alert('Error', 'Failed to accept job'); }
  };

  const sendQuote = async () => {
    if (!quoteAmount) { Alert.alert('Error', 'Please enter a quote amount'); return; }
    setSendingQuote(true);
    try {
      const response = await fetch(\`\${API_URL}/jobs/\${jobId}/quote\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ amount: parseInt(quoteAmount), message: quoteMsg }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Quote Sent ✅', 'The customer will be notified');
        setQuoteAmount(''); setQuoteMsg('');
        loadJob();
      } else { Alert.alert('Error', data.error || 'Failed to send quote'); }
    } catch { Alert.alert('Error', 'Connection failed'); }
    finally { setSendingQuote(false); }
  };

  const acceptQuote = async (quoteId) => {
    try {
      const response = await fetch(\`\${API_URL}/quotes/\${quoteId}/accept\`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }
      });
      const data = await response.json();
      if (data.success) { Alert.alert('✅ Fixer Hired!', 'The fixer has been assigned to your job'); loadJob(); }
      else { Alert.alert('Error', data.error || 'Failed to accept quote'); }
    } catch { Alert.alert('Error', 'Connection failed'); }
  };

  const reportJob = () => {
    Alert.alert(
      'Report Job',
      'Why are you reporting this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Scam / Fraud', onPress: () => submitReport('Scam or fraud') },
        { text: 'Inappropriate content', onPress: () => submitReport('Inappropriate content') },
        { text: 'Other', onPress: () => submitReport('Other') },
      ]
    );
  };

  const submitReport = async (reason) => {
    try {
      const response = await fetch(\`\${API_URL}/jobs/\${jobId}/report\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (data.success) Alert.alert('Reported', 'Thank you. We will investigate.');
      else Alert.alert('Error', 'Failed to submit report');
    } catch { Alert.alert('Error', 'Connection failed'); }
  };

  const updateStatus = async (status) => {
    console.log('📤 updateStatus called with:', status);
    console.log('   Job ID:', jobId);
    
    Alert.alert(
      'Confirm Action',
      \`Mark this job as \${status}?\`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              console.log('🔄 Sending request to update status...');
              const response = await fetch(\`\${API_URL}/jobs/\${jobId}/status\`, {
                method: 'PATCH',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': \`Bearer \${token}\` 
                },
                body: JSON.stringify({ status }),
              });
              const data = await response.json();
              console.log('📥 Response:', data);
              if (data.success) {
                if (status === 'completed') {
                  Alert.alert('Job Complete! 🎉', 'Would you like to rate your experience?', [
                    { text: 'Later', style: 'cancel', onPress: () => loadJob() },
                    { text: 'Rate Now', onPress: () => navigation.navigate('RateJob', { jobId }) }
                  ]);
                } else {
                  Alert.alert('Success!', \`Job marked as \${status}\`);
                  loadJob();
                }
              } else {
                Alert.alert('Error', data.error || 'Failed to update status');
              }
            } catch (error) {
              console.error('❌ Error:', error);
              Alert.alert('Error', 'Connection failed: ' + error.message);
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1A8A5A" /></View>;
  if (!job) return <View style={styles.center}><Text>Job not found</Text></View>;

  const quotes = job.quotes || [];
  const myQuote = quotes.find(q => q.fixerId === user.id);
  const canChat = job.fixerId === user.id || job.customerId === user.id;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.detailNavBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.detailBack}>← Back</Text></TouchableOpacity>
        <Text style={styles.detailNavTitle}>Job Details</Text>
        <TouchableOpacity onPress={shareJob}><Text style={styles.detailShare}>Share</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.detailCard}>
          {job?.photo_url && <Image source={{ uri: job.photo_url }} style={styles.jobDetailImage} />}
          <View style={styles.detailBadgeRow}>
            <View style={styles.detailCatBadge}><Text style={styles.detailCatText}>{job.category}</Text></View>
            <View style={[styles.detailStatusBadge, job.status === 'open' ? styles.statusOpen : job.status === 'completed' ? styles.statusDone : styles.statusActive]}>
              <Text style={styles.jobStatusText}>{job.status === 'open' ? 'Available' : job.status}</Text>
            </View>
          </View>
          <Text style={styles.detailTitle}>{job.title}</Text>
          <View style={styles.detailMetaRow}>
            <Text style={styles.detailMetaItem}>📍 {job.location}</Text>
            <Text style={styles.detailPrice}>R{job.budget || 'Negotiable'}</Text>
          </View>
          {job.paymentStatus && (
            <View style={[styles.payStatusBadge, job.paymentStatus === 'paid' ? styles.payPaid : styles.payPending]}>
              <Text style={styles.payStatusText}>{job.paymentStatus === 'paid' ? '✅ Paid' : '⏳ Payment Pending'}</Text>
            </View>
          )}
          <Text style={styles.detailDesc}>{job.description}</Text>
          <View style={styles.detailCustomerRow}>
            <View style={styles.detailAvatarSmall}><Text style={styles.detailAvatarText}>{job.customerName?.charAt(0).toUpperCase() || '?'}</Text></View>
            <Text style={styles.detailCustomerName}>Posted by {job.customerName}</Text>
          </View>
          <TouchableOpacity style={styles.reportBtn} onPress={reportJob}>
            <Text style={styles.reportBtnText}>⚠️ Report Issue</Text>
          </TouchableOpacity>
        </View>

        {user.role === 'fixer' && job.status === 'assigned' && job.fixerId === user.id && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => updateStatus('in_progress')}>
            <Text style={styles.actionBtnText}>🚀 Start Work</Text>
          </TouchableOpacity>
        )}
        {user.role === 'fixer' && job.status === 'in_progress' && job.fixerId === user.id && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => updateStatus('completed')}>
            <Text style={styles.actionBtnText}>✅ Mark Complete</Text>
          </TouchableOpacity>
        )}
        {canChat && job.fixerId && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0ea5e9', marginTop: 8 }]}
            onPress={() => navigation.navigate('ChatDetail', {
              job,
              otherUser: {
                fullName: user.role === 'customer' ? job.fixerName : job.customerName,
                id: user.role === 'customer' ? job.fixerId : job.customerId,
              }
            })}>
            <Text style={styles.actionBtnText}>💬 Open Chat</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}`;

// Replace the old function with the clean one
content = content.substring(0, startIdx) + cleanFunction + content.substring(endIdx);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ JobDetailsScreen has been completely rewritten with proper structure');
console.log('   The updateStatus function is now properly defined and will work!');
