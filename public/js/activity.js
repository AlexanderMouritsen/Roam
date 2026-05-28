// activity.js — activity create/edit page logic

let currentTripId = null;
let currentActivity = null;
let allTrips = [];
let previewObjectUrls = [];

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

function clampDateForTrip(tripId, dateValue) {
  if (!tripId) return dateValue;
  const trip = allTrips.find((item) => item.id === tripId);
  if (!trip) return dateValue;
  return clampDateWithinRange(dateValue, trip.start_date, trip.end_date);
}

async function fetchTrip(tripId) {
  const res = await fetch(`/api/trips/${tripId}`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function fetchActivities(tripId) {
  const res = await fetch(`/api/trips/${tripId}/activities`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchTrips() {
  const res = await fetch("/api/trips", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchActivity(activityId) {
  const res = await fetch(`/api/activities/${activityId}`, { credentials: "include" });
  if (!res.ok) return null;
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

async function deletePhoto(photoId) {
  await fetch(`/api/photos/${photoId}`, {
    method: "DELETE",
    credentials: "include",
  });
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

function setMessage(el, message) {
  el.textContent = message || "";
  el.classList.toggle("visible", Boolean(message));
}

function bindFileInput() {
  const fileInput = document.getElementById("activity-photo-input");
  const fileBtn = document.getElementById("activity-photo-btn");
  const fileName = document.getElementById("activity-photo-name");
  const previewWrap = document.getElementById("activity-photo-preview");
  const previewGrid = document.getElementById("activity-photo-grid");
  const clearBtn = document.getElementById("activity-photo-clear");

  fileBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    if (files.length > 1) {
      fileName.textContent = `${files.length} files selected`;
    } else {
      fileName.textContent = files[0]?.name || "No file selected";
    }

    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrls = [];
    previewGrid.innerHTML = "";

    if (files.length > 0) {
      files.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        previewObjectUrls.push(url);
        const item = document.createElement("div");
        item.className = "activity-photo-item";
        item.innerHTML = `
          <img src="${url}" alt="Selected activity" />
          <div class="activity-photo-meta">
            <input class="input" type="text" placeholder="Notes" data-photo-caption="${index}" />
            <input class="input" type="date" value="${getTodayInputValue()}" data-photo-date="${index}" />
          </div>
        `;
        previewGrid.appendChild(item);
      });
      previewWrap.hidden = false;
    } else {
      previewWrap.hidden = true;
    }
  });

  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    fileName.textContent = "No file selected";
    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrls = [];
    previewGrid.innerHTML = "";
    previewWrap.hidden = true;
  });
}

function renderTripSelect(selectedId) {
  const select = document.getElementById("activity-trip-select");
  select.innerHTML = "<option value=\"\">No trip</option>";
  allTrips.forEach((trip) => {
    const option = document.createElement("option");
    option.value = trip.id;
    option.textContent = trip.title;
    select.appendChild(option);
  });
  if (selectedId) {
    select.value = selectedId;
  }
}

function renderExistingPhotos(activity) {
  const existingWrap = document.getElementById("activity-photo-existing");
  const existingGrid = document.getElementById("activity-photo-existing-grid");
  existingGrid.innerHTML = "";

  const photos = activity?.photos || [];
  if (photos.length === 0) {
    existingWrap.hidden = true;
    return;
  }

  existingWrap.hidden = false;
  photos.forEach((photo) => {
    const item = document.createElement("div");
    item.className = "activity-photo-item";
    item.innerHTML = `
      <img src="${photo.thumbnail_url || photo.url}" alt="Activity photo" />
      <div class="activity-photo-meta">
        <input class="input" type="text" value="${photo.caption || ""}" placeholder="Notes" data-photo-caption />
        <input class="input" type="date" value="${formatDateInputValue(photo.taken_at)}" data-photo-date />
      </div>
      <div class="activity-photo-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="save">Save</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="delete">Remove</button>
      </div>
    `;

    item.querySelector("[data-action='save']").addEventListener("click", async () => {
      const caption = item.querySelector("[data-photo-caption]").value.trim();
      const dateValue = item.querySelector("[data-photo-date]").value;

      try {
        const updated = await updatePhoto(photo.id, {
          caption: caption || null,
          taken_at: dateValue ? toIsoDate(dateValue) : null,
        });
        const index = currentActivity.photos.findIndex((entry) => entry.id === photo.id);
        if (index !== -1) {
          currentActivity.photos[index] = updated;
        }
      } catch (error) {
        setMessage(document.getElementById("activity-form-error"), error.message);
      }
    });

    item.querySelector("[data-action='delete']").addEventListener("click", async () => {
      await deletePhoto(photo.id);
      currentActivity.photos = currentActivity.photos.filter((item) => item.id !== photo.id);
      renderExistingPhotos(currentActivity);
    });

    existingGrid.appendChild(item);
  });
}

function fillForm(activity) {
  document.getElementById("activity-title-input").value = activity?.title || "";
  document.getElementById("activity-type-input").value = activity?.activity_type || "other";
  document.getElementById("activity-location-input").value = activity?.location_name || "";
  document.getElementById("activity-datetime-input").value = formatDateInputValue(activity?.start_datetime);
  document.getElementById("activity-notes-input").value = activity?.notes || "";
  document.getElementById("activity-highlight-input").checked = Boolean(activity?.is_highlight);
  const previewWrap = document.getElementById("activity-photo-preview");
  const previewGrid = document.getElementById("activity-photo-grid");
  previewGrid.innerHTML = "";
  previewWrap.hidden = true;
  renderExistingPhotos(activity);
}

async function handleSubmit() {
  const title = document.getElementById("activity-title-input").value.trim();
  const activity_type = document.getElementById("activity-type-input").value;
  const location_name = document.getElementById("activity-location-input").value.trim();
  const startValue = document.getElementById("activity-datetime-input").value;
  const notes = document.getElementById("activity-notes-input").value.trim();
  const is_highlight = document.getElementById("activity-highlight-input").checked;
  const files = Array.from(document.getElementById("activity-photo-input").files || []);
  const selectedTripId = document.getElementById("activity-trip-select")?.value || "";
  const errorEl = document.getElementById("activity-form-error");
  const submitBtn = document.getElementById("activity-submit");

  setMessage(errorEl, null);

  if (!title) {
    setMessage(errorEl, "Title is required.");
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
  if (startValue) payload.start_datetime = toIsoDate(startValue);

  const useTripScoped = Boolean(currentTripId);
  const endpoint = useTripScoped
    ? (currentActivity
      ? `/api/trips/${currentTripId}/activities/${currentActivity.id}`
      : `/api/trips/${currentTripId}/activities`)
    : (currentActivity
      ? `/api/activities/${currentActivity.id}`
      : "/api/activities");
  const method = currentActivity ? "PUT" : "POST";

  if (!useTripScoped) {
    payload.trip_id = selectedTripId || null;
  }

  if (selectedTripId) {
    const dateInput = document.getElementById("activity-datetime-input");
    const clamped = clampDateForTrip(selectedTripId, dateInput.value || getTodayInputValue());
    if (clamped !== dateInput.value) {
      dateInput.value = clamped;
    }
    payload.start_datetime = toIsoDate(dateInput.value);
  }

  if (!useTripScoped && !selectedTripId && files.length > 0) {
    setMessage(errorEl, "Photos require a trip. Select a trip before uploading.");
    return;
  }

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
    setMessage(errorEl, data.errors?.[0]?.msg ?? data.error ?? "Something went wrong.");
    return;
  }

  if (files.length > 0) {
    const activityId = data.id || currentActivity?.id;
    const tripIdForPhotos = useTripScoped ? currentTripId : (selectedTripId || currentActivity?.trip_id);

    if (!tripIdForPhotos) {
      setMessage(errorEl, "Photos require a trip. Select a trip before uploading.");
      return;
    }

    try {
      for (const [index, file] of files.entries()) {
        const captionInput = document.querySelector(`[data-photo-caption="${index}"]`);
        const dateInput = document.querySelector(`[data-photo-date="${index}"]`);
        const caption = captionInput?.value?.trim() || "";
        const dateValue = dateInput?.value || "";
        await uploadActivityPhoto(tripIdForPhotos, activityId, file, caption, dateValue ? toIsoDate(dateValue) : null);
      }
    } catch (uploadError) {
      setMessage(errorEl, uploadError.message);
      return;
    }
  }

  const redirectTarget = currentTripId ? `/trips/${currentTripId}` : "/activities";
  window.location.href = redirectTarget;
}

async function initActivityPage() {
  const profile = await checkAuth();
  if (!profile) return;

  populateNavbar(profile);
  initDropdown();
  bindFileInput();

  const params = new URLSearchParams(window.location.search);
  currentTripId = params.get("tripId");
  const errorEl = document.getElementById("activity-form-error");
  const isEdit = window.location.pathname.includes("/edit");

  allTrips = await fetchTrips();
  renderTripSelect(currentTripId);

  const backLink = document.getElementById("back-to-trip");
  const cancelLink = document.getElementById("activity-cancel");

  if (currentTripId) {
    const trip = await fetchTrip(currentTripId);
    if (trip) {
      backLink.href = `/trips/${currentTripId}`;
      cancelLink.href = `/trips/${currentTripId}`;
      document.getElementById("activity-page-sub").textContent = `Trip: ${trip.title}`;
    }

    document.getElementById("activity-trip-select").value = currentTripId;
    document.getElementById("activity-trip-select").disabled = true;
  } else {
    backLink.href = "/activities";
    cancelLink.href = "/activities";
    document.getElementById("activity-page-sub").textContent = "Add a new memory, with or without a trip.";
  }

  if (!isEdit) {
    const dateInput = document.getElementById("activity-datetime-input");
    if (dateInput && !dateInput.value) {
      dateInput.value = clampDateForTrip(selectedTripId, getTodayInputValue());
    }
  }

  if (isEdit) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const activityId = parts[1];

    if (currentTripId) {
      const activities = await fetchActivities(currentTripId);
      currentActivity = activities.find((activity) => activity.id === activityId);
    } else {
      currentActivity = await fetchActivity(activityId);
    }

    if (!currentActivity) {
      setMessage(errorEl, "Activity not found.");
      return;
    }

    renderTripSelect(currentActivity.trip_id || "");
    fillForm(currentActivity);
  }

  const tripSelect = document.getElementById("activity-trip-select");
  if (tripSelect) {
    tripSelect.addEventListener("change", () => {
      const dateInput = document.getElementById("activity-datetime-input");
      if (!dateInput) return;
      const nextValue = dateInput.value || getTodayInputValue();
      dateInput.value = clampDateForTrip(tripSelect.value, nextValue);
    });
  }

  document.getElementById("activity-submit").addEventListener("click", handleSubmit);
}

initActivityPage();
