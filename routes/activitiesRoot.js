const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { createAuthClient } = require("../config/supabase");

const router = express.Router();

const ACTIVITY_TYPES = [
  "hike",
  "food",
  "transport",
  "museum",
  "beach",
  "accommodation",
  "shopping",
  "concert",
  "nature",
  "other",
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

function buildActivityUpdates(body) {
  const updates = {};

  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.activity_type !== undefined) updates.activity_type = body.activity_type;
  if (body.location_name !== undefined) updates.location_name = normalizeOptionalValue(body.location_name);
  if (body.notes !== undefined) updates.notes = normalizeOptionalValue(body.notes);
  if (body.start_datetime !== undefined) updates.start_datetime = normalizeOptionalValue(body.start_datetime);
  if (body.is_highlight !== undefined) updates.is_highlight = body.is_highlight;
  if (body.latitude !== undefined) updates.latitude = normalizeOptionalValue(body.latitude);
  if (body.longitude !== undefined) updates.longitude = normalizeOptionalValue(body.longitude);
  if (body.trip_id !== undefined) updates.trip_id = normalizeOptionalValue(body.trip_id);

  return updates;
}

const activityIdValidation = [
  param("id").isUUID().withMessage("Activity ID must be a valid UUID."),
];

const createActivityValidation = [
  body("title")
    .isString()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("Title must be between 1 and 150 characters."),
  body("activity_type")
    .isString()
    .isIn(ACTIVITY_TYPES)
    .withMessage("Activity type is invalid."),
  body("location_name")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Location name must be a string."),
  body("notes")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Notes must be a string."),
  body("start_datetime")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Start date must be a valid ISO datetime."),
  body("is_highlight")
    .optional()
    .isBoolean()
    .toBoolean()
    .withMessage("Highlight must be a boolean."),
  body("latitude")
    .optional({ checkFalsy: true })
    .isFloat({ min: -90, max: 90 })
    .toFloat()
    .withMessage("Latitude must be between -90 and 90."),
  body("longitude")
    .optional({ checkFalsy: true })
    .isFloat({ min: -180, max: 180 })
    .toFloat()
    .withMessage("Longitude must be between -180 and 180."),
  body("trip_id")
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage("Trip ID must be a valid UUID."),
];

const updateActivityValidation = [
  body("title")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("Title must be between 1 and 150 characters."),
  body("activity_type")
    .optional()
    .isString()
    .isIn(ACTIVITY_TYPES)
    .withMessage("Activity type is invalid."),
  body("location_name")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Location name must be a string."),
  body("notes")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .withMessage("Notes must be a string."),
  body("start_datetime")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Start date must be a valid ISO datetime."),
  body("is_highlight")
    .optional()
    .isBoolean()
    .toBoolean()
    .withMessage("Highlight must be a boolean."),
  body("latitude")
    .optional({ checkFalsy: true })
    .isFloat({ min: -90, max: 90 })
    .toFloat()
    .withMessage("Latitude must be between -90 and 90."),
  body("longitude")
    .optional({ checkFalsy: true })
    .isFloat({ min: -180, max: 180 })
    .toFloat()
    .withMessage("Longitude must be between -180 and 180."),
  body("trip_id")
    .optional({ checkFalsy: false })
    .custom((value) => {
      if (value === null || value === "") return true;
      if (typeof value !== "string") throw new Error("Trip ID must be a string.");
      if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error("Trip ID must be a valid UUID.");
      return true;
    }),
];

async function verifyTripOwnership(db, tripId, userId) {
  if (!tripId) return null;
  const { data: trip, error } = await db
    .from("trip")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return "not_found";
    return "error";
  }
  return trip;
}

// GET /api/activities
router.get("/", requireAuth, async (req, res) => {
  const db = createAuthClient(req.token);

  const { data, error } = await db
    .from("activities")
    .select(
      "id, trip_id, title, activity_type, location_name, notes, start_datetime, is_highlight, created_at, updated_at"
    )
    .eq("user_id", req.user.id)
    .order("start_datetime", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to fetch activities." });
  }

  const tripIds = (data || []).map((activity) => activity.trip_id).filter(Boolean);
  let tripTitles = {};
  if (tripIds.length > 0) {
    const { data: trips } = await db
      .from("trip")
      .select("id, title")
      .in("id", tripIds)
      .eq("user_id", req.user.id);

    (trips || []).forEach((trip) => {
      tripTitles[trip.id] = trip.title;
    });
  }

  const activityIds = (data || []).map((activity) => activity.id);
  let activityPhotos = {};
  if (activityIds.length > 0) {
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

  const activities = (data || []).map((activity) => ({
    ...activity,
    trip_title: activity.trip_id ? tripTitles[activity.trip_id] || "" : "",
    photos: activityPhotos[activity.id] || [],
  }));

  res.json(activities);
});

// GET /api/activities/:id
router.get("/:id", requireAuth, activityIdValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);

  const { data, error } = await db
    .from("activities")
    .select(
      "id, trip_id, title, activity_type, location_name, notes, start_datetime, is_highlight, created_at, updated_at"
    )
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Activity not found." });
    }
    return res.status(500).json({ error: "Failed to fetch activity." });
  }

  let photos = [];
  if (data) {
    const { data: photoRows } = await db
      .from("photos")
      .select("id, activity_id, url, thumbnail_url, caption, taken_at, created_at")
      .eq("activity_id", data.id)
      .eq("user_id", req.user.id);

    photos = photoRows || [];
  }

  res.json({ ...data, photos });
});

// POST /api/activities
router.post("/", requireAuth, createActivityValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);
  const updates = buildActivityUpdates(req.body);
  if (!updates.start_datetime) {
    const defaultDate = new Date();
    defaultDate.setHours(0, 0, 0, 0);
    updates.start_datetime = defaultDate.toISOString();
  }

  if (updates.trip_id) {
    const trip = await verifyTripOwnership(db, updates.trip_id, req.user.id);
    if (trip === "not_found") {
      return res.status(404).json({ error: "Trip not found." });
    }
    if (trip === "error") {
      return res.status(500).json({ error: "Failed to verify trip." });
    }
  }

  const { data, error } = await db
    .from("activities")
    .insert({
      user_id: req.user.id,
      trip_id: updates.trip_id ?? null,
      title: updates.title,
      activity_type: updates.activity_type,
      location_name: updates.location_name ?? null,
      latitude: updates.latitude ?? null,
      longitude: updates.longitude ?? null,
      notes: updates.notes ?? null,
      start_datetime: updates.start_datetime,
      is_highlight: updates.is_highlight ?? false,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to create activity." });
  }

  res.status(201).json(data);
});

// PUT /api/activities/:id
router.put("/:id", requireAuth, activityIdValidation, updateActivityValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);
  const updates = buildActivityUpdates(req.body);

  if (updates.trip_id !== undefined && updates.trip_id) {
    const trip = await verifyTripOwnership(db, updates.trip_id, req.user.id);
    if (trip === "not_found") {
      return res.status(404).json({ error: "Trip not found." });
    }
    if (trip === "error") {
      return res.status(500).json({ error: "Failed to verify trip." });
    }
  }

  const { data, error } = await db
    .from("activities")
    .update(updates)
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Activity not found." });
    }
    return res.status(500).json({ error: "Failed to update activity." });
  }

  res.json(data);
});

// DELETE /api/activities/:id
router.delete("/:id", requireAuth, activityIdValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);

  const { data, error } = await db
    .from("activities")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Activity not found." });
    }
    return res.status(500).json({ error: "Failed to delete activity." });
  }

  res.json({ message: "Activity deleted.", id: data.id });
});

module.exports = router;
