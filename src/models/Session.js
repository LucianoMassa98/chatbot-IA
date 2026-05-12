const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Session = sequelize.define(
    'Session',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      currentFlow: {
        type: DataTypes.ENUM('idle', 'sales', 'support', 'ai_fallback'),
        allowNull: false,
        defaultValue: 'idle',
        comment: 'Current active flow',
      },
      flowStep: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Current step in the flow',
      },
      context: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Flow-specific context and data',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Session expiration timestamp',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'sessions',
      timestamps: true,
      underscored: true,
    },
  );

  // Add associations
  Session.associate = (models) => {
    Session.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return Session;
};
