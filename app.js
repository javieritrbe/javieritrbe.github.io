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

// Split panel text into animatable units: letters for headings, words for
// body copy. Each span gets a cumulative delay so panels cascade in
// heading-first, line by line — SwiftUI numericText style.
function splitReveal(el, mode, start, step) {
  let t = start;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        return;
      }
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      const tokens = mode === "letters"
        ? child.textContent.split(/(\s+)/)
        : child.textContent.split(/(\s+)/);
      tokens.forEach((tok) => {
        if (!tok.trim()) {
          frag.appendChild(document.createTextNode(tok));
          return;
        }
        const units = mode === "letters" ? [...tok] : [tok];
        units.forEach((u) => {
          const span = document.createElement("span");
          span.className = "rv";
          span.textContent = u;
          span.style.animationDelay = `${t.toFixed(3)}s`;
          t += step;
          frag.appendChild(span);
        });
      });
      child.replaceWith(frag);
    });
  };
  walk(el);
  return t;
}

document.querySelectorAll(".panel").forEach((panel) => {
  let t = 0.03;
  const h1 = panel.querySelector("h1");
  if (h1) t = splitReveal(h1, "letters", t, 0.022) + 0.09;
  panel.querySelectorAll("p").forEach((p) => {
    t = splitReveal(p, "words", t, 0.012) + 0.07;
  });
});

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

  if (btn && screen.contains(btn)) {
    // Grow the app view out of the tapped icon's position
    const iconRect = btn.getBoundingClientRect();
    const screenRect = screen.getBoundingClientRect();
    const ox = ((iconRect.left + iconRect.width / 2 - screenRect.left) / screenRect.width) * 100;
    const oy = ((iconRect.top + iconRect.height / 2 - screenRect.top) / screenRect.height) * 100;
    appview.style.transformOrigin = `${ox}% ${oy}%`;
  } else {
    // opened from a text link — grow from the middle of the screen
    appview.style.transformOrigin = "50% 42%";
  }

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

// bold text actions in the panels mirror tapping the icons
document.querySelectorAll(".tlink[data-app]").forEach((btn) => {
  const activate = () => {
    const name = btn.dataset.app;
    if (openApp === name) return;
    open(name, btn);
  };
  btn.addEventListener("click", activate);
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
});

// "Tap around": hovering gives the phone a little shake
const shaker = document.querySelector("[data-shake]");
const iphone = document.querySelector(".iphone");
if (shaker && iphone) {
  shaker.addEventListener("mouseenter", () => {
    if (iphone.classList.contains("shaking")) return;
    iphone.classList.add("shaking");
  });
  iphone.addEventListener("animationend", (e) => {
    if (e.animationName === "phone-shake") iphone.classList.remove("shaking");
  });
}

closeBtn.addEventListener("click", close);
appview.addEventListener("click", close); // tap anywhere on the open app to dismiss
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});
