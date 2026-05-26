// config/supabase.js
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl     = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Creates a Supabase client authenticated with the user's JWT token.
// Use this in routes instead of the shared client so RLS works correctly.
function createAuthClient(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

module.exports = supabase;
module.exports.createAuthClient = createAuthClient;