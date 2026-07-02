const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const crm = require('../controllers/crmController');
const assignments = require('../controllers/assignmentController');

/**
 * @swagger
 * tags:
 *   name: Operator
 *   description: Operations for CRM Operators and Admins (Orders, Clients, and Dashboards)
 */

// All operator routes require authentication (both operators and admins can access)
router.use(authMiddleware);

// ─── Dashboard / Reports ──────────────────────────────────

/**
 * @swagger
 * /api/reports/summary:
 *   get:
 *     summary: Obtener resumen estadístico del Dashboard
 *     description: Retorna métricas generales como clientes totales, pedidos del día, pagos pendientes, pedidos en reparto y entregados.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen estadístico obtenido con éxito.
 *       401:
 *         description: No autorizado.
 */
router.get('/reports/summary', crm.getReportSummary);

/**
 * @swagger
 * /api/reports/deliveries:
 *   get:
 *     summary: Obtener los despachos de hoy
 *     description: Lista todos los pedidos que deben entregarse el día de la fecha.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de despachos obtenida con éxito.
 */
router.get('/reports/deliveries', crm.getTodayDeliveries);

// ─── Orders ───────────────────────────────────────────────

/**
 * @swagger
 * /api/orders/pending-assignment:
 *   get:
 *     summary: Listar pedidos pendientes de asignación
 *     description: Retorna pedidos que necesitan un operador asignado. Filtrar por role (armador o repartidor).
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [armador, repartidor]
 *         description: Rol del operador a asignar.
 *     responses:
 *       200:
 *         description: Lista de pedidos pendientes obtenida con éxito.
 *       400:
 *         description: Parámetro role inválido.
 */
router.get('/orders/pending-assignment', assignments.getPendingAssignments);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Listar pedidos
 *     description: Retorna los últimos 200 pedidos de la base de datos. Permite filtrar por estado a través de query params.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtrar por estado del pedido (ej. pending_payment, preparing, delivering, delivered).
 *     responses:
 *       200:
 *         description: Lista de pedidos obtenida con éxito.
 */
router.get('/orders', crm.getOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Obtener detalles de un pedido
 *     description: Devuelve la información completa de un pedido específico por su ID, incluyendo el cliente, producto, suscripción y pago asociado.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del pedido.
 *     responses:
 *       200:
 *         description: Detalles del pedido obtenidos con éxito.
 *       404:
 *         description: Pedido no encontrado.
 */
router.get('/orders/:id', crm.getOrder);

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Actualizar estado de un pedido
 *     description: Modifica el estado del pedido e incluye notas opcionales en el historial de cambios.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del pedido.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: Nuevo estado del pedido.
 *               notes:
 *                 type: string
 *                 description: Comentarios u observaciones acerca del cambio de estado.
 *     responses:
 *       200:
 *         description: Estado del pedido actualizado con éxito.
 *       400:
 *         description: Datos inválidos.
 *       404:
 *         description: Pedido no encontrado.
 */
router.put('/orders/:id/status', crm.updateOrderStatus);

/**
 * @swagger
 * /api/orders/{id}/assign:
 *   post:
 *     summary: Asignar operador a un pedido
 *     description: Asigna un operador (armador o repartidor) a un pedido. El armador se asigna cuando el pedido está 'paid', el repartidor cuando está 'ready'. Transiciona el estado automáticamente y notifica por WhatsApp.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del pedido.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operatorId
 *               - role
 *             properties:
 *               operatorId:
 *                 type: string
 *                 format: uuid
 *                 description: ID del operador a asignar.
 *               role:
 *                 type: string
 *                 enum: [armador, repartidor]
 *                 description: Rol del operador en este pedido.
 *     responses:
 *       201:
 *         description: Operador asignado exitosamente.
 *       400:
 *         description: Datos inválidos o estado del pedido no permite la asignación.
 *       404:
 *         description: Pedido u operador no encontrado.
 */
router.post('/orders/:id/assign', assignments.assignOperator);

/**
 * @swagger
 * /api/orders/{id}/self-assign:
 *   post:
 *     summary: Auto-asignarse a un pedido
 *     description: El operador autenticado se asigna a sí mismo a un pedido. Requiere que el pedido esté en estado válido.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del pedido.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [armador, repartidor]
 *                 description: Rol con el que se quiere asignar.
 *     responses:
 *       201:
 *         description: Auto-asignación exitosa.
 *       400:
 *         description: Estado del pedido no permite la asignación.
 */
router.post('/orders/:id/self-assign', assignments.selfAssign);

/**
 * @swagger
 * /api/orders/{id}/complete-armado:
 *   put:
 *     summary: Confirmar armado completado
 *     description: El armador confirma que terminó de armar el pedido. Transiciona el pedido a 'ready' y notifica al cliente.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del pedido.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Notas opcionales del armador.
 *     responses:
 *       200:
 *         description: Armado confirmado exitosamente.
 *       400:
 *         description: El pedido no está en estado 'preparing'.
 *       404:
 *         description: No hay asignación activa para este operador.
 */
router.put('/orders/:id/complete-armado', assignments.completeArmado);

/**
 * @swagger
 * /api/orders/{id}/complete-entrega:
 *   put:
 *     summary: Confirmar entrega completada
 *     description: El repartidor confirma que entregó el pedido. Transiciona el pedido a 'delivered' y notifica al cliente.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del pedido.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Notas opcionales del repartidor.
 *     responses:
 *       200:
 *         description: Entrega confirmada exitosamente.
 *       400:
 *         description: El pedido no está en estado 'delivering'.
 *       404:
 *         description: No hay asignación activa para este operador.
 */
router.put('/orders/:id/complete-entrega', assignments.completeEntrega);

/**
 * @swagger
 * /api/orders/{id}/assignments:
 *   get:
 *     summary: Obtener historial de asignaciones de un pedido
 *     description: Devuelve todas las asignaciones (armador y repartidor) asociadas a un pedido específico.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del pedido.
 *     responses:
 *       200:
 *         description: Historial de asignaciones obtenido con éxito.
 */
router.get('/orders/:id/assignments', assignments.getOrderAssignments);

// ─── My Assignments ──────────────────────────────────────

/**
 * @swagger
 * /api/my-assignments:
 *   get:
 *     summary: Obtener mis asignaciones activas
 *     description: Retorna las asignaciones activas (no completadas) del operador autenticado.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de asignaciones activas obtenida con éxito.
 */
router.get('/my-assignments', assignments.getMyAssignments);

/**
 * @swagger
 * /api/my-assignments/history:
 *   get:
 *     summary: Obtener historial de asignaciones del operador
 *     description: Retorna todas las asignaciones (incluyendo completadas) del operador autenticado.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Cantidad máxima de asignaciones a retornar.
 *     responses:
 *       200:
 *         description: Historial de asignaciones obtenido con éxito.
 */
router.get('/my-assignments/history', assignments.getMyAssignmentsHistory);

// ─── Clients ──────────────────────────────────────────────

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Listar todos los clientes
 *     description: Obtiene la lista de usuarios registrados con el rol de `cliente`.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes obtenida con éxito.
 */
router.get('/clients', crm.getClients);

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Obtener perfil y compras de un cliente
 *     description: Obtiene la información de contacto y el historial detallado de pedidos de un cliente específico por su ID.
 *     tags: [Operator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del cliente.
 *     responses:
 *       200:
 *         description: Perfil del cliente obtenido con éxito.
 *       404:
 *         description: Cliente no encontrado.
 */
router.get('/clients/:id', crm.getClient);

module.exports = router;

