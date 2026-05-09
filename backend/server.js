require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
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