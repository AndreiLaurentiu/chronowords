const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const Dataset = sequelize.define("Dataset", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  time_period: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: false
});

module.exports = Dataset;
