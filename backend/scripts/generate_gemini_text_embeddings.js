require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const {
  sequelize,
  Word,
  Text,
  Dataset,
  TextEmbedding,
} = require("../models");

const EMBEDDING_MODEL = "gemini-embedding-001";
const BATCH_LIMIT = 50;
const SLEEP_MS = 300;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanSentence = (sentence) => {
  return String(sentence || "")
    .replaceAll("_nn", "")
    .replaceAll("_vb", "")
    .replaceAll("_adj", "")
    .replaceAll("_adv", "")
    .trim();
};

const getEmbeddingVector = async (text) => {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });

  const embedding =
    response.embeddings?.[0]?.values ||
    response.embedding?.values ||
    response.embeddings?.[0]?.embedding?.values;

  if (!embedding || !Array.isArray(embedding)) {
    console.log("Unexpected embedding response:", JSON.stringify(response, null, 2));
    throw new Error("Could not read embedding vector from Gemini response.");
  }

  return embedding;
};

const main = async () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in .env");
  }

  console.log("Generating Gemini embeddings...");
  console.log("Model:", EMBEDDING_MODEL);

  await sequelize.authenticate();
  console.log("Database connected.");

const TARGET_WORDS = ["power", "change", "knowledge"];
const TARGET_POS = "nn";

const targetWords = await Word.findAll({
  where: {
    word: TARGET_WORDS,
    part_of_speech: TARGET_POS,
  },
});

const targetWordIds = targetWords.map((w) => w.id);

console.log(
  "Target words:",
  targetWords.map((w) => `${w.word}/${w.part_of_speech} id=${w.id}`)
);

if (targetWordIds.length === 0) {
  throw new Error("No target words found.");
}

    const texts = await Text.findAll({
    where: {
        word_id: targetWordIds,
    },
    include: [{ model: Dataset, as: "dataset" }],
    order: [["id", "ASC"]],
    });
  console.log("Total Text rows:", texts.length);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < texts.length; i++) {
    const textRow = texts[i];

    const existing = await TextEmbedding.findOne({
      where: {
        text_id: textRow.id,
        model_name: EMBEDDING_MODEL,
      },
    });

    if (existing) {
      skipped += 1;

      if ((i + 1) % 50 === 0) {
        console.log(`Progress ${i + 1}/${texts.length} | created=${created}, skipped=${skipped}, failed=${failed}`);
      }

      continue;
    }

    const cleaned = cleanSentence(textRow.content);

    if (!cleaned) {
      skipped += 1;
      continue;
    }

    try {
      const vector = await getEmbeddingVector(cleaned);

      await TextEmbedding.create({
        text_id: textRow.id,
        model_name: EMBEDDING_MODEL,
        embedding: vector,
      });

      created += 1;

      console.log(
        `Saved embedding ${i + 1}/${texts.length} | text_id=${textRow.id} | dim=${vector.length}`
      );

      await sleep(SLEEP_MS);
    } catch (error) {
      failed += 1;

      console.error(
        `Failed text_id=${textRow.id}:`,
        error.message
      );

      await sleep(1500);
    }

    if ((i + 1) % BATCH_LIMIT === 0) {
      console.log(`Progress ${i + 1}/${texts.length} | created=${created}, skipped=${skipped}, failed=${failed}`);
    }
  }

  console.log("Done.");
  console.log({ created, skipped, failed });

  await sequelize.close();
};

main().catch(async (error) => {
  console.error("Fatal error:", error);
  await sequelize.close();
  process.exit(1);
});