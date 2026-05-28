const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createAuthClient } = require("../config/supabase");

const router = express.Router();

// GET /api/stats
router.get("/", requireAuth, async (req, res) => {
  const db = createAuthClient(req.token);

  const [tripsResult, activitiesResult, photosResult] = await Promise.all([
    db.from("trip").select("id", { count: "exact", head: true }),
    db.from("activities").select("id", { count: "exact", head: true }),
    db.from("photos").select("id", { count: "exact", head: true }),
  ]);

  if (tripsResult.error || activitiesResult.error || photosResult.error) {
    return res.status(500).json({ error: "Failed to load stats." });
  }

  const trips = tripsResult.count || 0;
  const activities = activitiesResult.count || 0;
  const photos = photosResult.count || 0;

  const { data: tripCountries, error: tripCountriesError } = await db
    .from("trip")
    .select("country_code")
    .eq("user_id", req.user.id);

  if (tripCountriesError) {
    return res.status(500).json({ error: "Failed to load country stats." });
  }

  const countryCodes = [...new Set((tripCountries || []).map((t) => t.country_code).filter(Boolean))];
  const countriesVisited = countryCodes.length;

  let continentsVisited = 0;
  if (countryCodes.length > 0) {
    const { data: countryRows, error: countryError } = await db
      .from("countries")
      .select("continent")
      .in("code", countryCodes);

    if (countryError) {
      return res.status(500).json({ error: "Failed to load continent stats." });
    }

    continentsVisited = new Set((countryRows || []).map((row) => row.continent)).size;
  }

  const { data: activityRows, error: activityError } = await db
    .from("activities")
    .select("activity_type")
    .eq("user_id", req.user.id);

  if (activityError) {
    return res.status(500).json({ error: "Failed to load activity stats." });
  }

  const activitiesByType = (activityRows || []).reduce((acc, row) => {
    acc[row.activity_type] = (acc[row.activity_type] || 0) + 1;
    return acc;
  }, {});

  const { data: recentActivities, error: recentError } = await db
    .from("activities")
    .select("id, trip_id, title, activity_type, location_name, notes, start_datetime, is_highlight, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentError) {
    return res.status(500).json({ error: "Failed to load recent activities." });
  }

  const tripIds = (recentActivities || []).map((a) => a.trip_id);
  let tripTitles = {};
  if (tripIds.length > 0) {
    const { data: tripsData } = await db
      .from("trip")
      .select("id, title")
      .in("id", tripIds)
      .eq("user_id", req.user.id);

    (tripsData || []).forEach((trip) => {
      tripTitles[trip.id] = trip.title;
    });
  }

  const activityIds = (recentActivities || []).map((a) => a.id);
  let activityPhotos = {};
  if (activityIds.length > 0) {
    const { data: photosData } = await db
      .from("photos")
      .select("id, activity_id, url, thumbnail_url, caption, taken_at")
      .in("activity_id", activityIds)
      .eq("user_id", req.user.id);

    (photosData || []).forEach((photo) => {
      if (!activityPhotos[photo.activity_id]) {
        activityPhotos[photo.activity_id] = [];
      }
      activityPhotos[photo.activity_id].push(photo);
    });
  }

  const recent = (recentActivities || []).map((activity) => ({
    ...activity,
    trip_title: tripTitles[activity.trip_id] || "",
    photos: activityPhotos[activity.id] || [],
  }));

  res.json({
    countries_visited: countriesVisited,
    continents_visited: continentsVisited,
    trips_total: trips,
    activities_total: activities,
    photos_total: photos,
    activities_by_type: activitiesByType,
    recent_activities: recent,
  });
});

module.exports = router;
