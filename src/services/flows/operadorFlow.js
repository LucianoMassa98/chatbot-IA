const logger = require('../../config/logger');
const { User, Order, OrderAssignment } = require('../../models');
const { Op } = require('sequelize');
const assignmentService = require('../assignmentService');

/**
 * Operador Flow — Panel de WhatsApp para operadores (armadores / repartidores)
 * Se activa automáticamente cuando un usuario con rol 'operador' o 'administrador'
 * envía un mensaje, o cuando escribe keywords como "panel", "mis pedidos", etc.
 */
const operadorFlow = {
  name: 'operador',
  description: 'Panel de operador por WhatsApp: ver asignaciones, armar y entregar pedidos',

  shouldStart: (message) => {
    const kw = ['panel', 'operador', 'mis pedidos', 'asignaciones', 'mis tareas', 'disponibles'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Menú principal del operador
     */
    0: async (userMessage, sessionContext) => {
      const user = await User.findByPk(sessionContext.userId);

      if (!user || !['operador', 'administrador'].includes(user.role)) {
        return {
          response: 'Este menú es solo para operadores. Escribí *MENU* para volver al menú de cliente.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      // Count active assignments
      const activeAssignments = await OrderAssignment.count({
        where: {
          operatorId: user.id,
          status: { [Op.ne]: 'completed' },
        },
      });

      // Count available orders
      const paidOrders = await Order.count({ where: { status: 'paid' } });
      const readyOrders = await Order.count({ where: { status: 'ready' } });

      return {
        response:
          `🔧 *Panel de Operador*\n` +
          `Hola, ${user.firstName || 'operador'}!\n\n` +
          `📊 *Resumen:*\n` +
          `• Tareas activas: ${activeAssignments}\n` +
          `• Pedidos por armar: ${paidOrders}\n` +
          `• Pedidos por entregar: ${readyOrders}\n\n` +
          `Seleccioná una opción:\n\n` +
          `1️⃣ Ver mis tareas asignadas\n` +
          `2️⃣ Tomar pedido para armar\n` +
          `3️⃣ Tomar pedido para entregar\n` +
          `4️⃣ Volver al menú de cliente\n\n` +
          `_Respondé con el número de la opción._`,
        nextStep: 1,
        context: {},
      };
    },

    /**
     * Step 1: Procesar selección del menú operador
     */
    1: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // 1 — Mis tareas asignadas
      if (msg.includes('1') || msg.includes('tarea') || msg.includes('asignad')) {
        const assignments = await assignmentService.getAssignmentsByOperator(sessionContext.userId);

        if (!assignments.length) {
          return {
            response:
              '📋 No tenés tareas asignadas en este momento.\n\n' +
              '¿Querés tomar un pedido? Respondé *2* para armar o *3* para entregar.\n' +
              'Escribí *PANEL* para volver al menú de operador.',
            nextStep: 1,
            context: {},
          };
        }

        const roleLabel = { armador: '🔧 Armar', repartidor: '🚗 Entregar', ambos: '🔧🚗 Armar y Entregar' };
        const statusLabel = { assigned: '📌 Asignado', in_progress: '⏳ En progreso', completed: '✅ Completado' };

        const list = assignments.map((a, i) => {
          const order = a.order;
          const productName = order?.product?.name || order?.subscription?.name || 'Pedido';
          const customer = order?.user?.firstName || order?.user?.contact || 'N/A';
          const address = order?.deliveryAddress || order?.user?.address || 'Sin dirección';
          const delivery = order?.estimatedDelivery
            ? `\n   📅 ${new Date(order.estimatedDelivery).toLocaleDateString('es-AR')}`
            : '';
          return (
            `${i + 1}. ${roleLabel[a.role] || a.role} — *${productName}* (x${order?.quantity || 1})\n` +
            `   ${statusLabel[a.status] || a.status}\n` +
            `   👤 ${customer}\n` +
            `   📍 ${address}${delivery}`
          );
        }).join('\n\n');

        return {
          response:
            `📋 *Tus tareas activas:*\n\n${list}\n\n` +
            `Respondé con el *número* de la tarea para gestionarla.\n\n` +
            `_Escribí *PANEL* para volver al menú de operador._`,
          nextStep: 2,
          context: { assignmentIds: assignments.map((a) => a.id), assignmentRoles: assignments.map((a) => a.role) },
        };
      }

      // 2 — Pedidos para armar
      if (msg.includes('2') || msg.includes('armar')) {
        const orders = await assignmentService.getPendingAssignments('armador');

        if (!orders.length) {
          return {
            response:
              '📦 No hay pedidos pendientes para armar en este momento.\n\n' +
              '_Escribí *PANEL* para volver al menú de operador._',
            nextStep: 1,
            context: {},
          };
        }

        const list = orders.map((o, i) => {
          const productName = o.product?.name || o.subscription?.name || 'Pedido';
          const customer = o.user?.firstName || o.user?.contact || 'N/A';
          const date = new Date(o.createdAt).toLocaleDateString('es-AR');
          return `${i + 1}. *${productName}* (x${o.quantity}) — 👤 ${customer} — ${date}`;
        }).join('\n');

        return {
          response:
            `📦 *Pedidos disponibles para armar:*\n\n${list}\n\n` +
            `Respondé con el *número* del pedido para tomarlo.\n\n` +
            `_Escribí *PANEL* para volver._`,
          nextStep: 5,
          context: { pendingOrderIds: orders.map((o) => o.id), pendingRole: 'armador' },
        };
      }

      // 3 — Pedidos para entregar
      if (msg.includes('3') || msg.includes('entregar') || msg.includes('repartir')) {
        const orders = await assignmentService.getPendingAssignments('repartidor');

        if (!orders.length) {
          return {
            response:
              '🚗 No hay pedidos listos para entregar en este momento.\n\n' +
              '_Escribí *PANEL* para volver al menú de operador._',
            nextStep: 1,
            context: {},
          };
        }

        const list = orders.map((o, i) => {
          const productName = o.product?.name || o.subscription?.name || 'Pedido';
          const customer = o.user?.firstName || o.user?.contact || 'N/A';
          const address = o.deliveryAddress || o.user?.address || 'Sin dirección';
          const mapUrl = o.user?.location?.googleMapsUrl ? ` 📎` : '';
          return `${i + 1}. *${productName}* (x${o.quantity}) — 👤 ${customer}\n   📍 ${address}${mapUrl}`;
        }).join('\n\n');

        return {
          response:
            `🚗 *Pedidos disponibles para entregar:*\n\n${list}\n\n` +
            `Respondé con el *número* del pedido para tomarlo.\n\n` +
            `_Escribí *PANEL* para volver._`,
          nextStep: 5,
          context: { pendingOrderIds: orders.map((o) => o.id), pendingRole: 'repartidor' },
        };
      }

      // 4 — Volver al menú cliente
      if (msg.includes('4') || msg.includes('cliente') || msg.includes('menú') || msg.includes('menu')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'menu',
        };
      }

      // PANEL — volver al menú operador
      if (msg.includes('panel')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'operador',
        };
      }

      // No reconocido
      return {
        response:
          'No entendí tu selección. Respondé con un número del 1 al 4:\n\n' +
          '1️⃣ Ver mis tareas\n2️⃣ Tomar para armar\n3️⃣ Tomar para entregar\n4️⃣ Menú cliente',
        nextStep: 1,
        context: {},
      };
    },

    /**
     * Step 2: Seleccionar una tarea asignada para gestionarla
     */
    2: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'operador' };
      }

      const selection = parseInt(msg, 10);
      const assignmentIds = sessionContext.context.assignmentIds || [];
      const assignmentRoles = sessionContext.context.assignmentRoles || [];

      if (isNaN(selection) || selection < 1 || selection > assignmentIds.length) {
        return {
          response: `Respondé con un número del 1 al ${assignmentIds.length}, o escribí *PANEL* para volver.`,
          nextStep: 2,
          context: sessionContext.context,
        };
      }

      const assignmentId = assignmentIds[selection - 1];
      const assignmentRole = assignmentRoles[selection - 1];

      // Load the assignment with order details
      const assignment = await OrderAssignment.findByPk(assignmentId, {
        include: [{
          association: 'order',
          include: [
            { association: 'user' },
            { association: 'product' },
            { association: 'subscription' },
          ],
        }],
      });

      if (!assignment) {
        return {
          response: 'No se encontró esa tarea. Escribí *PANEL* para volver.',
          nextStep: 1,
          context: {},
        };
      }

      const order = assignment.order;
      const productName = order?.product?.name || order?.subscription?.name || 'Pedido';
      const customer = order?.user?.firstName || order?.user?.contact || 'N/A';
      const address = order?.deliveryAddress || order?.user?.address || 'Sin dirección';
      const mapUrl = order?.user?.location?.googleMapsUrl
        ? `\n📎 Mapa: ${order.user.location.googleMapsUrl}`
        : '';
      const delivery = order?.estimatedDelivery
        ? `\n📅 Entrega: ${new Date(order.estimatedDelivery).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`
        : '';

      const roleLabel = { armador: '🔧 Armado', repartidor: '🚗 Entrega', ambos: '🔧🚗 Armado y Entrega' };

      // Build actions based on role and order status
      let actions = '';
      if ((assignmentRole === 'armador' || assignmentRole === 'ambos') && order.status === 'preparing') {
        actions += '\n\n✅ Respondé *LISTO* para marcar como armado.';
      }
      if ((assignmentRole === 'repartidor' || assignmentRole === 'ambos') && order.status === 'delivering') {
        actions += '\n\n✅ Respondé *ENTREGADO* para confirmar la entrega.';
      }
      if (assignmentRole === 'ambos' && order.status === 'ready') {
        actions += '\n\n🚗 Respondé *SALIR* para comenzar la entrega (marcar en camino).';
      }

      return {
        response:
          `📋 *Detalle de tarea:*\n\n` +
          `Tipo: ${roleLabel[assignmentRole] || assignmentRole}\n` +
          `Pedido: *${productName}* (x${order?.quantity || 1})\n` +
          `Estado pedido: ${order?.status}\n` +
          `👤 Cliente: ${customer}\n` +
          `📍 Dirección: ${address}${mapUrl}${delivery}` +
          actions +
          `\n\n_Escribí *PANEL* para volver al menú de operador._`,
        nextStep: 3,
        context: {
          selectedAssignmentId: assignmentId,
          selectedOrderId: order?.id,
          selectedRole: assignmentRole,
          orderStatus: order?.status,
        },
      };
    },

    /**
     * Step 3: Ejecutar acción sobre la tarea (LISTO, ENTREGADO, SALIR)
     */
    3: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();
      const { selectedOrderId, selectedRole, orderStatus } = sessionContext.context;

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'operador' };
      }

      // LISTO — Completar armado
      if (msg.includes('listo') || msg.includes('armado')) {
        if ((selectedRole === 'armador' || selectedRole === 'ambos') && orderStatus === 'preparing') {
          try {
            await assignmentService.completeArmado(selectedOrderId, sessionContext.userId);

            // If role is 'ambos', the operator also delivers — inform them
            if (selectedRole === 'ambos') {
              // Auto-assign as repartidor too
              try {
                await assignmentService.assignRepartidor(selectedOrderId, sessionContext.userId);
              } catch (err) {
                logger.warn(`Auto-assign repartidor for 'ambos' failed: ${err.message}`);
              }

              return {
                response:
                  '✅ *¡Pedido marcado como armado!*\n\n' +
                  'Como tenés el rol de armador y repartidor, el pedido ya está asignado para que lo entregues.\n' +
                  'Cuando salgas a entregar, volvé a *Mis tareas* y confirmá la entrega.\n\n' +
                  '_Escribí *PANEL* para volver al menú de operador._',
                nextStep: 1,
                context: {},
              };
            }

            return {
              response:
                '✅ *¡Pedido marcado como armado!*\n\n' +
                'El pedido queda listo para que un repartidor lo retire.\n' +
                'El cliente fue notificado. 📦\n\n' +
                '_Escribí *PANEL* para volver al menú de operador._',
              nextStep: 1,
              context: {},
            };
          } catch (error) {
            logger.error(`Operator flow completeArmado failed: ${error.message}`);
            return {
              response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
              nextStep: 1,
              context: {},
            };
          }
        }
        return {
          response: 'No podés marcar este pedido como armado en su estado actual.\n\n_Escribí *PANEL* para volver._',
          nextStep: 1,
          context: {},
        };
      }

      // SALIR — Iniciar entrega (para rol 'ambos' cuando pedido está ready)
      if (msg.includes('salir') || msg.includes('camino') || msg.includes('retirar')) {
        if (selectedRole === 'ambos' && orderStatus === 'ready') {
          // The order should already be assigned to this operator as repartidor (from completeArmado)
          // Just need to update the order status to delivering
          try {
            // Check if already assigned as repartidor, if not assign
            const order = await Order.findByPk(selectedOrderId);
            if (order && order.status === 'ready') {
              await assignmentService.assignRepartidor(selectedOrderId, sessionContext.userId);
            }
            return {
              response:
                '🚗 *¡Pedido en camino!*\n\n' +
                'El cliente fue notificado de que su pedido está siendo entregado.\n' +
                'Cuando llegues, volvé a *Mis tareas* y respondé *ENTREGADO*.\n\n' +
                '_Escribí *PANEL* para volver al menú de operador._',
              nextStep: 1,
              context: {},
            };
          } catch (error) {
            logger.error(`Operator flow start delivery failed: ${error.message}`);
            return {
              response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
              nextStep: 1,
              context: {},
            };
          }
        }
        return {
          response: 'No podés iniciar la entrega de este pedido en su estado actual.\n\n_Escribí *PANEL* para volver._',
          nextStep: 1,
          context: {},
        };
      }

      // ENTREGADO — Completar entrega
      if (msg.includes('entregado') || msg.includes('entregué') || msg.includes('entregue')) {
        if ((selectedRole === 'repartidor' || selectedRole === 'ambos') && orderStatus === 'delivering') {
          try {
            await assignmentService.completeEntrega(selectedOrderId, sessionContext.userId);
            return {
              response:
                '✅ *¡Entrega confirmada!*\n\n' +
                'El cliente fue notificado. ¡Buen trabajo! 🎉\n\n' +
                '_Escribí *PANEL* para volver al menú de operador._',
              nextStep: 1,
              context: {},
            };
          } catch (error) {
            logger.error(`Operator flow completeEntrega failed: ${error.message}`);
            return {
              response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
              nextStep: 1,
              context: {},
            };
          }
        }
        return {
          response: 'No podés confirmar la entrega de este pedido en su estado actual.\n\n_Escribí *PANEL* para volver._',
          nextStep: 1,
          context: {},
        };
      }

      // No reconocido
      return {
        response:
          'No entendí tu respuesta. Opciones disponibles:\n' +
          '• *LISTO* — Marcar como armado\n' +
          '• *SALIR* — Iniciar entrega\n' +
          '• *ENTREGADO* — Confirmar entrega\n' +
          '• *PANEL* — Volver al menú de operador',
        nextStep: 3,
        context: sessionContext.context,
      };
    },

    /**
     * Step 5: Auto-asignar un pedido disponible (armar o entregar)
     */
    5: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'operador' };
      }

      const selection = parseInt(msg, 10);
      const pendingOrderIds = sessionContext.context.pendingOrderIds || [];
      const pendingRole = sessionContext.context.pendingRole || 'armador';

      if (isNaN(selection) || selection < 1 || selection > pendingOrderIds.length) {
        return {
          response: `Respondé con un número del 1 al ${pendingOrderIds.length}, o escribí *PANEL* para volver.`,
          nextStep: 5,
          context: sessionContext.context,
        };
      }

      const orderId = pendingOrderIds[selection - 1];

      // Load order for confirmation
      const order = await Order.findByPk(orderId, {
        include: [
          { association: 'user' },
          { association: 'product' },
          { association: 'subscription' },
        ],
      });

      if (!order) {
        return {
          response: 'No se encontró ese pedido. Escribí *PANEL* para volver.',
          nextStep: 1,
          context: {},
        };
      }

      const productName = order.product?.name || order.subscription?.name || 'Pedido';
      const customer = order.user?.firstName || order.user?.contact || 'N/A';
      const address = order.deliveryAddress || order.user?.address || 'Sin dirección';
      const roleText = pendingRole === 'armador' ? '🔧 armar' : '🚗 entregar';

      return {
        response:
          `📋 *Confirmar auto-asignación:*\n\n` +
          `Tarea: ${roleText}\n` +
          `Pedido: *${productName}* (x${order.quantity})\n` +
          `👤 Cliente: ${customer}\n` +
          `📍 ${address}\n\n` +
          `¿Te asignás este pedido? Respondé *SÍ* o *NO*.`,
        nextStep: 6,
        context: {
          confirmOrderId: orderId,
          confirmRole: pendingRole,
        },
      };
    },

    /**
     * Step 6: Confirmar auto-asignación
     */
    6: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('no') || msg.includes('cancelar')) {
        return {
          response: '❌ Auto-asignación cancelada.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'operador',
        };
      }

      if (!msg.includes('si') && !msg.includes('sí') && !msg.includes('ok') && !msg.includes('confirmo')) {
        return {
          response: 'Respondé *SÍ* para confirmar o *NO* para cancelar.',
          nextStep: 6,
          context: sessionContext.context,
        };
      }

      const { confirmOrderId, confirmRole } = sessionContext.context;

      try {
        await assignmentService.selfAssign(confirmOrderId, sessionContext.userId, confirmRole);

        const roleText = confirmRole === 'armador' ? 'armar' : 'entregar';
        return {
          response:
            `✅ *¡Pedido asignado!*\n\n` +
            `Te asignaste el pedido para ${roleText}.\n` +
            `Podés verlo en *Mis tareas* desde el panel.\n\n` +
            `_Escribí *PANEL* para volver al menú de operador._`,
          nextStep: 1,
          context: {},
        };
      } catch (error) {
        logger.error(`Self-assign via flow failed: ${error.message}`);
        return {
          response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
          nextStep: 1,
          context: {},
        };
      }
    },
  },
};

module.exports = operadorFlow;
