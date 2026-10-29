// App config — one entry per tappable home-screen app.
// To add a screen recording: set `video` to the file path (e.g. "/media/bereal.mp4")
// and it will play inside the phone instead of the placeholder.
const APPS = {
  bereal:  { video: "/media/bereal.mp4", placeholderClass: "ph-bereal" },
  retro:   { video: "/media/retro.mp4", placeholderClass: "ph-retro" },
  corner:  { video: "/media/corner.mp4", placeholderClass: "ph-corner" },
  gold:    { video: "/media/gold.mp4", placeholderClass: "ph-gold" },
  spendy:  { video: "/media/spendy.mp4", placeholderClass: "ph-spendy" },
  camera:  { video: "/media/camera.mp4", placeholderClass: "ph-camera" },
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
        // letters of one word share a nowrap wrapper so a heading that
        // wraps onto two lines never breaks mid-word
        const word = mode === "letters" ? document.createElement("span") : frag;
        if (word !== frag) word.style.whiteSpace = "nowrap";
        const units = mode === "letters" ? [...tok] : [tok];
        units.forEach((u) => {
          const span = document.createElement("span");
          span.className = "rv";
          span.textContent = u;
          span.style.animationDelay = `${t.toFixed(3)}s`;
          t += step;
          word.appendChild(span);
        });
        if (word !== frag) frag.appendChild(word);
      });
      child.replaceWith(frag);
    });
  };
  walk(el);
  return t;
}

function preparePanel(panel) {
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
}

document.querySelectorAll(".panel").forEach(preparePanel);

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

let openApp = null;

// Routing: every app is a real page (/bereal/, /retro/, ...) so each one
// ranks on its own. The panel carries its path and title; tapping an app
// swaps the URL and title in place, a direct visit lands with the app open.
const panelFor = (name) => document.querySelector(`.panel[data-panel="${name}"]`);
const pathFor = (name) => panelFor(name)?.dataset.path || null;
const HOME_TITLE = panelFor("default")?.dataset.title || document.title;

function appFromLocation() {
  const path = location.pathname.replace(/index\.html$/, "");
  const byPath = [...document.querySelectorAll(".panel[data-path]")]
    .find((p) => p.dataset.path === path && p.dataset.panel !== "default");
  if (byPath) return byPath.dataset.panel;
  const hash = location.hash.slice(1); // legacy #bereal links, and #camera
  return APPS[hash] ? hash : null;
}

// Sub-pages ship only their own panel (plus home), so each page reads as
// its own document. The rest arrive from the home page on demand.
let panelsPromise = null;
function ensurePanels() {
  if (panelsPromise) return panelsPromise;
  if (Object.keys(APPS).every((n) => panelFor(n))) return (panelsPromise = Promise.resolve());
  panelsPromise = fetch("/", { credentials: "same-origin" })
    .then((r) => r.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const host = document.getElementById("panels");
      doc.querySelectorAll(".panel").forEach((src) => {
        if (panelFor(src.dataset.panel)) return;
        const panel = document.adoptNode(src);
        panel.classList.remove("is-active");
        preparePanel(panel);
        bindPeeks(panel);
        host.appendChild(panel);
      });
    })
    .catch(() => { panelsPromise = null; });
  return panelsPromise;
}
window.addEventListener("load", () => setTimeout(() => {
  ensurePanels();
  // posters are tiny: fetch and decode them all up front, so the first
  // launch of every app starts on a ready frame
  if (screen.offsetWidth) {
    Object.keys(APPS).forEach((n) => {
      const img = new Image();
      img.src = `/media/poster-${n}.webp`;
      img.decode().catch(() => {});
    });
  }
}, 800));

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
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
  const active = panelFor(name);
  gateHoverEffects(parseFloat(active?.dataset.revealEnd || 0));
  warmPeeks(name);
  requestAnimationFrame(updateScrollLock);
}

// One video element per app, created the first time the app is hovered or
// opened and reused after that, so a second open never reloads anything.
// The poster is the recording's first frame: the app shows the instant it
// opens and the video takes over seamlessly once it can play.
const videos = {};
function videoFor(name) {
  const app = APPS[name];
  if (!app?.video) return null;
  if (!videos[name]) {
    const video = document.createElement("video");
    video.src = app.video;
    video.poster = `/media/poster-${name}.webp`;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    videos[name] = video;
  }
  return videos[name];
}

function buildAppScreen(name) {
  const app = APPS[name];
  const video = videoFor(name);
  if (video) {
    const body = document.createElement("div");
    body.className = `appview-screen ${app.placeholderClass}`;
    body.appendChild(video);
    return body;
  }
  const ph = document.createElement("div");
  ph.className = `app-placeholder ${app.placeholderClass}`;
  const icon = document.createElement("span");
  icon.className = "ph-icon";
  const img = document.createElement("img");
  img.src = `/media/icon-${name}.webp`;
  img.alt = "";
  icon.appendChild(img);
  ph.appendChild(icon);
  const note = document.createElement("p");
  note.textContent = "Screen recording coming soon";
  ph.appendChild(note);
  return ph;
}

// iOS app launch, the way the system draws it: the app's window is solid
// from the first frame and morphs out of the icon. Its frame grows from the
// icon's square to the full screen while its corners relax from the icon's
// radius to the display's; the content inside scales with the window's
// width, the icon artwork dissolves into it over the first few frames, and
// the home screen zooms toward the viewer and darkens.
//
// Closing is choreographed on its own rather than played backwards: the
// window shrinks as a card keeping the app's tall shape, and only on the
// final approach rounds into the icon's square while the artwork gathers
// in, so it lands as the icon instead of squashing into it.
//
// Each move is a critically damped spring, SwiftUI's
// .spring(response:, dampingFraction: 1).
const springAt = (response) => {
  const w = (2 * Math.PI) / response;
  return (t) => 1 - (1 + w * t) * Math.exp(-w * t);
};
const OPEN = { ms: 480, curve: springAt(0.36) };
const CLOSE = { ms: 420, curve: springAt(0.3) };
const HAS_LINEAR = CSS.supports("transition-timing-function", "linear(0, 1)");
const easingFor = ({ ms, curve }) => HAS_LINEAR
  ? `linear(${Array.from({ length: 33 }, (_, i) => (i === 32 ? 1 : +curve((ms / 1000) * (i / 32)).toFixed(3))).join(", ")})`
  : "cubic-bezier(0.25, 0.9, 0.3, 1)";

const ICON_SIZE = 191 / 1206; // icon width over screen width, measured on the screenshot
const ICON_RADIUS = 0.2237; // iOS icon corner radius over icon width
const SCREEN_RADIUS = 0.152; // the screen's corner radius over its width, as in styles.css
const HOME_ZOOM = "scale(1.1)";
const HOME_DIM = 0.6; // home screen opacity over the black screen behind it
const homescreen = document.getElementById("homescreen");

const appIcon = document.createElement("div");
appIcon.className = "appview-icon";
const appIconImg = document.createElement("img");
appIconImg.alt = "";
appIcon.appendChild(appIconImg);
appview.appendChild(appIcon);

let launchAnims = [];

// where the app's icon sits on the screen, in the screen's own pixels
// (null when the phone isn't on screen, e.g. the mobile layout). Read off
// layout, never off the rendered page: the hotspot's own percentages are
// exact, and blind to the phone's hover scale and to the home screen's
// zoom, which while closing would aim the window a few pixels off
function iconPose(name) {
  const hotspot = screen.querySelector(`.hotspot[data-app="${name}"]`);
  if (!hotspot || !screen.offsetWidth) return null;
  const css = getComputedStyle(screen);
  const W = parseFloat(css.width);
  const H = parseFloat(css.height);
  const pct = (prop, of) => (parseFloat(hotspot.style[prop]) / 100) * of;
  const h = { left: pct("left", W), top: pct("top", H), width: pct("width", W), height: pct("height", H) };
  const size = W * ICON_SIZE;
  return {
    W,
    H,
    size,
    // the icon sits at the top of its hotspot, the label below it
    x: h.left + h.width / 2,
    y: h.top + size * 0.6,
    hotspot: h,
  };
}

// The artwork that flies with the window is the home screen screenshot
// itself, framed on the icon: on the icon it lines up pixel for pixel with
// what's beneath, so the window lands as the real icon (corners included)
// and handing back to the screenshot can't pop
function dressIcon(name, pose) {
  const shot = homescreen.querySelector(".screenshot");
  if (!shot || !pose) return;
  const { W, H, size, x, y } = pose;
  const pct = (v) => `${(v / size) * 100}%`;
  appIconImg.src = shot.currentSrc || shot.src;
  Object.assign(appIconImg.style, {
    left: pct(size / 2 - x),
    top: pct(size / 2 - y),
    width: pct(W),
    height: pct(H),
  });
}

// While its app is open the icon's slot on the home screen is empty, as on
// iOS, so the window flies back into a gap instead of onto a second copy.
// The screenshot has no clean wallpaper, so the gap is rebuilt from the
// pixels around the icon (a Coons patch: each point blends the four edges
// around it), which on a soft, blurred wallpaper is seamless
const slotPatches = {};
let shownSlot = null;

function slotPatch(name, pose) {
  if (slotPatches[name]) return slotPatches[name];
  const shot = homescreen.querySelector(".screenshot");
  if (!shot?.naturalWidth) return null;
  const fx = shot.naturalWidth / pose.W;
  const fy = shot.naturalHeight / pose.H;
  const half = (pose.size / 2) * 1.1; // a little past the icon's anti-aliased edge
  const left = Math.round((pose.x - half) * fx);
  const top = Math.round((pose.y - half) * fy);
  const w = Math.round(half * 2 * fx);
  const h = Math.round(half * 2 * fy);
  const pad = 3; // a thin ring of wallpaper just outside the patch to sample
  const src = document.createElement("canvas");
  src.width = w + pad * 2;
  src.height = h + pad * 2;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(shot, left - pad, top - pad, src.width, src.height, 0, 0, src.width, src.height);
  const px = sctx.getImageData(0, 0, src.width, src.height).data;
  const at = (cx, cy) => {
    const i = (cy * src.width + cx) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };
  // each edge averaged across the ring's thickness, to calm the grain
  const edge = (n, pick) => Array.from({ length: n }, (_, i) => {
    const sum = [0, 0, 0];
    for (let d = 0; d < pad; d++) at(...pick(i, d)).forEach((c, j) => { sum[j] += c / pad; });
    return sum;
  });
  const T = edge(w, (i, d) => [pad + i, d]);
  const B = edge(w, (i, d) => [pad + i, pad + h + d]);
  const L = edge(h, (i, d) => [d, pad + i]);
  const R = edge(h, (i, d) => [pad + w + d, pad + i]);
  const [tl, tr, bl, br] = [T[0], T[w - 1], B[0], B[w - 1]];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const v = j / (h - 1);
    for (let i = 0; i < w; i++) {
      const u = i / (w - 1);
      const o = (j * w + i) * 4;
      for (let c = 0; c < 3; c++) {
        img.data[o + c] = (1 - v) * T[i][c] + v * B[i][c] + (1 - u) * L[j][c] + u * R[j][c]
          - ((1 - u) * (1 - v) * tl[c] + u * (1 - v) * tr[c] + (1 - u) * v * bl[c] + u * v * br[c]);
      }
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  canvas.className = "slot-patch";
  Object.assign(canvas.style, {
    left: `${(left / shot.naturalWidth) * 100}%`,
    top: `${(top / shot.naturalHeight) * 100}%`,
    width: `${(w / shot.naturalWidth) * 100}%`,
    height: `${(h / shot.naturalHeight) * 100}%`,
  });
  return (slotPatches[name] = canvas);
}

function emptySlot(name, pose) {
  const patch = pose && slotPatch(name, pose);
  if (patch === shownSlot) return;
  shownSlot?.remove();
  shownSlot = patch;
  if (patch) homescreen.querySelector(".screenshot").after(patch);
}

// the window as a rect in screen pixels: center, size, corner radius,
// plus how visible the icon artwork is
const iconWindow = ({ size, x, y }) => ({ cx: x, cy: y, w: size, h: size, r: size * ICON_RADIUS, art: 1 });
const fullWindow = ({ W, H }) => ({ cx: W / 2, cy: H / 2, w: W, h: H, r: W * SCREEN_RADIUS, art: 0 });

// where the window is right now, read back off the running clip
function currentWindow({ W, H }) {
  const m = getComputedStyle(appview).clipPath.match(/inset\(([^)]*?)(?:\s+round\s+([\d.]+)px)?\)/);
  if (!m) return null;
  const v = m[1].trim().split(/\s+/).map(parseFloat);
  const [t, r, b, l] = [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]];
  return {
    cx: (l + W - r) / 2, cy: (t + H - b) / 2, w: W - l - r, h: H - t - b,
    r: parseFloat(m[2] || 0), art: +getComputedStyle(appIcon).opacity,
  };
}

const lerp = (a, b, p) => a + (b - a) * p;
const smooth = (e0, e1, p) => {
  const x = Math.min(Math.max((p - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
};

// the window part-way from a to b at spring progress p
function windowBetween(a, b, p, closing) {
  if (!closing) {
    // opening: every edge, and the corners, travel together
    return { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), r: lerp(a.r, b.r, p) };
  }
  // closing: the card shrinks keeping its shape, then rounds into the
  // icon's square on the final approach
  const shape = smooth(0.4, 0.85, p);
  const w = lerp(a.w, b.w, p);
  return {
    cx: lerp(a.cx, b.cx, p),
    cy: lerp(a.cy, b.cy, p),
    w,
    h: w * lerp(a.h / a.w, b.h / b.w, shape),
    r: w * lerp(a.r / a.w, b.r / b.w, shape),
    art: lerp(a.art, b.art, smooth(0.58, 0.85, p)),
  };
}

// keyframes for the window's clip and its content's transform, sampled off
// the spring so every property moves on exactly the same beat
function windowFrames(pose, a, b, { ms, curve }, closing) {
  const { W, H } = pose;
  const clip = [];
  const content = [];
  const art = [];
  const body = [];
  const n = Math.round(ms / 16);
  for (let i = 0; i <= n; i++) {
    const p = i === n ? 1 : curve((ms / 1000) * (i / n));
    const f = windowBetween(a, b, p, closing);
    clip.push(`inset(${f.cy - f.h / 2}px ${W - f.cx - f.w / 2}px ${H - f.cy - f.h / 2}px ${f.cx - f.w / 2}px round ${f.r}px)`);
    content.push(`translate(${f.cx - W / 2}px, ${f.cy - H / 2}px) scale(${f.w / W})`);
    if (closing) {
      art.push(f.art);
      // once the artwork fully covers the app, stop drawing the app: two
      // layers clipped by one rounded edge both half-cover its anti-aliased
      // pixels, and the app's colors would leak through as specks
      body.push(f.art > 0.99 ? 0 : 1);
    }
  }
  return { clip, content, art, body };
}

function launch(name, opening) {
  const pose = iconPose(name);
  const running = launchAnims.some((a) => a.playState !== "finished");
  // a reversal picks up exactly where things are on screen right now
  const now = (el, prop) => getComputedStyle(el)[prop];
  const from = running && pose && {
    win: currentWindow(pose),
    home: now(homescreen, "transform"),
    dim: now(homescreen, "opacity"),
  };
  launchAnims.forEach((a) => a.cancel());
  launchAnims = [];

  const land = opening ? playApp : finishClose;
  if (!pose || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    land();
    return;
  }

  // a click arrives with the hover spotlight on: it lets go on the same
  // spring as the home screen darkens, so the light moves one way only
  const spotlight = screen.querySelector(".dim");
  const lit = getComputedStyle(spotlight).opacity;
  screen.classList.remove("dim-on");

  emptySlot(name, pose); // in case the screenshot wasn't decoded yet at open

  // each move's resting endpoints; a reversal starts from where things are instead
  const ends = opening
    ? { move: OPEN, win: [iconWindow(pose), fullWindow(pose)], home: ["none", HOME_ZOOM], dim: [1, HOME_DIM] }
    : { move: CLOSE, win: [fullWindow(pose), iconWindow(pose)], home: [HOME_ZOOM, "none"], dim: [HOME_DIM, 1] };
  const { move } = ends;
  const start = from?.win || ends.win[0];
  const frames = windowFrames(pose, start, ends.win[1], move, !opening);
  homescreen.style.transformOrigin = `${pose.x}px ${pose.y}px`;

  const sampled = { duration: move.ms, easing: "linear", fill: "both" };
  const spring = { duration: move.ms, easing: easingFor(move), fill: "both" };
  launchAnims = [
    appview.animate({ clipPath: frames.clip }, sampled),
    appviewBody.animate({ transform: frames.content }, sampled),
    appIcon.animate({ transform: frames.content }, sampled),
    spotlight.animate({ opacity: [lit, 0] }, spring),
    homescreen.animate({
      transform: [from ? from.home : ends.home[0], ends.home[1]],
      opacity: [from ? from.dim : ends.dim[0], ends.dim[1]],
    }, spring),
  ];
  if (opening) {
    launchAnims.push(
      // the artwork dissolves over the first few frames
      appIcon.animate({ opacity: [start.art, 0] }, { duration: 90, delay: 10, easing: "ease-out", fill: "both" }),
      // the app isn't drawn while the artwork fully covers it (see windowFrames)
      appviewBody.animate({ opacity: [start.art > 0.99 ? 0 : 1, 1] }, { duration: 10, easing: "step-end" }),
    );
  } else {
    launchAnims.push(
      // the artwork gathers in on the same beat as the window's shape
      appIcon.animate({ opacity: frames.art }, sampled),
      appviewBody.animate({ opacity: frames.body }, sampled),
    );
  }

  const mine = launchAnims;
  launchAnims[0].finished.then(() => {
    if (launchAnims === mine) land();
  }, () => {});
}

// the recording starts once the window has landed: while it flies, the
// app is a still frame, as the system's launch snapshot is
function playApp() {
  if (openApp) appviewBody.querySelector("video")?.play().catch(() => {});
}

function finishClose() {
  if (openApp) return;
  emptySlot(null, null);
  launchAnims.forEach((a) => a.cancel());
  launchAnims = [];
  appview.hidden = true;
  appviewBody.querySelector("video")?.pause();
  appviewBody.replaceChildren();
}

function open(name, { fromHistory = false, keyboard = false, animate = true } = {}) {
  const wasOpen = !!openApp;
  openApp = name;

  // the launch starts on this very frame, on the recording's first frame
  // (its poster). The mobile layout has no phone, so nothing loads there
  if (screen.offsetWidth) {
    appviewBody.replaceChildren(buildAppScreen(name));
    const pose = iconPose(name);
    dressIcon(name, pose);
    emptySlot(name, pose);
    const video = appviewBody.querySelector("video");
    if (video) video.currentTime = 0;
    appview.hidden = false;
    if (animate && !wasOpen) {
      launch(name, true);
    } else {
      // already in an app (back/forward between two) or arriving on a deep
      // link: no launch, the app is simply there
      launchAnims.forEach((a) => a.cancel());
      launchAnims = [];
      playApp();
    }
  }

  if (!fromHistory) history.pushState(null, "", pathFor(name) || `/#${name}`);
  showAppPanel(name, keyboard);
}

async function showAppPanel(name, keyboard) {
  if (!panelFor(name)) await ensurePanels(); // sub-pages fetch the other panels lazily
  if (openApp !== name) return; // closed or switched while the panels loaded
  document.title = panelFor(name)?.dataset.title || HOME_TITLE;

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
  // move focus to the back arrow only when the app was opened from the
  // keyboard. Safari never focuses a clicked link, so focusing from a click
  // or tap reads as keyboard focus there and paints a ring on the arrow
  if (keyboard) homeBtn.focus({ preventScroll: true });
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
  const lastName = openApp;
  openApp = null;
  document.body.classList.remove("app-open");
  document.querySelector(".app-strip")?.classList.remove("has-current");
  document.querySelectorAll(".strip-app").forEach((b) => b.classList.remove("is-current"));
  if (!fromHistory && (location.pathname !== "/" || location.hash)) history.pushState(null, "", "/");
  document.title = HOME_TITLE;
  suppressDimUntilMouseMoves();
  window.scrollTo({ top: 0, behavior: "instant" });
  showPanel("default");
  if (appview.hidden) return;
  if (lastName) launch(lastName, false);
  else finishClose();
}

document.querySelectorAll(".hotspot[data-app], .strip-app[data-app]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault(); // real links for crawlers; in-place transition for people
    const name = btn.dataset.app;
    if (openApp === name) return;
    open(name, { keyboard: e.detail === 0 }); // detail 0: activated by Enter
  });
});

// bold text actions in the panels mirror tapping the icons
document.querySelectorAll(".tlink[data-app]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const name = btn.dataset.app;
    if (openApp === name) return;
    open(name, { keyboard: e.detail === 0 });
  });
});

// start loading an app's recording the moment the pointer heads for it,
// so by the time the click lands the first seconds are usually in
document.querySelectorAll(".hotspot[data-app], .tlink[data-app]").forEach((btn) => {
  btn.addEventListener("pointerenter", () => videoFor(btn.dataset.app), { once: true });
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

function bindPeeks(root) {
  root.querySelectorAll(".fact--peek").forEach((el) => {
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
}
bindPeeks(document);

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

homeBtn.addEventListener("click", (e) => {
  e.preventDefault();
  close();
});
appview.addEventListener("click", () => close()); // tap anywhere on the open app to dismiss
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});

// deep links: /bereal/ (or a legacy #bereal) opens the app; back/forward stay in sync
function syncFromLocation() {
  const name = appFromLocation();
  if (name) {
    if (openApp !== name) {
      // the first visit lands with the app already open; back/forward zoom
      open(name, { fromHistory: true, animate: booted });
    }
    // old-style hash links settle onto the app's real URL
    if (location.hash && pathFor(name)) history.replaceState(null, "", pathFor(name));
  } else if (openApp) {
    close(true);
  }
}

window.addEventListener("hashchange", syncFromLocation);
window.addEventListener("popstate", syncFromLocation);
let booted = false;
syncFromLocation();
booted = true;

// copy, socials and hint are split and timed: let them paint
document.documentElement.classList.add("ready");

