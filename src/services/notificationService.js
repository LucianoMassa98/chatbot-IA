const metaService = require('./metaService');
const logger = require('../config/logger');
const env = require('../config/env');

/**
 * Notification Service
 * Sends automatic WhatsApp messages to customers on order state changes.
 */
class NotificationService {
  /**
   * Dispatch the correct notification based on new order status.
   * @param {object} user  - User model instance
   * @param {object} order - Order model instance
   * @param {string} newStatus
   * @param {object} [deliveryInfo] - Optional calculated delivery date and time window
   */
  async sendStatusNotification(user, order, newStatus, deliveryInfo = null) {
    const handlers = {
      paid: () => this.sendPaymentConfirmed(user, order, deliveryInfo),
      preparing: () => this.sendOrderPreparing(user, order),
      ready: () => this.sendOrderReady(user, order),
      delivering: () => this.sendOrderOutForDelivery(user, order),
      delivered: () => this.sendOrderDelivered(user, order),
      rescheduled: () => this.sendOrderRescheduled(user, order),
      cancelled: () => this.sendOrderCancelled(user, order),
    };

    const handler = handlers[newStatus];
    if (handler) {
      await handler();
    } else {
      logger.debug(`No notification defined for status: ${newStatus}`);
    }
  }

  /**
   * ✅ Payment confirmed
   */
  async sendPaymentConfirmed(user, order, deliveryInfo = null) {
    let deliveryMsg = '';
    
    if (deliveryInfo) {
      const formattedDate = this._formatDeliveryDate(deliveryInfo.date);
      deliveryMsg = `📅 *Fecha de entrega estimada:* ${formattedDate} entre las ${deliveryInfo.startTime} y ${deliveryInfo.endTime} hs.\n\n`;
    } else if (order.estimatedDelivery) {
      const formattedDate = this._formatDeliveryDate(order.estimatedDelivery);
      deliveryMsg = `📅 *Fecha de entrega estimada:* ${formattedDate}\n\n`;
    }

    const msg =
      `✅ *¡Tu pago fue confirmado!*\n\n` +
      `Pedido #${order.id.slice(0, 8).toUpperCase()}\n` +
      `Total: $${Number(order.total).toLocaleString('es-AR')}\n\n` +
      deliveryMsg +
      `Estamos preparando tu pedido. Te avisaremos cuando esté listo. 🥚`;
    await this._send(user, msg);
  }

  /**
   * 🔧 Order preparing
   */
  async sendOrderPreparing(user, order) {
    const msg =
      `🔧 *Tu pedido está en preparación.*\n\n` +
      `Pedido #${order.id.slice(0, 8).toUpperCase()}\n\n` +
      `Te avisamos cuando esté listo para entrega.`;
    await this._send(user, msg);
  }

  /**
   * 📦 Order ready
   */
  async sendOrderReady(user, order) {
    const msg =
      `📦 *¡Tu pedido ya fue preparado!*\n\n` +
      `Pedido #${order.id.slice(0, 8).toUpperCase()}\n\n` +
      `Pronto saldrá para entrega. 🚗`;
    await this._send(user, msg);
  }

  /**
   * 🚗 Order out for delivery
   */
  async sendOrderOutForDelivery(user, order) {
    const deliveryMsg = order.estimatedDelivery
      ? `Hora estimada de llegada: *${this._formatDateTime(order.estimatedDelivery)}*`
      : '';
    const msg =
      `🚗 *¡Tu pedido está en camino!*\n\n` +
      `Pedido #${order.id.slice(0, 8).toUpperCase()}\n` +
      `Dirección: ${order.deliveryAddress || user.address || 'tu domicilio'}\n` +
      `${deliveryMsg}\n\n` +
      `¡Ya casi llega! 🥚`;
    await this._send(user, msg);
  }

  /**
   * ✅ Order delivered
   */
  async sendOrderDelivered(user, order) {
    const msg =
      `✅ *¡Tu pedido fue entregado!*\n\n` +
      `Pedido #${order.id.slice(0, 8).toUpperCase()}\n\n` +
      `Gracias por elegirnos. Si tenés algún inconveniente, respondé este mensaje y te ayudamos. 🙌`;
    await this._send(user, msg);
  }

  /**
   * 🔄 Order rescheduled
   */
  async sendOrderRescheduled(user, order) {
    const msg =
      `🔄 *Tu entrega fue reprogramada.*\n\n` +
      `Pedido #${order.id.slice(0, 8).toUpperCase()}\n\n` +
      `${order.notes ? `Motivo: ${order.notes}\n\n` : ''}` +
      `Te contactaremos para coordinar una nueva fecha. Disculpá los inconvenientes.`;
    await this._send(user, msg);
  }

  /**
   * ❌ Order cancelled
   */
  async sendOrderCancelled(user, order) {
    const msg =
      `❌ *Tu pedido fue cancelado.*\n\n` +
      `Pedido #${order.id.slice(0, 8).toUpperCase()}\n\n` +
      `${order.notes ? `Motivo: ${order.notes}\n\n` : ''}` +
      `Si tenés dudas, respondé este mensaje y te ayudamos.`;
    await this._send(user, msg);
  }

  /**
   * 🔔 Subscription reminder (24 hours before next delivery)
   * @param {object} user
   * @param {object} subscription - Subscription model instance
   * @param {Date}   nextDelivery
   */
  async sendSubscriptionReminder(user, subscription, nextDelivery) {
    const msg =
      `🔔 *Recordatorio de suscripción*\n\n` +
      `Hola ${user.firstName || ''}! Mañana te entregamos tu pedido del plan *${subscription.name}*.\n\n` +
      `📦 ${subscription.maplesQuantity} maple(s)\n` +
      `📍 ${user.address || 'tu domicilio'}\n` +
      `🕐 ${this._formatDateTime(nextDelivery)}\n\n` +
      `Si necesitás reprogramar, respondé este mensaje.`;
    await this._send(user, msg);
  }

  /**
   * 🔔 Notify an operator about a new assignment
   * @param {object} operator - User model instance (role=operador)
   * @param {object} order    - Order model instance (with user association loaded)
   * @param {string} role     - 'armador' or 'repartidor'
   */
  async sendOperatorAssignment(operator, order, role) {
    const customer = order.user;
    const productName = order.product?.name || order.subscription?.name || 'Pedido';
    const orderId = order.id.slice(0, 8).toUpperCase();
    const address = order.deliveryAddress || customer?.address || 'No especificada';

    if (role === 'armador') {
      const msg =
        `🔔 *Nuevo pedido para armar*\n\n` +
        `Pedido #${orderId}\n` +
        `Producto: ${productName}\n` +
        `Cantidad: ${order.quantity} maple(s)\n` +
        `Cliente: ${customer?.firstName || customer?.contact || 'N/A'}\n\n` +
        `Por favor ingresá al panel para confirmar cuando esté listo.`;
      await this._send(operator, msg);
    } else if (role === 'repartidor') {
      const deliveryTime = order.estimatedDelivery
        ? `\nEntrega estimada: ${this._formatDateTime(order.estimatedDelivery)}`
        : '';

      const locationUrl = customer?.location?.googleMapsUrl
        ? `\n📎 Mapa: ${customer.location.googleMapsUrl}`
        : '';

      const msg =
        `🔔 *Nuevo pedido para entregar*\n\n` +
        `Pedido #${orderId}\n` +
        `Producto: ${productName} (x${order.quantity})\n` +
        `Cliente: ${customer?.firstName || customer?.contact || 'N/A'}\n` +
        `📍 Dirección: ${address}${locationUrl}${deliveryTime}\n\n` +
        `Por favor ingresá al panel para confirmar cuando hayas entregado.`;
      await this._send(operator, msg);
    }
  }

  /**
   * 🔔 Notify an operator that their assignment was removed/reassigned
   * @param {object} operator - User model instance
   * @param {object} order    - Order model instance
   * @param {string} role     - 'armador' or 'repartidor'
   */
  async sendOperatorUnassigned(operator, order, role) {
    const roleLabel = role === 'armador' ? 'armado' : 'entrega';
    const msg =
      `ℹ️ Se reasignó el ${roleLabel} del pedido #${order.id.slice(0, 8).toUpperCase()}.\n\n` +
      `Ya no estás a cargo de este pedido.`;
    await this._send(operator, msg);
  }

  /** @private — Sends a WhatsApp text message */
  async _send(user, text) {
    if (user.channel !== 'whatsapp') {
      logger.debug(`Notification skipped — user ${user.id} is on channel ${user.channel}`);
      return;
    }
    try {
      await metaService.sendWhatsAppMessage(
        env.META_PHONE_NUMBER_ID,
        user.contact,
        text,
      );
      logger.info(`Notification sent to ${user.contact}`);
    } catch (err) {
      logger.error(`Failed to send notification to ${user.contact}: ${err.message}`);
      throw err;
    }
  }

  /** @private */
  _formatDeliveryDate(date) {
    return new Date(date).toLocaleString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }

  /** @private */
  _formatDateTime(date) {
    return new Date(date).toLocaleString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
  }
}

module.exports = new NotificationService();
