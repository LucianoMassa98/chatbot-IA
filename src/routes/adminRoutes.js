const express = require('express');
const router = express.Router();
const { authMiddleware, roleGuard } = require('../middleware/authMiddleware');
const crm = require('../controllers/crmController');

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

module.exports = router;
