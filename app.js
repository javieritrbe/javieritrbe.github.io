// App config — one entry per tappable home-screen app.
// To add a screen recording: set `video` to the file path (e.g. "media/bereal.mp4")
// and it will play inside the phone instead of the placeholder.
const APPS = {
  bereal:  { video: "media/bereal.mp4", placeholderClass: "ph-bereal" },
  retro:   { video: "media/retro.mp4", placeholderClass: "ph-retro" },
  corner:  { video: "media/corner.mp4", placeholderClass: "ph-corner" },
  gold:    { video: "media/gold.mp4", placeholderClass: "ph-gold" },
  expense: { video: "media/expense.mp4", placeholderClass: "ph-expense" },
  camera:  { video: "media/camera.mp4", placeholderClass: "ph-camera" },
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
  const h1 = panel.querySelector("h1, h2");
  if (h1) t = splitReveal(h1, "letters", t, 0.022) + 0.09;
  panel.querySelectorAll("p").forEach((p) => {
    t = splitReveal(p, "words", t, 0.012) + 0.07;
  });
  panel.dataset.revealEnd = t.toFixed(2); // when this panel's text finishes
  // link underlines wipe in left-to-right in step with their own words:
  // start with the first word, finish as the last one lands
  panel.querySelectorAll(".quiet-link").forEach((a) => {
    const words = [...a.querySelectorAll(".rv")];
    if (!words.length) return;
    const first = parseFloat(words[0].style.animationDelay);
    const last = parseFloat(words[words.length - 1].style.animationDelay);
    a.style.setProperty("--ul-delay", `${first.toFixed(3)}s`);
    a.style.setProperty("--ul-dur", `${(last - first + 0.38).toFixed(3)}s`);
  });
});

// initial page load animates the default panel too
{
  const initial = document.querySelector(".panel.is-active");
  if (initial) {
    document.body.classList.add("revealing");
    setTimeout(
      () => document.body.classList.remove("revealing"),
      parseFloat(initial.dataset.revealEnd || 0) * 1000
    );
    // socials and the tap hint are the last things to arrive on the page
    const end = parseFloat(initial.dataset.revealEnd || 0);
    const socials = document.querySelector(".socials");
    if (socials) socials.style.setProperty("--socials-delay", `${end}s`);
    const hint = document.querySelector(".strip-hint");
    if (hint) hint.style.animationDelay = `${end + 0.15}s`;
  }
}

const screen = document.getElementById("screen");
const strip = document.querySelector(".app-strip");
const appview = document.getElementById("appview");
const appviewBody = document.getElementById("appview-body");
const homeBtn = document.getElementById("home-btn");
const panels = document.querySelectorAll(".panel");

let openApp = null;

let peeksReadyAt = 0;
let revealTimer;

function gateHoverEffects(seconds) {
  // while the text cascade runs, suppress peek cards and hover boxes
  peeksReadyAt = performance.now() + seconds * 1000;
  document.body.classList.add("revealing");
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => document.body.classList.remove("revealing"), seconds * 1000);
}

function showPanel(name) {
  panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
  const active = document.querySelector(`.panel[data-panel="${name}"]`);
  gateHoverEffects(parseFloat(active?.dataset.revealEnd || 0));
  warmPeeks(name);
  requestAnimationFrame(updateScrollLock);
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

function open(name, btn, fromHistory) {
  openApp = name;
  if (!fromHistory) history.pushState(null, "", `#${name}`);

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
  // mobile: retire the hint after the first tap, snug the arrow to the headline
  if (strip && getComputedStyle(strip).display !== "none") {
    const hint = document.querySelector(".strip-hint");
    if (hint) {
      // fade out but keep the space, so every heading sits at the same level
      hint.style.opacity = "0";
      hint.style.visibility = "hidden";
      hint.style.animation = "none";
    }
    requestAnimationFrame(placeHomeBtn);
    setTimeout(placeHomeBtn, 450); // again once layout fully settles
  } else {
    homeBtn.style.left = "";
    homeBtn.style.top = "";
  }
  // mark the selected app in the mobile strip
  document.querySelector(".app-strip")?.classList.add("has-current");
  document.querySelectorAll(".strip-app").forEach((b) =>
    b.classList.toggle("is-current", b.dataset.app === name));
  // back arrow blurs in right after the panel's text finishes revealing
  const panel = document.querySelector(`.panel[data-panel="${name}"]`);
  homeBtn.style.animationDelay = `${panel?.dataset.revealEnd || 0.3}s`;
  document.body.classList.add("app-open");
  // move focus into the panel for real interactions only — on a deep-link
  // reload or back/forward there's been no pointer yet, so browsers would
  // treat this focus as keyboard-driven and paint a ring on the arrow
  if (!fromHistory) homeBtn.focus({ preventScroll: true });
}

// lock scrolling whenever the content genuinely fits the viewport —
// measured live per device and per panel, not guessed via breakpoints
function updateScrollLock() {
  if (!matchMedia("(hover: none) and (max-width: 800px)").matches) return;
  const root = document.documentElement;
  root.classList.remove("locked");
  const fits = root.scrollHeight <= window.innerHeight + 2;
  root.classList.toggle("locked", fits);
}

window.addEventListener("resize", updateScrollLock);
window.addEventListener("load", updateScrollLock);
setTimeout(updateScrollLock, 100);

// pin the back arrow just left of the active heading (mobile only);
// re-run on resize since iOS viewport height shifts as toolbars collapse
function placeHomeBtn() {
  if (!openApp) return;
  if (!strip || getComputedStyle(strip).display === "none") return;
  const panelEl = document.querySelector(`.panel[data-panel="${openApp}"]`);
  const firstLetter = panelEl?.querySelector(":is(h1, h2) .rv");
  const h1 = panelEl?.querySelector("h1, h2");
  const col = document.querySelector(".text-col");
  if (!firstLetter || !col) return;
  const lr = firstLetter.getBoundingClientRect();
  const hr = h1.getBoundingClientRect();
  const cr = col.getBoundingClientRect();
  homeBtn.style.left = `${Math.max(lr.left - cr.left - 40, 0)}px`;
  homeBtn.style.top = `${hr.top - cr.top + hr.height / 2 - 15}px`;
}

window.addEventListener("resize", placeHomeBtn);

let clearSuppression = null;

function suppressDimUntilMouseMoves() {
  if (clearSuppression) clearSuppression();
  screen.classList.add("dim-suppressed");
  let ox = null, oy = null;
  const onMove = (e) => {
    if (ox === null) { ox = e.clientX; oy = e.clientY; return; }
    if (Math.hypot(e.clientX - ox, e.clientY - oy) > 14) clearSuppression();
  };
  clearSuppression = () => {
    document.removeEventListener("mousemove", onMove);
    screen.classList.remove("dim-suppressed");
    clearSuppression = null;
  };
  document.addEventListener("mousemove", onMove);
}

function close(fromHistory) {
  if (!openApp) return;
  openApp = null;
  document.body.classList.remove("app-open");
  document.querySelector(".app-strip")?.classList.remove("has-current");
  document.querySelectorAll(".strip-app").forEach((b) => b.classList.remove("is-current"));
  if (!fromHistory && location.hash) history.pushState(null, "", location.pathname + location.search);
  suppressDimUntilMouseMoves();
  window.scrollTo({ top: 0, behavior: "instant" });
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

document.querySelectorAll(".hotspot[data-app], .strip-app[data-app]").forEach((btn) => {
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

// spotlight state: an actual icon arms the dim; the zones between apps only
// sustain it; empty screen areas (or leaving the phone) release it
screen.addEventListener("mouseover", (e) => {
  if (e.target.closest(".hotspot")) {
    screen.classList.add("dim-on");
  } else if (!e.target.closest(".hover-zone")) {
    screen.classList.remove("dim-on");
  }
});
screen.addEventListener("mouseleave", () => screen.classList.remove("dim-on"));

// "Tap around": shakes the phone on desktop, jiggles the icon strip on mobile
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
if (shaker && strip) {
  shaker.addEventListener("click", () => {
    if (getComputedStyle(strip).display === "none") return;
    if (strip.classList.contains("shaking")) return;
    strip.classList.add("shaking");
    setTimeout(() => strip.classList.remove("shaking"), 850);
  });
}

// email actions: hover previews the address, click copies it
const EMAIL = "javier.hick1@gmail.com";
const toast = document.getElementById("toast");
const toastCheck = document.getElementById("toast-check");
const toastCopy = document.getElementById("toast-copy");
const toastText = document.getElementById("toast-text");
let toastTimer;
let copiedShowing = false;

function placeToast(anchor) {
  // pill hovers just above whatever was pressed, centered on it
  const w = toast.offsetWidth;
  const h = toast.offsetHeight;
  const r = anchor.getBoundingClientRect();
  const x = Math.min(Math.max(r.left + r.width / 2 - w / 2, 12), window.innerWidth - w - 12);
  toast.style.left = `${x}px`;
  toast.style.top = `${r.top - h - 12}px`;
}

async function copyEmail(anchor) {
  try {
    await navigator.clipboard.writeText(EMAIL);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = EMAIL;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toastCheck.style.display = "";
  toastCopy.style.display = "none";
  toastText.innerHTML = "";
  toastText.append(EMAIL + " ");
  const b = document.createElement("strong");
  b.textContent = "copied";
  toastText.append(b);
  placeToast(anchor);
  toast.classList.add("show");
  copiedShowing = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    copiedShowing = false;
  }, 1200); // long enough to register the check, short enough to feel snappy
}

function previewEmail(anchor) {
  if (copiedShowing || document.body.classList.contains("revealing")) return;
  toastCheck.style.display = "none";
  toastCopy.style.display = "";
  toastText.textContent = EMAIL;
  placeToast(anchor);
  toast.classList.add("show");
}

// the pill survives while the cursor is on the trigger or the pill itself
let lastEmailAnchor = null;
let pillHideTimer;

function schedulePillHide() {
  clearTimeout(pillHideTimer);
  pillHideTimer = setTimeout(() => {
    if (!copiedShowing) toast.classList.remove("show");
  }, 260);
}

toast.addEventListener("mouseenter", () => clearTimeout(pillHideTimer));
toast.addEventListener("mouseleave", schedulePillHide);
toast.addEventListener("click", () => {
  if (!copiedShowing && lastEmailAnchor) copyEmail(lastEmailAnchor);
});

document.querySelectorAll("[data-copy-email]").forEach((el) => {
  el.addEventListener("click", (e) => {
    // touch: every email trigger opens the sheet, where the choice lives
    if (matchMedia("(hover: none)").matches) {
      e.preventDefault();
      e.stopPropagation();
      openSheet();
      return;
    }
    // with a mouse, mailto links are intercepted and copied instead
    if (el.tagName === "A" && el.href.startsWith("mailto:")) e.preventDefault();
    copyEmail(el);
  });
  // hover preview only on the "get in touch" text, not the icons — and only
  // for pointers: a tap fires mouseenter too, which would drag the pill in
  if (el.classList.contains("tlink") && !matchMedia("(hover: none)").matches) {
    el.addEventListener("mouseenter", () => {
      clearTimeout(pillHideTimer);
      lastEmailAnchor = el;
      previewEmail(el);
    });
    el.addEventListener("mouseleave", schedulePillHide);
  }
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      copyEmail(el);
    }
  });
});

// hover peek: photo-from-the-moment card on facts that carry one
const peek = document.getElementById("peek");
const peekImg = document.getElementById("peek-img");
const peekCaption = document.getElementById("peek-caption");

function showPeek(el) {
  if (performance.now() < peeksReadyAt) return;
  const target = new URL(el.dataset.peekImg, location.href).href;
  if (peekImg.src !== target) {
    // never show the previous photo while the new one loads
    peekImg.style.visibility = "hidden";
    peekImg.src = target;
  }
  peekCaption.textContent = el.dataset.peekCaption;
  // anchor to the first line segment when the fact wraps across lines
  const rect = el.getClientRects()[0] || el.getBoundingClientRect();
  const place = () => {
    // the card hugs the picture, so measure after the image is in
    if (!touchDevice) {
      const w = peek.offsetWidth;
      const x = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, 12), window.innerWidth - w - 12);
      peek.style.left = `${x}px`;
      // always above the hovered line so the card never covers the text
      peek.style.top = `${Math.max(rect.top - peek.offsetHeight - 12, 10)}px`;
    }
    // touch: the dismiss disc floats a thumb's reach under the centered card
    else peekClose.style.top = `${Math.round((window.innerHeight + peek.offsetHeight) / 2) + 22}px`;
  };
  const reveal = () => {
    place();
    peekImg.style.visibility = "";
  };
  if (peekImg.complete && peekImg.naturalWidth) reveal();
  else peekImg.addEventListener("load", reveal, { once: true });
  place();
  peek.classList.add("show");
  if (touchDevice) {
    peekScrim.classList.add("show");
    peekClose.classList.add("show");
  }
}

// pre-warm a panel's peek images the moment it opens — ready by hover time,
// zero bytes spent on panels nobody visits
const warmedPanels = new Set();
function warmPeeks(name) {
  if (warmedPanels.has(name)) return;
  warmedPanels.add(name);
  document.querySelectorAll(`.panel[data-panel="${name}"] .fact--peek`).forEach((el) => {
    const img = new Image();
    img.src = el.dataset.peekImg;
  });
}

const peekScrim = document.getElementById("peek-scrim");
const peekClose = document.getElementById("peek-close");
const sheet = document.getElementById("email-sheet");
const sheetCopy = document.getElementById("sheet-copy");
const sheetCopyLabel = document.getElementById("sheet-copy-label");
const sheetCopiedGlyph = document.getElementById("sheet-copied-glyph");
const hidePeek = () => {
  peek.classList.remove("show");
  sheet.classList.remove("show");
  peekScrim.classList.remove("show");
  peekClose.classList.remove("show");
};

// touch email sheet: same frosted stage as the photos, the X under it
function openSheet() {
  hidePeek();
  sheetCopyLabel.textContent = "Copy email";
  sheetCopiedGlyph.toggleAttribute("hidden", true);
  sheet.classList.add("show");
  peekScrim.classList.add("show");
  peekClose.classList.add("show");
  peekClose.style.top = `${Math.round((window.innerHeight + sheet.offsetHeight) / 2) + 22}px`;
}

sheetCopy.addEventListener("click", async (e) => {
  e.stopPropagation();
  try {
    await navigator.clipboard.writeText(EMAIL);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = EMAIL;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  sheetCopyLabel.textContent = "Copied";
  sheetCopiedGlyph.toggleAttribute("hidden", false);
});
sheet.addEventListener("click", (e) => e.stopPropagation());
const touchDevice = matchMedia("(hover: none)").matches;

document.querySelectorAll(".fact--peek").forEach((el) => {
  if (touchDevice) {
    // touch: tap opens the card; the X or a tap anywhere else closes it
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      showPeek(el);
    });
  } else {
    el.addEventListener("mouseenter", () => showPeek(el));
    el.addEventListener("mouseleave", hidePeek);
  }
});

if (touchDevice) {
  peekClose.addEventListener("click", (e) => {
    e.stopPropagation();
    hidePeek();
  });
  // tapping anywhere — including the card itself — dismisses
  peek.addEventListener("click", hidePeek);
  document.addEventListener("click", (e) => {
    const open = peek.classList.contains("show") || sheet.classList.contains("show");
    if (open && !peek.contains(e.target) && !sheet.contains(e.target)) hidePeek();
  });
}

homeBtn.addEventListener("click", () => close());
appview.addEventListener("click", () => close()); // tap anywhere on the open app to dismiss
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});

// deep links: #bereal etc. open the app; back/forward stay in sync
function syncFromHash() {
  const name = location.hash.slice(1);
  if (APPS[name]) {
    if (openApp !== name) {
      open(name, document.querySelector(`.hotspot[data-app="${name}"]`), true);
    }
  } else if (openApp) {
    close(true);
  }
}

window.addEventListener("hashchange", syncFromHash);
window.addEventListener("popstate", syncFromHash);
syncFromHash();

