const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { QueryTypes } = require("sequelize");

const {
  sequelize,
  Word,
  Dataset,
  SemanticChange,
} = require("../models");

// ======================================================
// CONFIG
// ======================================================

const WINDOWS_DATA_ROOT = "C:/Users/andre/PycharmProjects/master_new_datasets";
const WSL_DATA_ROOT = "/mnt/c/Users/andre/PycharmProjects/master_new_datasets";

const DATA_ROOT = fs.existsSync(WSL_DATA_ROOT) ? WSL_DATA_ROOT : WINDOWS_DATA_ROOT;

const T1_CLUSTERED = path.join(DATA_ROOT, "gutenberg_run", "t1_clustered_minilm.csv");
const T2_CLUSTERED = path.join(DATA_ROOT, "ao3_run", "t2_clustered_ao3_minilm.csv");

const WORD2VEC_SCORES = path.join(
  DATA_ROOT,
  "word2vec_static_run",
  "static_change_scores_word2vec.csv"
);

const WORD2VEC_NEIGHBORS = path.join(
  DATA_ROOT,
  "word2vec_static_run",
  "word2vec_neighbors_t1_t2.csv"
);

const WORDS = ["power", "change", "knowledge"];

const DATASET_T1 = {
  name: "Gutenberg historical corpus",
  time_period: "t1",
};

const DATASET_T2 = {
  name: "AO3 modern narrative corpus",
  time_period: "t2",
};

// ======================================================
// HELPERS
// ======================================================

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function readCsv(filePath) {
  assertFileExists(filePath);

  const raw = fs.readFileSync(filePath, "utf8");

  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });
}

function normalizeWord(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeSentence(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function hasAttr(model, attrName) {
  return Boolean(model.rawAttributes && model.rawAttributes[attrName]);
}

function pickFirstExistingAttr(model, possibleNames) {
  return possibleNames.find((name) => hasAttr(model, name)) || null;
}

// ======================================================
// DB COLUMN HELPERS
// ======================================================

async function getTableColumns(tableName, transaction) {
  const rows = await sequelize.query(
    `
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = :tableName
    ORDER BY ordinal_position
    `,
    {
      replacements: { tableName },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  const map = new Map();

  for (const row of rows) {
    map.set(row.column_name, {
      isNullable: row.is_nullable === "YES",
    });
  }

  return map;
}

function addTimestampColumnsIfNeeded(payload, columns) {
  const now = new Date();

  if (columns.has("createdAt") && payload.createdAt === undefined) {
    payload.createdAt = now;
  }

  if (columns.has("updatedAt") && payload.updatedAt === undefined) {
    payload.updatedAt = now;
  }

  if (columns.has("created_at") && payload.created_at === undefined) {
    payload.created_at = now;
  }

  if (columns.has("updated_at") && payload.updated_at === undefined) {
    payload.updated_at = now;
  }

  return payload;
}

function filterPayloadToExistingColumns(payload, columns) {
  const filtered = {};

  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

async function insertRowReturningId({ tableName, payload, columns, transaction }) {
  const finalPayload = filterPayloadToExistingColumns(
    addTimestampColumnsIfNeeded({ ...payload }, columns),
    columns
  );

  const keys = Object.keys(finalPayload);

  if (keys.length === 0) {
    throw new Error(`No valid columns to insert into ${tableName}`);
  }

  const columnSql = keys.map(quoteIdent).join(", ");
  const valueSql = keys.map((key) => `:${key}`).join(", ");

  const rows = await sequelize.query(
    `
    INSERT INTO ${quoteIdent(tableName)} (${columnSql})
    VALUES (${valueSql})
    RETURNING id
    `,
    {
      replacements: finalPayload,
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return rows[0].id;
}

// ======================================================
// FIND / CREATE
// ======================================================

async function findOrCreateDataset(data, transaction) {
  const existing = await Dataset.findOne({
    where: {
      name: data.name,
      time_period: data.time_period,
    },
    transaction,
  });

  if (existing) return existing;

  return Dataset.create(
    {
      ...data,
      createdAt: new Date(),
    },
    { transaction }
  );
}

async function findOrCreateWord(word, transaction) {
  const existing = await Word.findOne({
    where: {
      word,
      part_of_speech: "noun",
    },
    transaction,
  });

  if (existing) return existing;

  return Word.create(
    {
      word,
      part_of_speech: "noun",
      createdAt: new Date(),
    },
    { transaction }
  );
}

// ======================================================
// CLEAR OLD TEXTS + CLUSTERS
// ======================================================

async function clearOldTextsAndClusters({ wordRows, datasetRows, transaction }) {
  const wordIds = wordRows.map((w) => w.id);
  const datasetIds = datasetRows.map((d) => d.id);

  console.log("Deleting old cluster assignments for these words...");

  await sequelize.query(
    `
    DELETE FROM "ClusterAssignments"
    WHERE word_id IN (:wordIds)
    `,
    {
      replacements: { wordIds },
      transaction,
    }
  );

  console.log("Deleting old texts for these words/datasets...");

  await sequelize.query(
    `
    DELETE FROM "Texts"
    WHERE word_id IN (:wordIds)
      AND dataset_id IN (:datasetIds)
    `,
    {
      replacements: { wordIds, datasetIds },
      transaction,
    }
  );
}

// ======================================================
// INSERT TEXTS + CLUSTERS
// ======================================================

function getTextContentColumn(textColumns) {
  if (textColumns.has("content")) return "content";
  if (textColumns.has("sentence")) return "sentence";
  if (textColumns.has("text")) return "text";

  throw new Error(
    'Could not find text column in "Texts". Expected one of: content, sentence, text.'
  );
}

function buildClusterPayload({ clusterColumns, wordId, textId, clusterIndex, period }) {
  const payload = {};

  if (clusterColumns.has("word_id")) payload.word_id = wordId;
  if (clusterColumns.has("text_id")) payload.text_id = textId;

  if (clusterColumns.has("cluster_index")) {
    payload.cluster_index = clusterIndex;
  } else if (clusterColumns.has("cluster")) {
    payload.cluster = clusterIndex;
  }

  if (clusterColumns.has("jsd")) payload.jsd = null;
  if (clusterColumns.has("semantic_change")) payload.semantic_change = period;
  if (clusterColumns.has("conclusion_t1")) payload.conclusion_t1 = null;
  if (clusterColumns.has("conclusion_t2")) payload.conclusion_t2 = null;

  return payload;
}

async function insertTextsAndClusters({
  rows,
  datasetRow,
  wordMap,
  period,
  textColumns,
  clusterColumns,
  transaction,
}) {
  const textContentColumn = getTextContentColumn(textColumns);

  let insertedTexts = 0;
  let insertedClusters = 0;
  let skipped = 0;

  for (const row of rows) {
    const word = normalizeWord(row.target);

    if (!WORDS.includes(word)) {
      skipped += 1;
      continue;
    }

    const wordRow = wordMap.get(word);
    if (!wordRow) {
      skipped += 1;
      continue;
    }

    const sentence = normalizeSentence(row.sentence);
    if (!sentence) {
      skipped += 1;
      continue;
    }

    const clusterIndex = safeNumber(row.cluster);
    if (clusterIndex === null) {
      skipped += 1;
      continue;
    }

    const textPayload = {
      word_id: wordRow.id,
      dataset_id: datasetRow.id,
      [textContentColumn]: sentence,
    };

    const textId = await insertRowReturningId({
      tableName: "Texts",
      payload: textPayload,
      columns: textColumns,
      transaction,
    });

    insertedTexts += 1;

    const clusterPayload = buildClusterPayload({
      clusterColumns,
      wordId: wordRow.id,
      textId,
      clusterIndex,
      period,
    });

    await insertRowReturningId({
      tableName: "ClusterAssignments",
      payload: clusterPayload,
      columns: clusterColumns,
      transaction,
    });

    insertedClusters += 1;
  }

  return {
    insertedTexts,
    insertedClusters,
    skipped,
  };
}

// ======================================================
// WORD2VEC STATIC RESULTS
// ======================================================

function buildWord2VecScoreMap(scoreRows) {
  const map = new Map();

  for (const row of scoreRows) {
    const word = normalizeWord(row.word || row.target);

    if (!word) continue;

    map.set(word, row);
  }

  return map;
}

function buildWord2VecNeighborMap(neighborRows) {
  const map = new Map();

  for (const row of neighborRows) {
    const word = normalizeWord(row.word || row.target);

    if (!word) continue;

    if (!map.has(word)) {
      map.set(word, []);
    }

    map.get(word).push(row);
  }

  return map;
}

function detectWord2VecColumns() {
  const scoreAttr = pickFirstExistingAttr(SemanticChange, [
    "static_change_score",
    "word2vec_change_score",
    "word2vec_score",
    "static_score",
    "static_embedding_score",
  ]);

  const t1NeighborsAttr = pickFirstExistingAttr(SemanticChange, [
    "word2vec_t1_neighbors",
    "t1_neighbors",
    "static_t1_neighbors",
  ]);

  const t2NeighborsAttr = pickFirstExistingAttr(SemanticChange, [
    "word2vec_t2_neighbors",
    "t2_neighbors",
    "static_t2_neighbors",
  ]);

  return {
    scoreAttr,
    t1NeighborsAttr,
    t2NeighborsAttr,
  };
}

function getStaticScore(row) {
  const possibleColumns = [
    "static_word2vec_cosine_distance",
    "word2vec_cosine_distance",
    "cosine_distance",
    "static_change_score",
    "change_score",
    "score",
  ];

  for (const col of possibleColumns) {
    if (row[col] !== undefined) {
      const n = safeNumber(row[col]);
      if (n !== null) return n;
    }
  }

  return null;
}

function extractNeighborsForWord(rowsForWord, period) {
  if (!rowsForWord || rowsForWord.length === 0) return [];

  const periodCols =
    period === "t1"
      ? ["t1_neighbors", "neighbors_t1", "T1 neighbors", "t1"]
      : ["t2_neighbors", "neighbors_t2", "T2 neighbors", "t2"];

  for (const row of rowsForWord) {
    for (const col of periodCols) {
      if (row[col]) {
        return String(row[col])
          .split(/[;,]/)
          .map((x) => x.trim())
          .filter(Boolean);
      }
    }
  }

  const oneNeighborCols =
    period === "t1"
      ? ["neighbor_t1", "t1_neighbor", "t1"]
      : ["neighbor_t2", "t2_neighbor", "t2"];

  const result = [];

  for (const row of rowsForWord) {
    for (const col of oneNeighborCols) {
      if (row[col]) {
        result.push(String(row[col]).trim());
      }
    }
  }

  return result.filter(Boolean);
}

async function updateWord2VecResults({ wordMap, transaction }) {
  const columns = detectWord2VecColumns();

  console.log("\nWord2Vec DB column detection:");
  console.log(columns);

  if (!columns.scoreAttr && !columns.t1NeighborsAttr && !columns.t2NeighborsAttr) {
    console.log("\n[WARN] No Word2Vec/static columns found in SemanticChange model.");
    console.log("[WARN] Clusters were inserted, but static Word2Vec scores were not stored.");
    console.log("[WARN] We can add a new table or columns next.");
    return {
      updated: 0,
      skippedBecauseNoColumns: true,
    };
  }

  if (!fs.existsSync(WORD2VEC_SCORES)) {
    console.log(`[WARN] Word2Vec score file not found: ${WORD2VEC_SCORES}`);
    return {
      updated: 0,
      skippedBecauseMissingFile: true,
    };
  }

  const scoreRows = readCsv(WORD2VEC_SCORES);
  const scoreMap = buildWord2VecScoreMap(scoreRows);

  let neighborMap = new Map();

  if (fs.existsSync(WORD2VEC_NEIGHBORS)) {
    const neighborRows = readCsv(WORD2VEC_NEIGHBORS);
    neighborMap = buildWord2VecNeighborMap(neighborRows);
  } else {
    console.log(`[WARN] Word2Vec neighbor file not found: ${WORD2VEC_NEIGHBORS}`);
  }

  let updated = 0;

  for (const word of WORDS) {
    const wordRow = wordMap.get(word);
    const scoreRow = scoreMap.get(word);

    if (!wordRow || !scoreRow) continue;

    const semanticChange = await SemanticChange.findOne({
      where: {
        word_id: wordRow.id,
      },
      transaction,
    });

    if (!semanticChange) {
      console.log(`[WARN] No SemanticChange row found for word: ${word}`);
      continue;
    }

    const patch = {};

    if (columns.scoreAttr) {
      const score = getStaticScore(scoreRow);
      if (score !== null) {
        patch[columns.scoreAttr] = score;
      }
    }

    const rowsForWord = neighborMap.get(word) || [];

    if (columns.t1NeighborsAttr) {
      patch[columns.t1NeighborsAttr] = extractNeighborsForWord(rowsForWord, "t1");
    }

    if (columns.t2NeighborsAttr) {
      patch[columns.t2NeighborsAttr] = extractNeighborsForWord(rowsForWord, "t2");
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    await semanticChange.update(patch, { transaction });
    updated += 1;
  }

  return {
    updated,
    skippedBecauseNoColumns: false,
  };
}

// ======================================================
// MAIN
// ======================================================

async function main() {
  console.log("Seed clusters + Word2Vec static results");
  console.log("DATA_ROOT:", DATA_ROOT);

  console.log("\nLoading clustered CSV files...");
  const t1Rows = readCsv(T1_CLUSTERED);
  const t2Rows = readCsv(T2_CLUSTERED);

  console.log("Loaded T1 rows:", t1Rows.length);
  console.log("Loaded T2 AO3 rows:", t2Rows.length);

  console.log("\nConnecting to database...");
  await sequelize.authenticate();

  const transaction = await sequelize.transaction();

  try {
    console.log("\nReading DB table columns...");
    const textColumns = await getTableColumns("Texts", transaction);
    const clusterColumns = await getTableColumns("ClusterAssignments", transaction);

    console.log("Texts columns:", [...textColumns.keys()]);
    console.log("ClusterAssignments columns:", [...clusterColumns.keys()]);

    console.log("\nCreating/finding datasets...");
    const datasetT1 = await findOrCreateDataset(DATASET_T1, transaction);
    const datasetT2 = await findOrCreateDataset(DATASET_T2, transaction);

    console.log("Creating/finding words...");
    const wordMap = new Map();

    for (const word of WORDS) {
      const wordRow = await findOrCreateWord(word, transaction);
      wordMap.set(word, wordRow);
    }

    console.log("\nClearing old texts/clusters for these words...");
    await clearOldTextsAndClusters({
      wordRows: [...wordMap.values()],
      datasetRows: [datasetT1, datasetT2],
      transaction,
    });

    console.log("\nInserting T1 texts + clusters...");
    const t1Stats = await insertTextsAndClusters({
      rows: t1Rows,
      datasetRow: datasetT1,
      wordMap,
      period: "t1",
      textColumns,
      clusterColumns,
      transaction,
    });

    console.log("T1 stats:", t1Stats);

    console.log("\nInserting T2 AO3 texts + clusters...");
    const t2Stats = await insertTextsAndClusters({
      rows: t2Rows,
      datasetRow: datasetT2,
      wordMap,
      period: "t2",
      textColumns,
      clusterColumns,
      transaction,
    });

    console.log("T2 stats:", t2Stats);

    console.log("\nTrying to update Word2Vec static results...");
    const word2vecStats = await updateWord2VecResults({
      wordMap,
      transaction,
    });

    console.log("Word2Vec stats:", word2vecStats);

    await transaction.commit();

    console.log("\nDONE ✅");
    console.log("Inserted T1:", t1Stats);
    console.log("Inserted T2:", t2Stats);
    console.log("Word2Vec:", word2vecStats);
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