const express = require("express");
const router = express.Router();
const wordController = require("../controllers/word.controller");

// Ensure API prefix is correct
router.get("/words/:word", wordController.getWordDetails);

module.exports = router;
