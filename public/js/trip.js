// trip.js — trip detail page logic

let allCountries = [];
let currentTrip = null;
let allActivities = [];
let currentActivity = null;
let tripPhotos = [];
let pendingTripFiles = [];
let activityPhotoObjectUrls = [];
let currentPhoto = null;

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

function formatDateOnly(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

function formatDateInputValue(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getTodayInputValue() {
  return formatDateInputValue(new Date().toISOString());
}

function toIsoDate(dateValue) {
  if (!dateValue) return null;
  return new Date(`${dateValue}T00:00:00`).toISOString();
}

function clampDateWithinRange(dateValue, startDate, endDate) {
  if (!dateValue || (!startDate && !endDate)) return dateValue;
  const target = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(target.getTime())) return dateValue;

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (target < start) return startDate;
  }

  if (endDate) {
    const end = new Date(`${endDate}T00:00:00`);
    if (target > end) return endDate;
  }

  return dateValue;
}

function truncateText(value, maxLength) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}…`;
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

async function fetchActivities(tripId) {
  const res = await fetch(`/api/trips/${tripId}/activities`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

async function uploadActivityPhoto(tripId, activityId, file, caption, takenAt) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("trip_id", tripId);
  formData.append("activity_id", activityId);
  if (caption) formData.append("caption", caption);
  if (takenAt) formData.append("taken_at", takenAt);

  const res = await fetch("/api/photos", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to upload activity photo.");
  }

  return data;
}

async function uploadTripPhoto(tripId, file, caption, takenAt) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("trip_id", tripId);
  if (caption) formData.append("caption", caption);
  if (takenAt) formData.append("taken_at", takenAt);

  const res = await fetch("/api/photos", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to upload trip photo.");
  }

  return data;
}

async function fetchTripPhotos(tripId) {
  const res = await fetch(`/api/photos/trip/${tripId}`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

async function updatePhoto(photoId, payload) {
  const res = await fetch(`/api/photos/${photoId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to update photo.");
  }

  return data;
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

function formatActivityType(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildActivityMeta(activity) {
  const parts = [];
  if (activity.activity_type) parts.push(formatActivityType(activity.activity_type));
  if (activity.location_name) parts.push(activity.location_name);
  if (activity.start_datetime) parts.push(formatDateOnly(activity.start_datetime));
  return parts.join(" · ");
}

function createActivityCard(activity, isHighlight) {
  const card = document.createElement("article");
  card.className = `activity-card${isHighlight ? " highlight" : ""}`;

  const photoUrl = activity.photos?.[0]?.thumbnail_url || activity.photos?.[0]?.url || "";
  const meta = buildActivityMeta(activity);
  const notes = truncateText(activity.notes || "", isHighlight ? 160 : 90);

  card.innerHTML = `
    ${photoUrl ? `<img class="activity-card-photo" src="${photoUrl}" alt="${activity.title}" loading="lazy" />` : ""}
    <div class="activity-card-header">
      <div>
        <div class="activity-card-title">${activity.title}</div>
        ${meta ? `<div class="activity-card-meta">${meta}</div>` : ""}
      </div>
    </div>
    ${notes ? `<div class="activity-card-notes">${notes}</div>` : ""}
    <div class="activity-actions">
      <button class="btn btn-ghost btn-sm" type="button" data-action="edit">Edit</button>
      <a class="btn btn-ghost btn-sm" href="/activity/${activity.id}/edit?tripId=${activity.trip_id}">Open</a>
      <button class="btn btn-ghost btn-sm" type="button" data-action="delete">Delete</button>
    </div>
  `;

  card.querySelector("[data-action='edit']").addEventListener("click", () => {
    openActivityModal(activity);
  });

  card.querySelector("[data-action='delete']").addEventListener("click", () => {
    deleteActivity(activity);
  });

  return card;
}

function updateActivityCount() {
  const count = allActivities.length;
  document.getElementById("trip-activities").textContent =
    `${count} ${count === 1 ? "activity" : "activities"}`;
}

function renderActivities(activities) {
  const rail = document.getElementById("activity-rail");
  const highlightsWrap = document.getElementById("trip-highlights");
  const highlightsRail = document.getElementById("highlight-rail");
  const emptyState = document.getElementById("activities-empty");
  const timelineWrap = document.getElementById("trip-timeline");
  const timelineList = document.getElementById("timeline-list");
  const footer = document.getElementById("trip-activities-footer");

  rail.innerHTML = "";
  highlightsRail.innerHTML = "";
  timelineList.innerHTML = "";

  if (activities.length === 0) {
    emptyState.hidden = false;
    highlightsWrap.hidden = true;
    timelineWrap.hidden = true;
    footer.hidden = true;
    return;
  }

  emptyState.hidden = true;
  footer.hidden = false;

  const highlights = activities.filter((activity) => activity.is_highlight);
  if (highlights.length > 0) {
    highlightsWrap.hidden = false;
    highlights.forEach((activity) => {
      highlightsRail.appendChild(createActivityCard(activity, true));
    });
  } else {
    highlightsWrap.hidden = true;
  }

  activities.forEach((activity) => {
    rail.appendChild(createActivityCard(activity, false));
  });

  renderTimeline(activities);
  timelineWrap.hidden = false;
}

function formatTimelineDate(dateStr) {
  if (!dateStr) return "Date unknown";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function buildTimelineMeta(activity) {
  const parts = [];
  if (activity.activity_type) parts.push(formatActivityType(activity.activity_type));
  if (activity.location_name) parts.push(activity.location_name);
  return parts.join(" · ");
}

function renderTimeline(activities) {
  const timelineList = document.getElementById("timeline-list");
  timelineList.innerHTML = "";

  const sorted = [...activities].sort((a, b) => {
    const timeA = a.start_datetime ? new Date(a.start_datetime).getTime() : new Date(a.created_at).getTime();
    const timeB = b.start_datetime ? new Date(b.start_datetime).getTime() : new Date(b.created_at).getTime();
    return timeA - timeB;
  });

  let currentGroup = null;
  let lastDate = "";

  sorted.forEach((activity) => {
    const dateLabel = formatTimelineDate(activity.start_datetime || activity.created_at);
    if (dateLabel !== lastDate) {
      currentGroup = document.createElement("div");
      currentGroup.className = "timeline-group";
      const header = document.createElement("div");
      header.className = "timeline-date";
      header.textContent = dateLabel;
      currentGroup.appendChild(header);
      timelineList.appendChild(currentGroup);
      lastDate = dateLabel;
    }

    const item = document.createElement("div");
    item.className = "timeline-item";

    const meta = buildTimelineMeta(activity);
    const notes = truncateText(activity.notes || "", 140);
    const highlightBadge = activity.is_highlight ? `<span class="timeline-badge">Highlight</span>` : "";

    item.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <div class="timeline-title">
          <span>${activity.title}</span>
          ${highlightBadge}
        </div>
        ${meta ? `<div class="timeline-meta">${meta}</div>` : ""}
        ${notes ? `<div class="timeline-notes">${notes}</div>` : ""}
      </div>
    `;

    currentGroup.appendChild(item);
  });
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

// ── Activity modal ──────────────────────────────────────────────────────────

function openActivityModal(activity) {
  currentActivity = activity || null;

  document.getElementById("activity-title").value = activity?.title || "";
  document.getElementById("activity-type").value = activity?.activity_type || "other";
  document.getElementById("activity-location").value = activity?.location_name || "";
  const dateInput = document.getElementById("activity-datetime");
  const baseDate = activity?.start_datetime
    ? formatDateInputValue(activity.start_datetime)
    : getTodayInputValue();
  dateInput.value = clampDateWithinRange(baseDate, currentTrip?.start_date, currentTrip?.end_date);
  document.getElementById("activity-notes").value = activity?.notes || "";
  document.getElementById("activity-highlight").checked = Boolean(activity?.is_highlight);
  document.getElementById("activity-photo").value = "";
  document.getElementById("activity-photo-name").textContent = "No file selected";
  const details = document.getElementById("activity-photo-details");
  details.innerHTML = "";
  details.hidden = true;
  activityPhotoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activityPhotoObjectUrls = [];
  document.getElementById("activity-form-error").textContent = "";
  document.getElementById("activity-form-error").classList.remove("visible");

  document.getElementById("activity-modal-title").textContent = activity ? "Edit activity" : "New activity";
  document.getElementById("activity-submit").textContent = activity ? "Save changes" : "Save activity";

  document.getElementById("activity-modal-overlay").hidden = false;
}

function closeActivityModal() {
  document.getElementById("activity-modal-overlay").hidden = true;
}

async function refreshTripData() {
  const trip = await fetchTrip(currentTrip.id);
  if (!trip) return;
  currentTrip = trip;
  allActivities = trip.activities || [];
  renderTrip(currentTrip);
  renderActivities(allActivities);
  updateActivityCount();
}

async function deletePhoto(photoId) {
  await fetch(`/api/photos/${photoId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

async function deleteActivity(activity) {
  if (!currentTrip) return;
  if (!confirm(`Delete "${activity.title}"? This cannot be undone.`)) return;

  await fetch(`/api/trips/${currentTrip.id}/activities/${activity.id}`, {
    method: "DELETE",
    credentials: "include",
  });

  await refreshTripData();
}

function initActivityModal() {
  const addBtn = document.getElementById("add-activity-bottom");
  const emptyBtn = document.getElementById("activities-empty-btn");
  const overlay = document.getElementById("activity-modal-overlay");

  if (addBtn) {
    addBtn.addEventListener("click", () => openActivityModal(null));
  }
  emptyBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openActivityModal(null);
  });

  document.getElementById("activity-modal-close").addEventListener("click", closeActivityModal);
  document.getElementById("activity-modal-cancel").addEventListener("click", closeActivityModal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeActivityModal();
  });

  const fileInput = document.getElementById("activity-photo");
  const fileBtn = document.getElementById("activity-photo-btn");
  const fileName = document.getElementById("activity-photo-name");
  const details = document.getElementById("activity-photo-details");

  fileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 1) {
      fileName.textContent = `${fileInput.files.length} files selected`;
    } else {
      fileName.textContent = fileInput.files[0]?.name || "No file selected";
    }

    activityPhotoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    activityPhotoObjectUrls = [];
    details.innerHTML = "";

    const files = Array.from(fileInput.files || []);
    if (files.length === 0) {
      details.hidden = true;
      return;
    }

    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      activityPhotoObjectUrls.push(url);
      const row = document.createElement("div");
      row.className = "activity-photo-detail";
      row.innerHTML = `
        <img src="${url}" alt="Selected activity" />
        <input class="input" type="text" placeholder="Caption" data-photo-caption="${index}" />
        <input class="input" type="date" value="${getTodayInputValue()}" data-photo-date="${index}" />
      `;
      details.appendChild(row);
    });

    details.hidden = false;
  });

  document.getElementById("activity-submit").addEventListener("click", async () => {
    if (!currentTrip) return;

    const title = document.getElementById("activity-title").value.trim();
    const activity_type = document.getElementById("activity-type").value;
    const location_name = document.getElementById("activity-location").value.trim();
    const startValue = document.getElementById("activity-datetime").value;
    const notes = document.getElementById("activity-notes").value.trim();
    const is_highlight = document.getElementById("activity-highlight").checked;
    const files = Array.from(document.getElementById("activity-photo").files || []);
    const errorEl = document.getElementById("activity-form-error");
    const submitBtn = document.getElementById("activity-submit");

    errorEl.textContent = "";
    errorEl.classList.remove("visible");

    if (!title) {
      errorEl.textContent = "Title is required.";
      errorEl.classList.add("visible");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = currentActivity ? "Saving…" : "Saving…";

    const payload = {
      title,
      activity_type,
      is_highlight,
    };

    if (location_name) payload.location_name = location_name;
    if (notes) payload.notes = notes;
    if (startValue) {
      const clamped = clampDateWithinRange(startValue, currentTrip?.start_date, currentTrip?.end_date);
      document.getElementById("activity-datetime").value = clamped;
      payload.start_datetime = toIsoDate(clamped);
    }

    const endpoint = currentActivity
      ? `/api/trips/${currentTrip.id}/activities/${currentActivity.id}`
      : `/api/trips/${currentTrip.id}/activities`;
    const method = currentActivity ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    submitBtn.disabled = false;
    submitBtn.textContent = currentActivity ? "Save changes" : "Save activity";

    if (!res.ok) {
      errorEl.textContent = data.errors?.[0]?.msg ?? data.error ?? "Something went wrong.";
      errorEl.classList.add("visible");
      return;
    }

    if (files.length > 0) {
      try {
        for (const [index, file] of files.entries()) {
          const captionInput = document.querySelector(`[data-photo-caption="${index}"]`);
          const dateInput = document.querySelector(`[data-photo-date="${index}"]`);
          const caption = captionInput?.value?.trim() || "";
          const dateValue = dateInput?.value || "";
          await uploadActivityPhoto(
            currentTrip.id,
            data.id || currentActivity?.id,
            file,
            caption,
            dateValue ? toIsoDate(dateValue) : null
          );
        }
      } catch (uploadError) {
        errorEl.textContent = uploadError.message;
        errorEl.classList.add("visible");
        return;
      }
    }

    await refreshTripData();
    closeActivityModal();
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
  allActivities = trip.activities || [];
  renderActivities(allActivities);
  updateActivityCount();

  tripPhotos = await fetchTripPhotos(currentTrip.id);
  renderTripPhotos();
  initTripPhotoUpload();

  const emptyBtn = document.getElementById("activities-empty-btn");
  if (emptyBtn) {
    emptyBtn.setAttribute("href", `/activity/new?tripId=${currentTrip.id}`);
  }

  initCountryPicker();
  initModal();
  initDelete();
  initActivityModal();
}

function renderTripPhotos() {
  const gallery = document.getElementById("trip-gallery");
  const grid = document.getElementById("trip-photo-grid");

  gallery.hidden = false;
  grid.innerHTML = "";

  if (!tripPhotos || tripPhotos.length === 0) {
    grid.innerHTML = `<div class="empty-state">No trip photos yet.</div>`;
    return;
  }

  tripPhotos.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "trip-photo-card";
    card.innerHTML = `
      <img src="${photo.thumbnail_url || photo.url}" alt="Trip photo" loading="lazy" />
      <div class="trip-photo-meta">
        <input class="input" type="text" value="${photo.caption || ""}" placeholder="Caption" data-photo-caption />
        <input class="input" type="date" value="${formatDateInputValue(photo.taken_at)}" data-photo-date />
      </div>
      <div class="trip-photo-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="save">Save</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="delete">Remove</button>
      </div>
    `;

    card.querySelector("img").addEventListener("click", () => {
      openPhotoDetail(photo);
    });

    card.querySelector("[data-action='save']").addEventListener("click", async () => {
      const caption = card.querySelector("[data-photo-caption]").value.trim();
      const dateValue = card.querySelector("[data-photo-date]").value;

      try {
        const updated = await updatePhoto(photo.id, {
          caption: caption || null,
          taken_at: dateValue ? toIsoDate(dateValue) : null,
        });
        const index = tripPhotos.findIndex((item) => item.id === photo.id);
        if (index !== -1) {
          tripPhotos[index] = updated;
        }
      } catch (error) {
        showPageError(error.message);
      }
    });

    card.querySelector("[data-action='delete']").addEventListener("click", async () => {
      await deletePhoto(photo.id);
      tripPhotos = tripPhotos.filter((item) => item.id !== photo.id);
      renderTripPhotos();
    });

    grid.appendChild(card);
  });
}

function openPhotoDetail(photo) {
  currentPhoto = photo;
  const overlay = document.getElementById("photo-detail-overlay");
  const image = document.getElementById("photo-detail-image");
  const caption = document.getElementById("photo-detail-caption");
  const dateInput = document.getElementById("photo-detail-date");
  const dateDisplay = document.getElementById("photo-detail-date-display");

  image.src = photo.url;
  caption.value = photo.caption || "";
  dateInput.value = formatDateInputValue(photo.taken_at) || getTodayInputValue();
  dateDisplay.textContent = formatDateOnly(dateInput.value || photo.taken_at) || "Date";
  overlay.hidden = false;
}

function closePhotoDetail() {
  const overlay = document.getElementById("photo-detail-overlay");
  overlay.hidden = true;
  currentPhoto = null;
}

function initTripPhotoUpload() {
  const input = document.getElementById("trip-photo-input");
  const btn = document.getElementById("trip-photo-btn");
  const uploadPanel = document.getElementById("trip-photo-upload");
  const pendingGrid = document.getElementById("trip-photo-pending-grid");
  const cancelBtn = document.getElementById("trip-photo-cancel");
  const saveBtn = document.getElementById("trip-photo-save");

  btn.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    if (!currentTrip || files.length === 0) return;

    pendingTripFiles = files;
    pendingGrid.innerHTML = "";

    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      const card = document.createElement("div");
      card.className = "trip-photo-card";
      card.innerHTML = `
        <img src="${url}" alt="Trip upload" loading="lazy" />
        <div class="trip-photo-meta">
          <input class="input" type="text" placeholder="Notes" data-photo-caption="${index}" />
          <input class="input" type="date" value="${getTodayInputValue()}" data-photo-date="${index}" />
        </div>
      `;
      pendingGrid.appendChild(card);
    });

    uploadPanel.hidden = false;
  });

  cancelBtn.addEventListener("click", () => {
    pendingTripFiles = [];
    pendingGrid.innerHTML = "";
    uploadPanel.hidden = true;
    input.value = "";
  });

  saveBtn.addEventListener("click", async () => {
    if (!currentTrip || pendingTripFiles.length === 0) return;

    try {
      for (const [index, file] of pendingTripFiles.entries()) {
        const captionInput = pendingGrid.querySelector(`[data-photo-caption="${index}"]`);
        const dateInput = pendingGrid.querySelector(`[data-photo-date="${index}"]`);
        const caption = captionInput?.value?.trim() || "";
        const dateValue = dateInput?.value || "";
        const uploaded = await uploadTripPhoto(
          currentTrip.id,
          file,
          caption,
          dateValue ? toIsoDate(dateValue) : null
        );
        tripPhotos.unshift(uploaded);
      }

      renderTripPhotos();
      pendingTripFiles = [];
      pendingGrid.innerHTML = "";
      uploadPanel.hidden = true;
      input.value = "";
    } catch (error) {
      showPageError(error.message);
    }
  });

  const detailOverlay = document.getElementById("photo-detail-overlay");
  document.getElementById("photo-detail-close").addEventListener("click", closePhotoDetail);
  document.getElementById("photo-detail-cancel").addEventListener("click", closePhotoDetail);
  detailOverlay.addEventListener("click", (event) => {
    if (event.target === detailOverlay) closePhotoDetail();
  });

  document.getElementById("photo-detail-save").addEventListener("click", async () => {
    if (!currentPhoto) return;
    const caption = document.getElementById("photo-detail-caption").value.trim();
    const dateValue = document.getElementById("photo-detail-date").value;
    const dateDisplay = document.getElementById("photo-detail-date-display");

    try {
      const updated = await updatePhoto(currentPhoto.id, {
        caption: caption || null,
        taken_at: dateValue ? toIsoDate(dateValue) : null,
      });
      const index = tripPhotos.findIndex((item) => item.id === currentPhoto.id);
      if (index !== -1) tripPhotos[index] = updated;
      dateDisplay.textContent = formatDateOnly(dateValue) || "Date";
      renderTripPhotos();
      closePhotoDetail();
    } catch (error) {
      showPageError(error.message);
    }
  });

  document.getElementById("photo-detail-date").addEventListener("change", (event) => {
    const dateDisplay = document.getElementById("photo-detail-date-display");
    dateDisplay.textContent = formatDateOnly(event.target.value) || "Date";
  });

  document.getElementById("photo-detail-delete").addEventListener("click", async () => {
    if (!currentPhoto) return;
    await deletePhoto(currentPhoto.id);
    tripPhotos = tripPhotos.filter((item) => item.id !== currentPhoto.id);
    renderTripPhotos();
    closePhotoDetail();
  });
}

initTripPage();
