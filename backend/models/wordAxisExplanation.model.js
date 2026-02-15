const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const WordAxisExplanation = sequelize.define("WordAxisExplanation", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },

  word_id: { type: DataTypes.INTEGER, allowNull: false },
  axis_id: { type: DataTypes.INTEGER, allowNull: false },

  signed_projection: { type: DataTypes.DOUBLE, allowNull: false },
  rank: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: "WordAxisExplanations",
  timestamps: false
});

module.exports = WordAxisExplanation;
