const express = require("express");
const multer = require("multer");
const path = require("path");
const { body, param, validationResult } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { createAuthClient } = require("../config/supabase");
const supabaseAdmin = require("../config/supabaseAdmin");

const router = express.Router();

const ACTIVITY_BUCKET = "activity-photos";

async function ensureActivityBucket() {
  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    throw error;
  }

  const exists = (data || []).some((bucket) => bucket.name === ACTIVITY_BUCKET);
  if (exists) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(ACTIVITY_BUCKET, {
    public: true,
  });

  if (createError) {
    throw createError;
  }
}

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

function normalizeOptionalValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

function extractStoragePath(url, bucketName) {
  if (!url) return null;
  const marker = `/object/public/${bucketName}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

const uploadValidation = [
  body("trip_id").optional({ checkFalsy: true }).isUUID().withMessage("Trip ID must be a valid UUID."),
  body("activity_id").optional({ checkFalsy: true }).isUUID().withMessage("Activity ID must be a valid UUID."),
  body().custom((value) => {
    if (!value.trip_id && !value.activity_id) {
      throw new Error("Trip ID or Activity ID is required.");
    }
    return true;
  }),
  body("caption")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Caption cannot exceed 1000 characters."),
  body("taken_at")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Taken at must be a valid ISO datetime."),
];

const photoTripValidation = [
  param("tripId").isUUID().withMessage("Trip ID must be a valid UUID."),
];

const photoActivityValidation = [
  param("activityId").isUUID().withMessage("Activity ID must be a valid UUID."),
];

const photoUpdateValidation = [
  param("id").isUUID().withMessage("Photo ID must be a valid UUID."),
  body("caption")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Caption cannot exceed 1000 characters."),
  body("taken_at")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Taken at must be a valid ISO datetime."),
];

// POST /api/photos/setup
router.post("/setup", requireAuth, async (req, res) => {
  try {
    await ensureActivityBucket();
    res.json({ status: "ready", bucket: ACTIVITY_BUCKET });
  } catch (error) {
    res.status(500).json({ error: "Failed to set up photo bucket." });
  }
});

// GET /api/photos/trip/:tripId
router.get("/trip/:tripId", requireAuth, photoTripValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);

  const { data: trip, error: tripError } = await db
    .from("trip")
    .select("id")
    .eq("id", req.params.tripId)
    .eq("user_id", req.user.id)
    .single();

  if (tripError) {
    if (tripError.code === "PGRST116") {
      return res.status(404).json({ error: "Trip not found." });
    }
    return res.status(500).json({ error: "Failed to verify trip." });
  }

  const { data, error } = await db
    .from("photos")
    .select("id, trip_id, activity_id, url, thumbnail_url, caption, taken_at, created_at")
    .eq("trip_id", trip.id)
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to fetch photos." });
  }

  res.json(data || []);
});

// GET /api/photos/activity/:activityId
router.get("/activity/:activityId", requireAuth, photoActivityValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);

  const { data: activity, error: activityError } = await db
    .from("activities")
    .select("id")
    .eq("id", req.params.activityId)
    .eq("user_id", req.user.id)
    .single();

  if (activityError) {
    if (activityError.code === "PGRST116") {
      return res.status(404).json({ error: "Activity not found." });
    }
    return res.status(500).json({ error: "Failed to verify activity." });
  }

  const { data, error } = await db
    .from("photos")
    .select("id, trip_id, activity_id, url, thumbnail_url, caption, taken_at, created_at")
    .eq("activity_id", activity.id)
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to fetch photos." });
  }

  res.json(data || []);
});

// POST /api/photos
router.post("/", requireAuth, upload.single("file"), uploadValidation, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    await ensureActivityBucket();
  } catch (error) {
    return res.status(500).json({ error: "Failed to set up photo bucket." });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);
  let tripId = normalizeOptionalValue(req.body.trip_id);
  const activityId = normalizeOptionalValue(req.body.activity_id);

  if (tripId) {
    const { data: trip, error: tripError } = await db
      .from("trip")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user.id)
      .single();

    if (tripError) {
      if (tripError.code === "PGRST116") {
        return res.status(404).json({ error: "Trip not found." });
      }
      return res.status(500).json({ error: "Failed to verify trip." });
    }
  }

  if (activityId) {
    const { data: activity, error: activityError } = await db
      .from("activities")
      .select("id, trip_id")
      .eq("id", activityId)
      .eq("user_id", req.user.id)
      .single();

    if (activityError) {
      if (activityError.code === "PGRST116") {
        return res.status(404).json({ error: "Activity not found." });
      }
      return res.status(500).json({ error: "Failed to verify activity." });
    }

    if (!tripId) {
      tripId = activity.trip_id ?? null;
    } else if (activity.trip_id && activity.trip_id !== tripId) {
      return res.status(400).json({ error: "Activity does not belong to trip." });
    }
  }

  const extension = path.extname(req.file.originalname || "").toLowerCase() || ".jpg";
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const filePath = activityId
    ? `${req.user.id}/activities/${activityId}/${fileName}`
    : `${req.user.id}/trips/${tripId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(ACTIVITY_BUCKET)
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });

  if (uploadError) {
    return res.status(500).json({ error: "Failed to upload photo." });
  }

  const { data: publicData } = supabaseAdmin
    .storage
    .from(ACTIVITY_BUCKET)
    .getPublicUrl(filePath);

  const url = publicData?.publicUrl;

  const { data, error } = await db
    .from("photos")
    .insert({
      user_id: req.user.id,
      trip_id: tripId ?? null,
      activity_id: activityId ?? null,
      url,
      thumbnail_url: null,
      caption: normalizeOptionalValue(req.body.caption) ?? null,
      taken_at: normalizeOptionalValue(req.body.taken_at) ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to save photo." });
  }

  res.status(201).json(data);
});

// DELETE /api/photos/:id
router.delete("/:id", requireAuth, [param("id").isUUID().withMessage("Photo ID must be a valid UUID.")], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);

  const { data: photo, error: fetchError } = await db
    .from("photos")
    .select("id, url")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return res.status(404).json({ error: "Photo not found." });
    }
    return res.status(500).json({ error: "Failed to load photo." });
  }

  const storagePath = extractStoragePath(photo.url, ACTIVITY_BUCKET);
  if (storagePath) {
    await supabaseAdmin.storage.from(ACTIVITY_BUCKET).remove([storagePath]);
  }

  const { error } = await db
    .from("photos")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.user.id);

  if (error) {
    return res.status(500).json({ error: "Failed to delete photo." });
  }

  res.json({ message: "Photo deleted." });
});

// PUT /api/photos/:id
router.put("/:id", requireAuth, photoUpdateValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = createAuthClient(req.token);

  const updates = {};
  if (req.body.caption !== undefined) {
    updates.caption = normalizeOptionalValue(req.body.caption);
  }
  if (req.body.taken_at !== undefined) {
    updates.taken_at = normalizeOptionalValue(req.body.taken_at);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const { data, error } = await db
    .from("photos")
    .update(updates)
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Photo not found." });
    }
    return res.status(500).json({ error: "Failed to update photo." });
  }

  res.json(data);
});

module.exports = router;
