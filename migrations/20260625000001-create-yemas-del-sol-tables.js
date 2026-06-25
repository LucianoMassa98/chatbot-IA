'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ─────────────────────────────────────────────
    // 1. ALTER users table — add new columns
    // ─────────────────────────────────────────────
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.ENUM('cliente', 'operador', 'administrador'),
      allowNull: false,
      defaultValue: 'cliente',
    });
    await queryInterface.addColumn('users', 'address', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'location', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('users', 'delivery_schedule', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    // ─────────────────────────────────────────────
    // 2. ALTER sessions — add new enum values to current_flow
    // ─────────────────────────────────────────────
    const newFlowValues = ['menu', 'compra', 'suscripcion', 'pedidos', 'cambiar_direccion', 'reprogramar'];
    for (const val of newFlowValues) {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = '${val}'
              AND enumtypid = (
                SELECT oid FROM pg_type WHERE typname = 'enum_sessions_current_flow'
              )
          ) THEN
            ALTER TYPE "enum_sessions_current_flow" ADD VALUE '${val}';
          END IF;
        END
        $$;
      `);
    }

    // ─────────────────────────────────────────────
    // 3. CREATE products table
    // ─────────────────────────────────────────────
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      unit: { type: Sequelize.STRING, allowNull: false, defaultValue: 'maple' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    // ─────────────────────────────────────────────
    // 4. CREATE subscriptions table
    // ─────────────────────────────────────────────
    await queryInterface.createTable('subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      maples_quantity: { type: Sequelize.INTEGER, allowNull: false },
      frequency: {
        type: Sequelize.ENUM('weekly', 'biweekly', 'monthly'),
        allowNull: false,
        defaultValue: 'biweekly',
      },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    // ─────────────────────────────────────────────
    // 5. CREATE orders table
    // ─────────────────────────────────────────────
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'products', key: 'id' },
        onDelete: 'SET NULL',
      },
      subscription_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'subscriptions', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM('single', 'subscription'),
        allowNull: false,
        defaultValue: 'single',
      },
      status: {
        type: Sequelize.ENUM(
          'pending_payment',
          'paid',
          'preparing',
          'ready',
          'delivering',
          'delivered',
          'rescheduled',
          'cancelled',
        ),
        allowNull: false,
        defaultValue: 'pending_payment',
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      delivery_address: { type: Sequelize.STRING, allowNull: true },
      estimated_delivery: { type: Sequelize.DATE, allowNull: true },
      delivered_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('orders', ['user_id'], { name: 'idx_orders_user_id' });
    await queryInterface.addIndex('orders', ['status'], { name: 'idx_orders_status' });

    // ─────────────────────────────────────────────
    // 6. CREATE payments table
    // ─────────────────────────────────────────────
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'orders', key: 'id' },
        onDelete: 'CASCADE',
      },
      mercado_pago_id: { type: Sequelize.STRING, allowNull: true },
      preference_id: { type: Sequelize.STRING, allowNull: true },
      payment_link: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('payments', ['order_id'], { name: 'idx_payments_order_id' });
    await queryInterface.addIndex('payments', ['mercado_pago_id'], { name: 'idx_payments_mp_id' });

    // ─────────────────────────────────────────────
    // 7. CREATE delivery_zones table
    // ─────────────────────────────────────────────
    await queryInterface.createTable('delivery_zones', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      center_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      center_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      radius_km: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
      localities: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    // ─────────────────────────────────────────────
    // 8. CREATE operating_hours table
    // ─────────────────────────────────────────────
    await queryInterface.createTable('operating_hours', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      day_of_week: { type: Sequelize.INTEGER, allowNull: false },
      open_time: { type: Sequelize.TIME, allowNull: true },
      close_time: { type: Sequelize.TIME, allowNull: true },
      delivery_start_time: { type: Sequelize.TIME, allowNull: true },
      delivery_end_time: { type: Sequelize.TIME, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop new tables in reverse order
    await queryInterface.dropTable('operating_hours');
    await queryInterface.dropTable('delivery_zones');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('orders');
    await queryInterface.dropTable('subscriptions');
    await queryInterface.dropTable('products');

    // Remove added columns from users
    await queryInterface.removeColumn('users', 'delivery_schedule');
    await queryInterface.removeColumn('users', 'location');
    await queryInterface.removeColumn('users', 'address');
    await queryInterface.removeColumn('users', 'role');
  },
};
