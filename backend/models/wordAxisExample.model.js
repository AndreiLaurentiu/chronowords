const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const WordAxisExample = sequelize.define("WordAxisExample", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },

  word_id: { type: DataTypes.INTEGER, allowNull: false },
  axis_id: { type: DataTypes.INTEGER, allowNull: false },

  period: { type: DataTypes.ENUM("t1", "t2"), allowNull: false },

  signed_score: { type: DataTypes.DOUBLE, allowNull: false },
  sentence: { type: DataTypes.TEXT, allowNull: false }
}, {
  tableName: "WordAxisExamples",
  timestamps: false
});

module.exports = WordAxisExample;
