const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DeliveryZone = sequelize.define(
    'DeliveryZone',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Zone name, e.g. "Zona Norte", "Centro"',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Human-readable description (barrios, referencias)',
      },
      // Geographic center point for radius-based matching
      centerLat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        comment: 'Latitude of zone center',
      },
      centerLng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        comment: 'Longitude of zone center',
      },
      radiusKm: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
        comment: 'Coverage radius in kilometers',
      },
      // Locality/neighborhood list for text-based fallback matching
      localities: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of locality/neighborhood names covered by this zone',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Optional polygon GeoJSON or extra config',
      },
    },
    {
      tableName: 'delivery_zones',
      timestamps: true,
      underscored: true,
    },
  );

  return DeliveryZone;
};
