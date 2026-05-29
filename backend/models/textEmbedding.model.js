const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const TextEmbedding = sequelize.define(
  "TextEmbedding",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    text_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    model_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    embedding: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  },
  {
    tableName: "TextEmbeddings",
    timestamps: true,
  }
);

module.exports = TextEmbedding;