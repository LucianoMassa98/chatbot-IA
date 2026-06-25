const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Subscription = sequelize.define(
    'Subscription',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Plan name, e.g. "Plan Familiar"',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      maplesQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Number of maples per delivery',
      },
      frequency: {
        type: DataTypes.ENUM('weekly', 'biweekly', 'monthly'),
        allowNull: false,
        defaultValue: 'biweekly',
        comment: 'Delivery frequency',
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Price per delivery cycle in ARS',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: 'subscriptions',
      timestamps: true,
      underscored: true,
    },
  );

  Subscription.associate = (models) => {
    Subscription.hasMany(models.Order, {
      foreignKey: 'subscription_id',
      as: 'orders',
    });
  };

  return Subscription;
};
