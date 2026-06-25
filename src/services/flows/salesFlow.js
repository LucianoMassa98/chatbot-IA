const logger = require('../../config/logger');
const { Product } = require('../../models');
const orderService = require('../orderService');

/**
 * Compra Flow — Flujo de compra de maples de huevos
 * Muestra productos disponibles, permite seleccionar y genera link de pago de Mercado Pago.
 */
const salesFlow = {
  name: 'compra',
  description: 'Flujo de compra de maples de huevos de Yemas del Sol',

  shouldStart: (message) => {
    const kw = ['comprar', 'maple', 'huevo', 'precio', 'cuanto', 'cuánto', 'quiero'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Listar productos disponibles
     */
    0: async (userMessage, sessionContext) => {
      const products = await Product.findAll({ where: { isActive: true } });

      if (!products.length) {
        return {
          response:
            '😔 Por el momento no tenemos productos disponibles.\n\n' +
            'Te avisaremos cuando tengamos stock. ¡Gracias por tu paciencia!',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      const productList = products
        .map((p, i) => `${i + 1}️⃣ *${p.name}* — $${Number(p.price).toLocaleString('es-AR')}\n   _${p.description || ''}_`)
        .join('\n\n');

      return {
        response:
          `🥚 *Nuestros productos disponibles:*\n\n${productList}\n\n` +
          `Respondé con el *número* del producto que querés comprar.`,
        nextStep: 1,
        context: { products: products.map((p) => ({ id: p.id, name: p.name, price: p.price })) },
      };
    },

    /**
     * Step 1: Selección de producto
     */
    1: async (userMessage, sessionContext) => {
      const products = sessionContext.context.products || [];
      const selection = parseInt(userMessage.trim(), 10);

      if (isNaN(selection) || selection < 1 || selection > products.length) {
        return {
          response: `Por favor respondé con un número del 1 al ${products.length}.`,
          nextStep: 1,
          context: sessionContext.context,
        };
      }

      const selected = products[selection - 1];

      return {
        response:
          `Elegiste: *${selected.name}*\n` +
          `Precio: $${Number(selected.price).toLocaleString('es-AR')}\n\n` +
          `¿Cuántos maples querés? (respondé con un número, ej: 1, 2, 3...)`,
        nextStep: 2,
        context: {
          ...sessionContext.context,
          selectedProductId: selected.id,
          selectedProductName: selected.name,
          selectedProductPrice: selected.price,
        },
      };
    },

    /**
     * Step 2: Cantidad
     */
    2: async (userMessage, sessionContext) => {
      const qty = parseInt(userMessage.trim(), 10);

      if (isNaN(qty) || qty < 1 || qty > 100) {
        return {
          response: 'Por favor indicá una cantidad válida (entre 1 y 100).',
          nextStep: 2,
          context: sessionContext.context,
        };
      }

      const { selectedProductName, selectedProductPrice } = sessionContext.context;
      const total = Number(selectedProductPrice) * qty;

      return {
        response:
          `📋 *Resumen de tu pedido:*\n\n` +
          `Producto: ${selectedProductName}\n` +
          `Cantidad: ${qty} maple(s)\n` +
          `Total: $${total.toLocaleString('es-AR')}\n\n` +
          `¿Confirmás? Respondé *SÍ* para continuar al pago, o *NO* para cancelar.`,
        nextStep: 3,
        context: { ...sessionContext.context, quantity: qty, total },
      };
    },

    /**
     * Step 3: Confirmación y generación de link de pago
     */
    3: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('no') || msg.includes('cancelar')) {
        return {
          response: '❌ Pedido cancelado. Cuando quieras volver a intentarlo, ¡acá estoy! 😊',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      if (!msg.includes('si') && !msg.includes('sí') && !msg.includes('ok') && !msg.includes('confirmo')) {
        return {
          response: 'Respondé *SÍ* para confirmar o *NO* para cancelar.',
          nextStep: 3,
          context: sessionContext.context,
        };
      }

      try {
        const { selectedProductId, quantity } = sessionContext.context;
        const userId = sessionContext.userId;

        const { order, payment } = await orderService.createProductOrder(userId, selectedProductId, quantity);

        logger.info('Order created from sales flow', { orderId: order.id, userId });

        return {
          response:
            `✅ *¡Pedido creado!*\n\n` +
            `Para completar tu compra, realizá el pago haciendo click en el siguiente link:\n\n` +
            `🔗 ${payment.paymentLink}\n\n` +
            `Una vez confirmado el pago, te avisamos por acá. 🥚`,
          nextStep: null,
          context: { orderId: order.id },
          shouldResetFlow: true,
        };
      } catch (error) {
        logger.error(`Failed to create order in sales flow: ${error.message}`);
        return {
          response:
            '😔 Hubo un error al procesar tu pedido. Por favor intentá de nuevo o hablá con un operador.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }
    },
  },
};

module.exports = salesFlow;
