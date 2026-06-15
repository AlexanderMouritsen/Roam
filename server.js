const fs = require("fs");
const path = require("path");

function loadLocalEnv(filePath = path.join(__dirname, ".env.local")) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const app  = express();
const PORT = process.env.PORT || 3000;
const supabaseOrigin = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null;
const publicOrigin = (process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null))?.replace(/\/+$/, "");

const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const connectSrc = ["'self'"];
if (supabaseOrigin) {
  connectSrc.push(supabaseOrigin);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://unpkg.com"],
      connectSrc,
      styleSrc:   ["'self'", "https://unpkg.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:", "https:"],
    },
  },
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === publicOrigin || localOriginPattern.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const { requireAuth } = require("./middleware/auth");
const { createAuthClient } = require("./config/supabase");

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Routes
const authRouter      = require("./routes/auth");
const countriesRouter = require("./routes/countries");
const profileRouter   = require("./routes/profile");
const tripsRouter     = require("./routes/trips");
const activitiesRouter = require("./routes/activities");
const activitiesRootRouter = require("./routes/activitiesRoot");
const photosRouter    = require("./routes/photos");
const statsRouter     = require("./routes/stats");

app.use("/api/auth",      authRouter);
app.use("/api/countries", countriesRouter);
app.use("/api/users",     profileRouter);
app.use("/api/trips",     tripsRouter);
app.use("/api/trips",     activitiesRouter);
app.use("/api/activities", activitiesRootRouter);
app.use("/api/photos",    photosRouter);
app.use("/api/stats",     statsRouter);

app.get("/api/geojson/countries", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "data", "countries.geojson"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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

app.get("/activities", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "activities.html"));
});

app.get("/settings", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

app.get("/activity/new", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "activity-new.html"));
});

app.get("/activity/:id/edit", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "activity-edit.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;