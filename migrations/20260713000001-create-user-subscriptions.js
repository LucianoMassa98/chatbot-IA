'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the ENUM type for user_subscription status
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_user_subscriptions_status') THEN
          CREATE TYPE "enum_user_subscriptions_status" AS ENUM (
            'pending_payment',
            'active',
            'paused',
            'expired',
            'cancelled'
          );
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable('user_subscriptions', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      subscription_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'subscriptions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM('pending_payment', 'active', 'paused', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending_payment',
      },
      current_period_start: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      current_period_end: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      next_delivery_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      delivery_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      renewal_order_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      reminder_sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes for common queries
    await queryInterface.addIndex('user_subscriptions', ['user_id'], {
      name: 'user_subscriptions_user_id_idx',
    });
    await queryInterface.addIndex('user_subscriptions', ['status'], {
      name: 'user_subscriptions_status_idx',
    });
    await queryInterface.addIndex('user_subscriptions', ['current_period_end'], {
      name: 'user_subscriptions_period_end_idx',
    });
    await queryInterface.addIndex('user_subscriptions', ['next_delivery_date'], {
      name: 'user_subscriptions_next_delivery_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_subscriptions');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_user_subscriptions_status";',
    );
  },
};
