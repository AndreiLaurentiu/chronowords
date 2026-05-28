const { sequelize } = require("../models");
const { QueryTypes } = require("sequelize");

const TARGET_WORDS = ["power", "change", "knowledge"];
const METHOD = "axis_method";

// ======================================================
// Helpers
// ======================================================

function normalizeWord(value) {
  return String(value || "").toLowerCase().trim();
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function addWeightedTokens(vector, tokens, weight = 1) {
  for (const token of tokens) {
    vector[token] = (vector[token] || 0) + weight;
  }
}

function cosineSimilarity(vecA, vecB) {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const key of keys) {
    const a = vecA[key] || 0;
    const b = vecB[key] || 0;

    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function arrayToText(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.join(" ");
  }

  return String(value);
}

// ======================================================
// Load axis profiles
// ======================================================

async function loadAxisRows() {
  return sequelize.query(
    `
    SELECT
      w.id AS word_id,
      w.word AS word,
      a.axis_id AS axis_global_id,
      a.axis_name AS axis_name,
      a.top_pos_words AS top_pos_words,
      a.top_neg_words AS top_neg_words,
      a.change_weight AS change_weight,
      wae.signed_projection AS signed_projection,
      wae.rank AS rank
    FROM "WordAxisExplanations" wae
    JOIN "Words" w
      ON w.id = wae.word_id
    JOIN "Axes" a
      ON a.axis_id = wae.axis_id
    WHERE w.word IN (:targetWords)
    ORDER BY w.word, wae.rank
    `,
    {
      replacements: {
        targetWords: TARGET_WORDS,
      },
      type: QueryTypes.SELECT,
    }
  );
}

function buildProfiles(axisRows) {
  const profiles = new Map();

  for (const row of axisRows) {
    const word = normalizeWord(row.word);

    if (!profiles.has(word)) {
      profiles.set(word, {
        word,
        wordId: row.word_id,
        vector: {},
        axisCount: 0,
      });
    }

    const profile = profiles.get(word);
    profile.axisCount += 1;

    const changeWeight = Number(row.change_weight || row.signed_projection || 1);
    const weight = Number.isFinite(changeWeight) ? Math.max(changeWeight, 0.1) : 1;

    const axisNameTokens = tokenize(row.axis_name);
    const posTokens = tokenize(arrayToText(row.top_pos_words));
    const negTokens = tokenize(arrayToText(row.top_neg_words));

    addWeightedTokens(profile.vector, axisNameTokens, 2.0 * weight);
    addWeightedTokens(profile.vector, posTokens, 1.5 * weight);
    addWeightedTokens(profile.vector, negTokens, 1.0 * weight);
  }

  return profiles;
}

function computePairwiseSimilarities(profiles) {
  const result = [];
  const profileList = [...profiles.values()];

  for (const source of profileList) {
    for (const target of profileList) {
      if (source.word === target.word) continue;

      const similarity = cosineSimilarity(source.vector, target.vector);

      result.push({
        wordId: source.wordId,
        neighborWordId: target.wordId,
        sourceWord: source.word,
        neighborWord: target.word,
        similarity,
      });
    }
  }

  return result.sort((a, b) => {
    if (a.sourceWord !== b.sourceWord) {
      return a.sourceWord.localeCompare(b.sourceWord);
    }

    return b.similarity - a.similarity;
  });
}

// ======================================================
// DB insert
// ======================================================

async function clearOldAxisSimilarDrift(transaction) {
  await sequelize.query(
    `
    DELETE FROM "WordSimilarDrift"
    WHERE method = :method
      AND word_id IN (
        SELECT id
        FROM "Words"
        WHERE word IN (:targetWords)
      )
    `,
    {
      replacements: {
        method: METHOD,
        targetWords: TARGET_WORDS,
      },
      transaction,
    }
  );
}

async function insertSimilarDriftRows(rows, transaction) {
  let inserted = 0;

  for (const row of rows) {
    await sequelize.query(
      `
      INSERT INTO "WordSimilarDrift" (
        word_id,
        neighbor_word_id,
        similarity,
        method,
        created_at
      )
      VALUES (
        :wordId,
        :neighborWordId,
        :similarity,
        :method,
        NOW()
      )
      `,
      {
        replacements: {
          wordId: row.wordId,
          neighborWordId: row.neighborWordId,
          similarity: row.similarity,
          method: METHOD,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    inserted += 1;
  }

  return inserted;
}

// ======================================================
// Main
// ======================================================

async function main() {
  console.log("Seed similar drift using axis method");

  await sequelize.authenticate();

  const transaction = await sequelize.transaction();

  try {
    console.log("Loading axis profiles...");
    const axisRows = await loadAxisRows();

    console.log("Loaded axis rows:", axisRows.length);

    if (axisRows.length === 0) {
      throw new Error("No axis rows found. Insert axes before running this script.");
    }

    const profiles = buildProfiles(axisRows);

    console.log(
      "Profiles:",
      [...profiles.values()].map((p) => ({
        word: p.word,
        wordId: p.wordId,
        axisCount: p.axisCount,
        featureCount: Object.keys(p.vector).length,
      }))
    );

    const similarities = computePairwiseSimilarities(profiles);

    console.log("Computed similarities:");
    console.table(
      similarities.map((x) => ({
        word: x.sourceWord,
        similar_word: x.neighborWord,
        similarity: Number(x.similarity.toFixed(4)),
      }))
    );

    console.log("Clearing old axis_method rows...");
    await clearOldAxisSimilarDrift(transaction);

    console.log("Inserting axis_method similar drift rows...");
    const inserted = await insertSimilarDriftRows(similarities, transaction);

    await transaction.commit();

    console.log("\nDONE ✅");
    console.log("Inserted rows:", inserted);
  } catch (error) {
    await transaction.rollback();

    console.error("\nFAILED ❌");
    console.error(error);

    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();