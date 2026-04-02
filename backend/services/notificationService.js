import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'fixza.db');
const db = new Database(dbPath);

class NotificationService {
  createNotification(userId, type, title, body, data = null) {
    try {
      const stmt = db.prepare(`
        INSERT INTO notifications (userId, type, title, body, data, isRead)
        VALUES (?, ?, ?, ?, ?, 0)
      `);
      stmt.run(userId, type, title, body, data ? JSON.stringify(data) : null);
      console.log(`📧 Notification created for user ${userId}: ${title}`);
      return true;
    } catch (error) {
      console.error('Create notification error:', error);
      return false;
    }
  }

  async sendPushNotification(userId, title, body, data) {
    // Mock push notification
    console.log(`📱 [PUSH] To user ${userId}: ${title} - ${body}`);
  }

  notifyJobAccepted(job, fixer, customer) {
    this.createNotification(
      customer.id,
      'job_accepted',
      'Job Accepted! ✅',
      `${fixer.fullName} has accepted your job: ${job.title}`,
      { jobId: job.id, type: 'job_accepted' }
    );
  }

  notifyJobStarted(job, fixer, customer) {
    this.createNotification(
      customer.id,
      'job_started',
      'Work Started 🚀',
      `${fixer.fullName} has started working on: ${job.title}`,
      { jobId: job.id, type: 'job_started' }
    );
  }

  notifyJobCompleted(job, fixer, customer) {
    this.createNotification(
      customer.id,
      'job_completed',
      'Job Completed! 🎉',
      `${fixer.fullName} completed: ${job.title}. Please rate your experience.`,
      { jobId: job.id, type: 'job_completed' }
    );
    
    this.createNotification(
      fixer.id,
      'job_completed',
      'Job Completed! 🎉',
      `You completed: ${job.title}. Payment will be processed.`,
      { jobId: job.id, type: 'job_completed' }
    );
  }

  notifyPaymentReceived(providerId, job, amount) {
    this.createNotification(
      providerId,
      'payment_received',
      'Payment Received! 💰',
      `You've received R${amount} for ${job.title}`,
      { jobId: job.id, amount }
    );
  }

  notifyJobCancelled(job, userId, reason, penalty, user) {
    const otherPartyId = user.id === job.customerId ? job.fixerId : job.customerId;
    
    if (otherPartyId) {
      this.createNotification(
        otherPartyId,
        'job_cancelled',
        'Job Cancelled ❌',
        `${user.fullName} cancelled: ${job.title}. ${penalty > 0 ? `Penalty: R${penalty}` : ''}`,
        { jobId: job.id, penalty }
      );
    }
  }

  getUnreadCount(userId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0').get(userId);
    return result ? result.count : 0;
  }

  markAsRead(notificationId, userId) {
    db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?').run(notificationId, userId);
  }

  getUserNotifications(userId, limit = 50) {
    return db.prepare(`
      SELECT * FROM notifications 
      WHERE userId = ? 
      ORDER BY createdAt DESC 
      LIMIT ?
    `).all(userId, limit);
  }
}

export default new NotificationService();
