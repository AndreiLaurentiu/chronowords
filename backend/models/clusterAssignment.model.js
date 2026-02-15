const { DataTypes } = require("sequelize");
const sequelize = require("../config/db.config");

const ClusterAssignment = sequelize.define("ClusterAssignment", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  word_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  text_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  cluster_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  jsd: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  semantic_change: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  conclusion_t1: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  conclusion_t2: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  timestamps: false
});


module.exports = ClusterAssignment;