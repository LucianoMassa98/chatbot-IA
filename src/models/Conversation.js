const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Conversation = sequelize.define(
    'Conversation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      status: {
        type: DataTypes.ENUM('active', 'closed', 'waiting'),
        allowNull: false,
        defaultValue: 'active',
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Main topic of conversation (sales, support, etc)',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Conversation context and metadata',
      },
    },
    {
      tableName: 'conversations',
      timestamps: true,
      underscored: true,
    },
  );

  // Add associations
  Conversation.associate = (models) => {
    Conversation.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
    Conversation.hasMany(models.Message, {
      foreignKey: 'conversation_id',
      as: 'messages',
      onDelete: 'CASCADE',
    });
  };

  return Conversation;
};
