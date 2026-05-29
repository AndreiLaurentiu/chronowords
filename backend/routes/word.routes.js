const express = require("express");
const router = express.Router();
const wordController = require("../controllers/word.controller");

router.get("/words/suggest", wordController.suggestWords);

// Sense Explorer POC
router.post("/words/sense-explorer", wordController.exploreSense);

// Word details
router.get("/words/:word", wordController.getWordDetails);

module.exports = router;