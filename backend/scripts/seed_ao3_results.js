const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const {
  sequelize,
  Word,
  Text,
  Dataset,
  SemanticChange,
  ClusterAssignment,
  Axis,
  WordAxisExplanation,
  WordAxisExample,
  WordSimilarDrift,
} = require("../models");

// ======================================================
// CONFIG
// ======================================================

// WSL path for: C:\Users\andre\PycharmProjects\master_new_datasets
const DATA_ROOT = "/mnt/c/Users/andre/PycharmProjects/master_new_datasets";

const T1_CLUSTERED = path.join(DATA_ROOT, "gutenberg_run", "t1_clustered_minilm.csv");
const T2_CLUSTERED = path.join(DATA_ROOT, "ao3_run", "t2_clustered_ao3_minilm.csv");

const SEMANTIC_REPORT = path.join(DATA_ROOT, "semantic_change_report_ao3.csv");
const AXIS_JSON = path.join(DATA_ROOT, "axis_run", "axis_explanations_ao3.json");

const WORDS = ["power", "change", "knowledge"];

const DATASET_T1 = {
  name: "Gutenberg historical corpus",
  time_period: "t1",
};

const DATASET_T2 = {
  name: "AO3 modern narrative corpus",
  time_period: "t2",
};

// Axis.axis_id must be globally unique.
// Local axis_id from JSON is reused per word, so we prefix it.
const GLOBAL_AXIS_PREFIX = {
  power: 100,
  change: 200,
  knowledge: 300,
};

const MANUAL_AXIS_LABELS = {
  "power:1": {
    label: "Abstract authority → technical/energy power levels",
    explanation:
      "In older texts, power is often abstract capacity or authority. In AO3, this axis captures technical or speculative uses such as weapon power and power levels.",
  },
  "power:2": {
    label: "Interpersonal influence → superhuman ability / power struggle",
    explanation:
      "The older examples describe power as influence or control, while the modern examples include superpowers, majesty, and explicit power struggles.",
  },
  "power:3": {
    label: "Political or social authority → embodied/internal power",
    explanation:
      "T1 uses power as influence, command, or authority. T2 includes embodied or internalized power, such as processing power, rage-fueled power, or heroic ability.",
  },
  "power:4": {
    label: "Formal strength → moral/supernatural responsibility",
    explanation:
      "This axis connects older authority-like uses with modern heroic or supernatural responsibility.",
  },

  "change:1": {
    label: "Transformation → monetary/casual change",
    explanation:
      "The older examples describe change as a shift in state, while the modern examples include concrete monetary uses such as 'plus change'. This reflects sense distribution, not a newly emerged meaning.",
  },
  "change:2": {
    label: "Inner emotional change → relational disruption",
    explanation:
      "Both sides involve transformation, but the modern examples focus more on memories, relationships, and whether past events can be changed.",
  },
  "change:3": {
    label: "Completed transformation → mixed personal and monetary change",
    explanation:
      "This axis mixes personal change with monetary change, so it should be interpreted cautiously.",
  },
  "change:4": {
    label: "Emotional transformation → people and relationships changing",
    explanation:
      "The modern examples emphasize people changing, things changing, and reassurance that something will not change.",
  },

  "knowledge:1": {
    label: "Acquisition of knowledge → hidden/secret knowledge",
    explanation:
      "The older examples focus on acquiring knowledge, while the modern examples frame knowledge as hidden, secret, or linked to mystery.",
  },
  "knowledge:2": {
    label: "Self-knowledge/acquisition → dangerous or burdensome knowledge",
    explanation:
      "The modern examples present knowledge as costly, dangerous, or morally heavy.",
  },
};

const SEMANTIC_EXPLANATIONS = {
  power:
    "Power shows strong variation between the selected periods. T1 often contains abstract, political, moral, or interpersonal uses, while AO3 introduces technical, magical, superhuman, and energy-level contexts.",
  change:
    "Change shows a notable distributional difference. T1 mainly uses it for transformation, altered states, emotional shifts, and changes of scene. AO3 also includes monetary uses such as spare or loose change, which are historically older but more visible in this sample.",
  knowledge:
    "Knowledge appears comparatively more stable. T1 often frames it as learning, acquisition, and intellectual pursuit, while AO3 adds secret, hidden, forbidden, or burdensome knowledge contexts.",
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

function readJson(filePath) {
  assertFileExists(filePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeWord(w) {
  return String(w || "").toLowerCase().trim();
}

function normalizeSentence(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function safeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getChangeCategory(normalizedScore) {
  if (normalizedScore >= 0.75) return "high";
  if (normalizedScore >= 0.4) return "moderate";
  return "low";
}

function getGlobalAxisId(word, localAxisId) {
  return GLOBAL_AXIS_PREFIX[word] + Number(localAxisId);
}

function buildReportMap(reportRows) {
  const map = new Map();

  for (const row of reportRows) {
    const word = normalizeWord(row.word);
    map.set(word, row);
  }

  return map;
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

  return Dataset.create(data, { transaction });
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
    },
    { transaction }
  );
}

// ======================================================
// CLEAR OLD DATA
// ======================================================

async function clearOldData(wordRows, globalAxisIds, transaction) {
  const wordIds = wordRows.map((w) => w.id);

  await WordSimilarDrift.destroy({
    where: {
      word_id: wordIds,
    },
    transaction,
  });

  await WordAxisExample.destroy({
    where: {
      word_id: wordIds,
    },
    transaction,
  });

  await WordAxisExplanation.destroy({
    where: {
      word_id: wordIds,
    },
    transaction,
  });

  await ClusterAssignment.destroy({
    where: {
      word_id: wordIds,
    },
    transaction,
  });

  await SemanticChange.destroy({
    where: {
      word_id: wordIds,
    },
    transaction,
  });

  await Text.destroy({
    where: {
      word_id: wordIds,
    },
    transaction,
  });

  if (globalAxisIds.length > 0) {
    await Axis.destroy({
      where: {
        axis_id: globalAxisIds,
      },
      transaction,
    });
  }
}

// ======================================================
// INSERT TEXTS + CLUSTERS
// ======================================================

async function insertTextsAndClusters({ rows, datasetRow, wordMap, period, transaction }) {
  let inserted = 0;

  for (const row of rows) {
    const word = normalizeWord(row.target);

    if (!WORDS.includes(word)) continue;

    const wordRow = wordMap.get(word);
    if (!wordRow) continue;

    const sentence = normalizeSentence(row.sentence);
    if (!sentence) continue;

    const clusterIndex = safeNumber(row.cluster);
    if (clusterIndex === null) continue;

    const textRow = await Text.create(
      {
        word_id: wordRow.id,
        dataset_id: datasetRow.id,
        content: sentence,
      },
      { transaction }
    );

    await ClusterAssignment.create(
      {
        word_id: wordRow.id,
        text_id: textRow.id,
        cluster_index: clusterIndex,

        // These columns exist in your earlier schema/screenshots.
        // If your ClusterAssignment model does not define them, Sequelize usually ignores unknown fields
        // only if strict model attributes are used. If you get an error, remove these 4 lines.
        jsd: null,
        semantic_change: period,
        conclusion_t1: null,
        conclusion_t2: null,
      },
      { transaction }
    );

    inserted += 1;
  }

  return inserted;
}

// ======================================================
// INSERT SEMANTIC CHANGE SCORES
// ======================================================

async function insertSemanticChanges({ reportMap, wordMap, transaction }) {
  const scores = [];

  for (const word of WORDS) {
    const row = reportMap.get(word);
    if (!row) continue;

    const score = safeNumber(row.global_shift_mean);
    if (score !== null) scores.push(score);
  }

  const maxScore = scores.length ? Math.max(...scores) : 1;

  for (const word of WORDS) {
    const wordRow = wordMap.get(word);
    const row = reportMap.get(word);

    if (!wordRow || !row) continue;

    const score = safeNumber(row.global_shift_mean, 0);
    const normalizedScore = maxScore > 0 ? score / maxScore : 0;

    await SemanticChange.create(
      {
        word_id: wordRow.id,
        change_score: score,
        normalized_score: normalizedScore,
        change_category: getChangeCategory(normalizedScore),
        explanation: SEMANTIC_EXPLANATIONS[word] || null,
      },
      { transaction }
    );
  }
}

// ======================================================
// INSERT AXES
// ======================================================

async function upsertAxis(axisData, transaction) {
  const existing = await Axis.findOne({
    where: {
      axis_id: axisData.axis_id,
    },
    transaction,
  });

  if (existing) {
    await existing.update(axisData, { transaction });
    return existing;
  }

  return Axis.create(axisData, { transaction });
}

async function insertAxes({ axesJson, wordMap, transaction }) {
  let axesInserted = 0;
  let examplesInserted = 0;
  let explanationsInserted = 0;

  for (const item of axesJson) {
    const word = normalizeWord(item.word);
    if (!WORDS.includes(word)) continue;

    const wordRow = wordMap.get(word);
    if (!wordRow) continue;

    const localAxisId = Number(item.axis_id);
    const globalAxisId = getGlobalAxisId(word, localAxisId);

    const manual = MANUAL_AXIS_LABELS[`${word}:${localAxisId}`];

    const axisName =
      manual?.label || item.axis_label_guess || `${word} axis ${localAxisId}`;

    const axisRow = await upsertAxis(
      {
        axis_id: globalAxisId,
        axis_name: axisName,
        top_pos_words: item.t2_keywords || [],
        top_neg_words: item.t1_keywords || [],
        change_weight: safeNumber(item.axis_distance, 0),
        tour_pos: localAxisId,
        label_status: manual ? "MANUAL" : "AUTO",
        seed: null,
      },
      transaction
    );

    axesInserted += 1;

    await WordAxisExplanation.create(
      {
        word_id: wordRow.id,

        // IMPORTANT:
        // This should be Axis.id, not Axis.axis_id.
        axis_id: axisRow.id,

        signed_projection: safeNumber(item.axis_distance, 0),
        rank: localAxisId,
      },
      { transaction }
    );

    explanationsInserted += 1;

    for (const sentence of item.t1_examples || []) {
      await WordAxisExample.create(
        {
          word_id: wordRow.id,
          axis_id: axisRow.id,
          period: "t1",
          signed_score: -Math.abs(safeNumber(item.axis_distance, 0)),
          sentence: normalizeSentence(sentence),
        },
        { transaction }
      );

      examplesInserted += 1;
    }

    for (const sentence of item.t2_examples || []) {
      await WordAxisExample.create(
        {
          word_id: wordRow.id,
          axis_id: axisRow.id,
          period: "t2",
          signed_score: Math.abs(safeNumber(item.axis_distance, 0)),
          sentence: normalizeSentence(sentence),
        },
        { transaction }
      );

      examplesInserted += 1;
    }
  }

  return {
    axesInserted,
    explanationsInserted,
    examplesInserted,
  };
}

// ======================================================
// MAIN
// ======================================================

async function main() {
  console.log("Loading files...");
  console.log("DATA_ROOT:", DATA_ROOT);

  const t1Rows = readCsv(T1_CLUSTERED);
  const t2Rows = readCsv(T2_CLUSTERED);
  const reportRows = readCsv(SEMANTIC_REPORT);
  const axesJson = readJson(AXIS_JSON);

  console.log("Loaded T1 rows:", t1Rows.length);
  console.log("Loaded T2 rows:", t2Rows.length);
  console.log("Loaded report rows:", reportRows.length);
  console.log("Loaded axes:", axesJson.length);

  const reportMap = buildReportMap(reportRows);

  console.log("Connecting to database...");
  await sequelize.authenticate();

  const transaction = await sequelize.transaction();

  try {
    console.log("Creating/finding datasets...");
    const datasetT1 = await findOrCreateDataset(DATASET_T1, transaction);
    const datasetT2 = await findOrCreateDataset(DATASET_T2, transaction);

    console.log("Creating/finding words...");
    const wordMap = new Map();

    for (const word of WORDS) {
      const wordRow = await findOrCreateWord(word, transaction);
      wordMap.set(word, wordRow);
    }

    const globalAxisIds = [];

    for (const item of axesJson) {
      const word = normalizeWord(item.word);
      if (!WORDS.includes(word)) continue;

      globalAxisIds.push(getGlobalAxisId(word, item.axis_id));
    }

    console.log("Clearing previous AO3/Gutenberg seeded data for these words...");
    await clearOldData([...wordMap.values()], globalAxisIds, transaction);

    console.log("Inserting T1 texts + cluster assignments...");
    const insertedT1 = await insertTextsAndClusters({
      rows: t1Rows,
      datasetRow: datasetT1,
      wordMap,
      period: "t1",
      transaction,
    });

    console.log("Inserting T2 AO3 texts + cluster assignments...");
    const insertedT2 = await insertTextsAndClusters({
      rows: t2Rows,
      datasetRow: datasetT2,
      wordMap,
      period: "t2",
      transaction,
    });

    console.log("Inserting semantic change scores...");
    await insertSemanticChanges({
      reportMap,
      wordMap,
      transaction,
    });

    console.log("Inserting axes, axis explanations, and axis examples...");
    const axisStats = await insertAxes({
      axesJson,
      wordMap,
      transaction,
    });

    await transaction.commit();

    console.log("\nDONE ✅");
    console.log("Inserted T1 texts/clusters:", insertedT1);
    console.log("Inserted T2 texts/clusters:", insertedT2);
    console.log("Axis stats:", axisStats);
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