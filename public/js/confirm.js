const box = document.getElementById("confirm-box");
const hash    = new URLSearchParams(window.location.hash.slice(1));
const token   = hash.get("access_token");
const refresh = hash.get("refresh_token");
const type    = hash.get("type");

if (token && type === "signup") {

  localStorage.setItem("roam_token", token);
  if (refresh) localStorage.setItem("roam_refresh_token", refresh);

  box.innerHTML = `
    <div class="confirm-icon">✓</div>
    <h1>E-mail confirmed</h1>
    <p class="text-secondary">Your account is ready. You will be redirected shortly.</p>
    <a href="/auth.html" class="btn btn-primary">Log in</a>
  `;

  setTimeout(() => { window.location.href = "/auth.html"; }, 3000);

} else {
  window.location.href = "/auth.html";
}