const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const WordSimilarDrift = sequelize.define("WordSimilarDrift", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },

  word_id: { type: DataTypes.INTEGER, allowNull: false },
  neighbor_word_id: { type: DataTypes.INTEGER, allowNull: false },

  similarity: { type: DataTypes.DOUBLE, allowNull: false },
  method: { type: DataTypes.TEXT, allowNull: false, defaultValue: "axis_fingerprint" }
}, {
  tableName: "WordSimilarDrift",
  timestamps: false
});

module.exports = WordSimilarDrift;
``