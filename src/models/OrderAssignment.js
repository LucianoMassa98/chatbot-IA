const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderAssignment = sequelize.define(
    'OrderAssignment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
      },
      operatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        comment: 'User with role operador',
      },
      role: {
        type: DataTypes.ENUM('armador', 'repartidor', 'ambos'),
        allowNull: false,
        comment: 'What role the operator plays for this order (armador: arma el pedido, repartidor: reparte el pedido, ambos: arma y reparte el pedido)',
      },
      status: {
        type: DataTypes.ENUM('assigned', 'in_progress', 'completed'),
        allowNull: false,
        defaultValue: 'assigned',
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the operator started working on the order',
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the operator finished their task',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Operator notes about the assignment',
      },
    },
    {
      tableName: 'order_assignments',
      timestamps: true,
      underscored: true,
    },
  );

  OrderAssignment.associate = (models) => {
    OrderAssignment.belongsTo(models.Order, {
      foreignKey: 'order_id',
      as: 'order',
    });
    OrderAssignment.belongsTo(models.User, {
      foreignKey: 'operator_id',
      as: 'operator',
    });
  };

  return OrderAssignment;
};
