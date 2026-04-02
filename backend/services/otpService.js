// services/otpService.js
const otpStore = new Map();

class OTPService {
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendSMSOTP(phoneNumber, otp) {
    console.log(`📱 [MOCK SMS] To: ${phoneNumber} | OTP: ${otp}`);
    console.log(`   Your FixZA verification code is: ${otp}. Valid for 10 minutes.`);
    return { success: true };
  }

  storeOTP(userId, otp) {
    otpStore.set(userId, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });
    
    setTimeout(() => {
      if (otpStore.has(userId)) {
        otpStore.delete(userId);
      }
    }, 10 * 60 * 1000);
  }

  verifyOTP(userId, otp) {
    const stored = otpStore.get(userId);
    
    if (!stored) {
      return { valid: false, error: 'OTP expired or not found' };
    }
    
    if (stored.attempts >= 5) {
      otpStore.delete(userId);
      return { valid: false, error: 'Too many attempts' };
    }
    
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(userId);
      return { valid: false, error: 'OTP expired' };
    }
    
    if (stored.otp !== otp) {
      stored.attempts++;
      otpStore.set(userId, stored);
      return { valid: false, error: 'Invalid OTP' };
    }
    
    otpStore.delete(userId);
    return { valid: true };
  }
}

module.exports = new OTPService();
