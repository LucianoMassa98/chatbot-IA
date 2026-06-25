const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'orders', key: 'id' },
      },
      mercadoPagoId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Payment ID returned by Mercado Pago after approval',
      },
      preferenceId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Preference ID used to generate the payment link',
      },
      paymentLink: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Full URL of the Mercado Pago checkout',
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Amount charged in ARS',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Full Mercado Pago webhook payload for audit',
      },
    },
    {
      tableName: 'payments',
      timestamps: true,
      underscored: true,
    },
  );

  Payment.associate = (models) => {
    Payment.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
  };

  return Payment;
};
