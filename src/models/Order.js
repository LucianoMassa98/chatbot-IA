const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define(
    'Order',
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
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'products', key: 'id' },
        comment: 'Populated for single-purchase orders',
      },
      subscriptionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'subscriptions', key: 'id' },
        comment: 'Populated for subscription orders',
      },
      type: {
        type: DataTypes.ENUM('single', 'subscription'),
        allowNull: false,
        defaultValue: 'single',
      },
      status: {
        type: DataTypes.ENUM(
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
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Number of maples ordered',
      },
      total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Total amount in ARS',
      },
      deliveryAddress: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Delivery address (may differ from user default)',
      },
      estimatedDelivery: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Estimated delivery datetime',
      },
      deliveredAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual delivery datetime',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Operator notes or incident description',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: 'orders',
      timestamps: true,
      underscored: true,
    },
  );

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Order.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    Order.belongsTo(models.Subscription, { foreignKey: 'subscription_id', as: 'subscription' });
    Order.hasOne(models.Payment, { foreignKey: 'order_id', as: 'payment' });
    Order.hasMany(models.OrderAssignment, { foreignKey: 'order_id', as: 'assignments' });
  };

  return Order;
};
