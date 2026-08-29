// App config — one entry per home-screen app.
// To add a screen recording: set `video` to the file path (e.g. "media/sage.mp4")
// and it will play inside the phone instead of the placeholder.
const APPS = {
  sage: {
    video: null,
    placeholderClass: "ph-sage",
    iconClass: "icon-sage",
    note: "Screen recording coming soon",
  },
  reranker: {
    video: null,
    placeholderClass: "ph-reranker",
    iconClass: "icon-reranker",
    note: "Screen recording coming soon",
  },
  playground: {
    video: null,
    placeholderClass: "ph-playground",
    iconClass: "icon-playground",
    note: "Screen recording coming soon",
  },
  gold: {
    video: null,
    placeholderClass: "ph-gold",
    iconClass: "icon-gold",
    note: "Screen recording coming soon",
  },
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
  const iconSvg = document.querySelector(`[data-app="${name}"] .app-icon`).cloneNode(true);
  ph.appendChild(iconSvg);
  const note = document.createElement("p");
  note.textContent = app.note;
  ph.appendChild(note);
  return ph;
}

function open(name, iconEl) {
  openApp = name;

  // Grow the app view out of the tapped icon's position
  const iconRect = iconEl.getBoundingClientRect();
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

document.querySelectorAll(".app").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.app;
    if (openApp === name) return;
    open(name, btn.querySelector(".app-icon"));
  });
});

closeBtn.addEventListener("click", close);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});
