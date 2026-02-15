const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");
const Word = require("./word.model");

const SemanticChange = sequelize.define("SemanticChange", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  change_score: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  normalized_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  change_category: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: false
});

// Relationship
SemanticChange.belongsTo(Word, { foreignKey: "word_id", onDelete: "CASCADE" });
Word.hasMany(SemanticChange, { foreignKey: "word_id" });

module.exports = SemanticChange;