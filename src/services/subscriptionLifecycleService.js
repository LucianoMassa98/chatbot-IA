const { Op } = require('sequelize');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const { UserSubscription, Subscription, User, Order, Payment } = require('../models');
const mercadoPagoService = require('./mercadoPagoService');
const notificationService = require('./notificationService');

/**
 * SubscriptionLifecycleService
 *
 * Manages the full lifecycle of customer subscriptions:
 *  - Monthly billing: reminder → payment order generation → webhook confirmation → next period
 *  - Weekly delivery: automatic order generation for active subscribers
 *  - Expiration: grace period handling for unpaid renewals
 */
class SubscriptionLifecycleService {
  // ─── Constants ───────────────────────────────────────────

  /** Days before period end to send the renewal reminder */
  REMINDER_DAYS_BEFORE = 3;

  /** Grace period (days) after period_end before marking as expired */
  GRACE_PERIOD_DAYS = 3;

  // ─── Public Jobs (called by schedulerService) ────────────

  /**
   * Daily job: send WhatsApp renewal reminders to customers whose subscription
   * expires in REMINDER_DAYS_BEFORE days and haven't been reminded yet this cycle.
   */
  async renewalCheck() {
    logger.info('[SubscriptionLifecycle] Running daily renewal check...');

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + this.REMINDER_DAYS_BEFORE);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const expiringSoon = await UserSubscription.findAll({
      where: {
        status: 'active',
        currentPeriodEnd: { [Op.between]: [startOfDay, endOfDay] },
        // Only notify once per cycle
        [Op.or]: [
          { reminderSentAt: null },
          {
            reminderSentAt: {
              [Op.lt]: new Date(new Date() - 20 * 24 * 60 * 60 * 1000), // >20 days ago
            },
          },
        ],
      },
      include: [
        { association: 'user' },
        { association: 'plan' },
      ],
    });

    logger.info(`[SubscriptionLifecycle] Found ${expiringSoon.length} subscriptions expiring in ${this.REMINDER_DAYS_BEFORE} days`);

    for (const userSub of expiringSoon) {
      try {
        await notificationService.sendSubscriptionRenewalReminder(userSub.user, userSub);
        await userSub.update({ reminderSentAt: new Date() });
        logger.info(`[SubscriptionLifecycle] Renewal reminder sent to user ${userSub.userId}`);
      } catch (err) {
        logger.warn(`[SubscriptionLifecycle] Failed to send reminder to user ${userSub.userId}: ${err.message}`);
      }
    }
  }

  /**
   * Daily job: find subscriptions past their period_end + grace period and mark expired.
   * Also generate the renewal payment order for subscriptions that just ended (grace starts today).
   */
  async processExpiredSubscriptions() {
    logger.info('[SubscriptionLifecycle] Running expired subscription check...');

    const now = new Date();

    // 1. Subscriptions that ended today → generate renewal order (start grace period)
    const endedToday = await UserSubscription.findAll({
      where: {
        status: 'active',
        currentPeriodEnd: { [Op.lte]: now },
        renewalOrderId: null, // No renewal order yet
      },
      include: [
        { association: 'user' },
        { association: 'plan' },
      ],
    });

    for (const userSub of endedToday) {
      try {
        await this.generateRenewalOrder(userSub);
        logger.info(`[SubscriptionLifecycle] Renewal order generated for user ${userSub.userId}`);
      } catch (err) {
        logger.warn(`[SubscriptionLifecycle] Failed to generate renewal order for user ${userSub.userId}: ${err.message}`);
      }
    }

    // 2. Subscriptions past grace period with unpaid renewal → expire them
    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - this.GRACE_PERIOD_DAYS);

    const overdue = await UserSubscription.findAll({
      where: {
        status: 'active',
        currentPeriodEnd: { [Op.lte]: graceCutoff },
        renewalOrderId: { [Op.ne]: null }, // Has a renewal order
      },
      include: [
        { association: 'user' },
        { association: 'plan' },
        {
          association: 'renewalOrder',
          include: [{ association: 'payment' }],
        },
      ],
    });

    for (const userSub of overdue) {
      // Check if renewal order was paid
      const renewalPayment = userSub.renewalOrder?.payment;
      if (renewalPayment && renewalPayment.status === 'approved') {
        // Payment came in — activate next period
        continue;
      }

      try {
        await userSub.update({ status: 'expired' });
        await notificationService.sendSubscriptionExpired(userSub.user, userSub);
        logger.info(`[SubscriptionLifecycle] Subscription expired for user ${userSub.userId}`);
      } catch (err) {
        logger.warn(`[SubscriptionLifecycle] Failed to expire subscription ${userSub.id}: ${err.message}`);
      }
    }
  }

  /**
   * Weekly job (runs Monday morning): generate delivery orders for all active subscribers
   * whose nextDeliveryDate falls within the current week.
   * Notifies armadores and repartidores via WhatsApp.
   */
  async generateWeeklyDeliveries() {
    logger.info('[SubscriptionLifecycle] Running weekly delivery generation...');

    const now = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);

    const activeSubscriptions = await UserSubscription.findAll({
      where: {
        status: 'active',
        nextDeliveryDate: { [Op.between]: [now, weekEnd] },
      },
      include: [
        { association: 'user' },
        { association: 'plan' },
      ],
    });

    logger.info(`[SubscriptionLifecycle] Found ${activeSubscriptions.length} deliveries to generate this week`);

    const generatedOrders = [];

    for (const userSub of activeSubscriptions) {
      // Skip if user has no delivery address
      if (!userSub.user.address && !userSub.user.location) {
        logger.warn(`[SubscriptionLifecycle] User ${userSub.userId} has no delivery address, skipping`);
        continue;
      }

      try {
        const order = await this._createDeliveryOrder(userSub);
        generatedOrders.push(order);

        // Notify the customer
        await notificationService.sendWeeklyDeliveryNotification(userSub.user, userSub.plan, order);

        // Advance nextDeliveryDate based on subscription frequency
        const nextDate = this._calculateNextDeliveryDate(userSub.plan.frequency, userSub.nextDeliveryDate);
        await userSub.update({
          nextDeliveryDate: nextDate,
          deliveryCount: userSub.deliveryCount + 1,
        });

        logger.info(`[SubscriptionLifecycle] Delivery order created for user ${userSub.userId}, next: ${nextDate}`);
      } catch (err) {
        logger.warn(`[SubscriptionLifecycle] Failed to create delivery for user ${userSub.userId}: ${err.message}`);
      }
    }

    // Notify all armadores with consolidated pending orders
    if (generatedOrders.length > 0) {
      try {
        await notificationService.sendWeeklyOperatorsAlert(generatedOrders);
        logger.info(`[SubscriptionLifecycle] Operators notified about ${generatedOrders.length} new deliveries`);
      } catch (err) {
        logger.warn(`[SubscriptionLifecycle] Failed to notify operators: ${err.message}`);
      }
    }

    return generatedOrders;
  }

  /**
   * Called from orderService webhook handler when a subscription order payment is approved.
   * Activates or renews the UserSubscription.
   *
   * @param {string} orderId - The Order.id that was just paid
   */
  async handleSubscriptionPaymentWebhook(orderId) {
    const order = await Order.findByPk(orderId, {
      include: [
        { association: 'user' },
        { association: 'subscription' },
      ],
    });

    if (!order || order.type !== 'subscription') return;

    // Check if there's an existing UserSubscription for this renewal order
    const existingForRenewal = await UserSubscription.findOne({
      where: { renewalOrderId: orderId },
    });

    if (existingForRenewal) {
      // This is a renewal payment — advance to next period
      await this._activateNextPeriod(existingForRenewal, order);
      logger.info(`[SubscriptionLifecycle] Subscription renewed for user ${order.userId}`);
      return;
    }

    // Check if there's an existing pending_payment UserSubscription for this user+plan
    const existing = await UserSubscription.findOne({
      where: {
        userId: order.userId,
        subscriptionId: order.subscriptionId,
        status: 'pending_payment',
      },
    });

    if (existing) {
      // First payment — activate
      await this._activateFirstPeriod(existing, order);
      logger.info(`[SubscriptionLifecycle] Subscription activated for user ${order.userId}`);
    } else {
      logger.warn(`[SubscriptionLifecycle] No UserSubscription found for order ${orderId}`);
    }
  }

  // ─── Manual operations (CRM) ─────────────────────────────

  /**
   * Manually generate a renewal payment order for a given UserSubscription.
   * Used by the CRM force-renew endpoint.
   *
   * @param {UserSubscription} userSub - Instance with user and plan loaded
   * @returns {Promise<Order>}
   */
  async generateRenewalOrder(userSub) {
    if (!userSub.user || !userSub.plan) {
      userSub = await UserSubscription.findByPk(userSub.id, {
        include: [{ association: 'user' }, { association: 'plan' }],
      });
    }

    const { user, plan } = userSub;

    const order = await Order.create({
      userId: user.id,
      subscriptionId: plan.id,
      type: 'subscription',
      status: 'pending_payment',
      quantity: plan.maplesQuantity,
      total: Number(plan.price),
      deliveryAddress: user.address,
      metadata: { isRenewal: true, userSubscriptionId: userSub.id },
    });

    const { preferenceId, paymentLink } = await mercadoPagoService.createPreference(
      order,
      user,
      `Renovación ${plan.name} — mes ${this._currentMonthLabel()}`,
    );

    await Payment.create({
      orderId: order.id,
      preferenceId,
      paymentLink,
      status: 'pending',
      amount: Number(plan.price),
    });

    await userSub.update({ renewalOrderId: order.id });

    // Notify the customer with the payment link
    await notificationService.sendSubscriptionRenewalPaymentLink(user, userSub, paymentLink);

    return order;
  }

  /**
   * Cancel a UserSubscription (CRM or user-initiated).
   * @param {string} userSubId
   * @param {string} [notes]
   */
  async cancelSubscription(userSubId, notes = null) {
    const userSub = await UserSubscription.findByPk(userSubId, {
      include: [{ association: 'user' }, { association: 'plan' }],
    });

    if (!userSub) throw new AppError('Suscripción no encontrada.', 404);
    if (userSub.status === 'cancelled') throw new AppError('La suscripción ya está cancelada.', 400);

    await userSub.update({
      status: 'cancelled',
      cancelledAt: new Date(),
      metadata: { ...userSub.metadata, cancelNotes: notes },
    });

    try {
      await notificationService.sendSubscriptionCancelled(userSub.user, userSub);
    } catch (err) {
      logger.warn(`[SubscriptionLifecycle] Failed to notify user ${userSub.userId} of cancellation: ${err.message}`);
    }

    logger.info(`[SubscriptionLifecycle] Subscription ${userSubId} cancelled`);
    return userSub;
  }

  /**
   * Pause a UserSubscription (stops weekly delivery generation).
   * @param {string} userSubId
   */
  async pauseSubscription(userSubId) {
    const userSub = await UserSubscription.findByPk(userSubId, {
      include: [{ association: 'user' }, { association: 'plan' }],
    });

    if (!userSub) throw new AppError('Suscripción no encontrada.', 404);
    if (!['active'].includes(userSub.status)) {
      throw new AppError(`No se puede pausar una suscripción en estado "${userSub.status}".`, 400);
    }

    await userSub.update({ status: 'paused' });
    logger.info(`[SubscriptionLifecycle] Subscription ${userSubId} paused`);
    return userSub;
  }

  /**
   * Resume a paused UserSubscription.
   * @param {string} userSubId
   */
  async resumeSubscription(userSubId) {
    const userSub = await UserSubscription.findByPk(userSubId, {
      include: [{ association: 'user' }, { association: 'plan' }],
    });

    if (!userSub) throw new AppError('Suscripción no encontrada.', 404);
    if (userSub.status !== 'paused') {
      throw new AppError(`Solo se pueden reactivar suscripciones pausadas. Estado actual: "${userSub.status}".`, 400);
    }

    // Recalculate next delivery date from now
    const nextDate = this._calculateNextDeliveryDate(userSub.plan.frequency, new Date());
    await userSub.update({ status: 'active', nextDeliveryDate: nextDate });

    logger.info(`[SubscriptionLifecycle] Subscription ${userSubId} resumed`);
    return userSub;
  }

  // ─── Private helpers ─────────────────────────────────────

  /**
   * Activate the first billing period after the first payment is confirmed.
   * @private
   */
  async _activateFirstPeriod(userSub, order) {
    const plan = await Subscription.findByPk(order.subscriptionId);
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1); // Monthly billing cycle

    const firstDelivery = this._calculateNextDeliveryDate(plan.frequency, periodStart);

    await userSub.update({
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextDeliveryDate: firstDelivery,
      deliveryCount: 0,
      reminderSentAt: null,
      renewalOrderId: null,
    });

    // Notify customer — subscription is now active
    const user = await User.findByPk(order.userId);
    await notificationService.sendSubscriptionActivated(user, userSub, plan, firstDelivery);
  }

  /**
   * Advance to the next billing period after a renewal payment is confirmed.
   * @private
   */
  async _activateNextPeriod(userSub, order) {
    const plan = await Subscription.findByPk(order.subscriptionId);
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const firstDelivery = this._calculateNextDeliveryDate(plan.frequency, periodStart);

    await userSub.update({
      status: 'active',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextDeliveryDate: firstDelivery,
      deliveryCount: 0,
      reminderSentAt: null,
      renewalOrderId: null,
    });

    const user = await User.findByPk(order.userId);
    await notificationService.sendSubscriptionRenewed(user, userSub, plan);
  }

  /**
   * Create a delivery Order for an active subscription (already-paid by monthly billing).
   * Status starts at 'paid' directly since the monthly payment covers it.
   * @private
   */
  async _createDeliveryOrder(userSub) {
    const { user, plan } = userSub;

    const order = await Order.create({
      userId: user.id,
      subscriptionId: plan.id,
      type: 'subscription',
      status: 'paid', // Monthly payment already covers this delivery
      quantity: plan.maplesQuantity,
      total: 0, // Covered by monthly fee — no additional charge
      deliveryAddress: user.address,
      estimatedDelivery: userSub.nextDeliveryDate,
      metadata: {
        userSubscriptionId: userSub.id,
        isWeeklyDelivery: true,
        deliveryNumber: userSub.deliveryCount + 1,
      },
    });

    // Track the delivery order ID in the subscription metadata
    const deliveryOrderIds = userSub.metadata?.deliveryOrderIds || [];
    await userSub.update({
      metadata: {
        ...userSub.metadata,
        deliveryOrderIds: [...deliveryOrderIds, order.id],
      },
    });

    return order;
  }

  /**
   * Calculate the next delivery date based on frequency.
   * @param {'weekly'|'biweekly'|'monthly'} frequency
   * @param {Date} fromDate
   * @returns {Date}
   * @private
   */
  _calculateNextDeliveryDate(frequency, fromDate = new Date()) {
    const next = new Date(fromDate);
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 7);
    }
    return next;
  }

  /** @private */
  _currentMonthLabel() {
    return new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  }
}

module.exports = new SubscriptionLifecycleService();
