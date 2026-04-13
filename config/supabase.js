// config/supabase.js
// Supabase client setup

const { createClient } = require("@supabase/supabase-js");

// Get Supabase URL and service key from .env.local
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Stop the program if required environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.local");
}

  // Create the Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;