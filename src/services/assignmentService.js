const { Order, User, OrderAssignment, Product, Subscription } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const notificationService = require('./notificationService');

/**
 * Assignment Service
 * Manages the assignment of operators (armadores & repartidores) to orders
 * and orchestrates status transitions with bidirectional notifications.
 */
class AssignmentService {
  /**
   * Assign an armador to a paid order.
   * - Validates order is in 'paid' status
   * - Validates operator exists and has role 'operador'
   * - Creates OrderAssignment record
   * - Transitions order status to 'preparing'
   * - Notifies armador and customer via WhatsApp
   *
   * @param {string} orderId
   * @param {string} operatorId
   * @returns {Promise<OrderAssignment>}
   */
  async assignArmador(orderId, operatorId) {
    const order = await this._loadOrder(orderId);
    const operator = await this._validateOperator(operatorId);

    if (order.status !== 'paid') {
      throw new AppError(
        `No se puede asignar armador: el pedido está en estado "${order.status}". Debe estar "paid".`,
        400,
      );
    }

    // Check if there's already an active armador assignment
    const existing = await OrderAssignment.findOne({
      where: {
        orderId,
        role: 'armador',
        status: { [Op.ne]: 'completed' },
      },
    });

    if (existing) {
      throw new AppError(
        'Este pedido ya tiene un armador asignado. Usá reasignar para cambiarlo.',
        400,
      );
    }

    // Create assignment
    const assignment = await OrderAssignment.create({
      orderId,
      operatorId,
      role: 'armador',
      status: 'assigned',
      assignedAt: new Date(),
    });

    // Transition order to 'preparing'
    await order.update({ status: 'preparing' });

    // Notify operator (armador)
    try {
      await notificationService.sendOperatorAssignment(operator, order, 'armador');
    } catch (err) {
      logger.warn(`Failed to notify armador ${operatorId}: ${err.message}`);
    }

    // Notify customer
    try {
      await notificationService.sendOrderPreparing(order.user, order);
    } catch (err) {
      logger.warn(`Failed to notify customer for order ${orderId}: ${err.message}`);
    }

    logger.info('Armador assigned', { orderId, operatorId, assignmentId: assignment.id });
    return assignment;
  }

  /**
   * Armador marks the order as assembled (complete).
   * - Validates the assignment belongs to this operator
   * - Transitions assignment to 'completed'
   * - Transitions order status to 'ready'
   * - Notifies customer via WhatsApp
   *
   * @param {string} orderId
   * @param {string} operatorId
   * @param {string} [notes]
   * @returns {Promise<OrderAssignment>}
   */
  async completeArmado(orderId, operatorId, notes = null) {
    const assignment = await this._findActiveAssignment(orderId, operatorId, 'armador');
    const order = await this._loadOrder(orderId);

    if (!['preparing'].includes(order.status)) {
      throw new AppError(
        `No se puede completar el armado: el pedido está en estado "${order.status}".`,
        400,
      );
    }

    // Complete assignment
    await assignment.update({
      status: 'completed',
      completedAt: new Date(),
      notes: notes || assignment.notes,
    });

    // Transition order to 'ready'
    await order.update({ status: 'ready' });

    // Notify customer
    try {
      await notificationService.sendOrderReady(order.user, order);
    } catch (err) {
      logger.warn(`Failed to notify customer for order ${orderId}: ${err.message}`);
    }

    // Notify all repartidores about the order ready for delivery + consolidated pending
    try {
      await notificationService.notifyRepartidoresOrderReady(order);
    } catch (err) {
      logger.warn(`Failed to notify repartidores for order ${orderId}: ${err.message}`);
    }

    logger.info('Armado completed', { orderId, operatorId });
    return assignment;
  }

  /**
   * Assign a repartidor to a ready order.
   * - Validates order is in 'ready' status
   * - Creates OrderAssignment record
   * - Transitions order status to 'delivering'
   * - Notifies repartidor and customer via WhatsApp
   *
   * @param {string} orderId
   * @param {string} operatorId
   * @returns {Promise<OrderAssignment>}
   */
  async assignRepartidor(orderId, operatorId) {
    const order = await this._loadOrder(orderId);
    const operator = await this._validateOperator(operatorId);

    if (order.status !== 'ready') {
      throw new AppError(
        `No se puede asignar repartidor: el pedido está en estado "${order.status}". Debe estar "ready".`,
        400,
      );
    }

    // Check if there's already an active repartidor assignment
    const existing = await OrderAssignment.findOne({
      where: {
        orderId,
        role: 'repartidor',
        status: { [Op.ne]: 'completed' },
      },
    });

    if (existing) {
      throw new AppError(
        'Este pedido ya tiene un repartidor asignado. Usá reasignar para cambiarlo.',
        400,
      );
    }

    // Create assignment
    const assignment = await OrderAssignment.create({
      orderId,
      operatorId,
      role: 'repartidor',
      status: 'assigned',
      assignedAt: new Date(),
    });

    // Transition order to 'delivering'
    await order.update({ status: 'delivering' });

    // Notify operator (repartidor)
    try {
      await notificationService.sendOperatorAssignment(operator, order, 'repartidor');
    } catch (err) {
      logger.warn(`Failed to notify repartidor ${operatorId}: ${err.message}`);
    }

    // Notify customer
    try {
      await notificationService.sendOrderOutForDelivery(order.user, order);
    } catch (err) {
      logger.warn(`Failed to notify customer for order ${orderId}: ${err.message}`);
    }

    logger.info('Repartidor assigned', { orderId, operatorId, assignmentId: assignment.id });
    return assignment;
  }

  /**
   * Repartidor confirms delivery.
   * - Validates the assignment belongs to this operator
   * - Transitions assignment to 'completed'
   * - Transitions order status to 'delivered'
   * - Notifies customer via WhatsApp
   *
   * @param {string} orderId
   * @param {string} operatorId
   * @param {string} [notes]
   * @returns {Promise<OrderAssignment>}
   */
  async completeEntrega(orderId, operatorId, notes = null) {
    const assignment = await this._findActiveAssignment(orderId, operatorId, 'repartidor');
    const order = await this._loadOrder(orderId);

    if (!['delivering'].includes(order.status)) {
      throw new AppError(
        `No se puede completar la entrega: el pedido está en estado "${order.status}".`,
        400,
      );
    }

    // Complete assignment
    await assignment.update({
      status: 'completed',
      completedAt: new Date(),
      notes: notes || assignment.notes,
    });

    // Transition order to 'delivered'
    await order.update({
      status: 'delivered',
      deliveredAt: new Date(),
    });

    // Notify customer
    try {
      await notificationService.sendOrderDelivered(order.user, order);
    } catch (err) {
      logger.warn(`Failed to notify customer for order ${orderId}: ${err.message}`);
    }

    logger.info('Entrega completed', { orderId, operatorId });
    return assignment;
  }

  /**
   * Self-assign: operator takes an available order.
   * @param {string} orderId
   * @param {string} operatorId
   * @param {string} role - 'armador' or 'repartidor'
   * @returns {Promise<OrderAssignment>}
   */
  async selfAssign(orderId, operatorId, role) {
    if (role === 'armador') {
      return this.assignArmador(orderId, operatorId);
    } else if (role === 'repartidor') {
      return this.assignRepartidor(orderId, operatorId);
    }
    throw new AppError(`Rol inválido: ${role}. Debe ser "armador" o "repartidor".`, 400);
  }

  /**
   * Complete the consolidated assembly of all paid orders.
   * - Finds all orders in 'paid' status without an active armador assignment
   * - Creates a completed armador assignment for each
   * - Transitions all orders to 'ready'
   * - Notifies repartidores about the new ready orders
   * - Notifies each customer that their order is ready
   *
   * @param {string} operatorId - The armador's user ID
   * @returns {Promise<Order[]>} - The list of processed orders
   */
  async completeConsolidado(operatorId) {
    // Get all paid orders without an active armador
    const orders = await this.getPendingAssignments('armador');

    if (!orders.length) {
      throw new AppError('No hay pedidos pendientes para armar.', 400);
    }

    const processedOrders = [];

    for (const order of orders) {
      // Create completed armador assignment
      await OrderAssignment.create({
        orderId: order.id,
        operatorId,
        role: 'armador',
        status: 'completed',
        assignedAt: new Date(),
        completedAt: new Date(),
      });

      // Transition order to 'ready'
      await order.update({ status: 'ready' });

      // Notify customer that order is ready
      try {
        await notificationService.sendOrderReady(order.user, order);
      } catch (err) {
        logger.warn(`Failed to notify customer for order ${order.id}: ${err.message}`);
      }

      processedOrders.push(order);
    }

    // Notify all repartidores about the consolidated ready orders
    try {
      // Use the last processed order to trigger the consolidated notification
      const lastOrder = processedOrders[processedOrders.length - 1];
      await notificationService.notifyRepartidoresOrderReady(lastOrder);
    } catch (err) {
      logger.warn(`Failed to notify repartidores: ${err.message}`);
    }

    logger.info('Consolidado completed', { operatorId, orderCount: processedOrders.length });
    return processedOrders;
  }

  /**
   * Get all active assignments for a specific operator.
   * @param {string} operatorId
   * @returns {Promise<OrderAssignment[]>}
   */
  async getAssignmentsByOperator(operatorId) {
    return OrderAssignment.findAll({
      where: {
        operatorId,
        status: { [Op.ne]: 'completed' },
      },
      include: [
        {
          association: 'order',
          include: [
            { association: 'user' },
            { association: 'product' },
            { association: 'subscription' },
          ],
        },
      ],
      order: [['assigned_at', 'DESC']],
    });
  }

  /**
   * Get all assignments for an operator (including completed).
   * @param {string} operatorId
   * @param {number} [limit=50]
   * @returns {Promise<OrderAssignment[]>}
   */
  async getAllAssignmentsByOperator(operatorId, limit = 50) {
    return OrderAssignment.findAll({
      where: { operatorId },
      include: [
        {
          association: 'order',
          include: [
            { association: 'user' },
            { association: 'product' },
            { association: 'subscription' },
          ],
        },
      ],
      order: [['assigned_at', 'DESC']],
      limit,
    });
  }

  /**
   * Get orders pending assignment for a given role.
   * - 'armador': orders in 'paid' status without an active armador
   * - 'repartidor': orders in 'ready' status without an active repartidor
   *
   * @param {string} role - 'armador' or 'repartidor'
   * @returns {Promise<Order[]>}
   */
  async getPendingAssignments(role) {
    const targetStatus = role === 'armador' ? 'paid' : 'ready';

    const orders = await Order.findAll({
      where: { status: targetStatus },
      include: [
        { association: 'user' },
        { association: 'product' },
        { association: 'subscription' },
        {
          association: 'assignments',
          required: false,
          where: {
            role,
            status: { [Op.ne]: 'completed' },
          },
        },
      ],
      order: [['created_at', 'ASC']],
    });

    // Filter to only orders without an active assignment for this role
    return orders.filter((o) => !o.assignments || o.assignments.length === 0);
  }

  /**
   * Get the assignment history for a specific order.
   * @param {string} orderId
   * @returns {Promise<OrderAssignment[]>}
   */
  async getOrderAssignments(orderId) {
    return OrderAssignment.findAll({
      where: { orderId },
      include: [
        {
          association: 'operator',
          attributes: ['id', 'firstName', 'lastName', 'contact'],
        },
      ],
      order: [['assigned_at', 'ASC']],
    });
  }

  // ─── Private helpers ──────────────────────────────────────

  /**
   * Load an order with all required associations.
   * @private
   */
  async _loadOrder(orderId) {
    const order = await Order.findByPk(orderId, {
      include: [
        { association: 'user' },
        { association: 'product' },
        { association: 'subscription' },
      ],
    });

    if (!order) {
      throw new AppError('Pedido no encontrado.', 404);
    }

    return order;
  }

  /**
   * Validate that a user exists, is active, and has the 'operador' role.
   * @private
   */
  async _validateOperator(operatorId) {
    const operator = await User.findByPk(operatorId);

    if (!operator) {
      throw new AppError('Operador no encontrado.', 404);
    }

    if (operator.role !== 'operador' && operator.role !== 'administrador') {
      throw new AppError('El usuario no tiene rol de operador.', 400);
    }

    if (!operator.isActive) {
      throw new AppError('El operador está inactivo.', 400);
    }

    return operator;
  }

  /**
   * Find an active (non-completed) assignment for a given order, operator and role.
   * @private
   */
  async _findActiveAssignment(orderId, operatorId, role) {
    const assignment = await OrderAssignment.findOne({
      where: {
        orderId,
        operatorId,
        role,
        status: { [Op.ne]: 'completed' },
      },
    });

    if (!assignment) {
      throw new AppError(
        `No tenés una asignación activa como ${role} para este pedido.`,
        404,
      );
    }

    return assignment;
  }
}

module.exports = new AssignmentService();
