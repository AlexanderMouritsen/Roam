// dashboard.js — main app logic for index.html

// Map colours
const MAP_COLORS = {
  home:      "#4f8eff",
  visited:   "#c8873a",
  unvisited: "#1a1a1e",
  border:    "#2a2a30", 
};

//  Auth check 
async function checkAuth() {
  const res = await fetch("/api/users/me", { credentials: "include" });
  if (!res.ok) {
    window.location.href = "/auth.html";
    return null;
  }
  return res.json();
}

// Fill navbar with user info
function populateNavbar(profile) {
  const displayName = profile.display_name || profile.username || "User";
  const username    = profile.username ? `@${profile.username}` : "";

  document.getElementById("user-display-name").textContent = displayName;
  document.getElementById("user-username").textContent     = username;

  const avatar = document.getElementById("user-avatar");

  if (profile.avatar_url) {
    // If the user has uploaded an avatar, show it as a background image
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.backgroundSize  = "cover";
  } else {
    // Otherwise show their initials
    avatar.textContent = displayName.slice(0, 2).toUpperCase();
  }
}

// Load stats
async function loadStats() {
  // Placeholder until the trips/activities and photos routes are built
  const stats = {
    countries:  0,
    continents: 0,
    trips:      0,
    activities: 0,
    photos:     0,
  };

  document.getElementById("stat-countries").textContent    = stats.countries;
  document.getElementById("stat-trips").textContent        = stats.trips;
  document.getElementById("stat-activities").textContent   = stats.activities;
  document.getElementById("stat-photos").textContent       = stats.photos;

  document.getElementById("stat-countries-sub").textContent =
    stats.continents > 0 ? `Across ${stats.continents} continents` : "No countries yet";
  document.getElementById("stat-trips-sub").textContent =
    stats.trips > 0 ? `${stats.trips} trips logged` : "No trips yet";
  document.getElementById("stat-activities-sub").textContent =
    stats.activities > 0 ? `Across all trips` : "No activities yet";
  document.getElementById("stat-photos-sub").textContent =
    stats.photos > 0 ? `Across all trips` : "No photos yet";

  document.getElementById("map-stats").textContent =
    stats.countries > 0
      ? `${stats.countries} countries · ${stats.continents} continents`
      : "No countries visited yet";

  return stats;
}

// Initialise the Leaflet map
function initMap(homeCountry, visitedCountryCodes) {
  const map = L.map("map", {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 6,
    zoomControl: false,
    attributionControl: false,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0,
  });

  // TO COME NEXT
  // Fetch the GeoJSON file from our own server
  // This file contains the border shapes of every country in the world
  fetch("/api/geojson/countries", { credentials: "include" })
    .then((res) => res.json())
    .then((geojson) => {
      // L.geoJSON draws every country shape from the file
      // The style function runs once per country and returns its fill colour
      L.geoJSON(geojson, {
        style: (feature) => {
          const code = feature.properties.ISO_A2;

          let fillColor = MAP_COLORS.unvisited;

          if (code === homeCountry) {
            fillColor = MAP_COLORS.home;
          } else if (visitedCountryCodes.includes(code)) {
            fillColor = MAP_COLORS.visited;
          }

          return {
            fillColor,
            fillOpacity: code === homeCountry || visitedCountryCodes.includes(code) ? 0.85 : 0.6,
            color:       MAP_COLORS.border,
            weight:      0.5,
          };
        },
      }).addTo(map);
    });

  return map;
}

// Show/hide recent content vs empty state
function renderRecentContent(tripCount) {
  const emptyState     = document.getElementById("empty-state");
  const recentContent  = document.getElementById("recent-content");

  if (tripCount === 0) {
    emptyState.hidden    = false;
    recentContent.hidden = true;
  } else {
    emptyState.hidden    = true;
    recentContent.hidden = false;
    // TODO: populate trips grid and activity list when those routes exist
  }
}

// Dropdown menu
function initDropdown() {
  const userMenu    = document.getElementById("user-menu");
  const dropdown    = document.getElementById("user-dropdown");
  const chevron     = document.getElementById("menu-chevron");
  const logoutBtn   = document.getElementById("logout-btn");

  // Toggle dropdown open/closed when clicking the user menu
  userMenu.addEventListener("click", () => {
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    chevron.classList.toggle("open", !isOpen);
  });

  // Close dropdown if the user clicks anywhere else on the page
  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
      chevron.classList.remove("open");
    }
  });

  // Logout
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/auth.html";
  });
}

// Boot
async function initDashboard() {
  const profile = await checkAuth();
  if (!profile) return;

  populateNavbar(profile);

  const stats = await loadStats();

  // Temp until route is made for visited countries
  const visitedCountryCodes = [];
  initMap(profile.home_country, visitedCountryCodes);

  renderRecentContent(stats.trips);

  initDropdown();
}

initDashboard();