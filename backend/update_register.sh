#!/bin/bash

# Create a temporary file with the new registration endpoint
cat > /tmp/new_register.txt << 'ENDOFREG'
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, role, avatar } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'fullName', 'role']
      });
    }

    if (!['customer', 'fixer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "customer" or "fixer"' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(
      'INSERT INTO users (email, password, fullName, phone, role, avatar, isPhoneVerified) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(email, hashedPassword, fullName, phone || null, role, avatar || null, 0);

    const userId = result.lastInsertRowid;
    
    const otp = otpService.generateOTP();
    otpService.storeOTP(userId.toString(), otp);
    if (phone) {
      await otpService.sendSMSOTP(phone, otp);
    }
    
    res.status(201).json({
      success: true,
      message: 'User created. Please verify your phone number with OTP.',
      userId: userId,
      requiresVerification: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});
ENDOFREG

echo "Please manually replace the registration endpoint in server.js"
echo "The new endpoint code is in /tmp/new_register.txt"
echo ""
echo "Open server.js and find the existing app.post('/auth/register'"
echo "Replace the entire function with the content from /tmp/new_register.txt"
