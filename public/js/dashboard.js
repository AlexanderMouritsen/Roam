// dashboard.js — main app logic for index.html

const MAP_COLORS = {
  home:      "#4f8eff",
  visited:   "#c8873a",
  unvisited: "#1a1a1e",
  border:    "#2a2a30",
};

async function checkAuth() {
  const res = await fetch("/api/users/me", { credentials: "include" });
  if (!res.ok) {
    window.location.href = "/auth.html";
    return null;
  }
  return res.json();
}

function populateNavbar(profile) {
  const displayName = profile.display_name || profile.username || "User";
  const username    = profile.username ? `@${profile.username}` : "";

  document.getElementById("user-display-name").textContent = displayName;
  document.getElementById("user-username").textContent     = username;

  const avatar = document.getElementById("user-avatar");
  if (profile.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.backgroundSize  = "cover";
  } else {
    avatar.textContent = displayName.slice(0, 2).toUpperCase();
  }
}

async function loadStats(visitedCount) {
  const stats = {
    continents: 0,
    trips:      0,
    activities: 0,
    photos:     0,
  };

  document.getElementById("stat-countries").textContent  = visitedCount;
  document.getElementById("stat-trips").textContent      = stats.trips;
  document.getElementById("stat-activities").textContent = stats.activities;
  document.getElementById("stat-photos").textContent     = stats.photos;

  document.getElementById("stat-countries-sub").textContent =
    visitedCount > 0 ? `Across ${stats.continents} continents` : "No countries yet";
  document.getElementById("stat-trips-sub").textContent =
    stats.trips > 0 ? `${stats.trips} trips logged` : "No trips yet";
  document.getElementById("stat-activities-sub").textContent =
    stats.activities > 0 ? `Across all trips` : "No activities yet";
  document.getElementById("stat-photos-sub").textContent =
    stats.photos > 0 ? `Across all trips` : "No photos yet";

  document.getElementById("map-stats").textContent =
    visitedCount > 0
      ? `${visitedCount} ${visitedCount === 1 ? "country" : "countries"} visited`
      : "No countries visited yet";

  return stats;
}

// Initialise the Leaflet map
// homeCountry: ISO code e.g. "NO"
// homeCountryName: full name e.g. "Norway" — fallback for broken -99 ISO codes
// visitedCountryCodes: array of ISO codes from the user's trips
function initMap(homeCountry, homeCountryName, visitedCountryCodes) {
  const map = L.map("map", {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 6,
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    dragging: false,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0,
  });

  fetch("/api/geojson/countries", { credentials: "include" })
    .then((res) => res.json())
    .then((geojson) => {
      L.geoJSON(geojson, {
        style: (feature) => {
          const isoCode = feature.properties["ISO3166-1-Alpha-2"];
          const name    = feature.properties.name || "";

          // Match home country — fall back to name if ISO code is -99
          const isHome =
            (isoCode !== "-99" && isoCode === homeCountry) ||
            (isoCode === "-99" && name === homeCountryName);

          // Match visited countries — same -99 fallback not needed here since
          // country codes in our DB are always correct (sourced from countries table)
          const isVisited = visitedCountryCodes.includes(isoCode);

          let fillColor = MAP_COLORS.unvisited;
          if (isHome)         fillColor = MAP_COLORS.home;
          else if (isVisited) fillColor = MAP_COLORS.visited;

          return {
            fillColor,
            fillOpacity: isHome || isVisited ? 0.85 : 0.6,
            color:       MAP_COLORS.border,
            weight:      0.5,
          };
        },
      }).addTo(map);

      map.invalidateSize();
    });

  return map;
}

function renderRecentContent(tripCount) {
  const emptyState    = document.getElementById("empty-state");
  const recentContent = document.getElementById("recent-content");

  if (tripCount === 0) {
    emptyState.hidden    = false;
    recentContent.hidden = true;
  } else {
    emptyState.hidden    = true;
    recentContent.hidden = false;
  }
}

function initDropdown() {
  const userMenu  = document.getElementById("user-menu");
  const dropdown  = document.getElementById("user-dropdown");
  const chevron   = document.getElementById("menu-chevron");
  const logoutBtn = document.getElementById("logout-btn");

    document.getElementById("add-first-trip-btn").addEventListener("click", () => {
    window.location.href = "/trips.html";
  });

  userMenu.addEventListener("click", () => {
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    chevron.classList.toggle("open", !isOpen);
  });

  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
      chevron.classList.remove("open");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/auth.html";
  });
}

async function initDashboard() {
  const profile = await checkAuth();
  if (!profile) return;

  populateNavbar(profile);

  // Fetch countries list and trips in parallel
  const [countriesRes, tripsRes] = await Promise.all([
    fetch("/api/countries",  { credentials: "include" }),
    fetch("/api/trips",      { credentials: "include" }),
  ]);

  // Get home country name for the -99 GeoJSON fallback
  let homeCountryName = "";
  if (countriesRes.ok) {
    const countries = await countriesRes.json();
    const found = countries.find((c) => c.code === profile.home_country);
    if (found) homeCountryName = found.name;
  }

  // Get unique visited country codes from trips
  let visitedCountryCodes = [];
  let tripCount = 0;
  if (tripsRes.ok) {
    const trips = await tripsRes.json();
    tripCount = trips.length;
    // Deduplicate — user might have multiple trips to the same country
    visitedCountryCodes = [...new Set(trips.map((t) => t.country_code))];
  }

  await loadStats(visitedCountryCodes.length);
  initMap(profile.home_country, homeCountryName, visitedCountryCodes);
  renderRecentContent(tripCount);
  initDropdown();
}

initDashboard();