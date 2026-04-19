const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");


// GET /api/users/me
// Gets the profile of the currently authenticated user
router.get("/me", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, home_country, created_at")
    .eq("id", req.user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.status(404).json({ error: "Profile not found." });
    }
    return res.status(500).json({ error: "Failed to fetch profile." });
  }

  res.json(data);
});

// Validation rules for PUT
const profileValidation = [
  body("username")
  .optional()
  .isString()
  .trim()
  .isLength({ min: 3, max: 30 })
  .withMessage("Username must be between 3 and 30 characters.")
  .matches(/^[a-zA-Z0-9_]+$/)
  .withMessage("Username can only contain letters, numbers, and underscores.")
  .custom(async (username, { req }) => {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", req.user.id)
      .single();

    if (data) throw new Error("Username is already taken.");
    return true;
  }),
  
  body("display_name")
    .optional()                
    .isString().withMessage("Display name must be a string.")
    .trim()                      
    .isLength({ min: 3, max: 30 })
    .withMessage("Display name must be between 3 and 30 characters."),

  body("bio")
    .optional()
    .isString().withMessage("Bio must be a string.")
    .trim()
    .isLength({ max: 150 })
    .withMessage("Bio cannot be longer than 150 characters."),
  body("home_country")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 2 })
    .isAlpha()
    .toUpperCase()
    // Validate code against countries table, make sure code is valid, so for example "ZZ" is not accepted
    .custom(async (countryCode) => {
      const { data } = await supabase
        .from("countries")
        .select("code")
        .eq("code", countryCode.toUpperCase())
        .single();

      if (!data) throw new Error("Invalid country code.");
      return true;
    })     
];

// PUT /api/users/me
// Update profile of the currently authenticated user
router.put("/me", requireAuth, profileValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const updates = {};
    if (req.body.display_name !== undefined) updates.display_name = req.body.display_name;
    if (req.body.bio          !== undefined) updates.bio           = req.body.bio;
    if (req.body.home_country !== undefined) updates.home_country  = req.body.home_country;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", req.user.id)
      .select("id, username, display_name, avatar_url, bio, home_country")
      .single();

    if (error) {
      return res.status(500).json({ error: "Failed to update profile." });
    }

    res.json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to update profile." });
  }
});

module.exports = router;