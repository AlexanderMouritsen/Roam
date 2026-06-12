// settings.js — profile settings page logic

const form = document.getElementById("settings-form");
const usernameInput = document.getElementById("settings-username");
const displayNameInput = document.getElementById("settings-display-name");
const bioInput = document.getElementById("settings-bio");
const bioHint = document.getElementById("bio-hint");
const homeCountryInput = document.getElementById("settings-home-country");
const avatarFileInput = document.getElementById("settings-avatar");
const avatarPreview = document.getElementById("settings-avatar-preview");
const errorEl = document.getElementById("settings-error");
const successEl = document.getElementById("settings-success");
const saveBtn = document.getElementById("settings-save-btn");
const cancelBtn = document.getElementById("settings-cancel-btn");
const statusEl = document.getElementById("settings-status");

const countrySearch = document.getElementById("country-search");
const countryList = document.getElementById("country-list");

const leaveModal = document.getElementById("leave-modal");
const leaveModalStayBtn = document.getElementById("leave-modal-stay");
const leaveModalLeaveBtn = document.getElementById("leave-modal-leave");

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;

let allCountries = [];
let initialProfile = null;
let currentAvatarUrl = "";
let pendingAvatarFile = null;
let pendingAvatarPreviewUrl = null;
let pendingNavigationAction = null;

function setMessage(el, text) {
  el.textContent = text ?? "";
  el.classList.toggle("visible", Boolean(text));
}

function setLoading(btn, isLoading, originalText) {
  btn.classList.toggle("loading", isLoading);
  btn.disabled = isLoading;
  if (!isLoading) btn.textContent = originalText;
}

function clearPendingAvatarPreviewUrl() {
  if (pendingAvatarPreviewUrl) {
    URL.revokeObjectURL(pendingAvatarPreviewUrl);
    pendingAvatarPreviewUrl = null;
  }
}

function getAvatarInitials() {
  const fallbackName = displayNameInput.value.trim() || usernameInput.value.trim() || "User";
  return fallbackName.slice(0, 2).toUpperCase();
}

function renderAvatar(url) {
  avatarPreview.style.backgroundImage = "";
  avatarPreview.textContent = "";

  if (url) {
    avatarPreview.style.backgroundImage = `url(${url})`;
    avatarPreview.style.backgroundSize = "cover";
    avatarPreview.style.backgroundPosition = "center";
    return;
  }

  avatarPreview.textContent = getAvatarInitials();
}

function snapshotProfile() {
  return {
    username: usernameInput.value.trim(),
    display_name: displayNameInput.value.trim(),
    bio: bioInput.value.trim(),
    home_country: homeCountryInput.value.trim(),
    avatar_url: currentAvatarUrl,
  };
}

function isDirty() {
  if (!initialProfile) return false;
  const current = snapshotProfile();
  const hasProfileChanges = Object.keys(current).some((key) => current[key] !== initialProfile[key]);
  return hasProfileChanges || Boolean(pendingAvatarFile);
}

function updateDirtyState() {
  const dirty = isDirty();
  statusEl.textContent = dirty ? "Unsaved changes." : "Changes save instantly.";
  cancelBtn.classList.toggle("is-hidden", !dirty);
}

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
  avatar.textContent = "";
  avatar.style.backgroundImage = "";

  if (profile.avatar_url) {
    avatar.style.backgroundImage = `url(${profile.avatar_url})`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
  } else {
    avatar.textContent = displayName.slice(0, 2).toUpperCase();
  }
}

function openLeaveModal(action) {
  pendingNavigationAction = action;
  leaveModal.hidden = false;
}

function closeLeaveModal() {
  leaveModal.hidden = true;
  pendingNavigationAction = null;
}

function requestNavigation(action) {
  if (!isDirty()) {
    action();
    return;
  }
  openLeaveModal(action);
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

  logoutBtn.addEventListener("click", () => {
    requestNavigation(async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = "/auth.html";
    });
  });
}

async function loadCountries() {
  const res = await fetch("/api/countries", { credentials: "include" });
  if (!res.ok) return;
  allCountries = await res.json();
}

function renderCountryList(query) {
  const q = query.toLowerCase().trim();
  const matches = q
    ? allCountries.filter((c) => c.name.toLowerCase().includes(q))
    : allCountries;

  countryList.innerHTML = "";

  if (matches.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No countries found.";
    li.className = "no-results";
    countryList.appendChild(li);
  } else {
    matches.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = c.name;
      li.dataset.code = c.code;

      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectCountry(c);
      });

      countryList.appendChild(li);
    });
  }

  countryList.hidden = false;
}

function selectCountry(country) {
  countrySearch.value = country.name;
  homeCountryInput.value = country.code;
  countryList.hidden = true;
  updateDirtyState();
}

function initCountryPicker() {
  countrySearch.addEventListener("focus", () => {
    renderCountryList(countrySearch.value);
  });

  countrySearch.addEventListener("input", () => {
    homeCountryInput.value = "";
    renderCountryList(countrySearch.value);
    updateDirtyState();
  });

  countrySearch.addEventListener("blur", () => {
    setTimeout(() => {
      countryList.hidden = true;
    }, 150);
  });
}

function setBioHint(text) {
  bioHint.textContent = text;
}

function updateBioCount() {
  const count = bioInput.value.length;
  setBioHint(`${count} / 150`);
  updateDirtyState();
}

function validateForm() {
  const username = usernameInput.value.trim();
  const displayName = displayNameInput.value.trim();
  const homeCountry = homeCountryInput.value.trim();

  if (!username) return "Username is required.";
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return "Username must be 3–30 characters and only use letters, numbers, and underscores.";
  }
  if (!displayName) return "Display name is required.";
  if (displayName.length < 3 || displayName.length > 30) {
    return "Display name must be between 3 and 30 characters.";
  }
  if (!homeCountry) return "Please select a home country from the list.";
  if (bioInput.value.trim().length > 150) return "Bio cannot be longer than 150 characters.";
  return null;
}

function buildPayload(avatarUrl) {
  const payload = {
    username: usernameInput.value.trim(),
    display_name: displayNameInput.value.trim(),
    bio: bioInput.value.trim(),
    home_country: homeCountryInput.value.trim(),
  };

  if (avatarUrl !== undefined) {
    payload.avatar_url = avatarUrl;
  }

  return payload;
}

async function uploadAvatarFile() {
  if (!pendingAvatarFile) return undefined;

  const formData = new FormData();
  formData.append("avatar", pendingAvatarFile);

  const res = await fetch("/api/users/me/avatar", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.errors
      ? data.errors.map((e) => e.msg).join(" ")
      : data.error ?? "Failed to upload avatar.";
    throw new Error(msg);
  }

  return data.avatar_url;
}

async function saveProfile() {
  setMessage(errorEl, null);
  setMessage(successEl, null);

  const validationError = validateForm();
  if (validationError) {
    setMessage(errorEl, validationError);
    return;
  }

  setLoading(saveBtn, true, "Save changes");

  try {
    const uploadedAvatarUrl = await uploadAvatarFile();

    const res = await fetch("/api/users/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(buildPayload(uploadedAvatarUrl)),
    });

    const data = await res.json();
    setLoading(saveBtn, false, "Save changes");

    if (!res.ok) {
      const msg = data.errors
        ? data.errors.map((e) => e.msg).join(" ")
        : data.error ?? "Failed to update profile.";
      setMessage(errorEl, msg);
      return;
    }

    currentAvatarUrl = data.avatar_url ?? "";
    pendingAvatarFile = null;
    clearPendingAvatarPreviewUrl();
    avatarFileInput.value = "";

    setMessage(successEl, "Profile updated.");
    populateNavbar(data);
    renderAvatar(currentAvatarUrl);

    initialProfile = {
      username: data.username ?? "",
      display_name: data.display_name ?? "",
      bio: data.bio ?? "",
      home_country: data.home_country ?? "",
      avatar_url: data.avatar_url ?? "",
    };
    updateDirtyState();
  } catch (error) {
    setLoading(saveBtn, false, "Save changes");
    setMessage(errorEl, error.message || "Failed to update profile.");
  }
}

function resetForm() {
  if (!initialProfile) return;
  usernameInput.value = initialProfile.username;
  displayNameInput.value = initialProfile.display_name;
  bioInput.value = initialProfile.bio;
  homeCountryInput.value = initialProfile.home_country;
  currentAvatarUrl = initialProfile.avatar_url;
  pendingAvatarFile = null;
  clearPendingAvatarPreviewUrl();
  avatarFileInput.value = "";
  renderAvatar(currentAvatarUrl);
  updateBioCount();

  const selected = allCountries.find((c) => c.code === initialProfile.home_country);
  countrySearch.value = selected ? selected.name : "";

  setMessage(errorEl, null);
  setMessage(successEl, null);
  updateDirtyState();
}

function initAvatarInput() {
  avatarFileInput.addEventListener("change", () => {
    const [file] = avatarFileInput.files || [];

    if (!file) {
      pendingAvatarFile = null;
      clearPendingAvatarPreviewUrl();
      renderAvatar(currentAvatarUrl);
      updateDirtyState();
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage(errorEl, "Avatar must be an image file.");
      avatarFileInput.value = "";
      pendingAvatarFile = null;
      clearPendingAvatarPreviewUrl();
      renderAvatar(currentAvatarUrl);
      updateDirtyState();
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setMessage(errorEl, "Avatar must be 5 MB or smaller.");
      avatarFileInput.value = "";
      pendingAvatarFile = null;
      clearPendingAvatarPreviewUrl();
      renderAvatar(currentAvatarUrl);
      updateDirtyState();
      return;
    }

    setMessage(errorEl, null);
    pendingAvatarFile = file;
    clearPendingAvatarPreviewUrl();
    pendingAvatarPreviewUrl = URL.createObjectURL(file);
    renderAvatar(pendingAvatarPreviewUrl);
    updateDirtyState();
  });
}

function initLeaveModal() {
  leaveModalStayBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLeaveModal();
  });

  leaveModalLeaveBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const action = pendingNavigationAction;
    closeLeaveModal();
    if (action) {
      await action();
    }
  });

  leaveModal.addEventListener("click", (event) => {
    if (event.target === leaveModal) {
      closeLeaveModal();
    }
  });
}

function initNavigationGuard() {
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.target.closest("#leave-modal")) return;

    const link = event.target.closest("a[href]");
    if (!link) return;
    if (link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(link.href, window.location.origin);
    const isSamePage = url.pathname === window.location.pathname && url.search === window.location.search;
    if (isSamePage || !isDirty()) return;

    event.preventDefault();
    requestNavigation(() => {
      window.location.href = link.href;
    });
  });
}

async function initSettings() {
  const [profile] = await Promise.all([checkAuth(), loadCountries()]);
  if (!profile) return;

  usernameInput.value = profile.username ?? "";
  displayNameInput.value = profile.display_name ?? "";
  bioInput.value = profile.bio ?? "";
  homeCountryInput.value = profile.home_country ?? "";
  currentAvatarUrl = profile.avatar_url ?? "";
  renderAvatar(currentAvatarUrl);
  updateBioCount();

  const selected = allCountries.find((c) => c.code === profile.home_country);
  if (selected) countrySearch.value = selected.name;

  initialProfile = snapshotProfile();
  updateDirtyState();

  // update delete-confirm state now that initialProfile is set
  try { updateDeleteConfirmState(); } catch (err) {}

  populateNavbar(profile);
  initDropdown();
  initCountryPicker();
  initAvatarInput();
  initLeaveModal();
  initNavigationGuard();
  initSectionNavigation();
}

cancelBtn.addEventListener("click", resetForm);
usernameInput.addEventListener("input", () => {
  renderAvatar(pendingAvatarPreviewUrl || currentAvatarUrl);
  updateDirtyState();
});
displayNameInput.addEventListener("input", () => {
  renderAvatar(pendingAvatarPreviewUrl || currentAvatarUrl);
  updateDirtyState();
});
bioInput.addEventListener("input", updateBioCount);
form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveProfile();
});

window.addEventListener("beforeunload", () => {
  clearPendingAvatarPreviewUrl();
});

initSettings();

// Section navigation: show only one section at a time
function initSectionNavigation() {
  const links = Array.from(document.querySelectorAll('.section-link'));
  if (links.length === 0) return;

  const sections = links
    .map((l) => l.getAttribute('href'))
    .filter(Boolean)
    .map((href) => document.querySelector(href));

  function showSectionById(id) {
    sections.forEach((s) => {
      if (!s) return;
      s.hidden = s.id !== id;
    });
    links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${id}`));
  }

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('href').slice(1);
      showSectionById(id);
      try { history.replaceState(null, '', `#${id}`); } catch (err) {}
    });
  });

  // initial: prefer hash, otherwise show account
  const preferred = window.location.hash ? window.location.hash.slice(1) : 'section-account';
  const found = sections.find((s) => s && s.id === preferred) ? preferred : sections[0].id;
  showSectionById(found);

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.slice(1);
    if (sections.find((s) => s && s.id === h)) showSectionById(h);
  });
}

// Security section handlers
const changePasswordForm = document.getElementById("security-change-password");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const securityStatus = document.getElementById("security-status");
const logoutAllBtn = document.getElementById("logout-all-btn");
const confirmUsernameInput = document.getElementById("confirm-username");
const deleteAccountConfirmBtn = document.getElementById("delete-account-confirm-btn");

function setSecurityMessage(text) {
  securityStatus.textContent = text ?? "";
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setSecurityMessage("");

    const current = currentPasswordInput.value.trim();
    const next = newPasswordInput.value.trim();
    const confirm = confirmPasswordInput.value.trim();

    if (!current || !next) {
      setSecurityMessage("Please fill both password fields.");
      return;
    }
    if (next.length < 8) {
      setSecurityMessage("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setSecurityMessage("New password and confirmation do not match.");
      return;
    }

    setLoading(document.getElementById("change-password-btn"), true, "Change password");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res.json();
      setLoading(document.getElementById("change-password-btn"), false, "Change password");
      if (!res.ok) {
        setSecurityMessage(data.error || "Failed to change password.");
        return;
      }
      setSecurityMessage("Password updated.");
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
    } catch (err) {
      setLoading(document.getElementById("change-password-btn"), false, "Change password");
      setSecurityMessage("Failed to change password.");
    }
  });
}

if (logoutAllBtn) {
  logoutAllBtn.addEventListener("click", async () => {
    if (!confirm("Log out of all devices? This will end all active sessions.")) return;
    logoutAllBtn.disabled = true;
    try {
      const res = await fetch('/api/auth/logout-all', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        alert('Failed to log out all sessions.');
        logoutAllBtn.disabled = false;
        return;
      }
      // Clear current cookie and redirect to login
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/auth.html';
    } catch (err) {
      alert('Failed to log out all sessions.');
      logoutAllBtn.disabled = false;
    }
  });
}

function getConfirmTargetUsername() {
  return (initialProfile && initialProfile.username) || usernameInput.value.trim();
}

function updateDeleteConfirmState() {
  if (!confirmUsernameInput || !deleteAccountConfirmBtn) return;
  const val = confirmUsernameInput.value.trim();
  const target = getConfirmTargetUsername();
  deleteAccountConfirmBtn.disabled = !target || val !== target;
}

if (confirmUsernameInput && deleteAccountConfirmBtn) {
  confirmUsernameInput.addEventListener('input', updateDeleteConfirmState);

  deleteAccountConfirmBtn.addEventListener('click', async () => {
    if (deleteAccountConfirmBtn.disabled) return;
    if (!confirm('Delete your account and all data? This action cannot be undone.')) return;
    deleteAccountConfirmBtn.disabled = true;
    try {
      const res = await fetch('/api/auth/account', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        alert('Failed to delete account.');
        deleteAccountConfirmBtn.disabled = false;
        return;
      }
      window.location.href = '/auth.html';
    } catch (err) {
      alert('Failed to delete account.');
      deleteAccountConfirmBtn.disabled = false;
    }
  });
}
