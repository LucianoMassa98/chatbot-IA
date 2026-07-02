const logger = require('../config/logger');
const assignmentService = require('../services/assignmentService');

/**
 * Assignment Controller
 * Handles HTTP requests for operator order assignments.
 */

// ─── Assignment operations ───────────────────────────────

/**
 * POST /api/orders/:id/assign
 * Body: { operatorId, role: 'armador' | 'repartidor' }
 * Assigns an operator to an order.
 */
const assignOperator = async (req, res) => {
  try {
    const { operatorId, role } = req.body;
    const orderId = req.params.id;

    if (!operatorId || !role) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren operatorId y role (armador/repartidor).',
      });
    }

    if (!['armador', 'repartidor'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'role debe ser "armador" o "repartidor".',
      });
    }

    let assignment;
    if (role === 'armador') {
      assignment = await assignmentService.assignArmador(orderId, operatorId);
    } else {
      assignment = await assignmentService.assignRepartidor(orderId, operatorId);
    }

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    logger.error(`Assign operator error: ${error.message}`);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/orders/:id/self-assign
 * Body: { role: 'armador' | 'repartidor' }
 * Operator self-assigns to an order (uses authenticated user ID).
 */
const selfAssign = async (req, res) => {
  try {
    const { role } = req.body;
    const orderId = req.params.id;
    const operatorId = req.admin.id; // From auth middleware

    if (!role || !['armador', 'repartidor'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'role debe ser "armador" o "repartidor".',
      });
    }

    const assignment = await assignmentService.selfAssign(orderId, operatorId, role);
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    logger.error(`Self-assign error: ${error.message}`);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/orders/:id/complete-armado
 * Body: { notes? }
 * Armador confirms the order has been assembled.
 */
const completeArmado = async (req, res) => {
  try {
    const orderId = req.params.id;
    const operatorId = req.admin.id;
    const { notes } = req.body;

    const assignment = await assignmentService.completeArmado(orderId, operatorId, notes);
    res.json({ success: true, data: assignment });
  } catch (error) {
    logger.error(`Complete armado error: ${error.message}`);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/orders/:id/complete-entrega
 * Body: { notes? }
 * Repartidor confirms the order has been delivered.
 */
const completeEntrega = async (req, res) => {
  try {
    const orderId = req.params.id;
    const operatorId = req.admin.id;
    const { notes } = req.body;

    const assignment = await assignmentService.completeEntrega(orderId, operatorId, notes);
    res.json({ success: true, data: assignment });
  } catch (error) {
    logger.error(`Complete entrega error: ${error.message}`);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ─── Query operations ────────────────────────────────────

/**
 * GET /api/my-assignments
 * Returns active assignments for the authenticated operator.
 */
const getMyAssignments = async (req, res) => {
  try {
    const operatorId = req.admin.id;
    const assignments = await assignmentService.getAssignmentsByOperator(operatorId);
    res.json({ success: true, data: assignments, count: assignments.length });
  } catch (error) {
    logger.error(`Get my assignments error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/my-assignments/history
 * Returns all assignments (including completed) for the authenticated operator.
 */
const getMyAssignmentsHistory = async (req, res) => {
  try {
    const operatorId = req.admin.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const assignments = await assignmentService.getAllAssignmentsByOperator(operatorId, limit);
    res.json({ success: true, data: assignments, count: assignments.length });
  } catch (error) {
    logger.error(`Get assignment history error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/pending-assignment?role=armador|repartidor
 * Returns orders that need an operator assigned for the given role.
 */
const getPendingAssignments = async (req, res) => {
  try {
    const { role } = req.query;

    if (!role || !['armador', 'repartidor'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Query param role debe ser "armador" o "repartidor".',
      });
    }

    const orders = await assignmentService.getPendingAssignments(role);
    res.json({ success: true, data: orders, count: orders.length });
  } catch (error) {
    logger.error(`Get pending assignments error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/orders/:id/assignments
 * Returns the full assignment history for a specific order.
 */
const getOrderAssignments = async (req, res) => {
  try {
    const assignments = await assignmentService.getOrderAssignments(req.params.id);
    res.json({ success: true, data: assignments, count: assignments.length });
  } catch (error) {
    logger.error(`Get order assignments error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  assignOperator,
  selfAssign,
  completeArmado,
  completeEntrega,
  getMyAssignments,
  getMyAssignmentsHistory,
  getPendingAssignments,
  getOrderAssignments,
};
