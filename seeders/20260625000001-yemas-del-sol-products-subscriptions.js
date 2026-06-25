'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // ─── Products ────────────────────────────────────────────────
    const products = [
      {
        id: uuidv4(),
        name: 'Maple de 30 huevos',
        description: 'Maple con 30 huevos frescos de producción propia. Ideales para el consumo diario familiar.',
        price: 4500.00,
        quantity: 1,
        unit: 'maple',
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: '2 Maples de 30 huevos',
        description: 'Pack de 2 maples con 30 huevos frescos cada uno. Precio especial por pack.',
        price: 8500.00,
        quantity: 2,
        unit: 'maple',
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: '3 Maples de 30 huevos',
        description: 'Pack de 3 maples con 30 huevos cada uno. El mejor precio por maple.',
        price: 12000.00,
        quantity: 3,
        unit: 'maple',
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Maple de 12 huevos',
        description: 'Maple con 12 huevos frescos. Perfecto para hogares pequeños o para probar nuestra calidad.',
        price: 1900.00,
        quantity: 1,
        unit: 'maple',
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: '2 Maples de 12 huevos',
        description: 'Pack de 2 maples con 12 huevos cada uno.',
        price: 3600.00,
        quantity: 2,
        unit: 'maple',
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Huevos de campo — Maple 30',
        description: 'Maple de 30 huevos de campo. Gallinas criadas en libertad, alimentación natural. Mayor tamaño y yema más oscura.',
        price: 5800.00,
        quantity: 1,
        unit: 'maple',
        is_active: true,
        metadata: JSON.stringify({ tipo: 'campo' }),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Docena de huevos',
        description: '12 huevos frescos sueltos. Ideal para compras rápidas o cuando no necesitás un maple completo.',
        price: 1600.00,
        quantity: 12,
        unit: 'unidad',
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Pack Familiar — 5 Maples',
        description: 'Pack de 5 maples de 30 huevos. Pensado para familias numerosas o grupos. Máximo ahorro por maple.',
        price: 20000.00,
        quantity: 5,
        unit: 'maple',
        is_active: true,
        metadata: JSON.stringify({ destacado: true }),
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('products', products);

    // ─── Subscriptions ───────────────────────────────────────────
    const subscriptions = [
      {
        id: uuidv4(),
        name: 'Plan Personal',
        description: 'Ideal para una persona o pareja. Recibís un maple cada 14 días sin preocuparte por quedarte sin huevos.',
        maples_quantity: 1,
        frequency: 'biweekly',
        price: 4200.00,
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Plan Familiar',
        description: 'Para familias de 3 a 5 personas. Recibís 2 maples cada 14 días directamente en tu puerta.',
        maples_quantity: 2,
        frequency: 'biweekly',
        price: 8000.00,
        is_active: true,
        metadata: JSON.stringify({ destacado: true }),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        name: 'Plan Grande',
        description: 'Para familias numerosas o pequeños negocios. 4 maples cada 14 días con el mejor precio por unidad.',
        maples_quantity: 4,
        frequency: 'biweekly',
        price: 15000.00,
        is_active: true,
        metadata: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('subscriptions', subscriptions);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('subscriptions', null, {});
    await queryInterface.bulkDelete('products', null, {});
  },
};
