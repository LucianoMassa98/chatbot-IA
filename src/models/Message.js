const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Message = sequelize.define(
    'Message',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'conversations',
          key: 'id',
        },
      },
      direction: {
        type: DataTypes.ENUM('in', 'out'),
        allowNull: false,
        comment: 'in = from user, out = from bot',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      messageType: {
        type: DataTypes.ENUM('text', 'image', 'document', 'audio', 'video'),
        allowNull: false,
        defaultValue: 'text',
      },
      externalId: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Message ID from Meta API',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional message data (attachments, etc)',
      },
    },
    {
      tableName: 'messages',
      timestamps: true,
      underscored: true,
    },
  );

  // Add associations
  Message.associate = (models) => {
    Message.belongsTo(models.Conversation, {
      foreignKey: 'conversation_id',
      as: 'conversation',
    });
  };

  return Message;
};
