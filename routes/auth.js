const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");


const COOKIE_OPTIONS = {
  httpOnly: true,     // JS cannot read this cookie - defeats XSS token theft
  secure: process.env.NODE_ENV === "production", // cookie only sent over HTTPS in production
  sameSite: "strict", // cookie is never sent on cross-site requests - defeats CSRF
  maxAge: 60 * 60 * 1000,
};

router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: "http://localhost:3000/confirm",
    },
  });

  if (error) return res.status(400).json({ error: error.message });

  // If email confirmation is on, there won't be a session yet
  if (data.session) {
    res.cookie("roam_token", data.session.access_token, COOKIE_OPTIONS);
  }

  res.status(201).json({
    user: data.user,
    confirmed: !!data.session,
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(401).json({ error: "Incorrect email or password." });

  res.cookie("roam_token", data.session.access_token, COOKIE_OPTIONS);

  res.json({ user: data.user });
});

router.post("/logout", (req, res) => {
  // Clear the cookie immediately
  res.clearCookie("roam_token", COOKIE_OPTIONS);
  res.json({ message: "Logged out." });
});

module.exports = router;