const { Op } = require("sequelize");

const { GoogleGenAI } = require("@google/genai");

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

  console.log("GEMINI loaded in controller:", !!process.env.GEMINI_API_KEY);
console.log("gemini client exists:", !!gemini);

const {
  sequelize,
  Word,
  SemanticChange,
  Text,
  Dataset,
  ClusterAssignment,
  Axis,
  WordAxisExplanation,
  WordAxisExample,
  WordSimilarDrift,
  TextEmbedding,
} = require("../models");

exports.getWordDetails = async (req, res) => {
  console.log("🔥 HIT getWordDetails:", req.method, req.originalUrl);

  try {
    const { word: wordParam } = req.params;

    // 1) Base word + semantic score
    const words = await Word.findAll({
      where: { word: wordParam },
      include: [
        {
          model: SemanticChange,
          as: "semanticChanges",
        },
      ],
    });

    if (!words || words.length === 0) {
      return res.status(404).json({ error: "Word not found" });
    }

    const wordIds = words.map((w) => w.id);

    // -------------------------
    // DEBUG optional
    // Use: /api/words/change?debug=1
    // -------------------------
    const debug = req.query.debug === "1";

    if (debug) {
      const wid = wordIds[0];

      const [[rawCntExpl]] = await sequelize.query(
        `SELECT COUNT(*)::int AS c FROM "WordAxisExplanations" WHERE word_id = :wid`,
        { replacements: { wid } }
      );

      const [[rawCntEx]] = await sequelize.query(
        `SELECT COUNT(*)::int AS c FROM "WordAxisExamples" WHERE word_id = :wid`,
        { replacements: { wid } }
      );

      const [[rawCntSim]] = await sequelize.query(
        `SELECT COUNT(*)::int AS c FROM "WordSimilarDrift" WHERE word_id = :wid`,
        { replacements: { wid } }
      );

      console.log("[DEBUG] wordIds:", wordIds);
      console.log("[DEBUG] RAW counts for wid", wid, {
        explanations: rawCntExpl.c,
        examples: rawCntEx.c,
        similar: rawCntSim.c,
      });

      const seqExpl = await WordAxisExplanation.findAll({
        where: { word_id: wid },
        limit: 1,
      });

      console.log(
        "[DEBUG] Sequelize explanations len (wid):",
        seqExpl.length,
        seqExpl[0]?.toJSON?.()
      );
    }

    // 2) Texts for total_examples and period labels
    const allTexts = await Text.findAll({
      where: { word_id: { [Op.in]: wordIds } },
      include: [{ model: Dataset, as: "dataset" }],
    });

    console.log("allTexts length =", allTexts.length);

    if (allTexts[0]) {
      console.log(
        "allTexts sample =",
        allTexts[0].toJSON?.() ?? allTexts[0]
      );

      console.log(
        "allTexts sample dataset =",
        allTexts[0].dataset?.toJSON?.() ?? allTexts[0].dataset
      );
    }

    // 3) Cluster assignments separately
    // Important: nu ne mai bazăm pe word.clusters, pentru că era gol.
    const clusterAssignmentsAll = await ClusterAssignment.findAll({
      where: { word_id: { [Op.in]: wordIds } },
      include: [
        {
          model: Text,
          as: "text",
          include: [{ model: Dataset, as: "dataset" }],
        },
      ],
      order: [
        ["word_id", "ASC"],
        ["cluster_index", "ASC"],
      ],
    });

    console.log("clusterAssignmentsAll length =", clusterAssignmentsAll.length);

    if (clusterAssignmentsAll[0]) {
      console.log(
        "clusterAssignmentsAll sample =",
        clusterAssignmentsAll[0].toJSON?.() ?? clusterAssignmentsAll[0]
      );
    }

    // 4) Axes explanations
    const axisExplanationsAll = await WordAxisExplanation.findAll({
      where: { word_id: { [Op.in]: wordIds } },
      include: [{ model: Axis, as: "axis" }],
      order: [
        ["word_id", "ASC"],
        ["rank", "ASC"],
      ],
    });

    console.log("axisExplanationsAll length =", axisExplanationsAll.length);

    if (axisExplanationsAll[0]) {
      console.log(
        "axisExplanationsAll sample =",
        axisExplanationsAll[0].toJSON?.() ?? axisExplanationsAll[0]
      );
    }

    // Group explanations per word_id, keep top K
    const TOP_K_AXES = 8;
    const axesByWordId = new Map();

    for (const ax of axisExplanationsAll) {
      const wid = Number(ax.word_id);

      if (!axesByWordId.has(wid)) {
        axesByWordId.set(wid, []);
      }

      const arr = axesByWordId.get(wid);

      if (arr.length < TOP_K_AXES) {
        arr.push(ax);
      }
    }

    // Collect axis_ids needed for examples
    const axisIdsNeeded = new Set();

    for (const arr of axesByWordId.values()) {
      for (const ax of arr) {
        const axObj = ax.toJSON ? ax.toJSON() : ax;
        const aid = axObj.axis_id ?? axObj.axisId;

        if (aid != null) {
          axisIdsNeeded.add(aid);
        }
      }
    }

    const axisIdsList = Array.from(axisIdsNeeded);

    // 5) Axis examples
    let axisExamplesAll = [];

    if (axisIdsList.length > 0) {
      axisExamplesAll = await WordAxisExample.findAll({
        where: {
          word_id: { [Op.in]: wordIds },
          axis_id: { [Op.in]: axisIdsList },
        },
        order: [
          ["word_id", "ASC"],
          ["axis_id", "ASC"],
          ["period", "ASC"],
          ["signed_score", "DESC"],
        ],
      });
    }

    console.log("axisExamplesAll length =", axisExamplesAll.length);

    // Build map: word_id -> axis_id -> { t1: [], t2: [] }
    const MAX_EXAMPLES_PER_PERIOD = 6;
    const examplesByWord = new Map();

    for (const ex of axisExamplesAll) {
      const wid = Number(ex.word_id);
      const aid = Number(ex.axis_id);
      const period = ex.period;

      if (!examplesByWord.has(wid)) {
        examplesByWord.set(wid, {});
      }

      const wmap = examplesByWord.get(wid);

      if (!wmap[aid]) {
        wmap[aid] = { t1: [], t2: [] };
      }

      if (!wmap[aid][period]) {
        wmap[aid][period] = [];
      }

      const bucket = wmap[aid][period];

      if (bucket.length >= MAX_EXAMPLES_PER_PERIOD) {
        continue;
      }

      bucket.push({
        signed_score: ex.signed_score,
        sentence: ex.sentence,
      });
    }

    // 6) Similar drift words
    const similarAll = await WordSimilarDrift.findAll({
      where: { word_id: { [Op.in]: wordIds } },
      include: [{ model: Word, as: "neighbor" }],
      order: [
        ["word_id", "ASC"],
        ["similarity", "DESC"],
      ],
    });

    console.log("similarAll length =", similarAll.length);

    // Group: word_id -> top N neighbors
    const TOP_N_SIMILAR = 10;
    const similarByWordId = new Map();

    for (const s of similarAll) {
      const wid = Number(s.word_id);

      if (!similarByWordId.has(wid)) {
        similarByWordId.set(wid, []);
      }

      const arr = similarByWordId.get(wid);

      if (arr.length >= TOP_N_SIMILAR) {
        continue;
      }

      arr.push({
        word: s.neighbor?.word ?? null,
        pos: s.neighbor?.part_of_speech ?? null,
        similarity: s.similarity,
        method: s.method,
      });
    }

    // 7) Helpers for t1 / t2 detection
    const isT1Dataset = (dataset) => {
      if (!dataset) return false;

      const name = String(dataset.name || "").toLowerCase();
      const timePeriod = String(dataset.time_period || "").toLowerCase();

      return (
        name === "semeval_c1" ||
        name.endsWith("_c1") ||
        name.includes("c1") ||
        timePeriod === "1790-1918" ||
        timePeriod === "1810-1860" ||
        timePeriod.includes("1790") ||
        timePeriod.includes("1810")
      );
    };

    const isT2Dataset = (dataset) => {
      if (!dataset) return false;

      const name = String(dataset.name || "").toLowerCase();
      const timePeriod = String(dataset.time_period || "").toLowerCase();

      return (
        name === "semeval_c2" ||
        name.endsWith("_c2") ||
        name.includes("c2") ||
        timePeriod === "2000-present" ||
        timePeriod === "2000-2025" ||
        timePeriod === "1960-2010" ||
        timePeriod.includes("2000") ||
        timePeriod.includes("1960")
      );
    };

    const getPeriodKeyFromDataset = (dataset) => {
      if (isT1Dataset(dataset)) return "t1";
      if (isT2Dataset(dataset)) return "t2";
      return null;
    };

    const getPeriodLabelFromDataset = (dataset, fallback) => {
      if (!dataset) return fallback;

      return (
        dataset.time_period ||
        dataset.period ||
        dataset.period_label ||
        dataset.label ||
        fallback
      );
    };

    // 8) Build response per POS variant
    const results = words.map((word) => {
      const clusters = { t1: {}, t2: {} };
      const periodLabels = { t1: null, t2: null };
      const totalExamples = { t1: 0, t2: 0 };

      const wordIdNumber = Number(word.id);

      // 8.1 Build total_examples from Text rows
      const textsForThisWord = allTexts.filter(
        (text) => Number(text.word_id) === wordIdNumber
      );

      textsForThisWord.forEach((text) => {
        const dataset = text.dataset;

        if (!dataset) {
          console.warn(
            "[WARN] Text has no dataset:",
            text.toJSON?.() ?? text
          );
          return;
        }

        const periodKey = getPeriodKeyFromDataset(dataset);

        if (!periodKey) {
          console.warn(
            "[WARN] Could not classify text dataset as t1/t2:",
            dataset.toJSON?.() ?? dataset
          );
          return;
        }

        totalExamples[periodKey] += 1;

        if (!periodLabels[periodKey]) {
          periodLabels[periodKey] = getPeriodLabelFromDataset(
            dataset,
            periodKey === "t1" ? "T1" : "T2"
          );
        }
      });

      // 8.2 Build clusters from ClusterAssignment rows
      const assignmentsForThisWord = clusterAssignmentsAll.filter(
        (assignment) => Number(assignment.word_id) === wordIdNumber
      );

      assignmentsForThisWord.forEach((assignment) => {
        const dataset = assignment.text?.dataset;

        if (!dataset) {
          console.warn(
            "[WARN] Cluster assignment has no dataset:",
            assignment.toJSON?.() ?? assignment
          );
          return;
        }

        const periodKey = getPeriodKeyFromDataset(dataset);

        if (!periodKey) {
          console.warn(
            "[WARN] Could not classify cluster dataset as t1/t2:",
            dataset.toJSON?.() ?? dataset
          );
          return;
        }

        if (!periodLabels[periodKey]) {
          periodLabels[periodKey] = getPeriodLabelFromDataset(
            dataset,
            periodKey === "t1" ? "T1" : "T2"
          );
        }

        const clusterIdx = assignment.cluster_index ?? "unknown";

        if (!clusters[periodKey][clusterIdx]) {
          clusters[periodKey][clusterIdx] = [];
        }

        if (assignment.text?.content) {
          clusters[periodKey][clusterIdx].push(assignment.text.content);
        }
      });

      const firstAssignmentForThisWord = assignmentsForThisWord[0];

      const conclusion_t1 =
        firstAssignmentForThisWord?.conclusion_t1 ||
        firstAssignmentForThisWord?.dataValues?.conclusion_t1 ||
        null;

      const conclusion_t2 =
        firstAssignmentForThisWord?.conclusion_t2 ||
        firstAssignmentForThisWord?.dataValues?.conclusion_t2 ||
        null;

      const semantic = word.semanticChanges?.[0] || {};

      const semantic_change =
        semantic.normalized_score !== undefined && semantic.normalized_score !== null
          ? {
              normalized_score: semantic.normalized_score,
              change_category: semantic.change_category,
            }
          : null;

      const axisExplanations = axesByWordId.get(wordIdNumber) || [];

      const axes_explanation = axisExplanations.map((ax) => ({
        axis_id: ax.axis_id ?? ax.axisId,
        rank: ax.rank,
        signed_projection: ax.signed_projection ?? ax.signedProjection,
        axis_name: ax.axis?.axis_name ?? null,
        top_pos_words: ax.axis?.top_pos_words ?? [],
        top_neg_words: ax.axis?.top_neg_words ?? [],
        change_weight: ax.axis?.change_weight ?? null,
      }));

      const axis_examples = examplesByWord.get(wordIdNumber) || {};
      const similar_drift_words = similarByWordId.get(wordIdNumber) || [];

      const responseItem = {
        word: word.word,
        pos: word.part_of_speech,
        semantic_change,
        conclusion_t1,
        conclusion_t2,

        clusters,

        total_examples: {
          t1: totalExamples.t1,
          t2: totalExamples.t2,
        },

        period_labels: {
          t1: periodLabels.t1 || "T1",
          t2: periodLabels.t2 || "T2",
        },

        axes_explanation,
        axis_examples,
        similar_drift_words,
      };

      console.log("[DEBUG] response item:", {
        word: responseItem.word,
        pos: responseItem.pos,
        total_examples: responseItem.total_examples,
        period_labels: responseItem.period_labels,
        clusters_t1_count: Object.values(responseItem.clusters.t1).flat().length,
        clusters_t2_count: Object.values(responseItem.clusters.t2).flat().length,
      });

      return responseItem;
    });

    console.log(
      "results[0] axes_explanation len =",
      results?.[0]?.axes_explanation?.length
    );

    console.log(
      "results[0] similar_drift_words len =",
      results?.[0]?.similar_drift_words?.length
    );

    return res.json(results);
  } catch (error) {
    console.error("❌ Error fetching word details:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.suggestWords = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 25);

    if (!q || q.length < 1) {
      return res.json([]);
    }

    const rows = await Word.findAll({
      attributes: ["word", "part_of_speech"],
      where: {
        word: {
          [Op.iLike]: `${q}%`,
        },
      },
      order: [
        ["word", "ASC"],
        ["part_of_speech", "ASC"],
      ],
      limit,
    });

    const suggestions = rows.map((r) => ({
      word: r.word,
      pos: r.part_of_speech,
    }));

    return res.json(suggestions);
  } catch (err) {
    console.error("❌ Error suggesting words:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const isT1DatasetForSense = (dataset) => {
  if (!dataset) return false;

  const name = String(dataset.name || "").toLowerCase();
  const timePeriod = String(dataset.time_period || "").toLowerCase();

  return (
    name === "semeval_c1" ||
    name.endsWith("_c1") ||
    name.includes("c1") ||
    timePeriod === "1790-1918" ||
    timePeriod === "1810-1860" ||
    timePeriod.includes("1790") ||
    timePeriod.includes("1810")
  );
};

const isT2DatasetForSense = (dataset) => {
  if (!dataset) return false;

  const name = String(dataset.name || "").toLowerCase();
  const timePeriod = String(dataset.time_period || "").toLowerCase();

  return (
    name === "semeval_c2" ||
    name.endsWith("_c2") ||
    name.includes("c2") ||
    timePeriod === "2000-present" ||
    timePeriod === "2000-2025" ||
    timePeriod === "1960-2010" ||
    timePeriod.includes("2000") ||
    timePeriod.includes("1960")
  );
};

const getSensePeriodKey = (dataset) => {
  if (isT1DatasetForSense(dataset)) return "t1";
  if (isT2DatasetForSense(dataset)) return "t2";
  return "unknown";
};

const getSensePeriodLabel = (dataset, fallback) => {
  return dataset?.time_period || fallback;
};

const buildLLMSenseInterpretation = async ({
  word,
  pos,
  sense,
  keywords,
  periodLabels,
  matches,
}) => {
  if (!gemini) {
    return {
      interpretation:
        "LLM interpretation is not available because GEMINI_API_KEY is not configured.",
    };
  }

  const bestT1 = matches.t1?.[0]?.similarity || 0;
  const bestT2 = matches.t2?.[0]?.similarity || 0;
  const bestOverall = Math.max(bestT1, bestT2);

  const compactMatches = {
    t1: (matches.t1 || []).slice(0, 4).map((m) => ({
      similarity: m.similarity,
      sentence: String(m.sentence || "")
        .replaceAll("_nn", "")
        .replaceAll("_vb", "")
        .replaceAll("_adj", "")
        .replaceAll("_adv", ""),
    })),
    t2: (matches.t2 || []).slice(0, 4).map((m) => ({
      similarity: m.similarity,
      sentence: String(m.sentence || "")
        .replaceAll("_nn", "")
        .replaceAll("_vb", "")
        .replaceAll("_adj", "")
        .replaceAll("_adv", ""),
    })),
  };

  const prompt = `
    You are helping interpret a semantic change exploration result.

    Target word: ${word}
    Part of speech: ${pos}
    User proposed sense: ${sense}
    Optional keywords: ${(keywords || []).join(", ") || "none"}

    Best similarity in period 1: ${bestT1}
    Best similarity in period 2: ${bestT2}
    Best overall similarity: ${bestOverall}

    Period 1 label: ${periodLabels.t1}
    Top matching examples from period 1:
    ${JSON.stringify(compactMatches.t1, null, 2)}

    Period 2 label: ${periodLabels.t2}
    Top matching examples from period 2:
    ${JSON.stringify(compactMatches.t2, null, 2)}

    Write a short interpretation in 4-6 sentences.

    Important rules:
    - Do not claim definitive semantic change.
    - Do not say that a sense did not exist historically.
    - Only discuss what is supported or not supported by the retrieved examples.
    - If all similarity scores are low, say that the proposed sense is not strongly supported by the available examples.
    - Do not describe a score as weak, moderate, or strong unless it matches these thresholds: below 0.35 = weak, 0.35 to 0.60 = moderate, above 0.60 = strong.
    - Do not invent a sense if the retrieved examples do not support it.
    - Say whether the proposed sense appears more supported in period 1, period 2, both periods, or neither.
    - Use the examples and similarity scores as evidence.
    - Use simple academic English.
    `;

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return {
    interpretation: response.text,
  };
};

const EMBEDDING_MODEL = "gemini-embedding-001";

const getGeminiEmbedding = async (text) => {
  if (!gemini) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await gemini.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });

  const vector =
    response.embeddings?.[0]?.values ||
    response.embedding?.values ||
    response.embeddings?.[0]?.embedding?.values;

  if (!vector || !Array.isArray(vector)) {
    throw new Error("Could not read embedding vector from Gemini response.");
  }

  return vector;
};

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);

    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

exports.exploreSense = async (req, res) => {
  console.log("🔥 HIT exploreSense:", req.method, req.originalUrl);
  console.time("sense-total");

  try {
    const {
      word,
      pos = "nn",
      sense,
      keywords = [],
      topK = 5,
      maxExamplesPerPeriod = 80,
    } = req.body;

    console.log("[Sense] Request body:", {
      word,
      pos,
      senseLength: sense?.length,
      keywordsCount: Array.isArray(keywords) ? keywords.length : 0,
      topK,
      maxExamplesPerPeriod,
    });

    if (!word || !sense) {
      console.timeEnd("sense-total");
      return res.status(400).json({
        error: "Missing required fields: word and sense.",
      });
    }

    const cleanWord = String(word).trim().toLowerCase();
    const cleanPos = String(pos).trim().toLowerCase();
    const cleanSense = String(sense).trim();

    console.time("sense-find-word");

    const targetWord = await Word.findOne({
      where: {
        word: cleanWord,
        part_of_speech: cleanPos,
      },
    });

    console.timeEnd("sense-find-word");

    if (!targetWord) {
      console.timeEnd("sense-total");
      return res.status(404).json({
        error: `Word not found for ${cleanWord}/${cleanPos}.`,
      });
    }

    console.log("[Sense] Found word:", {
      id: targetWord.id,
      word: targetWord.word,
      pos: targetWord.part_of_speech,
    });

    console.time("sense-db-texts");

    const texts = await Text.findAll({
      where: {
        word_id: targetWord.id,
      },
      include: [{ model: Dataset, as: "dataset" }],
      order: [["id", "ASC"]],
    });

    console.timeEnd("sense-db-texts");

    console.log("[Sense] Text rows:", texts.length);

    if (!texts || texts.length === 0) {
      console.timeEnd("sense-total");
      return res.status(404).json({
        error: "No text examples found for this word.",
      });
    }

    const periodLabels = {
      t1: "T1",
      t2: "T2",
    };

    const examplesByPeriod = {
      t1: [],
      t2: [],
      unknown: [],
    };

    console.time("sense-build-examples");

    for (const text of texts) {
      const dataset = text.dataset;
      const period = getSensePeriodKey(dataset);

      if (period === "t1" && periodLabels.t1 === "T1") {
        periodLabels.t1 = getSensePeriodLabel(dataset, "T1");
      }

      if (period === "t2" && periodLabels.t2 === "T2") {
        periodLabels.t2 = getSensePeriodLabel(dataset, "T2");
      }

      examplesByPeriod[period].push({
        text_id: text.id,
        sentence: text.content,
        period,
        dataset: dataset
          ? {
              id: dataset.id,
              name: dataset.name,
              time_period: dataset.time_period,
            }
          : null,
      });
    }

    console.timeEnd("sense-build-examples");

    console.log("[Sense] Examples by period:", {
      t1: examplesByPeriod.t1.length,
      t2: examplesByPeriod.t2.length,
      unknown: examplesByPeriod.unknown.length,
    });

    const candidateExamples = [
      ...examplesByPeriod.t1,
      ...examplesByPeriod.t2,
      ...examplesByPeriod.unknown,
    ];

    console.log("[Sense] Sampled examples:", candidateExamples.length);

    const senseForMatching =
      Array.isArray(keywords) && keywords.length > 0
        ? `${cleanSense}. Related keywords: ${keywords.join(", ")}`
        : cleanSense;

console.time("sense-gemini-embedding");

const senseEmbedding = await getGeminiEmbedding(senseForMatching);

console.timeEnd("sense-gemini-embedding");

const sampledTextIds = candidateExamples.map((ex) => ex.text_id);

console.time("sense-db-embeddings");

const storedEmbeddings = await TextEmbedding.findAll({
  where: {
    text_id: sampledTextIds,
    model_name: EMBEDDING_MODEL,
  },
});

console.timeEnd("sense-db-embeddings");

console.log("[Sense] Stored embeddings found:", storedEmbeddings.length);

if (storedEmbeddings.length === 0) {
  console.timeEnd("sense-total");

  return res.status(404).json({
    error:
      "No stored embeddings found for this word. Please generate embeddings for this word first.",
  });
}

const embeddingByTextId = new Map();

for (const row of storedEmbeddings) {
  embeddingByTextId.set(Number(row.text_id), row.embedding);
}

const groupedMatches = {
  t1: [],
  t2: [],
  unknown: [],
};

for (const ex of candidateExamples) {
  const textEmbedding = embeddingByTextId.get(Number(ex.text_id));

  if (!textEmbedding) {
    continue;
  }

  const similarity = cosineSimilarity(senseEmbedding, textEmbedding);

  const periodKey = ex.period || "unknown";

  if (!groupedMatches[periodKey]) {
    groupedMatches[periodKey] = [];
  }

  groupedMatches[periodKey].push({
    ...ex,
    similarity: Number(similarity.toFixed(4)),
  });
}

  for (const key of Object.keys(groupedMatches)) {
    groupedMatches[key] = groupedMatches[key]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Number(topK) || 5);
  }

  const matches = groupedMatches;

  console.log("[Sense] Gemini embedding matches:", {
    t1: matches.t1?.length || 0,
    t2: matches.t2?.length || 0,
    unknown: matches.unknown?.length || 0,
    bestT1: matches.t1?.[0]?.similarity,
    bestT2: matches.t2?.[0]?.similarity,
  });

  const bestT1 = matches.t1?.[0]?.similarity || 0;
  const bestT2 = matches.t2?.[0]?.similarity || 0;
  const bestOverall = Math.max(bestT1, bestT2);

  let supportLevel = "weak";

  if (bestOverall >= 0.6) {
    supportLevel = "strong";
  } else if (bestOverall >= 0.35) {
    supportLevel = "moderate";
  }

  const hasEnoughEvidence = bestOverall >= 0.6;

console.log("[Sense] Evidence level:", {
  bestT1,
  bestT2,
  bestOverall,
  supportLevel,
  hasEnoughEvidence,
});

  let llmResult;

  if (!hasEnoughEvidence) {
    llmResult = {
      interpretation:
        "The proposed sense is not strongly supported by the available corpus examples. The retrieved examples have low similarity scores, so the system cannot provide reliable evidence that this meaning is present for the selected word.",
    };
  } else {
    console.time("sense-gemini");

    try {
      llmResult = await buildLLMSenseInterpretation({
        word: cleanWord,
        pos: cleanPos,
        sense: cleanSense,
        keywords,
        periodLabels,
        matches,
      });
    } catch (error) {
      console.error("LLM interpretation failed:", error.message);

      llmResult = {
        interpretation:
          "LLM interpretation could not be generated. The examples below were retrieved using Gemini embedding similarity, but the LLM API call failed.",
      };
    }

    console.timeEnd("sense-gemini");
  }

    console.timeEnd("sense-total");

    return res.json({
      word: cleanWord,
      pos: cleanPos,
      proposed_sense: cleanSense,
      keywords,
      period_labels: periodLabels,
      total_examples_available: {
        t1: examplesByPeriod.t1.length,
        t2: examplesByPeriod.t2.length,
        unknown: examplesByPeriod.unknown.length,
      },
      total_examples_checked: storedEmbeddings.length,
      best_similarity: Number(bestOverall.toFixed(4)),
      support_level: supportLevel,
      has_enough_evidence: hasEnoughEvidence,
      matches,
      interpretation: llmResult.interpretation,
      note:
        "This is a POC. It uses precomputed Gemini embeddings for retrieving examples and a Gemini language model for a short interpretation.",
    });
  } catch (error) {
    console.error("❌ Error in exploreSense:", error);
    console.timeEnd("sense-total");

    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};