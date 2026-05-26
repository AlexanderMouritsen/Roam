// trip.js — trip detail page logic

let allCountries = [];
let currentTrip = null;

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
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

function formatDateRange(start, end) {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s)      return `From ${s}`;
  if (e)      return `Until ${e}`;
  return "No dates set";
}

function showPageError(message) {
  const errorEl = document.getElementById("trip-error");
  errorEl.textContent = message;
  errorEl.classList.add("visible");
}

function clearPageError() {
  const errorEl = document.getElementById("trip-error");
  errorEl.textContent = "";
  errorEl.classList.remove("visible");
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadCountries() {
  const res = await fetch("/api/countries", { credentials: "include" });
  if (!res.ok) return;
  allCountries = await res.json();
}

async function fetchTrip(tripId) {
  const res = await fetch(`/api/trips/${tripId}`, { credentials: "include" });
  if (res.status === 404) {
    showPageError("Trip not found.");
    return null;
  }
  if (!res.ok) {
    showPageError("Failed to load trip details.");
    return null;
  }
  return res.json();
}

function renderTrip(trip) {
  clearPageError();

  const country = allCountries.find((c) => c.code === trip.country_code);
  const countryName = country ? country.name : trip.country_code;

  document.getElementById("trip-title").textContent = trip.title;
  document.getElementById("trip-dates").textContent = formatDateRange(trip.start_date, trip.end_date);
  document.getElementById("trip-country").textContent = countryName || "—";
  document.getElementById("trip-status").textContent = trip.status || "—";
  document.getElementById("trip-activities").textContent =
    `${trip.activity_count || 0} ${trip.activity_count === 1 ? "activity" : "activities"}`;

  const badge = document.getElementById("trip-status-badge");
  badge.className = `badge badge-${trip.status}`;
  badge.textContent = trip.status;

  const description = trip.description ? trip.description : "No description yet.";
  document.getElementById("trip-description").textContent = description;

  const cover = document.getElementById("trip-cover");
  if (trip.cover_photo_url) {
    cover.innerHTML = `<img src="${trip.cover_photo_url}" alt="${trip.title}" loading="lazy" />`;
  } else {
    cover.innerHTML = `
      <div class="trip-cover-placeholder">
        <span>No cover photo</span>
        <button class="btn btn-secondary" type="button" id="cover-cta-btn">Add cover photo</button>
      </div>
    `;

    const ctaBtn = document.getElementById("cover-cta-btn");
    if (ctaBtn) {
      ctaBtn.addEventListener("click", () => {
        if (!currentTrip) return;
        openEditModal(currentTrip);
        document.getElementById("trip-cover-file").focus();
      });
    }
  }
}

// ── Country picker ───────────────────────────────────────────────────────────

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
    codeInput.value = "";
    renderCountryList(searchInput.value, listEl, codeInput);
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => { listEl.hidden = true; }, 150);
  });
}

// ── Edit modal ───────────────────────────────────────────────────────────────

function openEditModal(trip) {
  const country = allCountries.find((c) => c.code === trip.country_code);
  const countryName = country ? country.name : trip.country_code;

  document.getElementById("trip-title-input").value       = trip.title || "";
  document.getElementById("trip-country-search").value   = countryName || "";
  document.getElementById("trip-country-code").value     = trip.country_code || "";
  document.getElementById("trip-start-date").value       = formatDateInput(trip.start_date);
  document.getElementById("trip-end-date").value         = formatDateInput(trip.end_date);
  document.getElementById("trip-status-input").value     = trip.status || "planned";
  document.getElementById("trip-description-input").value = trip.description || "";
  document.getElementById("trip-cover-file").value       = "";
  document.getElementById("trip-cover-name").textContent = "No file selected";
  document.getElementById("trip-form-error").textContent = "";
  document.getElementById("trip-form-error").classList.remove("visible");

  document.getElementById("modal-overlay").hidden = false;
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
}

function initModal() {
  document.getElementById("edit-trip-btn").addEventListener("click", () => {
    if (!currentTrip) return;
    openEditModal(currentTrip);
  });

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);

  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

  const coverInput = document.getElementById("trip-cover-file");
  const coverBtn = document.getElementById("trip-cover-btn");
  const coverName = document.getElementById("trip-cover-name");

  coverBtn.addEventListener("click", () => coverInput.click());
  coverInput.addEventListener("change", () => {
    coverName.textContent = coverInput.files[0]?.name || "No file selected";
  });

  document.getElementById("trip-submit").addEventListener("click", async () => {
    if (!currentTrip) return;

    const title        = document.getElementById("trip-title-input").value.trim();
    const country_code = document.getElementById("trip-country-code").value;
    const start_date_raw = document.getElementById("trip-start-date").value.trim();
    const end_date_raw   = document.getElementById("trip-end-date").value.trim();
    const status       = document.getElementById("trip-status-input").value;
    const description  = document.getElementById("trip-description-input").value.trim();
    const coverFile    = document.getElementById("trip-cover-file").files[0];
    const errorEl      = document.getElementById("trip-form-error");
    const submitBtn    = document.getElementById("trip-submit");

    errorEl.textContent = "";
    errorEl.classList.remove("visible");

    if (!title)        {
      errorEl.textContent = "Title is required.";
      errorEl.classList.add("visible");
      return;
    }
    if (!country_code) {
      errorEl.textContent = "Please select a country from the list.";
      errorEl.classList.add("visible");
      return;
    }

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
    payload.description = description;
    payload.start_date  = start_date;
    payload.end_date    = end_date;

    const res  = await fetch(`/api/trips/${currentTrip.id}`, {
      method:      "PUT",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify(payload),
    });

    const data = await res.json();

    submitBtn.disabled    = false;
    submitBtn.textContent = "Save changes";

    if (!res.ok) {
      errorEl.textContent = data.errors?.[0]?.msg ?? data.error ?? "Something went wrong.";
      errorEl.classList.add("visible");
      return;
    }

    let updatedTrip = { ...currentTrip, ...data };

    if (coverFile) {
      try {
        updatedTrip = { ...updatedTrip, ...(await uploadCoverPhoto(currentTrip.id, coverFile)) };
      } catch (uploadError) {
        errorEl.textContent = uploadError.message;
        errorEl.classList.add("visible");
        submitBtn.disabled = false;
        submitBtn.textContent = "Save changes";
        return;
      }
    }

    currentTrip = updatedTrip;
    renderTrip(currentTrip);
    closeModal();
  });
}

// ── Delete ───────────────────────────────────────────────────────────────────

function initDelete() {
  document.getElementById("delete-trip-btn").addEventListener("click", async () => {
    if (!currentTrip) return;
    if (!confirm(`Delete "${currentTrip.title}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/trips/${currentTrip.id}`, {
      method:      "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      window.location.href = "/trips";
      return;
    }

    showPageError("Failed to delete trip.");
  });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

async function initTripPage() {
  const profile = await checkAuth();
  if (!profile) return;

  populateNavbar(profile);
  initDropdown();

  const tripId = window.location.pathname.split("/").pop();
  await loadCountries();

  const trip = await fetchTrip(tripId);
  if (!trip) return;

  currentTrip = trip;
  renderTrip(currentTrip);

  initCountryPicker();
  initModal();
  initDelete();
}

initTripPage();
