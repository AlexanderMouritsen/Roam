// trips.js — trips page logic

// ── Auth ──────────────────────────────────────────────────────────────────────

async function checkAuth() {
  const res = await fetch("/api/users/me", { credentials: "include" });
  if (!res.ok) {
    window.location.href = "/auth.html";
    return null;
  }
  return res.json();
}

// ── Navbar ────────────────────────────────────────────────────────────────────

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

function initDropdown() {
  const userMenu  = document.getElementById("user-menu");
  const dropdown  = document.getElementById("user-dropdown");
  const chevron   = document.getElementById("menu-chevron");
  const logoutBtn = document.getElementById("logout-btn");

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

// ── Trip data ─────────────────────────────────────────────────────────────────

// allTrips holds the full unfiltered list fetched from the server.
// We filter/sort it client-side so no extra API calls are needed when
// the user changes a filter.
let allTrips = [];
let currentEditTripId = null;

async function fetchTrips() {
  const res = await fetch("/api/trips", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

// Format a date string (YYYY-MM-DD) to a readable form like "Mar 10, 2026"
function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00"); // force local time
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateInput(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

function parseDateInput(value) {
  if (!value) return "";
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const iso = `${match[3]}-${match[2]}-${match[1]}`;

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return iso;
}

async function uploadCoverPhoto(tripId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/trips/${tripId}/cover`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to upload cover photo.");
  }

  return data;
}

// Build the date range string shown on the card
function formatDateRange(start, end) {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s)      return `From ${s}`;
  if (e)      return `Until ${e}`;
  return "No dates set";
}

// Create one trip card element from a trip object
function createTripCard(trip) {
  const card = document.createElement("a");
  card.className   = "trip-card";
  card.href        = `/trips/${trip.id}`;

  // Prevent the card click navigating when the user is using the menu
  card.addEventListener("click", (e) => {
    if (e.target.closest(".trip-card-menu-btn") || e.target.closest(".card-dropdown")) {
      e.preventDefault();
    }
  });

  // Cover photo or placeholder
  const imageSection = trip.cover_photo_url
    ? `<img class="trip-card-image" src="${trip.cover_photo_url}" alt="${trip.title}" loading="lazy" />`
    : `<div class="trip-card-placeholder">✦</div>`;

  card.innerHTML = `
    ${imageSection}
    <div class="trip-card-body">
      <div class="trip-card-top">
        <span class="trip-card-title">${trip.title}</span>
        <button class="trip-card-menu-btn" type="button" aria-label="Trip options">
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
            <circle cx="3"  cy="8" r="1.2"/>
            <circle cx="8"  cy="8" r="1.2"/>
            <circle cx="13" cy="8" r="1.2"/>
          </svg>
        </button>
      </div>
      <div class="trip-card-dates">${formatDateRange(trip.start_date, trip.end_date)}</div>
      <div class="trip-card-footer">
        <div class="trip-card-activities">
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 5v3l2 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          ${trip.activity_count} ${trip.activity_count === 1 ? "activity" : "activities"}
        </div>
        <span class="badge badge-${trip.status}">${trip.status}</span>
      </div>
    </div>
  `;

  // Three-dot menu
  const menuBtn  = card.querySelector(".trip-card-menu-btn");
  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCardDropdown(trip, card, menuBtn);
  });

  return card;
}

// Show/hide a dropdown on a specific card
function toggleCardDropdown(trip, card, anchor) {
  // Remove any existing open dropdown on any card
  document.querySelectorAll(".card-dropdown").forEach((d) => d.remove());

  const dropdown = document.createElement("div");
  dropdown.className = "card-dropdown";
  dropdown.innerHTML = `
    <button class="card-dropdown-item" data-action="edit">
      Edit trip
    </button>
    <button class="card-dropdown-item card-dropdown-item-danger" data-action="delete">
      Delete trip
    </button>
  `;

  dropdown.querySelector("[data-action='edit']").addEventListener("click", (e) => {
    e.stopPropagation();
    openEditModal(trip);
    dropdown.remove();
  });

  dropdown.querySelector("[data-action='delete']").addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${trip.title}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/trips/${trip.id}`, {
      method:      "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      allTrips = allTrips.filter((t) => t.id !== trip.id);
      renderTrips();
    }
    dropdown.remove();
  });

  card.style.position = "relative";
  card.appendChild(dropdown);

  // Close if user clicks elsewhere
  setTimeout(() => {
    document.addEventListener("click", () => dropdown.remove(), { once: true });
  }, 0);
}

// Apply filters and re-render the grid
function renderTrips() {
  const statusFilter = document.getElementById("filter-status").value;
  const sortOrder    = document.getElementById("filter-sort").value;
  const searchQuery  = document.getElementById("search-input").value.toLowerCase().trim();

  let filtered = [...allTrips];

  // Status filter
  if (statusFilter !== "all") {
    filtered = filtered.filter((t) => t.status === statusFilter);
  }

  // Search
  if (searchQuery) {
    filtered = filtered.filter((t) => t.title.toLowerCase().includes(searchQuery));
  }

  // Sort
  filtered.sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  const grid           = document.getElementById("trips-grid");
  const emptyState     = document.getElementById("empty-state");
  const noResultsState = document.getElementById("no-results-state");

  grid.innerHTML = "";

  if (allTrips.length === 0) {
    // No trips at all
    emptyState.hidden     = false;
    noResultsState.hidden = true;
    return;
  }

  emptyState.hidden = true;

  if (filtered.length === 0) {
    // Trips exist but none match the current filter/search
    noResultsState.hidden = false;
    return;
  }

  noResultsState.hidden = true;
  filtered.forEach((trip) => grid.appendChild(createTripCard(trip)));
}

// ── Country picker (same pattern as auth.js) ──────────────────────────────────

let allCountries = [];

async function loadCountries() {
  const res = await fetch("/api/countries", { credentials: "include" });
  if (!res.ok) return;
  allCountries = await res.json();
}

function renderCountryList(query, listEl, codeInput) {
  const q       = query.toLowerCase().trim();
  const matches = q
    ? allCountries.filter((c) => c.name.toLowerCase().includes(q))
    : allCountries;

  listEl.innerHTML = "";

  if (matches.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No countries found.";
    li.className   = "no-results";
    listEl.appendChild(li);
  } else {
    matches.forEach((c) => {
      const li       = document.createElement("li");
      li.textContent = c.name;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.getElementById("trip-country-search").value = c.name;
        codeInput.value = c.code;
        listEl.hidden   = true;
      });
      listEl.appendChild(li);
    });
  }

  listEl.hidden = false;
}

function initCountryPicker() {
  const searchInput = document.getElementById("trip-country-search");
  const codeInput   = document.getElementById("trip-country-code");
  const listEl      = document.getElementById("trip-country-list");

  searchInput.addEventListener("focus", () => {
    renderCountryList(searchInput.value, listEl, codeInput);
  });

  searchInput.addEventListener("input", () => {
    codeInput.value = ""; // clear selection when user types again
    renderCountryList(searchInput.value, listEl, codeInput);
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => { listEl.hidden = true; }, 150);
  });
}

// ── New trip modal ────────────────────────────────────────────────────────────

function openModal() {
  // Reset form
  currentEditTripId = null;
  document.getElementById("trip-title").value       = "";
  document.getElementById("trip-country-search").value = "";
  document.getElementById("trip-country-code").value   = "";
  document.getElementById("trip-start-date").value   = "";
  document.getElementById("trip-end-date").value     = "";
  document.getElementById("trip-status").value       = "planned";
  document.getElementById("trip-description").value  = "";
  document.getElementById("trip-cover-file").value   = "";
  document.getElementById("trip-cover-name").textContent = "No file selected";
  const errorEl = document.getElementById("trip-error");
  errorEl.textContent = "";
  errorEl.classList.remove("visible");
  document.getElementById("modal-title").textContent = "New trip";
  document.getElementById("trip-submit").textContent = "Create trip";

  document.getElementById("modal-overlay").hidden = false;
}

function openEditModal(trip) {
  currentEditTripId = trip.id;

  const country = allCountries.find((c) => c.code === trip.country_code);
  const countryName = country ? country.name : trip.country_code;

  document.getElementById("trip-title").value       = trip.title || "";
  document.getElementById("trip-country-search").value = countryName || "";
  document.getElementById("trip-country-code").value   = trip.country_code || "";
  document.getElementById("trip-start-date").value   = formatDateInput(trip.start_date);
  document.getElementById("trip-end-date").value     = formatDateInput(trip.end_date);
  document.getElementById("trip-status").value       = trip.status || "planned";
  document.getElementById("trip-description").value  = trip.description || "";
  document.getElementById("trip-cover-file").value   = "";
  document.getElementById("trip-cover-name").textContent = "No file selected";
  const errorEl = document.getElementById("trip-error");
  errorEl.textContent = "";
  errorEl.classList.remove("visible");
  document.getElementById("modal-title").textContent = "Edit trip";
  document.getElementById("trip-submit").textContent = "Save changes";

  document.getElementById("modal-overlay").hidden = false;
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
}

function initModal() {
  document.getElementById("new-trip-btn").addEventListener("click", openModal);
  document.getElementById("empty-new-trip-btn").addEventListener("click", openModal);
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);

  const coverInput = document.getElementById("trip-cover-file");
  const coverBtn = document.getElementById("trip-cover-btn");
  const coverName = document.getElementById("trip-cover-name");

  coverBtn.addEventListener("click", () => coverInput.click());
  coverInput.addEventListener("change", () => {
    coverName.textContent = coverInput.files[0]?.name || "No file selected";
  });

  // Close on backdrop click
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  document.getElementById("trip-submit").addEventListener("click", async () => {
    const title        = document.getElementById("trip-title").value.trim();
    const country_code = document.getElementById("trip-country-code").value;
    const start_date_raw = document.getElementById("trip-start-date").value.trim();
    const end_date_raw   = document.getElementById("trip-end-date").value.trim();
    const status       = document.getElementById("trip-status").value;
    const description  = document.getElementById("trip-description").value.trim();
    const coverFile    = document.getElementById("trip-cover-file").files[0];
    const errorEl      = document.getElementById("trip-error");
    const submitBtn    = document.getElementById("trip-submit");

    errorEl.textContent = "";
    errorEl.classList.remove("visible");

    if (!title)        { errorEl.textContent = "Title is required."; errorEl.classList.add("visible"); return; }
    if (!country_code) { errorEl.textContent = "Please select a country from the list."; errorEl.classList.add("visible"); return; }

    const start_date = parseDateInput(start_date_raw);
    if (start_date_raw && !start_date) {
      errorEl.textContent = "Start date must be DD/MM/YYYY.";
      errorEl.classList.add("visible");
      return;
    }

    const end_date = parseDateInput(end_date_raw);
    if (end_date_raw && !end_date) {
      errorEl.textContent = "End date must be DD/MM/YYYY.";
      errorEl.classList.add("visible");
      return;
    }

    if (start_date && end_date && end_date < start_date) {
      errorEl.textContent = "End date cannot be before start date.";
      errorEl.classList.add("visible");
      return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = "Saving…";

    const payload = { title, country_code, status };
    if (description) payload.description = description;
    payload.start_date = start_date;
    payload.end_date   = end_date;

    const endpoint = currentEditTripId ? `/api/trips/${currentEditTripId}` : "/api/trips";
    const method   = currentEditTripId ? "PUT" : "POST";

    const res  = await fetch(endpoint, {
      method,
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify(payload),
    });

    const data = await res.json();

    submitBtn.disabled    = false;
    submitBtn.textContent = currentEditTripId ? "Save changes" : "Create trip";

    if (!res.ok) {
      errorEl.textContent = data.errors?.[0]?.msg ?? data.error ?? "Something went wrong.";
      errorEl.classList.add("visible");
      return;
    }

    if (currentEditTripId) {
      let updatedTrip = data;

      if (coverFile) {
        try {
          updatedTrip = await uploadCoverPhoto(currentEditTripId, coverFile);
        } catch (uploadError) {
          alert(uploadError.message);
        }
      }

      const index = allTrips.findIndex((t) => t.id === currentEditTripId);
      if (index !== -1) {
        allTrips[index] = { ...allTrips[index], ...updatedTrip };
      }
      renderTrips();
      closeModal();
      currentEditTripId = null;
      return;
    }

    let newTrip = { ...data, activity_count: 0 };

    if (coverFile) {
      try {
        newTrip = { ...newTrip, ...(await uploadCoverPhoto(data.id, coverFile)) };
      } catch (uploadError) {
        alert(uploadError.message);
      }
    }

    allTrips.unshift(newTrip);
    renderTrips();
    closeModal();
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function initTrips() {
  const profile = await checkAuth();
  if (!profile) return;

  populateNavbar(profile);
  initDropdown();

  // Load countries and trips in parallel
  const [trips] = await Promise.all([fetchTrips(), loadCountries()]);
  allTrips = trips;

  renderTrips();
  initCountryPicker();
  initModal();

  // Filter/sort/search listeners — all re-render client-side
  document.getElementById("filter-status").addEventListener("change", renderTrips);
  document.getElementById("filter-sort").addEventListener("change", renderTrips);
  document.getElementById("search-input").addEventListener("input", renderTrips);
}

initTrips();