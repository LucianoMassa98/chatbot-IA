const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define(
    'Product',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Product name, e.g. "Maple de 30 huevos"',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Detailed product description shown to customers',
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Price in ARS',
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Default quantity per purchase unit',
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'maple',
        comment: 'Unit of measure (maple, docena, unidad)',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the product is available for purchase',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
    },
    {
      tableName: 'products',
      timestamps: true,
      underscored: true,
    },
  );

  Product.associate = (models) => {
    Product.hasMany(models.Order, {
      foreignKey: 'product_id',
      as: 'orders',
    });
  };

  return Product;
};
