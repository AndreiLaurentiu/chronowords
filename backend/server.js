require("dotenv").config();

console.log("GEMINI loaded in server:", !!process.env.GEMINI_API_KEY);
console.log("GEMINI starts with:", process.env.GEMINI_API_KEY?.slice(0, 6));
console.log("PYTHON_PATH:", process.env.PYTHON_PATH);

const express = require("express");
const cors = require("cors");

const app = express();
app.set("trust proxy", 1);
const sequelize = require("./config/db.config");
const wordRoutes = require("./routes/word.routes");
const { apiLimiter, heavyLimiter } = require("./rateLimit");

app.use(cors());
app.use(express.json());

app.use("/api", apiLimiter);

app.use("/api/words", apiLimiter);

app.use("/api", wordRoutes);

const PORT = process.env.PORT || 5000;

sequelize.sync().then(() => {
  console.log("Database connected.");
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});