const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const Word = sequelize.define("Word", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  word: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  part_of_speech: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  timestamps: false
});

module.exports = Word;
