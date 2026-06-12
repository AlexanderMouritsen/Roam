// Auth.js — logic for auth.html

const tabLogin     = document.getElementById("tab-login");
const tabSignup    = document.getElementById("tab-signup");
const authTabs     = document.querySelector(".auth-tabs");
const formLogin    = document.getElementById("form-login");
const formSignup   = document.getElementById("form-signup");
const formReset    = document.getElementById("form-reset");
const formRecovery = document.getElementById("form-recovery");
const footerSwitch = document.getElementById("footer-switch");
const authFooter   = document.getElementById("auth-footer");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const forgotPasswordBtn = document.getElementById("forgot-password-btn");
const loginErrorEl = document.getElementById("login-error");
const loginSuccessEl = document.getElementById("login-success");
const loginBtn = document.getElementById("login-btn");
const resetEmailInput = document.getElementById("reset-email");
const resetErrorEl = document.getElementById("reset-error");
const resetSuccessEl = document.getElementById("reset-success");
const resetBtn = document.getElementById("reset-btn");
const resetBackBtn = document.getElementById("reset-back-btn");
const recoveryPasswordInput = document.getElementById("recovery-password");
const recoveryPasswordConfirmInput = document.getElementById("recovery-password-confirm");
const recoveryErrorEl = document.getElementById("recovery-error");
const recoverySuccessEl = document.getElementById("recovery-success");
const recoveryBtn = document.getElementById("recovery-btn");
const recoveryBackBtn = document.getElementById("recovery-back-btn");

const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const signupUsernameInput = document.getElementById("signup-username");
const signupDisplayNameInput = document.getElementById("signup-display-name");
const signupHomeCountryInput = document.getElementById("signup-home-country");
const signupErrorEl = document.getElementById("signup-error");
const signupSuccessEl = document.getElementById("signup-success");
const signupBtn = document.getElementById("signup-btn");

function showLogin() {
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  formLogin.hidden  = false;
  formSignup.hidden = true;
  authFooter.innerHTML = `Don't have an account? <button type="button" id="footer-switch">Sign up</button>`;
  document.getElementById("footer-switch").addEventListener("click", showSignup);
}

function showSignup() {
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  formSignup.hidden = false;
  formLogin.hidden  = true;
  authFooter.innerHTML = `Already have an account? <button type="button" id="footer-switch">Log in</button>`;
  document.getElementById("footer-switch").addEventListener("click", showLogin);
}

tabLogin.addEventListener("click", showLogin);
tabSignup.addEventListener("click", showSignup);
footerSwitch.addEventListener("click", showSignup);


function setMessage(el, text) {
  el.textContent = text ?? "";
  el.classList.toggle("visible", Boolean(text));
}

function setLoading(btn, isLoading, originalText) {
  btn.classList.toggle("loading", isLoading);
  btn.disabled = isLoading;
  if (!isLoading) btn.textContent = originalText;
}



let allCountries = []; // [{ code: "NO", name: "Norway" }, ...]

const countrySearch  = document.getElementById("country-search");
const countryList    = document.getElementById("country-list");
let supabaseClient = null;

function isRecoveryIntent() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("mode") === "recovery" ||
    window.location.hash.includes("type=recovery") ||
    window.location.hash.includes("access_token=")
  );
}

function setFooterForMode(mode) {
  if (mode === "login") {
    authFooter.hidden = false;
    authFooter.innerHTML = `Don't have an account? <button type="button" id="footer-switch">Sign up</button>`;
    document.getElementById("footer-switch").addEventListener("click", showSignup);
    return;
  }

  if (mode === "signup") {
    authFooter.hidden = false;
    authFooter.innerHTML = `Already have an account? <button type="button" id="footer-switch">Log in</button>`;
    document.getElementById("footer-switch").addEventListener("click", showLogin);
    return;
  }

  authFooter.hidden = true;
}

function hideAuthForms() {
  formLogin.hidden = true;
  formSignup.hidden = true;
  formReset.hidden = true;
  formRecovery.hidden = true;
}

function showLogin() {
  hideAuthForms();
  authTabs.hidden = false;
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  formLogin.hidden = false;
  setFooterForMode("login");
}

function showSignup() {
  hideAuthForms();
  authTabs.hidden = false;
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  formSignup.hidden = false;
  setFooterForMode("signup");
}

function showResetRequest() {
  hideAuthForms();
  authTabs.hidden = true;
  formReset.hidden = false;
  setFooterForMode("reset");
  if (loginEmailInput.value.trim() && !resetEmailInput.value.trim()) {
    resetEmailInput.value = loginEmailInput.value.trim();
  }
}

function showRecovery() {
  hideAuthForms();
  authTabs.hidden = true;
  formRecovery.hidden = false;
  setFooterForMode("recovery");
}

async function loadCountries() {
  const res = await fetch("/api/countries");
  if (!res.ok) return;
  allCountries = await res.json();
}

function renderCountryList(query) {
  const q = query.toLowerCase().trim();
  const matches = q ? allCountries.filter((c) => c.name.toLowerCase().includes(q)) : allCountries;

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
  signupHomeCountryInput.value = country.code;
  countryList.hidden = true;
}

function initCountryPicker() {
  countrySearch.addEventListener("focus", () => {
    renderCountryList(countrySearch.value);
  });

  countrySearch.addEventListener("input", () => {
    signupHomeCountryInput.value = "";
    renderCountryList(countrySearch.value);
  });

  countrySearch.addEventListener("blur", () => {
    setTimeout(() => {
      countryList.hidden = true;
    }, 150);
  });
}

async function initSupabaseClient() {
  const res = await fetch("/api/auth/public-config");
  if (!res.ok) return;

  const config = await res.json();
  if (!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) return;

  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      showRecovery();
    }
  });
}

async function checkAlreadyLoggedIn() {
  if (isRecoveryIntent()) return;

  const res = await fetch("/api/users/me", { credentials: "include" });
  if (res.ok) window.location.href = "/";
}

tabLogin.addEventListener("click", showLogin);
tabSignup.addEventListener("click", showSignup);
forgotPasswordBtn.addEventListener("click", showResetRequest);
resetBackBtn.addEventListener("click", showLogin);
recoveryBackBtn.addEventListener("click", showLogin);

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  setMessage(loginErrorEl, null);
  setMessage(loginSuccessEl, null);

  if (!email || !password) {
    setMessage(loginErrorEl, "Please fill in email and password.");
    return;
  }

  setLoading(loginBtn, true, "Log in");

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  setLoading(loginBtn, false, "Log in");

  if (!res.ok) {
    setMessage(loginErrorEl, data.error ?? "Something went wrong.");
    return;
  }

  setMessage(loginSuccessEl, "Logged in! Redirecting…");
  setTimeout(() => {
    window.location.href = "/";
  }, 800);
});

formSignup.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;
  const username = signupUsernameInput.value.trim();
  const display_name = signupDisplayNameInput.value.trim();
  const home_country = signupHomeCountryInput.value;

  setMessage(signupErrorEl, null);
  setMessage(signupSuccessEl, null);

  if (!email) {
    setMessage(signupErrorEl, "Email is required.");
    return;
  }
  if (!password) {
    setMessage(signupErrorEl, "Password is required.");
    return;
  }
  if (!username) {
    setMessage(signupErrorEl, "Username is required.");
    return;
  }
  if (!display_name) {
    setMessage(signupErrorEl, "Display name is required.");
    return;
  }
  if (!home_country) {
    setMessage(signupErrorEl, "Please select a home country from the list.");
    return;
  }

  setLoading(signupBtn, true, "Create account");

  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, username, display_name, home_country }),
  });

  const data = await res.json();
  setLoading(signupBtn, false, "Create account");

  if (!res.ok) {
    const msg = data.errors ? data.errors.map((e) => e.msg).join(" ") : data.error ?? "Something went wrong.";
    setMessage(signupErrorEl, msg);
    return;
  }

  setMessage(
    signupSuccessEl,
    data.confirmed ? "Account created! Redirecting…" : "Account created! Check your email to confirm."
  );

  if (data.confirmed) {
    setTimeout(() => {
      window.location.href = "/";
    }, 800);
  }
});

formReset.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = resetEmailInput.value.trim();

  setMessage(resetErrorEl, null);
  setMessage(resetSuccessEl, null);

  if (!email) {
    setMessage(resetErrorEl, "Email is required.");
    return;
  }

  setLoading(resetBtn, true, "Send reset link");

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(resetBtn, false, "Send reset link");

    if (!res.ok) {
      setMessage(resetErrorEl, data.error ?? "Failed to send reset link.");
      return;
    }

    setMessage(resetSuccessEl, data.message ?? "If that email exists, a reset link has been sent.");
  } catch (err) {
    setLoading(resetBtn, false, "Send reset link");
    setMessage(resetErrorEl, "Failed to send reset link.");
  }
});

formRecovery.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = recoveryPasswordInput.value;
  const confirm = recoveryPasswordConfirmInput.value;

  setMessage(recoveryErrorEl, null);
  setMessage(recoverySuccessEl, null);

  if (!password || !confirm) {
    setMessage(recoveryErrorEl, "Please fill in both password fields.");
    return;
  }
  if (password.length < 8) {
    setMessage(recoveryErrorEl, "New password must be at least 8 characters.");
    return;
  }
  if (password !== confirm) {
    setMessage(recoveryErrorEl, "Passwords do not match.");
    return;
  }
  if (!supabaseClient) {
    setMessage(recoveryErrorEl, "Password recovery is not available right now.");
    return;
  }

  setLoading(recoveryBtn, true, "Update password");

  try {
    const { error } = await supabaseClient.auth.updateUser({ password });
    setLoading(recoveryBtn, false, "Update password");

    if (error) {
      setMessage(recoveryErrorEl, error.message ?? "Failed to update password.");
      return;
    }

    setMessage(recoverySuccessEl, "Password updated. Redirecting to log in…");
    await supabaseClient.auth.signOut();
    setTimeout(() => {
      window.location.href = "/auth.html";
    }, 1000);
  } catch (err) {
    setLoading(recoveryBtn, false, "Update password");
    setMessage(recoveryErrorEl, "Failed to update password.");
  }
});

async function initAuthPage() {
  await Promise.all([loadCountries(), initSupabaseClient()]);

  if (isRecoveryIntent()) {
    showRecovery();
  } else {
    showLogin();
  }

  initCountryPicker();
  await checkAlreadyLoggedIn();
}

initAuthPage();