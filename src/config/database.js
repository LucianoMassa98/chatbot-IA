require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'chatbot_user',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'chatbot_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  },
  test: {
    username: 'chatbot_test',
    password: 'test_password',
    database: 'chatbot_test_db',
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
