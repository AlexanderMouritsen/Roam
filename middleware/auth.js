// middleware/auth.js
// Verifies the JWT token from the httpOnly cookie
const supabase = require("../config/supabase");

async function requireAuth(req, res, next) {
  const token = req.cookies.roam_token;

  if (!token) {
    return res.status(401).json({ error: "Not logged in." });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
  };

  next();
}

module.exports = { requireAuth };