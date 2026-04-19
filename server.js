const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); // For security headers
const cookieParser = require("cookie-parser");
const supabase = require("./config/supabase");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: "http://localhost:${PORT}",
  credentials: true, // Allow cookies to be sent
}));
app.use(express.json());
app.use(cookieParser()); // lets req.cookies work in middleware and routes

app.use(express.static("public"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
const authRouter = require("./routes/auth");
app.use("/api/auth", authRouter);

const countriesRouter = require("./routes/countries");
app.use("/api/countries", countriesRouter);

const profileRouter = require("./routes/profile");
app.use("/api/users", profileRouter);

app.get("/confirm", (req, res) => {
  res.sendFile(__dirname + "/public/confirm.html");
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
});