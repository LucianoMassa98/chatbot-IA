const express = require('express');

const router = express.Router();
const { authMiddleware, roleGuard } = require('../middleware/authMiddleware');
const crm = require('../controllers/crmController');
const subscriptionCtrl = require('../controllers/subscriptionController');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative operations (Products, Subscriptions, Operators, and System Configuration)
 */

// All admin routes require authentication and the 'administrador' role
router.use(authMiddleware);
router.use(roleGuard('administrador'));

// ─── Products ─────────────────────────────────────────────

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Listar todos los productos
 *     description: Retorna un listado de todos los productos de la base de datos (activos e inactivos).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de productos obtenida con éxito.
 *       401:
 *         description: No autorizado.
 *       403:
 *         description: Permisos insuficientes.
 *   post:
 *     summary: Crear un nuevo producto
 *     description: Registra un nuevo producto para la venta.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               imageUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Producto creado con éxito.
 *       400:
 *         description: Datos inválidos.
 */
router.get('/products', crm.getProducts);
router.post('/products', crm.createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Actualizar un producto existente
 *     description: Modifica los campos de un producto por su ID.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del producto.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               imageUrl:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Producto actualizado con éxito.
 *       404:
 *         description: Producto no encontrado.
 *   delete:
 *     summary: Desactivar un producto
 *     description: Cambia el estado del producto a inactivo (`isActive = false`).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del producto a desactivar.
 *     responses:
 *       200:
 *         description: Producto desactivado correctamente.
 *       404:
 *         description: Producto no encontrado.
 */
router.put('/products/:id', crm.updateProduct);
router.delete('/products/:id', crm.deleteProduct);

// ─── Subscriptions ────────────────────────────────────────

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: Listar todas las suscripciones
 *     description: Obtiene el listado de planes de suscripción disponibles.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de suscripciones obtenida con éxito.
 *   post:
 *     summary: Crear un plan de suscripción
 *     description: Crea un nuevo plan de suscripción recurrente para los clientes.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - frequencyWeeks
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               frequencyWeeks:
 *                 type: integer
 *                 description: Frecuencia de entrega en semanas (ej. 1 para semanal, 2 para quincenal).
 *     responses:
 *       201:
 *         description: Suscripción creada exitosamente.
 */
router.get('/subscriptions', crm.getSubscriptions);
router.post('/subscriptions', crm.createSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   put:
 *     summary: Actualizar un plan de suscripción
 *     description: Modifica los datos de un plan de suscripción por su ID.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la suscripción.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               frequencyWeeks:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Suscripción actualizada correctamente.
 *       404:
 *         description: Suscripción no encontrada.
 */
router.put('/subscriptions/:id', crm.updateSubscription);

// ─── Operators ────────────────────────────────────────────

/**
 * @swagger
 * /api/operators:
 *   get:
 *     summary: Listar operadores del CRM
 *     description: Retorna todos los usuarios con rol de `operador`.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de operadores obtenida exitosamente.
 *   post:
 *     summary: Crear un nuevo operador
 *     description: Registra una nueva cuenta de operador para acceder al CRM.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contact
 *               - firstName
 *               - password
 *             properties:
 *               contact:
 *                 type: string
 *                 description: Email de Google o número de contacto del operador.
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *                 description: Contraseña de acceso.
 *     responses:
 *       201:
 *         description: Operador creado con éxito.
 */
router.get('/operators', crm.getOperators);
router.post('/operators', crm.createOperator);

// ─── Config ───────────────────────────────────────────────

/**
 * @swagger
 * /api/config/operating-hours:
 *   get:
 *     summary: Obtener horarios de atención y despacho
 *     description: Devuelve la lista de horarios configurados para cada día de la semana.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de horarios obtenida correctamente.
 *   put:
 *     summary: Crear o actualizar un horario de atención
 *     description: Actualiza los límites de tiempo de atención o entregas para un día de la semana.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dayOfWeek
 *             properties:
 *               dayOfWeek:
 *                 type: integer
 *                 description: Día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado).
 *               openTime:
 *                 type: string
 *                 example: "08:00:00"
 *               closeTime:
 *                 type: string
 *                 example: "18:00:00"
 *               deliveryStartTime:
 *                 type: string
 *                 example: "10:00:00"
 *               deliveryEndTime:
 *                 type: string
 *                 example: "17:00:00"
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Horario actualizado con éxito.
 */
router.get('/config/operating-hours', crm.getOperatingHours);
router.put('/config/operating-hours', crm.updateOperatingHours);

/**
 * @swagger
 * /api/config/delivery-zones:
 *   get:
 *     summary: Listar zonas de entrega
 *     description: Devuelve todas las zonas de entrega y sus costos de envío asociados.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de zonas de entrega obtenida con éxito.
 *   post:
 *     summary: Crear una nueva zona de entrega
 *     description: Agrega un sector geográfico de despacho y su tarifa correspondiente.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre o sector de la zona (ej. CABA, Zona Norte).
 *               price:
 *                 type: number
 *                 description: Costo de envío para esta zona.
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Zona de entrega creada exitosamente.
 */
router.get('/config/delivery-zones', crm.getDeliveryZones);
router.post('/config/delivery-zones', crm.createDeliveryZone);

/**
 * @swagger
 * /api/config/delivery-zones/{id}:
 *   put:
 *     summary: Actualizar una zona de entrega
 *     description: Modifica el nombre, precio o estado de una zona de entrega por su ID.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la zona de entrega.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Zona de entrega modificada exitosamente.
 *       404:
 *         description: Zona no encontrada.
 */
router.put('/config/delivery-zones/:id', crm.updateDeliveryZone);

// ─── User Subscriptions (Active Instances) ────────────────

/**
 * @swagger
 * /api/user-subscriptions:
 *   get:
 *     summary: Listar suscripciones activas de clientes
 *     description: Devuelve todas las instancias de suscripción de clientes. Filtrar por ?status=active|paused|expired|cancelled|pending_payment.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending_payment, active, paused, expired, cancelled]
 *         description: Filtrar por estado de la suscripción.
 *     responses:
 *       200:
 *         description: Lista obtenida con éxito.
 */
router.get('/user-subscriptions', subscriptionCtrl.listUserSubscriptions);

/**
 * @swagger
 * /api/user-subscriptions/trigger-weekly-deliveries:
 *   post:
 *     summary: Disparar generación de entregas semanales manualmente
 *     description: Ejecuta el job de generación de pedidos semanales para todas las suscripciones activas. Útil para pruebas o emergencias.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Job ejecutado exitosamente.
 */
router.post('/user-subscriptions/trigger-weekly-deliveries', subscriptionCtrl.triggerWeeklyDeliveries);

/**
 * @swagger
 * /api/user-subscriptions/{id}:
 *   get:
 *     summary: Detalle de una suscripción activa
 *     description: Devuelve el estado completo de una instancia de suscripción, incluyendo historial de entregas.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la UserSubscription.
 *     responses:
 *       200:
 *         description: Detalle obtenido con éxito.
 *       404:
 *         description: Suscripción no encontrada.
 */
router.get('/user-subscriptions/:id', subscriptionCtrl.getUserSubscription);

/**
 * @swagger
 * /api/user-subscriptions/{id}/cancel:
 *   put:
 *     summary: Cancelar una suscripción de cliente
 *     description: Cancela la suscripción y notifica al cliente por WhatsApp.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la UserSubscription.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Motivo de cancelación (opcional).
 *     responses:
 *       200:
 *         description: Suscripción cancelada exitosamente.
 *       404:
 *         description: Suscripción no encontrada.
 */
router.put('/user-subscriptions/:id/cancel', subscriptionCtrl.cancelUserSubscription);

/**
 * @swagger
 * /api/user-subscriptions/{id}/pause:
 *   put:
 *     summary: Pausar una suscripción de cliente
 *     description: Pausa la suscripción. Los pedidos semanales dejan de generarse hasta que se reactive.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Suscripción pausada exitosamente.
 */
router.put('/user-subscriptions/:id/pause', subscriptionCtrl.pauseUserSubscription);

/**
 * @swagger
 * /api/user-subscriptions/{id}/resume:
 *   put:
 *     summary: Reactivar una suscripción pausada
 *     description: Reactiva una suscripción pausada y recalcula la próxima fecha de entrega.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Suscripción reactivada exitosamente.
 */
router.put('/user-subscriptions/:id/resume', subscriptionCtrl.resumeUserSubscription);

/**
 * @swagger
 * /api/user-subscriptions/{id}/force-renew:
 *   post:
 *     summary: Generar manualmente una orden de renovación
 *     description: Crea una nueva orden de pago para el próximo mes y envía el link al cliente. Útil si el webhook de Mercado Pago no se disparó correctamente.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Orden de renovación generada exitosamente.
 *       400:
 *         description: La suscripción no está en estado válido para renovar.
 *       404:
 *         description: Suscripción no encontrada.
 */
router.post('/user-subscriptions/:id/force-renew', subscriptionCtrl.forceRenewSubscription);

module.exports = router;
