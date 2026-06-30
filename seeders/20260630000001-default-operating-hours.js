'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const defaultHours = [];

    for (let day = 0; day <= 6; day++) {
      defaultHours.push({
        id: uuidv4(),
        day_of_week: day,
        open_time: '08:00:00',
        close_time: '18:00:00',
        delivery_start_time: '10:00:00',
        delivery_end_time: '17:00:00',
        // Monday (1) to Friday (5) active by default
        is_active: day >= 1 && day <= 5,
        created_at: now,
        updated_at: now,
      });
    }

    await queryInterface.bulkInsert('operating_hours', defaultHours);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('operating_hours', null, {});
  },
};
