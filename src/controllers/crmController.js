const { OAuth2Client } = require('google-auth-library');
const logger = require('../config/logger');
const env = require('../config/env');
const {
  User, Product, Subscription, Order, Payment, DeliveryZone, OperatingHours,
} = require('../models');
const orderService = require('../services/orderService');

// ─────────────────────────────────────────────────────────────
// AUTH — Google OAuth
// ─────────────────────────────────────────────────────────────

const googleOAuthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Body: { idToken: <Google ID token from React frontend> }
 * Verifies the Google token, finds the matching staff user by googleEmail in metadata.
 */
const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'idToken requerido.' });
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email } = payload;

    const { Op } = require('sequelize');
    const matchedUser = await User.findOne({
      where: {
        isActive: true,
        metadata: { [Op.contains]: { googleEmail: email } },
      },
    });

    if (!matchedUser || !['operador', 'administrador'].includes(matchedUser.role)) {
      logger.warn(`Unauthorized Google auth attempt: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta de Google no tiene acceso al panel.',
      });
    }

    // Return user info — the React app stores the Google token as Bearer for future requests
    logger.info(`Google auth success for ${email} (${matchedUser.role})`);
    res.json({
      success: true,
      user: {
        id: matchedUser.id,
        email,
        role: matchedUser.role,
        firstName: matchedUser.firstName || payload.given_name,
        picture: payload.picture,
      },
    });
  } catch (error) {
    logger.error(`Google auth error: ${error.message}`);
    res.status(401).json({ success: false, message: 'Token de Google inválido.' });
  }
};

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────

const getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({ order: [['created_at', 'ASC']] });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    await product.update(req.body);
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    await product.update({ isActive: false });
    res.json({ success: true, message: 'Producto desactivado.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────

const getSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.findAll({ order: [['created_at', 'ASC']] });
    res.json({ success: true, data: subs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSubscription = async (req, res) => {
  try {
    const sub = await Subscription.create(req.body);
    res.status(201).json({ success: true, data: sub });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Suscripción no encontrada.' });
    await sub.update(req.body);
    res.json({ success: true, data: sub });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────

const getOrders = async (req, res) => {
  try {
    const { status, date } = req.query;
    let orders;

    if (status) {
      orders = await orderService.getOrdersByStatus(status);
    } else {
      orders = await Order.findAll({
        include: [
          { association: 'user' },
          { association: 'product' },
          { association: 'subscription' },
          { association: 'payment' },
        ],
        order: [['created_at', 'DESC']],
        limit: 200,
      });
    }

    res.json({ success: true, data: orders, count: orders.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { association: 'user' },
        { association: 'product' },
        { association: 'subscription' },
        { association: 'payment' },
      ],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status requerido.' });
    const order = await orderService.updateOrderStatus(req.params.id, status, notes);
    res.json({ success: true, data: order });
  } catch (error) {
    logger.error(`Update order status error: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getTodayDeliveries = async (req, res) => {
  try {
    const orders = await orderService.getTodayDeliveries();
    res.json({ success: true, data: orders, count: orders.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────────────────────

const getClients = async (req, res) => {
  try {
    const clients = await User.findAll({
      where: { role: 'cliente', isActive: true },
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data: clients, count: clients.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getClient = async (req, res) => {
  try {
    const client = await User.findByPk(req.params.id, {
      include: [{ association: 'orders', include: [{ association: 'payment' }] }],
    });
    if (!client) return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// OPERATORS (admin only)
// ─────────────────────────────────────────────────────────────

const getOperators = async (req, res) => {
  try {
    const operators = await User.findAll({ where: { role: 'operador' } });
    res.json({ success: true, data: operators });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createOperator = async (req, res) => {
  try {
    const {
      contact, firstName, lastName, password,
    } = req.body;
    const operator = await User.create({
      contact,
      channel: 'whatsapp',
      role: 'operador',
      firstName,
      lastName,
      metadata: { password }, // MVP: store plain. Use bcrypt in production.
    });
    res.status(201).json({ success: true, data: { id: operator.id, contact: operator.contact } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const getOperatingHours = async (req, res) => {
  try {
    const hours = await OperatingHours.findAll({ order: [['day_of_week', 'ASC']] });
    res.json({ success: true, data: hours });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateOperatingHours = async (req, res) => {
  try {
    const {
      dayOfWeek, openTime, closeTime, deliveryStartTime, deliveryEndTime, isActive,
    } = req.body;
    const [record, created] = await OperatingHours.findOrCreate({
      where: { dayOfWeek },
      defaults: {
        dayOfWeek, openTime, closeTime, deliveryStartTime, deliveryEndTime, isActive,
      },
    });
    if (!created) {
      await record.update({
        openTime, closeTime, deliveryStartTime, deliveryEndTime, isActive,
      });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getDeliveryZones = async (req, res) => {
  try {
    const zones = await DeliveryZone.findAll({ order: [['name', 'ASC']] });
    res.json({ success: true, data: zones });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createDeliveryZone = async (req, res) => {
  try {
    const zone = await DeliveryZone.create(req.body);
    res.status(201).json({ success: true, data: zone });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateDeliveryZone = async (req, res) => {
  try {
    const zone = await DeliveryZone.findByPk(req.params.id);
    if (!zone) return res.status(404).json({ success: false, message: 'Zona no encontrada.' });
    await zone.update(req.body);
    res.json({ success: true, data: zone });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────

const getReportSummary = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalClients, todayOrders, pendingPayment, inDelivery, deliveredToday] = await Promise.all([
      User.count({ where: { role: 'cliente', isActive: true } }),
      Order.count({ where: { createdAt: { [Op.gte]: today } } }),
      Order.count({ where: { status: 'pending_payment' } }),
      Order.count({ where: { status: { [Op.in]: ['preparing', 'ready', 'delivering'] } } }),
      Order.count({ where: { status: 'delivered', deliveredAt: { [Op.gte]: today } } }),
    ]);

    res.json({
      success: true,
      data: {
        totalClients,
        todayOrders,
        pendingPayment,
        inDelivery,
        deliveredToday,
        date: today.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  googleAuth,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getSubscriptions,
  createSubscription,
  updateSubscription,
  getOrders,
  getOrder,
  updateOrderStatus,
  getTodayDeliveries,
  getClients,
  getClient,
  getOperators,
  createOperator,
  getOperatingHours,
  updateOperatingHours,
  getDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  getReportSummary,
};
