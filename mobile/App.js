import React, { useState, useEffect, createContext, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ScrollView, Alert, ActivityIndicator, SafeAreaView, Share, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
// LIVE API URL - Deployed on Render
const API_URL = 'https://fixza-api.onrender.com';
const AuthContext = createContext();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ========== LOGIN SCREEN ==========
function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success) {
        await signIn(data.token, data.user);
      } else {
        Alert.alert('Error', data.error || 'Login failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Connection failed. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <View style={styles.authContent}>
        <Text style={styles.authTitle}>FixZA</Text>
        <Text style={styles.authSubtitle}>South Africa's Local Services</Text>
        <TextInput 
          style={styles.authInput} 
          placeholder="Email" 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none" 
          keyboardType="email-address" 
        />
        <TextInput 
          style={styles.authInput} 
          placeholder="Password" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        <TouchableOpacity style={styles.authButton} onPress={handleLogin} disabled={loading}>
          <Text style={styles.authButtonText}>{loading ? 'Logging in...' : 'Login'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.authLink}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ========== REGISTER SCREEN ==========
function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const { signIn } = useContext(AuthContext);

  const handleRegister = async () => {
    if (!email || !password || !fullName) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, role }),
      });
      const data = await response.json();
      if (data.success) {
        await signIn(data.token, data.user);
      } else {
        Alert.alert('Error', data.error || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Connection failed. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <ScrollView contentContainerStyle={styles.authContent}>
        <Text style={styles.authTitle}>Create Account</Text>
        <TextInput 
          style={styles.authInput} 
          placeholder="Full Name *" 
          value={fullName} 
          onChangeText={setFullName} 
        />
        <TextInput 
          style={styles.authInput} 
          placeholder="Email *" 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none" 
          keyboardType="email-address" 
        />
        <TextInput 
          style={styles.authInput} 
          placeholder="Password *" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        <View style={styles.roleSelector}>
          <TouchableOpacity 
            style={[styles.roleOption, role === 'customer' && styles.roleActive]} 
            onPress={() => setRole('customer')}
          >
            <Text style={[styles.roleText, role === 'customer' && styles.roleTextActive]}>👤 Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleOption, role === 'fixer' && styles.roleActive]} 
            onPress={() => setRole('fixer')}
          >
            <Text style={[styles.roleText, role === 'fixer' && styles.roleTextActive]}>🔧 Fixer</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.authButton} onPress={handleRegister} disabled={loading}>
          <Text style={styles.authButtonText}>{loading ? 'Creating...' : 'Register'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.authLink}>Already have an account? Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ========== HOME SCREEN (Jobs) with Category Filter ==========
function HomeScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { user, token } = useContext(AuthContext);

  const categories = ['all', 'Plumbing', 'Electrical', 'Cleaning', 'Painting', 'Handyman', 'Gardening', 'Moving', 'Automotive'];

  useEffect(() => {
    loadJobs();
    const unsubscribe = navigation.addListener('focus', loadJobs);
    return unsubscribe;
  }, [navigation, selectedCategory]);

  const loadJobs = async () => {
    try {
      let url = user.role === 'fixer' ? `${API_URL}/my-jobs` : `${API_URL}/jobs`;
      if (selectedCategory !== 'all') {
        url += `?category=${selectedCategory}`;
      }
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderJob = ({ item }) => (
    <TouchableOpacity 
      style={styles.jobCard} 
      onPress={() => navigation.navigate('JobDetails', { jobId: item.id })}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle}>{item.title}</Text>
        <View style={[styles.jobStatus, { 
          backgroundColor: item.status === 'open' ? '#10B981' : 
                          item.status === 'assigned' ? '#F59E0B' : 
                          item.status === 'in_progress' ? '#3B82F6' : '#6B7280' 
        }]}>
          <Text style={styles.jobStatusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.jobCategory}>{item.category}</Text>
      <Text style={styles.jobLocation}>📍 {item.location}</Text>
      <View style={styles.jobFooter}>
        <Text style={styles.jobBudget}>R{item.budget || 'Negotiable'}</Text>
        <Text style={styles.jobCustomer}>{item.customerName}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1A8A5A" /></View>;

  return (
    <View style={styles.container}>
      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChipFilter, selectedCategory === cat && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
              {cat === 'all' ? 'All' : cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList 
        data={jobs} 
        renderItem={renderJob} 
        keyExtractor={(item) => item.id.toString()} 
        contentContainerStyle={styles.jobList} 
        ListEmptyComponent={<Text style={styles.emptyText}>No jobs found</Text>} 
      />
      {user.role === 'customer' && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => navigation.navigate('CreateJob')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ========== CREATE JOB SCREEN ==========
function CreateJobScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const { token, signOut, user } = useContext(AuthContext);

  const categories = ['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'Handyman', 'Gardening', 'Moving', 'Automotive'];

  const handleSubmit = async () => {
    if (!title || !description || !category || !location) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          title, 
          description, 
          category, 
          location, 
          budget: budget ? parseInt(budget) : null 
        }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Job posted!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.createHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonHeader}>
          <Text style={styles.backButtonHeaderText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.createHeaderTitle}>Post a New Job</Text>
        <TouchableOpacity onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: () => signOut() }
          ]);
        }} style={styles.logoutButtonHeader}>
          <Text style={styles.logoutButtonHeaderText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.createForm}>
        <TextInput 
          style={styles.input} 
          placeholder="Job Title *" 
          value={title} 
          onChangeText={setTitle} 
        />
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="Description *" 
          value={description} 
          onChangeText={setDescription} 
          multiline 
          numberOfLines={4} 
        />
        <Text style={styles.sectionLabel}>Category *</Text>
        <View style={styles.categoryGrid}>
          {categories.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.categoryChip, category === cat && styles.categoryActive]} 
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput 
          style={styles.input} 
          placeholder="Location *" 
          value={location} 
          onChangeText={setLocation} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Budget (R) - Optional" 
          value={budget} 
          onChangeText={setBudget} 
          keyboardType="numeric" 
        />
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitButtonText}>{loading ? 'Posting...' : 'Post Job'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ========== PROFILE SCREEN ==========
function ProfileScreen() {
  const { user, signOut } = useContext(AuthContext);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.profileHeader}>
        <Text style={styles.profileName}>{user?.fullName}</Text>
        <Text style={styles.profileRole}>{user?.role === 'fixer' ? '🔧 Service Provider' : '👤 Customer'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ========== JOB DETAILS SCREEN with Share Button ==========
function JobDetailsScreen({ route, navigation }) {
  const { jobId } = route.params;
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, token } = useContext(AuthContext);

  useEffect(() => { loadJob(); }, []);

  const loadJob = async () => {
    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await response.json();
      setJob(data.job);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const shareJob = async () => {
    try {
      const result = await Share.share({
        message: `🔧 FixZA Job: ${job.title}\n\n📋 Description: ${job.description}\n📍 Location: ${job.location}\n💰 Budget: R${job.budget || 'Negotiable'}\n\nDownload FixZA app to apply!`,
        url: 'https://fixza-api.onrender.com'
      });
      if (result.action === Share.sharedAction) {
        console.log('Job shared successfully');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const acceptJob = async () => {
    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}/accept`, { 
        method: 'PATCH', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        } 
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Job accepted!');
        loadJob();
      } else {
        Alert.alert('Error', data.error || 'Could not accept job');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept job');
    }
  };

  const updateStatus = async (status) => {
    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', `Job marked as ${status}`);
        loadJob();
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1A8A5A" /></View>;
  if (!job) return <View style={styles.center}><Text>Job not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>{job.title}</Text>
        <Text style={styles.detailCategory}>{job.category}</Text>
        <Text style={styles.detailLocation}>📍 {job.location}</Text>
        <Text style={styles.detailBudget}>💰 R{job.budget || 'Negotiable'}</Text>
        <Text style={styles.detailDescription}>{job.description}</Text>
        <Text style={styles.detailCustomer}>Posted by: {job.customerName}</Text>
        <Text style={styles.detailStatus}>Status: {job.status}</Text>
      </View>
      
      {/* Share Button */}
      <TouchableOpacity style={styles.shareButton} onPress={shareJob}>
        <Text style={styles.shareButtonText}>📱 Share this Job</Text>
      </TouchableOpacity>
      
      {/* Fixer Actions */}
      {user.role === 'fixer' && job.status === 'open' && (
        <TouchableOpacity style={styles.actionButton} onPress={acceptJob}>
          <Text style={styles.actionButtonText}>Accept Job</Text>
        </TouchableOpacity>
      )}
      
      {user.role === 'fixer' && job.status === 'assigned' && job.fixerId === user.id && (
        <TouchableOpacity style={styles.actionButton} onPress={() => updateStatus('in_progress')}>
          <Text style={styles.actionButtonText}>Start Work</Text>
        </TouchableOpacity>
      )}
      
      {user.role === 'fixer' && job.status === 'in_progress' && job.fixerId === user.id && (
        <TouchableOpacity style={styles.actionButton} onPress={() => updateStatus('completed')}>
          <Text style={styles.actionButtonText}>Mark Complete</Text>
        </TouchableOpacity>
      )}
      
      {/* Customer Actions */}
      {user.role === 'customer' && job.customerId === user.id && job.status === 'assigned' && (
        <TouchableOpacity style={styles.actionButton} onPress={() => updateStatus('in_progress')}>
          <Text style={styles.actionButtonText}>Start Work</Text>
        </TouchableOpacity>
      )}
      
      {user.role === 'customer' && job.customerId === user.id && job.status === 'in_progress' && (
        <TouchableOpacity style={styles.actionButton} onPress={() => updateStatus('completed')}>
          <Text style={styles.actionButtonText}>Mark Complete</Text>
        </TouchableOpacity>
      )}
      
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back to Jobs</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ========== MAIN APP ==========
function MainApp() {
  const { user } = useContext(AuthContext);
  return (
    <Tab.Navigator 
      screenOptions={{ 
        tabBarActiveTintColor: '#1A8A5A',
        tabBarInactiveTintColor: '#6B7280',
        headerStyle: { backgroundColor: '#1A8A5A' }, 
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' }
      }}
    >
      <Tab.Screen name="Jobs" component={HomeScreen} />
      {user.role === 'customer' && <Tab.Screen name="Post Job" component={CreateJobScreen} />}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ========== PUSH NOTIFICATION HELPER ==========
async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return;
  }
  token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

// ========== APP ROOT ==========
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => { loadStoredData(); }, []);

  const loadStoredData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) { 
      console.error(error);
    } finally { 
      setIsLoading(false); 
    }
  };

  const signIn = async (newToken, newUser) => {
    await AsyncStorage.setItem('token', newToken);
    await AsyncStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    
    // Register push token
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        await fetch(`${API_URL}/users/${newUser.id}/push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
          body: JSON.stringify({ pushToken }),
        });
      }
    } catch (error) {
      console.error('Push token registration error:', error);
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#1A8A5A" /></View>;

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              <Stack.Screen name="Main" component={MainApp} />
              <Stack.Screen name="JobDetails" component={JobDetailsScreen} />
              <Stack.Screen name="CreateJob" component={CreateJobScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  authContainer: { flex: 1, backgroundColor: '#fff' },
  authContent: { padding: 20, justifyContent: 'center', flexGrow: 1 },
  authTitle: { fontSize: 36, fontWeight: 'bold', color: '#1A8A5A', textAlign: 'center', marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 40 },
  authInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 16 },
  authButton: { backgroundColor: '#1A8A5A', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  authLink: { color: '#1A8A5A', textAlign: 'center', marginTop: 20 },
  roleSelector: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleOption: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  roleActive: { backgroundColor: '#1A8A5A', borderColor: '#1A8A5A' },
  roleText: { color: '#6B7280' },
  roleTextActive: { color: '#fff' },
  categoryFilter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryChipFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#1A8A5A',
  },
  categoryChipText: {
    color: '#6b7280',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  jobList: { padding: 12 },
  jobCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, elevation: 2 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8 },
  jobStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  jobStatusText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  jobCategory: { fontSize: 13, color: '#1A8A5A', marginBottom: 4 },
  jobLocation: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  jobBudget: { fontSize: 14, fontWeight: 'bold', color: '#1A8A5A' },
  jobCustomer: { fontSize: 11, color: '#9CA3AF' },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#1A8A5A', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#9CA3AF' },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  createHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A8A5A',
  },
  backButtonHeader: {
    padding: 8,
  },
  backButtonHeaderText: {
    fontSize: 16,
    color: '#1A8A5A',
    fontWeight: 'bold',
  },
  logoutButtonHeader: {
    padding: 8,
  },
  logoutButtonHeaderText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  createForm: { padding: 16 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A8A5A', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', margin: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  categoryActive: { backgroundColor: '#1A8A5A', borderColor: '#1A8A5A' },
  categoryText: { color: '#6B7280' },
  categoryTextActive: { color: '#fff' },
  submitButton: { backgroundColor: '#1A8A5A', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  profileHeader: { backgroundColor: '#fff', padding: 20, alignItems: 'center', margin: 12, borderRadius: 12 },
  profileName: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  profileRole: { fontSize: 14, color: '#1A8A5A', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  logoutButton: { backgroundColor: '#EF4444', padding: 15, borderRadius: 10, alignItems: 'center', minWidth: 200 },
  logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  detailCard: { backgroundColor: '#fff', margin: 12, padding: 16, borderRadius: 12 },
  detailTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  detailCategory: { fontSize: 14, color: '#1A8A5A', marginBottom: 8 },
  detailLocation: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  detailBudget: { fontSize: 18, fontWeight: 'bold', color: '#1A8A5A', marginBottom: 12 },
  detailDescription: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 12 },
  detailCustomer: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  detailStatus: { fontSize: 12, color: '#1A8A5A', fontWeight: 'bold', marginTop: 8 },
  actionButton: { backgroundColor: '#1A8A5A', margin: 12, padding: 16, borderRadius: 10, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  shareButton: {
    backgroundColor: '#1A8A5A',
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  backButton: { backgroundColor: '#6B7280', margin: 12, padding: 16, borderRadius: 10, alignItems: 'center' },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});