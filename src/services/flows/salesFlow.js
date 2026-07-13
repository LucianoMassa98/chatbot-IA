const logger = require('../../config/logger');

/**
 * Compra Flow — DESHABILITADO
 *
 * El bot opera exclusivamente con planes de suscripción.
 * La lógica de compra individual de productos está comentada.
 * Para reactivar: descomentar el código de abajo y restaurar createProductOrder en orderService.js.
 */
const salesFlow = {
  name: 'compra',
  description: 'Flujo de compra individual — DESHABILITADO (usar suscripciones)',

  shouldStart: (message) => {
    // Capturamos estas palabras para poder redirigir al usuario a suscripciones
    const kw = ['comprar', 'maple', 'huevo', 'precio', 'cuanto', 'cuánto', 'quiero'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Redirigir al usuario hacia planes de suscripción
     */
    0: async (userMessage, sessionContext) => {
      return {
        response:
          '🛒 Las compras individuales no están disponibles en este momento.\n\n' +
          'Actualmente trabajamos con *planes de suscripción mensual* 📦\n\n' +
          'Podés ver nuestros planes respondiendo *SUSCRIPCION* o eligiendo la opción del menú. ¿Querés verlos?',
        nextStep: null,
        context: {},
        shouldResetFlow: true,
        redirectFlow: 'suscripcion',
      };
    },
  },
};

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * LÓGICA ORIGINAL — DESHABILITADA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * const { Product } = require('../../models');
 * const orderService = require('../orderService');
 *
 * steps: {
 *   0: async (userMessage, sessionContext) => {
 *     const products = await Product.findAll({ where: { isActive: true } });
 *     if (!products.length) {
 *       return {
 *         response: '😔 Por el momento no tenemos productos disponibles.',
 *         nextStep: null, context: {}, shouldResetFlow: true,
 *       };
 *     }
 *     const productList = products
 *       .map((p, i) => `${i + 1}️⃣ *${p.name}* — $${Number(p.price).toLocaleString('es-AR')}\n   _${p.description || ''}_`)
 *       .join('\n\n');
 *     return {
 *       response: `🥚 *Nuestros productos disponibles:*\n\n${productList}\n\nRespondé con el *número* del producto.`,
 *       nextStep: 1,
 *       context: { products: products.map((p) => ({ id: p.id, name: p.name, price: p.price })) },
 *     };
 *   },
 *   1: async (userMessage, sessionContext) => { ... selección de producto ... },
 *   2: async (userMessage, sessionContext) => { ... cantidad ... },
 *   3: async (userMessage, sessionContext) => {
 *     const { selectedProductId, quantity } = sessionContext.context;
 *     const { order, payment } = await orderService.createProductOrder(userId, selectedProductId, quantity);
 *     ...
 *   },
 * }
 */

module.exports = salesFlow;
