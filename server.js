const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); // For security headers

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static("public"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});