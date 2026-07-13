const cron = require('node-cron');
const logger = require('../config/logger');
const subscriptionLifecycleService = require('./subscriptionLifecycleService');

/**
 * Scheduler Service
 *
 * Registers all recurring background jobs using node-cron.
 * Jobs are only started once, at server initialization.
 *
 * Schedule reference (America/Argentina/Buenos_Aires):
 *  - Daily 09:00  → renewalCheck         (3-day reminder before period ends)
 *  - Daily 09:05  → processExpired       (expire overdue subscriptions + generate renewal links)
 *  - Every Monday 08:00 → generateWeeklyDeliveries (create delivery orders for the week)
 */
class SchedulerService {
  constructor() {
    this._jobs = [];
    this._started = false;
  }

  /**
   * Start all cron jobs. Safe to call multiple times — starts only once.
   */
  start() {
    if (this._started) {
      logger.warn('[Scheduler] Already started — skipping');
      return;
    }

    const timezone = 'America/Argentina/Buenos_Aires';

    // ── Daily at 09:00 — Renewal reminders ──────────────────
    this._jobs.push(
      cron.schedule(
        '0 9 * * *',
        async () => {
          logger.info('[Scheduler] Firing: renewalCheck');
          try {
            await subscriptionLifecycleService.renewalCheck();
          } catch (err) {
            logger.error(`[Scheduler] renewalCheck failed: ${err.message}`);
          }
        },
        { timezone },
      ),
    );

    // ── Daily at 09:05 — Expiry processing ──────────────────
    this._jobs.push(
      cron.schedule(
        '5 9 * * *',
        async () => {
          logger.info('[Scheduler] Firing: processExpiredSubscriptions');
          try {
            await subscriptionLifecycleService.processExpiredSubscriptions();
          } catch (err) {
            logger.error(`[Scheduler] processExpiredSubscriptions failed: ${err.message}`);
          }
        },
        { timezone },
      ),
    );

    // ── Every Monday at 08:00 — Weekly delivery generation ──
    this._jobs.push(
      cron.schedule(
        '0 8 * * 1',
        async () => {
          logger.info('[Scheduler] Firing: generateWeeklyDeliveries');
          try {
            const orders = await subscriptionLifecycleService.generateWeeklyDeliveries();
            logger.info(`[Scheduler] Weekly deliveries generated: ${orders.length} orders`);
          } catch (err) {
            logger.error(`[Scheduler] generateWeeklyDeliveries failed: ${err.message}`);
          }
        },
        { timezone },
      ),
    );

    this._started = true;
    logger.info('[Scheduler] All cron jobs started successfully');
    logger.info('[Scheduler] Jobs: renewalCheck (09:00), processExpired (09:05), weeklyDeliveries (Mon 08:00)');
  }

  /**
   * Stop all cron jobs (useful for graceful shutdown or tests).
   */
  stop() {
    this._jobs.forEach((job) => job.stop());
    this._jobs = [];
    this._started = false;
    logger.info('[Scheduler] All cron jobs stopped');
  }
}

module.exports = new SchedulerService();
