// Auth.js — logic for auth.html

const tabLogin     = document.getElementById("tab-login");
const tabSignup    = document.getElementById("tab-signup");
const formLogin    = document.getElementById("form-login");
const formSignup   = document.getElementById("form-signup");
const footerSwitch = document.getElementById("footer-switch");
const authFooter   = document.getElementById("auth-footer");



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
const countryCodeInput = document.getElementById("signup-home-country"); // hidden

async function loadCountries() {
  const res = await fetch("/api/countries");
  if (!res.ok) return;

  allCountries = await res.json(); // already sorted by name from the server
}

// Render filtered country list
function renderCountryList(query) {
  const q = query.toLowerCase().trim();

  // Filter to countries whose name contains the query
  const matches = q
    ? allCountries.filter((c) => c.name.toLowerCase().includes(q))
    : allCountries;

  countryList.innerHTML = "";

  if (matches.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No countries found.";
    li.className   = "no-results";
    countryList.appendChild(li);
  } else {
    matches.forEach((c) => {
      const li       = document.createElement("li");
      li.textContent = c.name;
      li.dataset.code = c.code;

      li.addEventListener("mousedown", (e) => {
        // mousedown fires before blur, so set value first
        e.preventDefault();
        selectCountry(c);
      });

      countryList.appendChild(li);
    });
  }

  countryList.hidden = false;
}

// Set country input values on selection
function selectCountry(country) {
  countrySearch.value    = country.name; // show the name in the visible input
  countryCodeInput.value = country.code; // store the code in the hidden input
  countryList.hidden     = true;
}

// Show list on focus
countrySearch.addEventListener("focus", () => {
  renderCountryList(countrySearch.value);
});

// Filter list on input and clear code if typing
countrySearch.addEventListener("input", () => {
  countryCodeInput.value = "";
  renderCountryList(countrySearch.value);
});

// Hide list on blur
countrySearch.addEventListener("blur", () => {
  // Small delay so a mousedown on a list item can fire first
  setTimeout(() => { countryList.hidden = true; }, 150);
});

loadCountries();

// Login handler

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email     = document.getElementById("login-email").value.trim();
  const password  = document.getElementById("login-password").value;
  const errorEl   = document.getElementById("login-error");
  const successEl = document.getElementById("login-success");
  const btn       = document.getElementById("login-btn");

  setMessage(errorEl,   null);
  setMessage(successEl, null);

  if (!email || !password) {
    setMessage(errorEl, "Please fill in email and password.");
    return;
  }

  setLoading(btn, true, "Log in");

  const res  = await fetch("/api/auth/login", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({ email, password }),
  });

  const data = await res.json();
  setLoading(btn, false, "Log in");

  if (!res.ok) {
    setMessage(errorEl, data.error ?? "Something went wrong.");
    return;
  }

  setMessage(successEl, "Logged in! Redirecting…");
  setTimeout(() => { window.location.href = "/"; }, 800);
});

// Signup handler

formSignup.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email        = document.getElementById("signup-email").value.trim();
  const password     = document.getElementById("signup-password").value;
  const username     = document.getElementById("signup-username").value.trim();
  const display_name = document.getElementById("signup-display-name").value.trim();
  const home_country = document.getElementById("signup-home-country").value; // hidden input
  const errorEl      = document.getElementById("signup-error");
  const successEl    = document.getElementById("signup-success");
  const btn          = document.getElementById("signup-btn");

  setMessage(errorEl,   null);
  setMessage(successEl, null);

  // Client-side checks
  if (!email)        { setMessage(errorEl, "Email is required.");                       return; }
  if (!password)     { setMessage(errorEl, "Password is required.");                    return; }
  if (!username)     { setMessage(errorEl, "Username is required.");                    return; }
  if (!display_name) { setMessage(errorEl, "Display name is required.");                return; }
  if (!home_country) { setMessage(errorEl, "Please select a home country from the list."); return; }

  setLoading(btn, true, "Create account");

  const res = await fetch("/api/auth/signup", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({ email, password, username, display_name, home_country }),
  });

  const data = await res.json();
  setLoading(btn, false, "Create account");

  if (!res.ok) {
    const msg = data.errors
      ? data.errors.map((e) => e.msg).join(" ")
      : data.error ?? "Something went wrong.";
    setMessage(errorEl, msg);
    return;
  }

  setMessage(
    successEl,
    data.confirmed
      ? "Account created! Redirecting…"
      : "Account created! Check your email to confirm."
  );

  if (data.confirmed) {
    setTimeout(() => { window.location.href = "/"; }, 800);
  }
});

// Redirect if already logged in

async function checkAlreadyLoggedIn() {
  const res = await fetch("/api/users/me", { credentials: "include" });
  if (res.ok) window.location.href = "/";
}

checkAlreadyLoggedIn();