// routes/trips.js

const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const path     = require("path");
const supabase = require("../config/supabase");           // anon client — for country validation only
const supabaseAdmin = require("../config/supabaseAdmin");
const { createAuthClient } = require("../config/supabase"); // auth client — for all user data queries
const { requireAuth } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

const COVER_BUCKET = "covers";

// ── GET /api/trips ────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const db = createAuthClient(req.token);

  const { data, error } = await db
    .from("trip")
    .select(`
      id,
      title,
      description,
      country_code,
      cover_photo_url,
      start_date,
      end_date,
      status,
      created_at
    `)
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Trips fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch trips." });
  }

  let activityCounts = {};
  if (data.length > 0) {
    const tripIds = data.map((t) => t.id);

    const { data: activities } = await db
      .from("activities")
      .select("trip_id")
      .eq("user_id", req.user.id)
      .in("trip_id", tripIds);

    if (activities) {
      activities.forEach((a) => {
        activityCounts[a.trip_id] = (activityCounts[a.trip_id] || 0) + 1;
      });
    }
  }

  const trips = data.map((trip) => ({
    ...trip,
    activity_count: activityCounts[trip.id] || 0,
  }));

  res.json(trips);
});

// ── GET /api/trips/:id ────────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req, res) => {
  const db = createAuthClient(req.token);

  const { data, error } = await db
    .from("trip")
    .select(`
      id,
      title,
      description,
      country_code,
      cover_photo_url,
      start_date,
      end_date,
      status,
      created_at,
      updated_at
    `)
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Trip not found." });
    }
    return res.status(500).json({ error: "Failed to fetch trip." });
  }

  const { data: activities, error: activitiesError } = await db
    .from("activities")
    .select(
      "id, trip_id, title, activity_type, location_name, latitude, longitude, notes, start_datetime, is_highlight, created_at, updated_at"
    )
    .eq("trip_id", req.params.id)
    .eq("user_id", req.user.id)
    .order("start_datetime", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (activitiesError) {
    return res.status(500).json({ error: "Failed to fetch activities." });
  }

  let activityPhotos = {};
  if (activities.length > 0) {
    const activityIds = activities.map((activity) => activity.id);

    const { data: photos } = await db
      .from("photos")
      .select("id, activity_id, url, thumbnail_url, caption, taken_at, created_at")
      .in("activity_id", activityIds)
      .eq("user_id", req.user.id);

    (photos || []).forEach((photo) => {
      if (!activityPhotos[photo.activity_id]) {
        activityPhotos[photo.activity_id] = [];
      }
      activityPhotos[photo.activity_id].push(photo);
    });
  }

  const activityList = activities.map((activity) => ({
    ...activity,
    photos: activityPhotos[activity.id] || [],
  }));

  res.json({
    ...data,
    activity_count: activities.length,
    activities: activityList,
  });
});

// ── POST /api/trips/:id/cover ───────────────────────────────────────────────

router.post("/:id/cover", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const db = createAuthClient(req.token);

  const { data: trip, error: tripError } = await db
    .from("trip")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (tripError) {
    if (tripError.code === "PGRST116") {
      return res.status(404).json({ error: "Trip not found." });
    }
    return res.status(500).json({ error: "Failed to verify trip." });
  }

  const extension = path.extname(req.file.originalname || "").toLowerCase() || ".jpg";
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const filePath = `${req.user.id}/trips/${trip.id}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(COVER_BUCKET)
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });

  if (uploadError) {
    console.log("Cover upload error:", uploadError);
    return res.status(500).json({ error: "Failed to upload cover photo." });
  }

  const { data: publicData } = supabaseAdmin
    .storage
    .from(COVER_BUCKET)
    .getPublicUrl(filePath);

  const coverUrl = publicData?.publicUrl;

  const { data: updatedTrip, error: updateError } = await db
    .from("trip")
    .update({ cover_photo_url: coverUrl })
    .eq("id", trip.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({ error: "Failed to save cover photo." });
  }

  res.json(updatedTrip);
});

// ── Validation rules ──────────────────────────────────────────────────────────

const createTripValidation = [
  body("title")
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title must be between 1 and 100 characters."),

  body("country_code")
    .isString()
    .trim()
    .isLength({ min: 2, max: 2 })
    .isAlpha()
    .toUpperCase()
    .withMessage("Invalid country code.")
    .custom(async (code) => {
      // Countries table is public — anon client is fine here
      const { data } = await supabase
        .from("countries")
        .select("code")
        .eq("code", code.toUpperCase())
        .single();
      if (!data) throw new Error("Invalid country code.");
      return true;
    }),

  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters."),

  body("cover_photo_url")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Cover photo must be a valid URL."),

  body("start_date")
    .optional({ checkFalsy: true })
    .isDate()
    .withMessage("Start date must be a valid date (YYYY-MM-DD)."),

  body("end_date")
    .optional({ checkFalsy: true })
    .isDate()
    .withMessage("End date must be a valid date (YYYY-MM-DD).")
    .custom((value, { req }) => {
      if (!req.body.start_date) return true;
      if (new Date(value) < new Date(req.body.start_date)) {
        throw new Error("End date cannot be before start date.");
      }
      return true;
    }),

  body("status")
    .optional()
    .isIn(["planned", "ongoing", "completed"])
    .withMessage("Status must be planned, ongoing, or completed."),
];

const updateTripValidation = [
  body("title")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title must be between 1 and 100 characters."),

  body("country_code")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 2 })
    .isAlpha()
    .toUpperCase()
    .withMessage("Invalid country code.")
    .custom(async (code) => {
      const { data } = await supabase
        .from("countries")
        .select("code")
        .eq("code", code.toUpperCase())
        .single();
      if (!data) throw new Error("Invalid country code.");
      return true;
    }),

  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters."),

  body("cover_photo_url")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Cover photo must be a valid URL."),

  body("start_date")
    .optional({ checkFalsy: true })
    .isDate()
    .withMessage("Start date must be a valid date (YYYY-MM-DD)."),

  body("end_date")
    .optional({ checkFalsy: true })
    .isDate()
    .withMessage("End date must be a valid date (YYYY-MM-DD).")
    .custom((value, { req }) => {
      if (!req.body.start_date) return true;
      if (new Date(value) < new Date(req.body.start_date)) {
        throw new Error("End date cannot be before start date.");
      }
      return true;
    }),

  body("status")
    .optional()
    .isIn(["planned", "ongoing", "completed"])
    .withMessage("Status must be planned, ongoing, or completed."),
];

function normalizeOptionalValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

function buildTripUpdates(body) {
  const updates = {};

  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.country_code !== undefined) updates.country_code = body.country_code.toUpperCase();
  if (body.description !== undefined) updates.description = normalizeOptionalValue(body.description);
  if (body.cover_photo_url !== undefined) updates.cover_photo_url = normalizeOptionalValue(body.cover_photo_url);
  if (body.start_date !== undefined) updates.start_date = normalizeOptionalValue(body.start_date);
  if (body.end_date !== undefined) updates.end_date = normalizeOptionalValue(body.end_date);
  if (body.status !== undefined) updates.status = body.status;

  return updates;
}

// ── POST /api/trips ───────────────────────────────────────────────────────────

router.post("/", requireAuth, createTripValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);
  const updates = buildTripUpdates(req.body);

  const { data, error } = await db
    .from("trip")
    .insert({
      user_id:         req.user.id,
      title:           updates.title,
      country_code:    updates.country_code,
      description:     updates.description ?? null,
      cover_photo_url: updates.cover_photo_url ?? null,
      start_date:      updates.start_date ?? null,
      end_date:        updates.end_date ?? null,
      status:          updates.status || "planned",
    })
    .select()
    .single();

  if (error) {
    console.log("Trip insert error:", error);
    return res.status(500).json({ error: "Failed to create trip." });
  }

  res.status(201).json(data);
});

// ── PUT /api/trips/:id ────────────────────────────────────────────────────────

router.put("/:id", requireAuth, updateTripValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);

  const updates = buildTripUpdates(req.body);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const { data, error } = await db
    .from("trip")
    .update(updates)
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Trip not found." });
    }
    return res.status(500).json({ error: "Failed to update trip." });
  }

  res.json(data);
});

// ── DELETE /api/trips/:id ─────────────────────────────────────────────────────

router.delete("/:id", requireAuth, async (req, res) => {
  const db = createAuthClient(req.token);

  const { error } = await db
    .from("trip")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) {
    return res.status(500).json({ error: "Failed to delete trip." });
  }

  res.json({ message: "Trip deleted." });
});

module.exports = router;