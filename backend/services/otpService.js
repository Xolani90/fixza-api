import africastalking from 'africastalking';

// Initialize Africa's Talking
let sms;
try {
  const africastalkingConfig = {
    apiKey: process.env.AFRICASTALKING_API_KEY,
    username: process.env.AFRICASTALKING_USERNAME || 'sandbox'
  };
  
  if (process.env.AFRICASTALKING_API_KEY) {
    const africasTalking = africastalking(africastalkingConfig);
    sms = africasTalking.SMS;
    console.log('✅ Africa\'s Talking SMS service initialized');
  } else {
    console.log('⚠️ Africa\'s Talking API key not set, using mock SMS');
  }
} catch (error) {
  console.error('Failed to initialize Africa\'s Talking:', error.message);
}

// In-memory OTP storage
const otpStore = new Map();

class OTPService {
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendSMSOTP(phoneNumber, otp) {
    try {
      // Format phone number for South Africa
      let formattedNumber = phoneNumber.replace(/\s/g, '');
      if (formattedNumber.startsWith('0')) {
        formattedNumber = '+27' + formattedNumber.substring(1);
      }
      if (!formattedNumber.startsWith('+')) {
        formattedNumber = '+27' + formattedNumber;
      }

      const message = `Your FixZA verification code is: ${otp}. Valid for 10 minutes.`;

      if (sms && process.env.AFRICASTALKING_API_KEY) {
        // Send real SMS
        const result = await sms.send({
          to: formattedNumber,
          message: message,
          from: 'FixZA'
        });
        console.log(`📱 SMS sent to ${phoneNumber}: ${otp}`);
        return { success: true, result };
      } else {
        // Fallback to mock mode
        console.log(`⚠️ [MOCK SMS] To: ${phoneNumber} | OTP: ${otp}`);
        console.log(`   Add AFRICASTALKING_API_KEY to enable real SMS`);
        return { success: true, mock: true };
      }
    } catch (error) {
      console.error('SMS Error:', error.message);
      console.log(`⚠️ [MOCK SMS - Fallback] To: ${phoneNumber} | OTP: ${otp}`);
      return { success: true, mock: true };
    }
  }

  storeOTP(userId, otp) {
    otpStore.set(userId.toString(), {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });
    
    setTimeout(() => {
      if (otpStore.has(userId.toString())) {
        otpStore.delete(userId.toString());
      }
    }, 10 * 60 * 1000);
  }

  verifyOTP(userId, otp) {
    const stored = otpStore.get(userId.toString());
    
    if (!stored) {
      return { valid: false, error: 'OTP expired or not found' };
    }
    
    if (stored.attempts >= 5) {
      otpStore.delete(userId.toString());
      return { valid: false, error: 'Too many attempts' };
    }
    
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(userId.toString());
      return { valid: false, error: 'OTP expired' };
    }
    
    if (stored.otp !== otp) {
      stored.attempts++;
      otpStore.set(userId.toString(), stored);
      return { valid: false, error: `Invalid OTP (${5 - stored.attempts} attempts left)` };
    }
    
    otpStore.delete(userId.toString());
    return { valid: true };
  }
}

export default new OTPService();
