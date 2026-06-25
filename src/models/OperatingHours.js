const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OperatingHours = sequelize.define(
    'OperatingHours',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      dayOfWeek: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '0=Sunday, 1=Monday, ..., 6=Saturday',
        validate: { min: 0, max: 6 },
      },
      openTime: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Business open time, e.g. "08:00:00"',
      },
      closeTime: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Business close time, e.g. "18:00:00"',
      },
      deliveryStartTime: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Delivery window start, e.g. "10:00:00"',
      },
      deliveryEndTime: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Delivery window end, e.g. "17:00:00"',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether operations run on this day',
      },
    },
    {
      tableName: 'operating_hours',
      timestamps: true,
      underscored: true,
    },
  );

  return OperatingHours;
};
