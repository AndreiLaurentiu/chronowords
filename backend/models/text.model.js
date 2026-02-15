const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");
const Word = require("./word.model");
const Dataset = require("./dataset.model");

const Text = sequelize.define("Text", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  timestamps: false
});

// Relationships
Text.belongsTo(Word, { foreignKey: "word_id", onDelete: "CASCADE" });

module.exports = Text;
