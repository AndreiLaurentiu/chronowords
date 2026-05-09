const { Op } = require("sequelize");

const {
  sequelize, // 👈 important pentru raw queries (ai nevoie ca models/index.js să exporte sequelize)
  Word,
  SemanticChange,
  Text,
  Dataset,
  ClusterAssignment,
  Axis,
  WordAxisExplanation,
  WordAxisExample,
  WordSimilarDrift,
} = require("../models");

exports.getWordDetails = async (req, res) => {
  console.log("🔥 HIT getWordDetails:", req.method, req.originalUrl);
  try {
    const { word: wordParam } = req.params;

    // 1) Base word + clusters + semantic score
    const words = await Word.findAll({
      where: { word: wordParam },
      include: [
        {
          model: ClusterAssignment,
          as: "clusters",
          include: [
            {
              model: Text,
              as: "text",
              include: [{ model: Dataset, as: "dataset" }],
            },
          ],
        },
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
    // DEBUG (optional but recommended)
    // -------------------------
    const debug = req.query.debug === "1";
    if (debug) {
      const wid = wordIds[0];

      // raw counts from THE SAME backend connection
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

      // quick sequelize sanity for wid
      const seqExpl = await WordAxisExplanation.findAll({ where: { word_id: wid }, limit: 1 });
      console.log("[DEBUG] Sequelize explanations len (wid):", seqExpl.length, seqExpl[0]?.toJSON?.());
    }

    // 2) total_examples (batched)
    const allTexts = await Text.findAll({
      where: { word_id: { [Op.in]: wordIds } },
      include: [{ model: Dataset, as: "dataset" }],
    });

    // 3) Axes explanations (top axes per word_id)
    const axisExplanationsAll = await WordAxisExplanation.findAll({
      where: { word_id: { [Op.in]: wordIds } },
      include: [{ model: Axis, as: "axis" }],
      order: [
        ["word_id", "ASC"],
        ["rank", "ASC"],
      ],
    });

    console.log("axisExplanationsAll length =", axisExplanationsAll.length);
    if (axisExplanationsAll[0]) console.log("axisExplanationsAll sample =", axisExplanationsAll[0].toJSON?.() ?? axisExplanationsAll[0]);


    // Group explanations per word_id, keep top K
    const TOP_K_AXES = 8;
    const axesByWordId = new Map(); // word_id -> array

    for (const ax of axisExplanationsAll) {
      const wid = Number(ax.word_id);
      if (!axesByWordId.has(wid)) axesByWordId.set(wid, []);
      const arr = axesByWordId.get(wid);
      if (arr.length < TOP_K_AXES) arr.push(ax);
    }

    // Collect axis_ids we need examples for (only from selected top axes)
    const axisIdsNeeded = new Set();
    for (const arr of axesByWordId.values()) {
      for (const ax of arr) {
        const axObj = ax.toJSON ? ax.toJSON() : ax;
        const aid = axObj.axis_id ?? axObj.axisId;
        if (aid != null) axisIdsNeeded.add(aid);
      }
    }
    const axisIdsList = Array.from(axisIdsNeeded);

    // 4) Axis examples (for these word_ids + these axis_ids)
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

      if (!examplesByWord.has(wid)) examplesByWord.set(wid, {});
      const wmap = examplesByWord.get(wid);

      if (!wmap[aid]) wmap[aid] = { t1: [], t2: [] };

      const bucket = wmap[aid][period];
      if (bucket.length >= MAX_EXAMPLES_PER_PERIOD) continue;

      bucket.push({
        signed_score: ex.signed_score,
        sentence: ex.sentence,
      });
    }

    // 5) Similar drift words
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
      if (!similarByWordId.has(wid)) similarByWordId.set(wid, []);
      const arr = similarByWordId.get(wid);
      if (arr.length >= TOP_N_SIMILAR) continue;

      arr.push({
        word: s.neighbor?.word ?? null,
        pos: s.neighbor?.part_of_speech ?? null,
        similarity: s.similarity,
        method: s.method,
      });
    }

    // 6) Build response per POS variant
    const results = words.map((word) => {
      const clusters = { t1: {}, t2: {} };

      (word.clusters || []).forEach((assignment) => {
        const dataset = assignment.text?.dataset;
        if (!dataset) return;

        const period = dataset.name === "Semeval_c1" ? "t1" : "t2";
        const clusterIdx = assignment.cluster_index;

        if (!clusters[period][clusterIdx]) clusters[period][clusterIdx] = [];
        clusters[period][clusterIdx].push(assignment.text.content);
      });

      const semantic = word.semanticChanges?.[0] || {};
      const semantic_change =
        semantic.normalized_score !== undefined
          ? {
              normalized_score: semantic.normalized_score,
              change_category: semantic.change_category,
            }
          : null;

      const conclusion_t1 = word.clusters?.[0]?.conclusion_t1 || null;
      const conclusion_t2 = word.clusters?.[0]?.conclusion_t2 || null;

      const textsForThisWord = allTexts.filter((t) => t.word_id === word.id);
      const total_examples = {
        t1: textsForThisWord.filter((t) => t.dataset?.name === "Semeval_c1").length,
        t2: textsForThisWord.filter((t) => t.dataset?.name === "Semeval_c2").length,
      };

      const axisExplanations = axesByWordId.get(word.id) || [];
      const axes_explanation = axisExplanations.map((ax) => ({
        axis_id: ax.axis_id ?? ax.axisId,
        rank: ax.rank,
        signed_projection: ax.signed_projection ?? ax.signedProjection,
        axis_name: ax.axis?.axis_name ?? null,
        top_pos_words: ax.axis?.top_pos_words ?? [],
        top_neg_words: ax.axis?.top_neg_words ?? [],
        change_weight: ax.axis?.change_weight ?? null,
      }));

      const axis_examples = examplesByWord.get(word.id) || {};
      const similar_drift_words = similarByWordId.get(word.id) || [];

      return {
        word: word.word,
        pos: word.part_of_speech,
        semantic_change,
        conclusion_t1,
        conclusion_t2,
        clusters,
        total_examples,

        axes_explanation,
        axis_examples,
        similar_drift_words,
      };
    });

    console.log("results[0] axes_explanation len =", results?.[0]?.axes_explanation?.length);
    console.log("results[0] similar_drift_words len =", results?.[0]?.similar_drift_words?.length);

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

    if (!q || q.length < 1) return res.json([]);

    // If you want to ignore case, you can use iLike on Postgres
    // For other DBs, adapt accordingly.
    const rows = await Word.findAll({
      attributes: ["word", "part_of_speech"],
      where: {
        word: {
          [Op.iLike]: `${q}%`, // prefix match
        },
      },
      // optional: prioritize exact prefix matches naturally via order
      order: [["word", "ASC"], ["part_of_speech", "ASC"]],
      limit,
    });

    // Return as grouped suggestions (same word may have multiple POS)
    // so UI can show: bank (noun), bank (verb)
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