const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const Axis = sequelize.define("Axis", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  axis_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  axis_name: { type: DataTypes.TEXT, allowNull: false },
  top_pos_words: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
  top_neg_words: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
  change_weight: { type: DataTypes.DOUBLE, allowNull: true },
  tour_pos: { type: DataTypes.INTEGER, allowNull: true },
  label_status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "OK" },
  seed: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: "Axes",
  timestamps: false,
});

module.exports = Axis;