const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// Get all countries
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase.from("countries").select("*");
        if (error) {
            throw error;
        }
        res.json(data);
    } catch (error) {
        console.error("Error fetching countries:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;