const sequelize = require("../config/db.config");
const Word = require("./word.model");
const Text = require("./text.model");
const Dataset = require("./dataset.model");
const SemanticChange = require("./semanticChange.model");
const ClusterAssignment = require("./clusterAssignment.model");
const Axis = require("./axis.model");
const WordAxisExplanation = require("./wordAxisExplanation.model");
const WordAxisExample = require("./wordAxisExample.model");
const WordSimilarDrift = require("./wordSimilarDrift.model");
const TextEmbedding = require("./textEmbedding.model");

Word.hasMany(SemanticChange, { as: "semanticChanges", foreignKey: "word_id" });
SemanticChange.belongsTo(Word, { foreignKey: "word_id" });

Word.hasMany(Text, { as: "texts", foreignKey: "word_id" });
Text.belongsTo(Word, { foreignKey: "word_id" });

Dataset.hasMany(Text, { as: "texts", foreignKey: "dataset_id" });
Text.belongsTo(Dataset, { as: "dataset", foreignKey: "dataset_id" });

Word.hasMany(ClusterAssignment, { as: "clusters", foreignKey: "word_id" });
ClusterAssignment.belongsTo(Word, { foreignKey: "word_id" });

Text.hasMany(ClusterAssignment, { as: "clusterAssignments", foreignKey: "text_id" });
ClusterAssignment.belongsTo(Text, { as: "text", foreignKey: "text_id" });

Axis.hasMany(WordAxisExplanation, { as: "wordExplanations", foreignKey: "axis_id" });
WordAxisExplanation.belongsTo(Axis, { as: "axis", foreignKey: "axis_id" });

Word.hasMany(WordAxisExplanation, { as: "axisExplanations", foreignKey: "word_id" });
WordAxisExplanation.belongsTo(Word, { foreignKey: "word_id" });

Word.hasMany(WordAxisExample, { as: "axisExamples", foreignKey: "word_id" });
WordAxisExample.belongsTo(Word, { foreignKey: "word_id" });

Axis.hasMany(WordAxisExample, { as: "examples", foreignKey: "axis_id" });
WordAxisExample.belongsTo(Axis, { as: "axis", foreignKey: "axis_id" });

Word.hasMany(WordSimilarDrift, { as: "similarDrift", foreignKey: "word_id" });
WordSimilarDrift.belongsTo(Word, { as: "word", foreignKey: "word_id" });

WordSimilarDrift.belongsTo(Word, { as: "neighbor", foreignKey: "neighbor_word_id" });

Text.hasMany(TextEmbedding, {
  foreignKey: "text_id",
  as: "embeddings",
});

TextEmbedding.belongsTo(Text, {
  foreignKey: "text_id",
  as: "text",
});

module.exports = {
  Word,
  Text,
  Dataset,
  SemanticChange,
  ClusterAssignment,
  TextEmbedding,
  Axis,
  WordAxisExplanation,
  WordAxisExample,
  WordSimilarDrift,

  sequelize
};
