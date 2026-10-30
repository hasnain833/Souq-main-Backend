const cron = require('node-cron');
const EscrowTransaction = require('../../db/models/escrowTransactionModel');
const Offer = require('../../db/models/offerModel');
const payoutService = require('../payout/PayoutService');

class EscrowScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.socketIO = null;
  }

  /**
   * Set socket IO instance for real-time notifications
   * @param {Object} io - Socket IO instance
   */
  setSocketIO(io) {
    this.socketIO = io;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Escrow scheduler is already running');
      return;
    }

    console.log('🚀 Starting escrow scheduler...');

    // Auto-release funds job - runs every hour
    this.scheduleAutoRelease();

    // Expire old offers job - runs every 30 minutes
    this.scheduleOfferExpiration();

    // Cleanup old transactions job - runs daily at 2 AM
    this.scheduleTransactionCleanup();

    // Generate daily reports job - runs daily at 6 AM
    this.scheduleDailyReports();

    this.isRunning = true;
    console.log('✅ Escrow scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Escrow scheduler is not running');
      return;
    }

    console.log('🛑 Stopping escrow scheduler...');

    // Stop all cron jobs
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`✅ Stopped job: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Escrow scheduler stopped successfully');
  }

  /**
   * Schedule auto-release of funds
   */
  scheduleAutoRelease() {
    const job = cron.schedule('0 * * * *', async () => { // Every hour
      try {
        console.log('🔄 Running auto-release job...');
        const results = await payoutService.processAutoReleasePayouts();
        
        if (results.length > 0) {
          console.log(`✅ Processed ${results.length} auto-release payouts`);
          
          // Send notifications via socket
          results.forEach(result => {
            if (result.payoutResult.success && this.socketIO) {
              this.socketIO.emit('payout_processed', {
                transactionId: result.transactionId,
                type: 'auto_release',
                timestamp: new Date()
              });
            }
          });
        } else {
          console.log('ℹ️ No transactions eligible for auto-release');
        }

      } catch (error) {
        console.error('❌ Auto-release job error:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('auto-release', job);
    job.start();
    console.log('✅ Scheduled auto-release job (every hour)');
  }

  /**
   * Schedule offer expiration
   */
  scheduleOfferExpiration() {
    const job = cron.schedule('*/30 * * * *', async () => { // Every 30 minutes
      try {
        console.log('🔄 Running offer expiration job...');
        const expiredCount = await Offer.expireOldOffers();
        
        if (expiredCount > 0) {
          console.log(`✅ Expired ${expiredCount} old offers`);
          
          // Send notifications via socket
          if (this.socketIO) {
            this.socketIO.emit('offers_expired', {
              count: expiredCount,
              timestamp: new Date()
            });
          }
        } else {
          console.log('ℹ️ No offers to expire');
        }

      } catch (error) {
        console.error('❌ Offer expiration job error:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('offer-expiration', job);
    job.start();
    console.log('✅ Scheduled offer expiration job (every 30 minutes)');
  }

  /**
   * Schedule transaction cleanup
   */
  scheduleTransactionCleanup() {
    const job = cron.schedule('0 2 * * *', async () => { // Daily at 2 AM
      try {
        console.log('🔄 Running transaction cleanup job...');
        
        // Clean up old failed transactions (older than 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const cleanupResult = await EscrowTransaction.deleteMany({
          status: { $in: ['payment_failed', 'cancelled'] },
          createdAt: { $lt: thirtyDaysAgo }
        });

        if (cleanupResult.deletedCount > 0) {
          console.log(`✅ Cleaned up ${cleanupResult.deletedCount} old failed transactions`);
        } else {
          console.log('ℹ️ No old transactions to clean up');
        }

        // Archive completed transactions older than 1 year
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        
        const archiveResult = await EscrowTransaction.updateMany(
          {
            status: 'completed',
            'payoutDetails.payoutProcessedAt': { $lt: oneYearAgo }
          },
          {
            $set: { 'metadata.archived': true, 'metadata.archivedAt': new Date() }
          }
        );

        if (archiveResult.modifiedCount > 0) {
          console.log(`✅ Archived ${archiveResult.modifiedCount} old completed transactions`);
        }

      } catch (error) {
        console.error('❌ Transaction cleanup job error:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('transaction-cleanup', job);
    job.start();
    console.log('✅ Scheduled transaction cleanup job (daily at 2 AM)');
  }

  /**
   * Schedule daily reports generation
   */
  scheduleDailyReports() {
    const job = cron.schedule('0 6 * * *', async () => { // Daily at 6 AM
      try {
        console.log('🔄 Running daily reports job...');
        
        // Generate yesterday's statistics
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyStats = await this.generateDailyStatistics(yesterday, today);
        
        console.log('📊 Daily statistics generated:', dailyStats);

        // TODO: Send daily report email to administrators
        // TODO: Store daily statistics in database for historical tracking

      } catch (error) {
        console.error('❌ Daily reports job error:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('daily-reports', job);
    job.start();
    console.log('✅ Scheduled daily reports job (daily at 6 AM)');
  }

  /**
   * Generate daily statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Daily statistics
   */
  async generateDailyStatistics(startDate, endDate) {
    try {
      const stats = await EscrowTransaction.aggregate([
        {
          $match: {
            createdAt: {
              $gte: startDate,
              $lt: endDate
            }
          }
        },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalVolume: { $sum: '$totalAmount' },
            totalPlatformFees: { $sum: '$platformFeeAmount' },
            totalGatewayFees: { $sum: '$gatewayFeeAmount' },
            statusBreakdown: {
              $push: '$status'
            },
            gatewayBreakdown: {
              $push: '$paymentGateway'
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          date: startDate.toISOString().split('T')[0],
          totalTransactions: 0,
          totalVolume: 0,
          totalPlatformFees: 0,
          totalGatewayFees: 0,
          statusBreakdown: {},
          gatewayBreakdown: {}
        };
      }

      const result = stats[0];

      // Calculate status breakdown
      const statusBreakdown = {};
      result.statusBreakdown.forEach(status => {
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });

      // Calculate gateway breakdown
      const gatewayBreakdown = {};
      result.gatewayBreakdown.forEach(gateway => {
        gatewayBreakdown[gateway] = (gatewayBreakdown[gateway] || 0) + 1;
      });

      return {
        date: startDate.toISOString().split('T')[0],
        totalTransactions: result.totalTransactions,
        totalVolume: Math.round(result.totalVolume * 100) / 100,
        totalPlatformFees: Math.round(result.totalPlatformFees * 100) / 100,
        totalGatewayFees: Math.round(result.totalGatewayFees * 100) / 100,
        statusBreakdown,
        gatewayBreakdown
      };

    } catch (error) {
      console.error('Generate daily statistics error:', error);
      return null;
    }
  }

  /**
   * Manually trigger auto-release job
   * @returns {Promise<Array>} Auto-release results
   */
  async triggerAutoRelease() {
    try {
      console.log('🔄 Manually triggering auto-release job...');
      return await payoutService.processAutoReleasePayouts();
    } catch (error) {
      console.error('❌ Manual auto-release trigger error:', error);
      return [];
    }
  }

  /**
   * Manually trigger offer expiration job
   * @returns {Promise<number>} Number of expired offers
   */
  async triggerOfferExpiration() {
    try {
      console.log('🔄 Manually triggering offer expiration job...');
      return await Offer.expireOldOffers();
    } catch (error) {
      console.error('❌ Manual offer expiration trigger error:', error);
      return 0;
    }
  }

  /**
   * Get scheduler status
   * @returns {Object} Scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Add custom job
   * @param {string} name - Job name
   * @param {string} schedule - Cron schedule
   * @param {Function} task - Task function
   */
  addCustomJob(name, schedule, task) {
    if (this.jobs.has(name)) {
      console.warn(`⚠️ Job ${name} already exists`);
      return false;
    }

    const job = cron.schedule(schedule, task, { scheduled: false });
    this.jobs.set(name, job);
    
    if (this.isRunning) {
      job.start();
    }

    console.log(`✅ Added custom job: ${name} (${schedule})`);
    return true;
  }

  /**
   * Remove custom job
   * @param {string} name - Job name
   */
  removeCustomJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      console.log(`✅ Removed job: ${name}`);
      return true;
    }
    return false;
  }
}

// Create singleton instance
const escrowScheduler = new EscrowScheduler();

module.exports = escrowScheduler;
