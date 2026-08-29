// App config — one entry per tappable home-screen app.
// To add a screen recording: set `video` to the file path (e.g. "media/bereal.mp4")
// and it will play inside the phone instead of the placeholder.
const APPS = {
  bereal:  { video: null, placeholderClass: "ph-bereal" },
  retro:   { video: null, placeholderClass: "ph-retro" },
  corner:  { video: null, placeholderClass: "ph-corner" },
  gold:    { video: null, placeholderClass: "ph-gold" },
  expense: { video: null, placeholderClass: "ph-expense" },
  camera:  { video: null, placeholderClass: "ph-camera" },
};

const screen = document.getElementById("screen");
const appview = document.getElementById("appview");
const appviewBody = document.getElementById("appview-body");
const closeBtn = document.getElementById("appview-close");
const panels = document.querySelectorAll(".panel");

let openApp = null;

function showPanel(name) {
  panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
}

function buildAppScreen(name) {
  const app = APPS[name];
  if (app.video) {
    const video = document.createElement("video");
    video.src = app.video;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "metadata";
    return video;
  }
  const ph = document.createElement("div");
  ph.className = `app-placeholder ${app.placeholderClass}`;
  const icon = document.createElement("span");
  icon.className = "ph-icon";
  const img = document.createElement("img");
  img.src = `media/icon-${name}.webp`;
  img.alt = "";
  icon.appendChild(img);
  ph.appendChild(icon);
  const note = document.createElement("p");
  note.textContent = "Screen recording coming soon";
  ph.appendChild(note);
  return ph;
}

function open(name, btn) {
  openApp = name;

  // Grow the app view out of the tapped icon's position
  const iconRect = btn.getBoundingClientRect();
  const screenRect = screen.getBoundingClientRect();
  const ox = ((iconRect.left + iconRect.width / 2 - screenRect.left) / screenRect.width) * 100;
  const oy = ((iconRect.top + iconRect.height / 2 - screenRect.top) / screenRect.height) * 100;
  appview.style.transformOrigin = `${ox}% ${oy}%`;

  appviewBody.replaceChildren(buildAppScreen(name));
  appview.hidden = false;

  // next frame so the transition runs
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      appview.classList.add("is-open");
      screen.classList.add("app-is-open");
    });
  });

  showPanel(name);
  closeBtn.focus({ preventScroll: true });
}

function close() {
  if (!openApp) return;
  openApp = null;
  appview.classList.remove("is-open");
  screen.classList.remove("app-is-open");
  showPanel("default");
  appview.addEventListener(
    "transitionend",
    () => {
      if (!openApp) {
        appview.hidden = true;
        appviewBody.replaceChildren();
      }
    },
    { once: true }
  );
}

document.querySelectorAll(".hotspot[data-app]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.app;
    if (openApp === name) return;
    open(name, btn);
  });
});

closeBtn.addEventListener("click", close);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});
