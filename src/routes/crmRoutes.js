const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const crm = require('../controllers/crmController');
const crmChat = require('../controllers/crmChatController');

/**
 * @swagger
 * tags:
 *   name: CRM
 *   description: Conversation and message management for CRM Operators and Admins
 */

// ─── Public ───────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: Autenticar con Google OAuth
 *     description: Verifica el ID Token de Google enviado por el frontend y devuelve los datos del usuario si está registrado como operador o administrador.
 *     tags: [CRM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Token de identidad obtenido desde Google Sign-In en el frontend.
 *     responses:
 *       200:
 *         description: Autenticación exitosa. Devuelve los datos de perfil y rol del usuario.
 *       400:
 *         description: Petición inválida (falta idToken).
 *       401:
 *         description: Token de Google inválido o expirado.
 *       403:
 *         description: Usuario no registrado o sin acceso al panel.
 */
router.post('/auth/google', crm.googleAuth);

// ─── Protected (operador + administrador) ─────────────────
router.use(authMiddleware);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Obtener todas las conversaciones
 *     description: Retorna un listado de todas las conversaciones registradas en el sistema, ordenadas por fecha de actualización (más reciente primero), incluyendo información del cliente.
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de conversaciones obtenido exitosamente.
 *       401:
 *         description: No autorizado (Token faltante, inválido o expirado).
 */
router.get('/conversations', crmChat.getConversations);

/**
 * @swagger
 * /api/conversations/{id}/messages:
 *   get:
 *     summary: Obtener los mensajes de una conversación
 *     description: Retorna el historial completo de mensajes de una conversación ordenados cronológicamente (más antiguo primero).
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la conversación.
 *     responses:
 *       200:
 *         description: Historial de mensajes obtenido exitosamente.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Conversación no encontrada.
 */
router.get('/conversations/:id/messages', crmChat.getConversationMessages);

/**
 * @swagger
 * /api/conversations/{id}/messages:
 *   post:
 *     summary: Enviar un mensaje al usuario desde el CRM
 *     description: Envía un mensaje manual al cliente asociado a la conversación a través del canal de mensajería (WhatsApp/Meta) y lo registra en la base de datos. Si el estado de la conversación era 'waiting', se cambia automáticamente a 'active'.
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la conversación.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Mensaje de texto a enviar al usuario.
 *     responses:
 *       200:
 *         description: Mensaje enviado e insertado en la base de datos con éxito.
 *       400:
 *         description: Faltan campos requeridos (content).
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Conversación no encontrada.
 */
router.post('/conversations/:id/messages', crmChat.sendCRMMessage);

/**
 * @swagger
 * /api/conversations/{id}/status:
 *   put:
 *     summary: Actualizar el estado de una conversación
 *     description: Modifica el estado actual de la conversación. Los estados permitidos son 'active', 'closed' y 'waiting'.
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la conversación.
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
 *                 enum: [active, closed, waiting]
 *                 description: Nuevo estado para la conversación.
 *     responses:
 *       200:
 *         description: Estado de la conversación actualizado exitosamente.
 *       400:
 *         description: Estado inválido provisto.
 *       401:
 *         description: No autorizado.
 *       404:
 *         description: Conversación no encontrada.
 */
router.put('/conversations/:id/status', crmChat.updateConversationStatus);

module.exports = router;
