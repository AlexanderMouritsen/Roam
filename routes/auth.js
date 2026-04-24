// routes/auth.js
const express  = require("express");
const router   = express.Router();
const supabase = require("../config/supabase");

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

  console.log("Supabase error:", error?.message);
console.log("Supabase data:", data?.user?.id);

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

module.exports = router;