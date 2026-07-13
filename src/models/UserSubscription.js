const { DataTypes } = require('sequelize');

/**
 * UserSubscription
 * Represents an active subscription instance for a specific user.
 * The Subscription model defines the plan (name, price, frequency).
 * This model tracks the lifecycle: when it started, when it renews, how many deliveries remain.
 */
module.exports = (sequelize) => {
  const UserSubscription = sequelize.define(
    'UserSubscription',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        comment: 'The subscriber (cliente)',
      },
      subscriptionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'subscriptions', key: 'id' },
        comment: 'The plan contracted',
      },
      status: {
        type: DataTypes.ENUM('pending_payment', 'active', 'paused', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending_payment',
        comment: 'Lifecycle state of this subscription instance',
      },
      currentPeriodStart: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Start date of the current monthly billing period',
      },
      currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'End date of the current monthly billing period (renewal date)',
      },
      nextDeliveryDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Scheduled date for the next weekly/biweekly delivery',
      },
      deliveryCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of deliveries generated in the current period',
      },
      renewalOrderId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Order ID for the pending renewal payment (if any)',
      },
      reminderSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when the 3-day renewal reminder was last sent',
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when the subscription was cancelled',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Extra data: list of delivery order IDs, payment history, etc.',
      },
    },
    {
      tableName: 'user_subscriptions',
      timestamps: true,
      underscored: true,
    },
  );

  UserSubscription.associate = (models) => {
    UserSubscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    UserSubscription.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'plan',
    });
    UserSubscription.belongsTo(models.Order, {
      foreignKey: 'renewal_order_id',
      as: 'renewalOrder',
      constraints: false,
    });
  };

  return UserSubscription;
};
