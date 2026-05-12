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
        type: DataTypes.ENUM('whatsapp', 'instagram', 'messenger'),
        allowNull: false,
        comment: 'Channel through which user is communicating',
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
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
  };

  return User;
};
