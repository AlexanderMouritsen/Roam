// routes/auth.js
const express  = require("express");
const router   = express.Router();
const supabase = require("../config/supabase");
const supabaseAdmin = require("../config/supabaseAdmin");
const { body, validationResult } = require("express-validator");
const { requireAuth } = require("../middleware/auth");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge:   60 * 60 * 1000,
};

// POST /api/auth/signup

// Profile fields are passed as metadata in the signUp call.
// The DB trigger create_profile_on_signup() reads them and writes the

router.post("/signup", async (req, res) => {
  const { email, password, username, display_name, home_country } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  if (!username || !display_name || !home_country) {
    return res.status(400).json({ error: "Username, display name, and home country are required." });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.BASE_URL || "http://localhost:3000"}/confirm`,
      data: {
        username:     username.trim(),
        display_name: display_name.trim(),
        home_country: home_country.toUpperCase(),
      },
    },
  });

  if (error) return res.status(400).json({ error: error.message });

  if (data.session) {
    res.cookie("roam_token", data.session.access_token, COOKIE_OPTIONS);
  }

  res.status(201).json({
    user:      data.user,
    confirmed: !!data.session,
  });
});

// POST /api/auth/login

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return res.status(401).json({ error: "Incorrect email or password." });

  res.cookie("roam_token", data.session.access_token, COOKIE_OPTIONS);
  res.json({ user: data.user });
});

// POST /api/auth/logout

router.post("/logout", (req, res) => {
  res.clearCookie("roam_token", COOKIE_OPTIONS);
  res.json({ message: "Logged out." });
});

// GET /api/auth/public-config
// Exposes the public Supabase config needed by the browser auth client.
router.get("/public-config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// POST /api/auth/reset-password
// Sends a password reset email with a recovery link.
router.post("/reset-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const redirectTo = `${process.env.BASE_URL || "http://localhost:3000"}/auth.html?mode=recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    res.status(500).json({ error: "Failed to send password reset email." });
  }
});

// POST /api/auth/logout-all
// Invalidate all sessions for current user (requires service role key)
router.post("/logout-all", requireAuth, async (req, res) => {
  try {
    // Use admin client to invalidate user sessions
    await supabaseAdmin.auth.admin.invalidateUserSessions(req.user.id);
    res.json({ message: "Invalidated sessions." });
  } catch (error) {
    res.status(500).json({ error: "Failed to invalidate sessions." });
  }
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, [
  body('current_password').isString().trim().notEmpty(),
  body('new_password').isString().trim().isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { current_password, new_password } = req.body;

  try {
    // Verify current password by attempting sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: current_password,
    });
    if (error || !data) return res.status(401).json({ error: 'Current password is incorrect.' });

    // Update password using admin client
    const { error: adminError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: new_password });
    if (adminError) return res.status(500).json({ error: 'Failed to update password.' });

    // End all sessions after a password change so old tokens cannot remain active.
    try {
      await supabaseAdmin.auth.admin.invalidateUserSessions(req.user.id);
    } catch (sessionError) {
      // Keep the password change successful even if session invalidation fails.
    }

    res.json({ message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// DELETE /api/auth/account
// Delete the authenticated user's account and profile
router.delete("/account", requireAuth, async (req, res) => {
  // Attempt to remove all user files from storage buckets before deleting the account.
  const AVATAR_BUCKET = "avatars";
  const ACTIVITY_BUCKET = "activity-photos";

  async function removeFilesForBucket(bucket, userId) {
    try {
      // list files under the user's top-level prefix
      const { data: list1, error: listErr1 } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
      if (listErr1) {
        return { error: listErr1 };
      }

      const toRemove = [];
      if (Array.isArray(list1)) {
        for (const item of list1) {
          // item.name could be a file or a folder; attempt to remove file entries and list nested folders
          if (item.name && !item.type) continue; // skip if unexpected
          // If item is a file object it may have 'name' and 'id'
          if (item.name && item.metadata === undefined) {
            // treat as file entry
            toRemove.push(`${userId}/${item.name}`);
          }
        }
      }

      // Also attempt to list deeper common prefixes
      const prefixes = [`${userId}/trips`, `${userId}/activities`];
      for (const p of prefixes) {
        const { data: list2 } = await supabaseAdmin.storage.from(bucket).list(p, { limit: 1000 });
        if (Array.isArray(list2)) {
          for (const it of list2) {
            if (it.name) toRemove.push(`${p}/${it.name}`);
          }
        }
      }

      if (toRemove.length === 0) return { removed: [] };

      const { error: removeErr } = await supabaseAdmin.storage.from(bucket).remove(toRemove);
      if (removeErr) return { error: removeErr };
      return { removed: toRemove };
    } catch (err) {
      return { error: err };
    }
  }

  try {
    const avatarResult = await removeFilesForBucket(AVATAR_BUCKET, req.user.id);
    const photosResult = await removeFilesForBucket(ACTIVITY_BUCKET, req.user.id);

    // Proceed to delete the auth user (this cascades DB rows via foreign key on delete)
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (delErr) {
      return res.status(500).json({ error: 'Failed to delete auth user.' });
    }

    // Best-effort: try to clean any remaining DB rows (in case cascade didn't run)
    await supabaseAdmin.from('profiles').delete().eq('id', req.user.id);
    await supabaseAdmin.from('photos').delete().eq('user_id', req.user.id);
    await supabaseAdmin.from('activities').delete().eq('user_id', req.user.id);
    await supabaseAdmin.from('trip').delete().eq('user_id', req.user.id);

    res.clearCookie('roam_token', COOKIE_OPTIONS);

    const result = { message: 'Account deleted.' };
    if (avatarResult.error || photosResult.error) {
      result.warning = 'Some user files could not be deleted automatically.';
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

module.exports = router;