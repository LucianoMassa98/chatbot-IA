const metaService = require('./metaService');
const logger = require('../config/logger');
const env = require('../config/env');
const { User, Order, OrderAssignment } = require('../models');
const { Op } = require('sequelize');

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

  // ─── Dynamic consolidated notifications ─────────────────

  /**
   * Notify all active armadores about a new paid order and send a
   * consolidated list of all orders pending assembly.
   * @param {object} order - Order model instance (with user, product/subscription loaded)
   */
  async notifyArmadoresNewOrder(order) {
    const armadores = await User.findAll({
      where: { role: 'armador', isActive: true },
    });

    if (!armadores.length) {
      logger.info('No active armadores to notify');
      return;
    }

    const productName = order.product?.name || order.subscription?.name || 'Pedido';

    const consolidado = await this._buildConsolidadoArmador();

    const msg =
      `📦 *Actualización de pedidos*\n\n` +
      `Producto: ${productName}  x ${order.quantity}\n\n` +
      consolidado +
      `\nIngresá al *PANEL* para tomar un pedido.`;

    for (const armador of armadores) {
      try {
        await this._send(armador, msg);
      } catch (err) {
        logger.warn(`Failed to notify armador ${armador.id}: ${err.message}`);
      }
    }
  }

  /**
   * Notify all active repartidores about a newly ready order and send a
   * consolidated list of all orders pending delivery.
   * @param {object} order - Order model instance (with user, product/subscription loaded)
   */
  async notifyRepartidoresOrderReady(order) {
    const repartidores = await User.findAll({
      where: { role: 'repartidor', isActive: true },
    });

    if (!repartidores.length) {
      logger.info('No active repartidores to notify');
      return;
    }

    const productName = order.product?.name || order.subscription?.name || 'Pedido';
    const customer = order.user?.firstName || order.user?.contact || 'N/A';
    const orderId = order.id.slice(0, 8).toUpperCase();
    const address = order.deliveryAddress || order.user?.address || 'Sin dirección';
    const mapUrl = order.user?.location?.googleMapsUrl
      ? `\n📎 Mapa: ${order.user.location.googleMapsUrl}`
      : '';

    const consolidado = await this._buildConsolidadoRepartidor();

    const msg =
      `🚗 *Nuevo pedido listo para entregar*\n\n` +
      `Pedido #${orderId}\n` +
      `Producto: ${productName} (x${order.quantity})\n` +
      `Cliente: ${customer}\n` +
      `📍 ${address}${mapUrl}\n\n` +
      consolidado +
      `\nIngresá al *PANEL* para tomar una entrega.`;

    for (const repartidor of repartidores) {
      try {
        await this._send(repartidor, msg);
      } catch (err) {
        logger.warn(`Failed to notify repartidor ${repartidor.id}: ${err.message}`);
      }
    }
  }

  /**
   * Build a consolidated text of all paid orders without an active armador assignment.
   * @private
   * @returns {Promise<string>}
   */
  async _buildConsolidadoArmador() {
    const orders = await Order.findAll({
      where: { status: 'paid' },
      include: [
        { association: 'user' },
        { association: 'product' },
        { association: 'subscription' },
        {
          association: 'assignments',
          required: false,
          where: { role: 'armador', status: { [Op.ne]: 'completed' } },
        },
      ],
      order: [['created_at', 'ASC']],
    });

    // Filter to only orders without an active armador assignment
    const pending = orders.filter((o) => !o.assignments || o.assignments.length === 0);

    if (!pending.length) {
      return '📋 No hay pedidos pendientes por armar en este momento.\n';
    }

    // Group by product name and sum quantities
    const productMap = {};
    let totalProducts = 0;
    for (const o of pending) {
      const name = o.product?.name || o.subscription?.name || 'Pedido';
      const qty = o.quantity || 1;
      productMap[name] = (productMap[name] || 0) + qty;
      totalProducts += qty;
    }

    const list = Object.entries(productMap)
      .map(([name, qty], i) => `${i + 1}. ${name} (x${qty})`)
      .join('\n');

    return (
      `📋 *Consolidado de productos por armar:*\n${list}\n\n` +
      `📊 Total: ${totalProducts} producto${totalProducts > 1 ? 's' : ''}\n`
    );
  }

  /**
   * Build a consolidated text of all ready orders without an active repartidor assignment.
   * @private
   * @returns {Promise<string>}
   */
  async _buildConsolidadoRepartidor() {
    const orders = await Order.findAll({
      where: { status: 'ready' },
      include: [
        { association: 'user' },
        { association: 'product' },
        { association: 'subscription' },
        {
          association: 'assignments',
          required: false,
          where: { role: 'repartidor', status: { [Op.ne]: 'completed' } },
        },
      ],
      order: [['created_at', 'ASC']],
    });

    // Filter to only orders without an active repartidor assignment
    const pending = orders.filter((o) => !o.assignments || o.assignments.length === 0);

    if (!pending.length) {
      return '📋 No hay entregas pendientes en este momento.\n';
    }

    let totalMaples = 0;
    const list = pending.map((o, i) => {
      const name = o.product?.name || o.subscription?.name || 'Pedido';
      const customer = o.user?.firstName || o.user?.contact || 'N/A';
      const addr = o.deliveryAddress || o.user?.address || 'Sin dirección';
      totalMaples += o.quantity || 1;
      return `${i + 1}. #${o.id.slice(0, 8).toUpperCase()} — ${name} (x${o.quantity}) — ${customer}\n   📍 ${addr}`;
    }).join('\n');

    return (
      `📋 *Consolidado de entregas pendientes:*\n${list}\n\n` +
      `📊 Total: ${pending.length} entrega${pending.length > 1 ? 's' : ''}, ${totalMaples} maple${totalMaples > 1 ? 's' : ''}.\n`
    );
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
