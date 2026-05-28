// activities.js — activities list page logic

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
  const username = profile.username ? `@${profile.username}` : "";

  document.getElementById("user-display-name").textContent = displayName;
  document.getElementById("user-username").textContent = username;

  const avatar = document.getElementById("user-avatar");
  if (profile.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.backgroundSize = "cover";
  } else {
    avatar.textContent = displayName.slice(0, 2).toUpperCase();
  }
}

function initDropdown() {
  const userMenu = document.getElementById("user-menu");
  const dropdown = document.getElementById("user-dropdown");
  const chevron = document.getElementById("menu-chevron");
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

function formatDateOnly(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function fetchActivities() {
  const res = await fetch("/api/activities", { credentials: "include" });
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

async function deleteActivity(activityId) {
  await fetch(`/api/activities/${activityId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

async function deletePhoto(photoId) {
  await fetch(`/api/photos/${photoId}`, {
    method: "DELETE",
    credentials: "include",
  });
}

function formatDateInputValue(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toIsoDate(dateValue) {
  if (!dateValue) return null;
  return new Date(`${dateValue}T00:00:00`).toISOString();
}

function buildMeta(activity) {
  const parts = [];
  if (activity.trip_title) {
    parts.push(activity.trip_title);
  } else if (!activity.trip_id) {
    parts.push("No trip");
  }
  if (activity.activity_type) parts.push(activity.activity_type);
  if (activity.start_datetime) parts.push(formatDateOnly(activity.start_datetime));
  return parts.join(" · ");
}

let allActivities = [];
let currentPhoto = null;

function openPhotoDetail(photo) {
  currentPhoto = photo;
  const overlay = document.getElementById("photo-detail-overlay");
  const image = document.getElementById("photo-detail-image");
  const caption = document.getElementById("photo-detail-caption");
  const dateInput = document.getElementById("photo-detail-date");
  const dateDisplay = document.getElementById("photo-detail-date-display");

  image.src = photo.url;
  caption.value = photo.caption || "";
  dateInput.value = formatDateInputValue(photo.taken_at) || new Date().toISOString().slice(0, 10);
  dateDisplay.textContent = formatDateOnly(dateInput.value || photo.taken_at) || "Date";
  overlay.hidden = false;
}

function closePhotoDetail() {
  document.getElementById("photo-detail-overlay").hidden = true;
  currentPhoto = null;
}

function renderActivities(activities) {
  const list = document.getElementById("activity-list");
  const emptyState = document.getElementById("empty-state");
  list.innerHTML = "";

  if (!activities || activities.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  activities.forEach((activity) => {
    const card = document.createElement("article");
    card.className = "activity-card";

    const photoUrl = activity.photos?.[0]?.thumbnail_url || activity.photos?.[0]?.url || "";
    const meta = buildMeta(activity);
    const editLink = activity.trip_id
      ? `/activity/${activity.id}/edit?tripId=${activity.trip_id}`
      : `/activity/${activity.id}/edit`;

    card.innerHTML = `
      ${photoUrl ? `<img src="${photoUrl}" alt="${activity.title}" loading="lazy" />` : ""}
      <div class="activity-card-title">${activity.title}</div>
      ${meta ? `<div class="activity-card-meta">${meta}</div>` : ""}
      ${activity.notes ? `<div class="activity-card-notes">${activity.notes}</div>` : ""}
      <div class="activity-card-actions">
        <a class="btn btn-ghost btn-sm" href="${editLink}">Edit</a>
        <button class="btn btn-ghost btn-sm" type="button" data-action="delete">Delete</button>
      </div>
    `;

    if (photoUrl && activity.photos?.[0]) {
      card.querySelector("img").addEventListener("click", () => {
        openPhotoDetail(activity.photos[0]);
      });
    }

    card.querySelector("[data-action='delete']").addEventListener("click", async () => {
      if (!confirm(`Delete "${activity.title}"? This cannot be undone.`)) return;
      await deleteActivity(activity.id);
      renderActivities(activities.filter((item) => item.id !== activity.id));
    });

    list.appendChild(card);
  });
}

function applyFilters() {
  const typeFilter = document.getElementById("filter-type").value;
  const tripFilter = document.getElementById("filter-trip").value;
  const sortFilter = document.getElementById("filter-sort").value;

  let filtered = [...allActivities];

  if (typeFilter !== "all") {
    filtered = filtered.filter((item) => item.activity_type === typeFilter);
  }

  if (tripFilter !== "all") {
    if (tripFilter === "none") {
      filtered = filtered.filter((item) => !item.trip_id);
    } else {
      filtered = filtered.filter((item) => item.trip_id === tripFilter);
    }
  }

  filtered.sort((a, b) => {
    const dateA = new Date(a.start_datetime || a.created_at).getTime();
    const dateB = new Date(b.start_datetime || b.created_at).getTime();
    return sortFilter === "newest" ? dateB - dateA : dateA - dateB;
  });

  renderActivities(filtered);
}

function populateTripFilter() {
  const select = document.getElementById("filter-trip");
  const trips = [...new Map(allActivities
    .filter((item) => item.trip_id)
    .map((item) => [item.trip_id, item.trip_title || item.trip_id]))
    .entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  select.innerHTML = "<option value=\"all\">All trips</option><option value=\"none\">No trip</option>";
  trips.forEach((trip) => {
    const option = document.createElement("option");
    option.value = trip.id;
    option.textContent = trip.title;
    select.appendChild(option);
  });
}

function initPhotoModal() {
  const overlay = document.getElementById("photo-detail-overlay");
  document.getElementById("photo-detail-close").addEventListener("click", closePhotoDetail);
  document.getElementById("photo-detail-cancel").addEventListener("click", closePhotoDetail);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePhotoDetail();
  });

  document.getElementById("photo-detail-save").addEventListener("click", async () => {
    if (!currentPhoto) return;
    const caption = document.getElementById("photo-detail-caption").value.trim();
    const dateValue = document.getElementById("photo-detail-date").value;

    try {
      const updated = await updatePhoto(currentPhoto.id, {
        caption: caption || null,
        taken_at: dateValue ? toIsoDate(dateValue) : null,
      });
      const index = allActivities.findIndex((item) => item.photos?.some((p) => p.id === currentPhoto.id));
      if (index !== -1) {
        const photoIndex = allActivities[index].photos.findIndex((p) => p.id === currentPhoto.id);
        if (photoIndex !== -1) {
          allActivities[index].photos[photoIndex] = updated;
        }
      }
      applyFilters();
      closePhotoDetail();
    } catch (error) {
      // noop
    }
  });

  document.getElementById("photo-detail-delete").addEventListener("click", async () => {
    if (!currentPhoto) return;
    await deletePhoto(currentPhoto.id);
    allActivities = allActivities.map((activity) => ({
      ...activity,
      photos: (activity.photos || []).filter((photo) => photo.id !== currentPhoto.id),
    }));
    applyFilters();
    closePhotoDetail();
  });

  document.getElementById("photo-detail-date").addEventListener("change", (event) => {
    const dateDisplay = document.getElementById("photo-detail-date-display");
    dateDisplay.textContent = formatDateOnly(event.target.value) || "Date";
  });
}

async function initActivitiesPage() {
  const profile = await checkAuth();
  if (!profile) return;

  populateNavbar(profile);
  initDropdown();

  allActivities = await fetchActivities();
  populateTripFilter();
  applyFilters();
  initPhotoModal();

  document.getElementById("filter-type").addEventListener("change", applyFilters);
  document.getElementById("filter-trip").addEventListener("change", applyFilters);
  document.getElementById("filter-sort").addEventListener("change", applyFilters);
}

initActivitiesPage();
