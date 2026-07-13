const { UserSubscription, Subscription, User, Order } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const subscriptionLifecycleService = require('../services/subscriptionLifecycleService');

/**
 * Subscription Controller
 * CRM endpoints for administering active UserSubscriptions.
 */
const subscriptionController = {
  /**
   * GET /api/user-subscriptions
   * List all UserSubscriptions. Filter by ?status=active|paused|expired|cancelled|pending_payment
   */
  async listUserSubscriptions(req, res, next) {
    try {
      const { status } = req.query;
      const where = {};
      if (status) where.status = status;

      const userSubscriptions = await UserSubscription.findAll({
        where,
        include: [
          {
            association: 'user',
            attributes: ['id', 'firstName', 'lastName', 'contact', 'address'],
          },
          {
            association: 'plan',
            attributes: ['id', 'name', 'price', 'frequency', 'maplesQuantity'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      return res.json({ success: true, data: userSubscriptions });
    } catch (err) {
      logger.error(`listUserSubscriptions error: ${err.message}`);
      next(err);
    }
  },

  /**
   * GET /api/user-subscriptions/:id
   * Detail of a single UserSubscription with delivery order history.
   */
  async getUserSubscription(req, res, next) {
    try {
      const { id } = req.params;

      const userSub = await UserSubscription.findByPk(id, {
        include: [
          {
            association: 'user',
            attributes: ['id', 'firstName', 'lastName', 'contact', 'address', 'location'],
          },
          {
            association: 'plan',
          },
        ],
      });

      if (!userSub) {
        return next(new AppError('Suscripción no encontrada.', 404));
      }

      // Fetch delivery orders linked to this subscription
      const deliveryOrderIds = userSub.metadata?.deliveryOrderIds || [];
      const deliveryOrders = deliveryOrderIds.length
        ? await Order.findAll({
            where: { id: { [Op.in]: deliveryOrderIds } },
            attributes: ['id', 'status', 'quantity', 'estimatedDelivery', 'deliveredAt', 'createdAt'],
            order: [['created_at', 'DESC']],
          })
        : [];

      return res.json({
        success: true,
        data: {
          ...userSub.toJSON(),
          deliveryOrders,
        },
      });
    } catch (err) {
      logger.error(`getUserSubscription error: ${err.message}`);
      next(err);
    }
  },

  /**
   * GET /api/clients/:clientId/subscriptions
   * All subscriptions for a specific client.
   */
  async getSubscriptionsByClient(req, res, next) {
    try {
      const { clientId } = req.params;

      const user = await User.findByPk(clientId);
      if (!user) return next(new AppError('Cliente no encontrado.', 404));

      const userSubscriptions = await UserSubscription.findAll({
        where: { userId: clientId },
        include: [{ association: 'plan' }],
        order: [['created_at', 'DESC']],
      });

      return res.json({ success: true, data: userSubscriptions });
    } catch (err) {
      logger.error(`getSubscriptionsByClient error: ${err.message}`);
      next(err);
    }
  },

  /**
   * PUT /api/user-subscriptions/:id/cancel
   * Cancel a UserSubscription and notify the customer.
   */
  async cancelUserSubscription(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const userSub = await subscriptionLifecycleService.cancelSubscription(id, notes);
      return res.json({ success: true, message: 'Suscripción cancelada exitosamente.', data: userSub });
    } catch (err) {
      logger.error(`cancelUserSubscription error: ${err.message}`);
      next(err);
    }
  },

  /**
   * PUT /api/user-subscriptions/:id/pause
   * Pause a UserSubscription (stops weekly delivery generation).
   */
  async pauseUserSubscription(req, res, next) {
    try {
      const { id } = req.params;
      const userSub = await subscriptionLifecycleService.pauseSubscription(id);
      return res.json({ success: true, message: 'Suscripción pausada.', data: userSub });
    } catch (err) {
      logger.error(`pauseUserSubscription error: ${err.message}`);
      next(err);
    }
  },

  /**
   * PUT /api/user-subscriptions/:id/resume
   * Resume a paused UserSubscription.
   */
  async resumeUserSubscription(req, res, next) {
    try {
      const { id } = req.params;
      const userSub = await subscriptionLifecycleService.resumeSubscription(id);
      return res.json({ success: true, message: 'Suscripción reactivada.', data: userSub });
    } catch (err) {
      logger.error(`resumeUserSubscription error: ${err.message}`);
      next(err);
    }
  },

  /**
   * POST /api/user-subscriptions/:id/force-renew
   * Manually generate a renewal payment order (e.g. if MP webhook failed).
   */
  async forceRenewSubscription(req, res, next) {
    try {
      const { id } = req.params;

      const userSub = await UserSubscription.findByPk(id, {
        include: [{ association: 'user' }, { association: 'plan' }],
      });

      if (!userSub) return next(new AppError('Suscripción no encontrada.', 404));
      if (!['active', 'expired'].includes(userSub.status)) {
        return next(new AppError(`No se puede generar renovación para una suscripción en estado "${userSub.status}".`, 400));
      }

      const order = await subscriptionLifecycleService.generateRenewalOrder(userSub);
      return res.status(201).json({
        success: true,
        message: 'Orden de renovación generada y link de pago enviado al cliente.',
        data: { orderId: order.id },
      });
    } catch (err) {
      logger.error(`forceRenewSubscription error: ${err.message}`);
      next(err);
    }
  },

  /**
   * POST /api/user-subscriptions/trigger-weekly-deliveries
   * Manually trigger the weekly delivery generation job (admin only, for testing or emergencies).
   */
  async triggerWeeklyDeliveries(req, res, next) {
    try {
      logger.info('[CRM] Manual trigger: generateWeeklyDeliveries');
      const orders = await subscriptionLifecycleService.generateWeeklyDeliveries();
      return res.json({
        success: true,
        message: `Job ejecutado. ${orders.length} pedido(s) de entrega generado(s).`,
        data: { generatedOrderCount: orders.length, orderIds: orders.map((o) => o.id) },
      });
    } catch (err) {
      logger.error(`triggerWeeklyDeliveries error: ${err.message}`);
      next(err);
    }
  },
};

module.exports = subscriptionController;
