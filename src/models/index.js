const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const databaseConfig = require('../config/database');
const env = require('../config/env');

const sequelize = new Sequelize(
  databaseConfig[env.NODE_ENV].database,
  databaseConfig[env.NODE_ENV].username,
  databaseConfig[env.NODE_ENV].password,
  databaseConfig[env.NODE_ENV],
);

const models = {};

// Load all models
fs.readdirSync(__dirname)
  .filter(
    (file) => file.endsWith('.js') && file !== 'index.js',
  )
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize);
    models[model.name] = model;
  });

// Set up associations
Object.keys(models).forEach((key) => {
  if (models[key].associate) {
    models[key].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
