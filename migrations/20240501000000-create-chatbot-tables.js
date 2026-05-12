'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Create users table
     */
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      contact: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Phone number, email, or IG handle depending on channel',
      },
      channel: {
        type: Sequelize.ENUM('whatsapp', 'instagram', 'messenger'),
        allowNull: false,
        comment: 'Channel through which user is communicating',
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
    });

    // Create unique index on contact + channel
    await queryInterface.addIndex('users', ['contact', 'channel'], {
      unique: true,
      name: 'idx_users_contact_channel',
    });

    /**
     * Create conversations table
     */
    await queryInterface.createTable('conversations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('active', 'closed', 'waiting'),
        allowNull: false,
        defaultValue: 'active',
      },
      topic: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
    });

    await queryInterface.addIndex('conversations', ['user_id'], {
      name: 'idx_conversations_user_id',
    });

    /**
     * Create messages table
     */
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'conversations',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      direction: {
        type: Sequelize.ENUM('in', 'out'),
        allowNull: false,
        comment: 'in = from user, out = from bot',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      message_type: {
        type: Sequelize.ENUM('text', 'image', 'document', 'audio', 'video'),
        allowNull: false,
        defaultValue: 'text',
      },
      external_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
    });

    await queryInterface.addIndex('messages', ['conversation_id'], {
      name: 'idx_messages_conversation_id',
    });

    /**
     * Create sessions table
     */
    await queryInterface.createTable('sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      current_flow: {
        type: Sequelize.ENUM('idle', 'sales', 'support', 'ai_fallback'),
        allowNull: false,
        defaultValue: 'idle',
      },
      flow_step: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      context: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now'),
      },
    });

    await queryInterface.addIndex('sessions', ['user_id'], {
      name: 'idx_sessions_user_id',
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order
    await queryInterface.dropTable('sessions');
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('conversations');
    await queryInterface.dropTable('users');
  },
};
