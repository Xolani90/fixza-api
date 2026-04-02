import crypto from 'crypto';

class PaystackService {
  async initializePayment(email, amount, metadata) {
    console.log(`💳 [MOCK] Initializing payment for ${email}: R${amount}`);
    const reference = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Return a mock success URL that will show a success message
    const mockSuccessUrl = `http://localhost:4000/payments/mock-success?reference=${reference}&amount=${amount}`;
    
    return {
      success: true,
      authorization_url: mockSuccessUrl,
      reference: reference
    };
  }

  async verifyPayment(reference) {
    console.log(`🔍 [MOCK] Verifying payment: ${reference}`);
    return {
      success: true,
      amount: 500,
      reference: reference,
      customer: { email: 'customer@test.com' }
    };
  }

  verifyWebhook(signature, payload, secretKey) {
    return true;
  }

  async processRefund(transactionReference, amount, reason) {
    console.log(`💰 [MOCK] Processing refund for ${transactionReference}: R${amount}`);
    return { success: true, refund: { id: 'ref_123' } };
  }
}

export default new PaystackService();
