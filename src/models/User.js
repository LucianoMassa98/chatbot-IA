const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      contact: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Phone number, email, or IG handle depending on channel',
      },
      channel: {
        type: DataTypes.ENUM('whatsapp'),
        allowNull: false,
        defaultValue: 'whatsapp',
        comment: 'Communication channel — WhatsApp only for Yemas del Sol',
      },
      role: {
        type: DataTypes.ENUM('cliente', 'operador', 'administrador'),
        allowNull: false,
        defaultValue: 'cliente',
        comment: 'User role in the system',
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Delivery address',
      },
      location: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'GPS coordinates and map URL: { lat, lng, googleMapsUrl }',
      },
      deliverySchedule: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: 'Preferred delivery times: { morning, afternoon, evening }',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional user data (language, preferences, etc)',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      underscored: true,
    },
  );

  // Add associations
  User.associate = (models) => {
    User.hasMany(models.Conversation, {
      foreignKey: 'user_id',
      as: 'conversations',
      onDelete: 'CASCADE',
    });
    User.hasOne(models.Session, {
      foreignKey: 'user_id',
      as: 'session',
      onDelete: 'CASCADE',
    });
    User.hasMany(models.Order, {
      foreignKey: 'user_id',
      as: 'orders',
      onDelete: 'CASCADE',
    });
    User.hasMany(models.OrderAssignment, {
      foreignKey: 'operator_id',
      as: 'assignments',
    });
  };

  return User;
};
