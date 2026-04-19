// auth.js — handles tab switching and form submissions for auth.html

const tabLogin    = document.getElementById("tab-login");
const tabSignup   = document.getElementById("tab-signup");
const formLogin   = document.getElementById("form-login");
const formSignup  = document.getElementById("form-signup");
const footerSwitch = document.getElementById("footer-switch");
const authFooter  = document.getElementById("auth-footer");


// Tab switching
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

// Helpers
function setMessage(el, text) {
  el.textContent = text ?? "";
  el.classList.toggle("visible", Boolean(text));
}

function setLoading(btn, isLoading, originalText) {
  btn.classList.toggle("loading", isLoading);
  btn.disabled = isLoading;
  if (!isLoading) btn.textContent = originalText;
}

// Login 
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl  = document.getElementById("login-error");
  const successEl = document.getElementById("login-success");
  const btn      = document.getElementById("login-btn");

  setMessage(errorEl, null);
  setMessage(successEl, null);

  if (!email || !password) {
    setMessage(errorEl, "Please fill in email and password.");
    return;
  }

  setLoading(btn, true, "Log in");

  const res  = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
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

// Signup
formSignup.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email    = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const errorEl  = document.getElementById("signup-error");
  const successEl = document.getElementById("signup-success");
  const btn      = document.getElementById("signup-btn");

  setMessage(errorEl, null);
  setMessage(successEl, null);

  if (!email || !password) {
    setMessage(errorEl, "Please fill in email and password.");
    return;
  }

  setLoading(btn, true, "Create account");

  const res  = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
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

  setMessage(successEl, "Account created! Check your email to confirm.");
});

// Auth check
async function checkAlreadyLoggedIn() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.ok) window.location.href = "/";
}

checkAlreadyLoggedIn();