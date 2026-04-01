// config/supabase.js
// Supabase client setup

const { createClient } = require("@supabase/supabase-js");

// Get Supabase URL and service key from .env.local
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Stop the program if required environment variables are missing
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;