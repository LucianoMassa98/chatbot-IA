const { Order, Payment, Product, Subscription, User } = require('../models');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const mercadoPagoService = require('./mercadoPagoService');
const notificationService = require('./notificationService');

/**
 * Order Service
 * Manages the full order lifecycle for Yemas del Sol.
 */
class OrderService {
  /**
   * Create a new single-product order and its associated Payment record.
   * Returns the order with the Mercado Pago payment link.
   * NOTE: The order remains in 'pending_payment' until MP webhook confirms.
   *
   * @param {string} userId
   * @param {string} productId
   * @param {number} quantity
   * @returns {{ order, payment }}
   */
  async createProductOrder(userId, productId, quantity = 1) {
    const product = await Product.findByPk(productId);
    if (!product || !product.isActive) {
      throw new AppError('Producto no disponible.', 404);
    }

    const user = await User.findByPk(userId);
    const total = Number(product.price) * quantity;

    const order = await Order.create({
      userId,
      productId,
      type: 'single',
      status: 'pending_payment',
      quantity,
      total,
      deliveryAddress: user.address,
    });

    const { preferenceId, paymentLink } = await mercadoPagoService.createPreference(
      order,
      user,
      `${product.name} x${quantity}`,
    );

    const payment = await Payment.create({
      orderId: order.id,
      preferenceId,
      paymentLink,
      status: 'pending',
      amount: total,
    });

    logger.info('Product order created', { orderId: order.id, userId, productId });
    return { order, payment };
  }

  /**
   * Create a new subscription order.
   * @param {string} userId
   * @param {string} subscriptionId
   * @returns {{ order, payment }}
   */
  async createSubscriptionOrder(userId, subscriptionId) {
    const subscription = await Subscription.findByPk(subscriptionId);
    if (!subscription || !subscription.isActive) {
      throw new AppError('Plan de suscripción no disponible.', 404);
    }

    const user = await User.findByPk(userId);

    const order = await Order.create({
      userId,
      subscriptionId,
      type: 'subscription',
      status: 'pending_payment',
      quantity: subscription.maplesQuantity,
      total: Number(subscription.price),
      deliveryAddress: user.address,
    });

    const { preferenceId, paymentLink } = await mercadoPagoService.createPreference(
      order,
      user,
      `${subscription.name} (${subscription.maplesQuantity} maples cada ${this._frequencyLabel(subscription.frequency)})`,
    );

    const payment = await Payment.create({
      orderId: order.id,
      preferenceId,
      paymentLink,
      status: 'pending',
      amount: Number(subscription.price),
    });

    logger.info('Subscription order created', { orderId: order.id, userId, subscriptionId });
    return { order, payment };
  }

  /**
   * Update order status and send automatic WhatsApp notification to the customer.
   * This is the main method called from the CRM when operators change order state.
   *
   * @param {string} orderId
   * @param {string} newStatus
   * @param {string} [notes]
   */
  async updateOrderStatus(orderId, newStatus, notes = null) {
    const order = await Order.findByPk(orderId, { include: [{ association: 'user' }] });
    if (!order) throw new AppError('Pedido no encontrado.', 404);

    const validTransitions = {
      pending_payment: ['paid', 'cancelled'],
      paid: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivering', 'cancelled'],
      delivering: ['delivered', 'rescheduled'],
      rescheduled: ['delivering', 'cancelled'],
    };

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `No se puede cambiar el estado de "${order.status}" a "${newStatus}".`,
        400,
      );
    }

    const updateData = { status: newStatus };
    if (notes) updateData.notes = notes;
    if (newStatus === 'delivered') updateData.deliveredAt = new Date();

    let deliveryInfo = null;
    if (newStatus === 'paid' && !order.estimatedDelivery) {
      deliveryInfo = await this.calculateNextDeliveryTime();
      updateData.estimatedDelivery = deliveryInfo.date;
    }

    await order.update(updateData);

    // Send automatic WhatsApp notification
    try {
      await notificationService.sendStatusNotification(order.user, order, newStatus, deliveryInfo);
    } catch (notifError) {
      logger.warn(`Failed to send status notification for order ${orderId}: ${notifError.message}`);
    }

    // Notify armadores when order becomes paid (CRM route)
    if (newStatus === 'paid') {
      try {
        const fullOrder = await Order.findByPk(orderId, {
          include: [
            { association: 'user' },
            { association: 'product' },
            { association: 'subscription' },
          ],
        });
        await notificationService.notifyArmadoresNewOrder(fullOrder);
      } catch (e) {
        logger.warn(`Failed to notify armadores for order ${orderId}: ${e.message}`);
      }
    }

    logger.info('Order status updated', { orderId, oldStatus: order.status, newStatus });
    return order;
  }

  /**
   * Called from the Mercado Pago webhook handler once payment is confirmed.
   * @param {string} orderId
   * @param {string} mpPaymentId
   * @param {string} mpStatus  ('approved'|'rejected'|'cancelled'|'pending')
   * @param {object} rawData   Full MP payload for audit
   */
  async handlePaymentWebhook(orderId, mpPaymentId, mpStatus, rawData = {}) {
    const order = await Order.findByPk(orderId, { include: [{ association: 'user' }, { association: 'payment' }] });
    if (!order) {
      logger.warn(`MP webhook: order ${orderId} not found`);
      return;
    }

    // Update payment record
    if (order.payment) {
      await order.payment.update({
        mercadoPagoId: mpPaymentId,
        status: mpStatus,
        metadata: rawData,
      });
    }

    // Only transition order status for terminal MP states
    if (mpStatus === 'approved' && order.status === 'pending_payment') {
      const deliveryInfo = await this.calculateNextDeliveryTime();
      await order.update({
        status: 'paid',
        estimatedDelivery: deliveryInfo.date
      });
      try {
        await notificationService.sendPaymentConfirmed(order.user, order, deliveryInfo);
      } catch (e) {
        logger.warn(`Notification error after payment: ${e.message}`);
      }

      // Notify all armadores about the new paid order + consolidated pending
      try {
        // Reload order with associations for notification context
        const fullOrder = await Order.findByPk(order.id, {
          include: [
            { association: 'user' },
            { association: 'product' },
            { association: 'subscription' },
          ],
        });
        await notificationService.notifyArmadoresNewOrder(fullOrder);
      } catch (e) {
        logger.warn(`Failed to notify armadores for order ${orderId}: ${e.message}`);
      }

      logger.info('Order marked as paid after MP approval', { orderId, mpPaymentId, estimatedDelivery: deliveryInfo.date });
    } else if (['rejected', 'cancelled'].includes(mpStatus) && order.status === 'pending_payment') {
      await order.update({ status: 'cancelled' });
      logger.info('Order cancelled after MP rejection', { orderId, mpStatus });
    }
  }

  /**
   * Calculate the next available delivery date and time window based on OperatingHours.
   * Takes into account the Argentina timezone (America/Argentina/Buenos_Aires).
   * @param {Date} [fromDate]
   * @returns {Promise<{ date: Date, startTime: string, endTime: string }>}
   */
  async calculateNextDeliveryTime(fromDate = new Date()) {
    const { OperatingHours } = require('../models');
    const operatingHours = await OperatingHours.findAll({
      where: { isActive: true }
    });

    if (!operatingHours || operatingHours.length === 0) {
      // Fallback: next day at 10:00
      const fallbackDate = new Date(fromDate);
      fallbackDate.setDate(fallbackDate.getDate() + 1);
      fallbackDate.setHours(10, 0, 0, 0);
      return {
        date: fallbackDate,
        startTime: '10:00',
        endTime: '17:00'
      };
    }

    const hoursMap = {};
    operatingHours.forEach(h => {
      hoursMap[h.dayOfWeek] = h;
    });

    const candidate = new Date(fromDate);
    const targetTimezone = 'America/Argentina/Buenos_Aires';
    
    const getLocalParts = (date) => {
      const options = {
        timeZone: targetTimezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(date);
      const partValues = {};
      parts.forEach(p => {
        partValues[p.type] = p.value;
      });
      
      return new Date(
        parseInt(partValues.year, 10),
        parseInt(partValues.month, 10) - 1,
        parseInt(partValues.day, 10),
        parseInt(partValues.hour, 10),
        parseInt(partValues.minute, 10),
        parseInt(partValues.second, 10)
      );
    };

    for (let i = 0; i < 7; i++) {
      const localDate = getLocalParts(candidate);
      const dayOfWeek = localDate.getDay();
      const activeHours = hoursMap[dayOfWeek];

      if (activeHours) {
        const startTimeStr = activeHours.deliveryStartTime || '10:00:00';
        const endTimeStr = activeHours.deliveryEndTime || '17:00:00';
        
        const startTimeParts = startTimeStr.split(':');
        const endTimeParts = endTimeStr.split(':');
        
        const startHour = parseInt(startTimeParts[0], 10);
        const startMin = parseInt(startTimeParts[1], 10);
        const endHour = parseInt(endTimeParts[0], 10);
        const endMin = parseInt(endTimeParts[1], 10);

        const isToday = i === 0;
        if (isToday) {
          const currentLocalHour = localDate.getHours();
          const currentLocalMin = localDate.getMinutes();

          // Today is valid if the current local time is before the delivery end time
          if (currentLocalHour < endHour || (currentLocalHour === endHour && currentLocalMin < endMin)) {
            localDate.setHours(startHour, startMin, 0, 0);
            const offset = candidate.getTime() - getLocalParts(candidate).getTime();
            const utcDeliveryTime = new Date(localDate.getTime() + offset);

            return {
              date: utcDeliveryTime,
              startTime: startTimeStr.substring(0, 5),
              endTime: endTimeStr.substring(0, 5)
            };
          }
        } else {
          // Future day is valid
          localDate.setHours(startHour, startMin, 0, 0);
          const offset = candidate.getTime() - getLocalParts(candidate).getTime();
          const utcDeliveryTime = new Date(localDate.getTime() + offset);

          return {
            date: utcDeliveryTime,
            startTime: startTimeStr.substring(0, 5),
            endTime: endTimeStr.substring(0, 5)
          };
        }
      }
      candidate.setDate(candidate.getDate() + 1);
    }

    // Fallback if no active day found
    const fallbackDate = new Date(fromDate);
    fallbackDate.setDate(fallbackDate.getDate() + 1);
    fallbackDate.setHours(10, 0, 0, 0);
    return {
      date: fallbackDate,
      startTime: '10:00',
      endTime: '17:00'
    };
  }

  /**
   * Get all active orders for a user.
   * @param {string} userId
   */
  async getOrdersByUser(userId) {
    return Order.findAll({
      where: { userId },
      include: [
        { association: 'product' },
        { association: 'subscription' },
        { association: 'payment' },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Get all orders with a given status (for CRM operator view).
   * @param {string} status
   */
  async getOrdersByStatus(status) {
    return Order.findAll({
      where: { status },
      include: [
        { association: 'user' },
        { association: 'product' },
        { association: 'subscription' },
        { association: 'payment' },
      ],
      order: [['created_at', 'ASC']],
    });
  }

  /**
   * Get all orders scheduled for delivery today.
   */
  async getTodayDeliveries() {
    const { Op } = require('sequelize');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return Order.findAll({
      where: {
        status: { [Op.in]: ['paid', 'preparing', 'ready', 'delivering'] },
        estimated_delivery: { [Op.between]: [startOfDay, endOfDay] },
      },
      include: [
        { association: 'user' },
        { association: 'product' },
        { association: 'subscription' },
      ],
      order: [['estimated_delivery', 'ASC']],
    });
  }

  /** @private */
  _frequencyLabel(freq) {
    const labels = { weekly: '7 días', biweekly: '14 días', monthly: '30 días' };
    return labels[freq] || freq;
  }
}

module.exports = new OrderService();
