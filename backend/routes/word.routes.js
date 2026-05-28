const express = require("express");
const router = express.Router();
const wordController = require("../controllers/word.controller");

// IMPORTANT: /words/suggest MUST be before /words/:word
router.get("/words/suggest", wordController.suggestWords);

// Sense Explorer POC
router.post("/sense-explorer", wordController.exploreSense);

// Word details
router.get("/words/:word", wordController.getWordDetails);

module.exports = router;