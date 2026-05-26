const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://unpkg.com"],
      styleSrc:   ["'self'", "https://unpkg.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:", "https:"],
    },
  },
}));

app.use(cors({ origin: `http://localhost:${PORT}`, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const { requireAuth } = require("./middleware/auth");
const { createAuthClient } = require("./config/supabase");
const path = require("path");

app.use(express.static("public"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Routes
const authRouter      = require("./routes/auth");
const countriesRouter = require("./routes/countries");
const profileRouter   = require("./routes/profile");
const tripsRouter     = require("./routes/trips");

app.use("/api/auth",      authRouter);
app.use("/api/countries", countriesRouter);
app.use("/api/users",     profileRouter);
app.use("/api/trips",     tripsRouter);

app.get("/api/geojson/countries", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "data", "countries.geojson"));
});

app.get("/confirm", (req, res) => {
  res.sendFile(__dirname + "/public/confirm.html");
});

app.get("/trips", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "trips.html"));
});

app.get("/trips/:id", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "trip.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});