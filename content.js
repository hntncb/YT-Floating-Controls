(() => {
  "use strict";

  const LAUNCHER_ID = "__yt_float_launcher";
  const PREV_SELECTORS = [".ytp-prev-button", "ytmusic-player-bar .previous-button"];
  const NEXT_SELECTORS = [".ytp-next-button", "ytmusic-player-bar .next-button"];
  const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const HISTORY_KEY = "yt_float_history_v1";
  const LOG_KEY = "yt_float_log_v1";
  const LOG_MAX = 500;

  const BASE_FONT = 13;
  const BASE_W = 320;
  const BASE_H_COLLAPSED = 82;
  const PANEL_BASE_H = 175;
  const IDLE_MS = 5000;
  const MIN_SCALE = 0.65;
  const MAX_SCALE = 1.7;

  let pipWin = null;
  let doc = null;
  let playBtn = null;
  let toggleBtn = null;
  let loopBtn = null;
  let pinBtn = null;
  let titleEl = null;
  let panel = null;
  let seek = null;
  let timeEl = null;
  let durEl = null;
  let rateEl = null;
  let queueList = null;
  let scrubbing = false;
  let pinned = false;
  let expanded = false;
  let grewUp = false;
  let lastPanelHeight = 0;
  let idleTimer = null;

  let hist = { items: [], pointer: -1 };
  let histReady = false;
  let logBuffer = [];
  let logReady = false;

  const ICON = {
    prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h2.2v14H7zm10 0v14l-9-7z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.8 5H17v14h-2.2zM7 5l9 7-9 7z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.4v14H7zm6.6 0H17v14h-3.4z"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15.5 5.5 9l1.4-1.4L12 12.7l5.1-5.1L18.5 9z"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 8.5 18.5 15l-1.4 1.4L12 11.3l-5.1 5.1L5.5 15z"/></svg>',
    loop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 7h8V4l5 4-5 4V9H7a3 3 0 0 0-3 3c0 .35.06.68.16 1H2.1A5 5 0 0 1 2 12a5 5 0 0 1 5-5zm10 10H9v3l-5-4 5-4v3h8a3 3 0 0 0 3-3c0-.35-.06-.68-.16-1h2.06c.07.32.1.66.1 1a5 5 0 0 1-5 5z"/></svg>',
    //pin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 2 22 10l-2.1 2.1-1.1-.4-3.1 3.1L17 18.5 15.5 20l-3.8-3.8L7 21l-1-1 4.8-4.7L5 11.5 6.5 10l3.7 1.3 3.1-3.1-.4-1.1z"/></svg>',
    launch: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H4V6h16zM8 10.5h1.6v3H8zm3.2 0H13v3h-1.8zm3.4 0H16v3h-1.4z"/></svg>'
  };

  const getVideo = () => {
    const list = [...document.querySelectorAll("video")].filter(v => v.readyState > 0 || v.currentSrc);
    return list.find(v => !v.paused) || list[0] || null;
  };

  const clickFirst = selectors => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && el.getAttribute("aria-disabled") !== "true" && !el.disabled) {
        el.click();
        return true;
      }
    }
    return false;
  };

  function currentTitle() {
    const music = document.querySelector("ytmusic-player-bar .title");
    if (music && music.textContent.trim()) return music.textContent.trim();
    const watch = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string");
    if (watch && watch.textContent.trim()) return watch.textContent.trim();
    return (
      document.title
        .replace(/^\(\d+\)\s*/, "")
        .replace(/\s*-\s*YouTube(\sMusic)?\s*$/, "")
        .trim() || "Nothing playing"
    );
  }

  function videoIdFromUrl(url = location.href) {
    try {
      return new URL(url).searchParams.get("v");
    } catch (e) {
      return null;
    }
  }

  const fmt = s => {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = n => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  };

  // ---------- logging (buffered, exportable as .log) ----------

  async function loadLog() {
    try {
      const data = await chrome.storage.local.get(LOG_KEY);
      logBuffer = Array.isArray(data[LOG_KEY]) ? data[LOG_KEY] : [];
    } catch (e) {
      logBuffer = [];
    }
    logReady = true;
  }

  function log(event, detail) {
    const line = `[${new Date().toISOString()}] ${event}${detail !== undefined ? " " + JSON.stringify(detail) : ""}`;
    logBuffer.push(line);
    if (logBuffer.length > LOG_MAX) logBuffer.splice(0, logBuffer.length - LOG_MAX);
    if (logReady) {
      try { chrome.storage.local.set({ [LOG_KEY]: logBuffer }); } catch (e) { /* storage unavailable */ }
    }
  }

  function exportLog() {
    const content = logBuffer.join("\n") || "(empty)";
    try {
      chrome.runtime.sendMessage({ type: "yt-float-export-log", content }, () => void chrome.runtime.lastError);
    } catch (e) { /* messaging unavailable */ }
  }

  const actions = {
    prev() {
      if (clickFirst(PREV_SELECTORS)) { log("action", { name: "prev", via: "youtube-button" }); return; }
      log("action", { name: "prev", via: "history.back" });
      history.back();
    },
    next() {
      if (clickFirst(NEXT_SELECTORS)) { log("action", { name: "next", via: "youtube-button" }); return; }
      const v = getVideo();
      if (v && isFinite(v.duration)) v.currentTime = v.duration;
      log("action", { name: "next", via: "seek-to-end" });
    },
    toggle() {
      const v = getVideo();
      if (!v) return;
      if (v.paused) v.play(); else v.pause();
      log("action", { name: "toggle-play", paused: v.paused });
    },
    toggleLoop() {
      const v = getVideo();
      if (!v) return;
      v.loop = !v.loop;
      log("action", { name: "loop", value: v.loop });
      syncLoop();
    }
  };

  // ---------- own play-history (for "previous") ----------

  async function loadHistory() {
    try {
      const data = await chrome.storage.session.get(HISTORY_KEY);
      const h = data[HISTORY_KEY];
      if (h && Array.isArray(h.items)) return h;
    } catch (e) { /* storage unavailable */ }
    return { items: [], pointer: -1 };
  }

  async function saveHistory(h) {
    try {
      await chrome.storage.session.set({ [HISTORY_KEY]: h });
    } catch (e) { /* storage unavailable */ }
  }

  async function initHistory() {
    hist = await loadHistory();
    histReady = true;
    await recordCurrentVideo();
  }

  async function recordCurrentVideo() {
    const id = videoIdFromUrl();
    if (!id || !histReady) return;
    const title = currentTitle();
    const items = hist.items;
    const p = hist.pointer;
    const validTitle = title && title !== "Nothing playing" ? title : null;

    if (p >= 0 && items[p] && items[p].id === id) {
      if (validTitle) items[p].title = validTitle;
    } else if (p + 1 < items.length && items[p + 1].id === id) {
      hist.pointer = p + 1;
      if (validTitle) items[hist.pointer].title = validTitle;
      log("history", { move: "forward", id });
    } else if (p - 1 >= 0 && items[p - 1].id === id) {
      hist.pointer = p - 1;
      if (validTitle) items[hist.pointer].title = validTitle;
      log("history", { move: "back", id });
    } else {
      hist.items = items.slice(0, p + 1);
      hist.items.push({ id, title: validTitle || "Loading…" });
      hist.pointer = hist.items.length - 1;
      log("history", { move: "new", id });
    }
    await saveHistory(hist);
    refreshQueueUI();
  }

  function updateHistoryTitle(t) {
    if (!histReady || !t || t === "Nothing playing") return;
    const id = videoIdFromUrl();
    const item = hist.items[hist.pointer];
    if (item && item.id === id && item.title !== t) {
      item.title = t;
      saveHistory(hist);
      refreshQueueUI();
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "session" && changes[HISTORY_KEY]) {
        hist = changes[HISTORY_KEY].newValue || hist;
        refreshQueueUI();
      }
    });
  } catch (e) { /* storage unavailable */ }

  // ---------- playlist "next two" (best-effort DOM read, re-resolved at click time) ----------

  function isPlaylistContext() {
    return /[?&]list=/.test(location.href) || !!document.querySelector("ytd-playlist-panel-renderer, ytmusic-player-queue-item");
  }

  function nextTwoFromPlaylist() {
    let items = [...document.querySelectorAll("ytd-playlist-panel-video-renderer")];
    let titleSel = "#video-title";
    let isSelected = it => it.hasAttribute("selected") || it.getAttribute("aria-selected") === "true";
    if (!items.length) {
      items = [...document.querySelectorAll("ytmusic-player-queue-item")];
      titleSel = ".song-title, .title";
      isSelected = it => it.hasAttribute("selected") || it.classList.contains("selected");
    }
    if (!items.length) return [];
    let idx = items.findIndex(isSelected);
    if (idx === -1) {
      const cur = currentTitle();
      idx = items.findIndex(it => {
        const t = it.querySelector(titleSel);
        return t && t.textContent.trim() === cur;
      });
    }
    if (idx === -1) return [];
    return items.slice(idx + 1, idx + 3).map(it => {
      const t = it.querySelector(titleSel);
      return { title: (t && t.textContent.trim()) || "Unknown", el: it };
    });
  }

  function resolveClickTarget(el) {
    return el.querySelector("a#wc-endpoint") || el.querySelector("a.yt-simple-endpoint") || el.querySelector("a") || el;
  }

  // ---------- sync state to widget ----------

  function syncPlay() {
    if (!playBtn) return;
    const v = getVideo();
    const paused = !v || v.paused;
    playBtn.innerHTML = paused ? ICON.play : ICON.pause;
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }

  function syncLoop() {
    if (!loopBtn) return;
    const v = getVideo();
    const on = !!(v && v.loop);
    loopBtn.classList.toggle("active", on);
    loopBtn.setAttribute("aria-pressed", String(on));
  }

  function syncTitle() {
    if (!titleEl) return;
    const t = currentTitle();
    titleEl.textContent = t;
    titleEl.title = t;
    updateHistoryTitle(t);
  }

  function syncProgress() {
    if (!seek || scrubbing) return;
    const v = getVideo();
    const dur = v && isFinite(v.duration) ? v.duration : 0;
    seek.max = dur || 0;
    seek.value = v ? Math.min(v.currentTime, dur || v.currentTime) : 0;
    seek.disabled = !dur;
    timeEl.textContent = fmt(v ? v.currentTime : 0);
    durEl.textContent = fmt(dur);
  }

  function syncRate() {
    if (!rateEl) return;
    const v = getVideo();
    if (v) rateEl.value = String(v.playbackRate);
  }

  function syncAll() {
    syncPlay();
    syncLoop();
    syncTitle();
    syncProgress();
    syncRate();
    refreshQueueUI();
  }

  document.addEventListener("play", syncPlay, true);
  document.addEventListener("pause", syncPlay, true);
  document.addEventListener("ratechange", syncRate, true);
  document.addEventListener("timeupdate", syncProgress, true);
  document.addEventListener("durationchange", syncProgress, true);
  document.addEventListener("loadeddata", () => { syncAll(); recordCurrentVideo(); }, true);
  window.addEventListener("yt-navigate-finish", () => { syncAll(); recordCurrentVideo(); });
  window.addEventListener("popstate", () => { syncAll(); recordCurrentVideo(); });

  function makeQueueRow(title, kind, onClick) {
    const row = doc.createElement(onClick ? "button" : "div");
    row.className = `qrow ${kind}`;
    if (onClick) row.type = "button";
    const icon = doc.createElement("span");
    icon.className = "qicon";
    if (kind === "current") icon.innerHTML = ICON.play;
    const label = doc.createElement("span");
    label.className = "qlabel";
    label.textContent = title;
    row.append(icon, label);
    row.title = title;
    if (onClick) row.addEventListener("click", onClick);
    return row;
  }

  function refreshQueueUI() {
    if (!doc || !queueList) return;
    queueList.innerHTML = "";
    const items = hist.items;
    const p = hist.pointer;

    if (p - 2 >= 0) {
      const it = items[p - 2];
      queueList.appendChild(makeQueueRow(it.title, "prev", () => {
        log("nav", { kind: "prev", title: it.title, steps: 2 });
        try { history.go(-2); } catch (e) { log("nav-error", String(e)); }
      }));
    }
    if (p - 1 >= 0) {
      const it = items[p - 1];
      queueList.appendChild(makeQueueRow(it.title, "prev", () => {
        log("nav", { kind: "prev", title: it.title, steps: 1 });
        try { history.go(-1); } catch (e) { log("nav-error", String(e)); }
      }));
    }

    const curTitle = (items[p] && items[p].title) || currentTitle();
    queueList.appendChild(makeQueueRow(curTitle, "current", null));

    if (isPlaylistContext()) {
      const nexts = nextTwoFromPlaylist();
      nexts.forEach((it, idx) => {
        queueList.appendChild(makeQueueRow(it.title, "next", () => {
          const fresh = nextTwoFromPlaylist();
          const match = fresh[idx];
          if (!match) { log("nav-error", "next item no longer available"); return; }
          log("nav", { kind: "next", title: match.title });
          try { resolveClickTarget(match.el).click(); } catch (e) { log("nav-error", String(e)); }
        }));
      });
    }
  }

  const PIP_CSS = `
    :root { color-scheme: dark; }
    html, body { margin: 0; height: 100%; }
    html { font-size: ${BASE_FONT}px; }
    body {
      background: #121212;
      color: #f1f1f1;
      font: 400 1em/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      -webkit-user-select: none;
      user-select: none;
      overflow: hidden;
      transition: opacity .4s ease;
    }
    body.idle { opacity: .3; }
    body.idle:hover { opacity: 1; }
    body.ghost { opacity: .07; }
    body.ghost:hover { opacity: .55; }
    .wrap { display: flex; flex-direction: column; height: 100%; padding: 0.46em; gap: 0.38em; box-sizing: border-box; }
    .track {
      order: -10;
      flex: 0 0 auto;
      padding: 0 0.3em;
      font-size: 0.92em;
      color: #e8e8e8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row { order: 0; display: flex; gap: 0.15em; flex: 1 1 0; min-height: 2.2em; }
    .row button {
      flex: 1 1 0;
      min-width: 0;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 0.77em;
      background: #1f1f1f;
      color: #f1f1f1;
      cursor: pointer;
      transition: background 120ms ease;
    }
    .row button:hover { background: #303030; }
    .row button:active { background: #3d3d3d; }
    .row button:focus-visible { outline: 2px solid #3ea6ff; outline-offset: -2px; }
    .row button svg { width: 1.85em; height: 1.85em; pointer-events: none; }
    .row .play { flex: 1.3 1 0; background: #2b2b2b; }
    .row .play:hover { background: #3a3a3a; }
    .row .toggle { flex: 0 0 2.4em; background: transparent; color: #8a8a8a; }
    .row .toggle:hover { background: #1f1f1f; color: #f1f1f1; }
    .row .toggle svg { width: 1.4em; height: 1.4em; }
    .row .pin { flex: 0 0 2.4em; background: transparent; color: #8a8a8a; }
    .row .pin:hover { background: #1f1f1f; color: #f1f1f1; }
    .row .pin.active { color: #3ea6ff; background: #1f1f1f; }
    .row .pin svg { width: 1.3em; height: 1.3em; }
    .panel {
      order: 1;
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.5em;
      background: #1f1f1f;
      border-radius: 0.77em;
      padding: 0.55em 0.7em;
      box-sizing: border-box;
    }
    .panel[hidden] { display: none; }
    .seek-row, .speed-row { display: flex; align-items: center; gap: 0.6em; color: #9a9a9a; font-variant-numeric: tabular-nums; font-size: 0.9em; }
    input[type="range"] { flex: 1 1 auto; min-width: 0; accent-color: #ff0033; height: 1.2em; margin: 0; cursor: pointer; }
    input[type="range"]:disabled { cursor: default; opacity: .4; }
    .loop-btn {
      flex: 0 0 auto;
      width: 1.8em;
      height: 1.8em;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 0.5em;
      background: #2a2a2a;
      color: #9a9a9a;
      cursor: pointer;
    }
    .loop-btn svg { width: 1.1em; height: 1.1em; pointer-events: none; }
    .loop-btn:hover { background: #333; color: #f1f1f1; }
    .loop-btn.active { color: #3ea6ff; background: #25344a; }
    .speed-row select {
      margin-left: auto;
      background: #2a2a2a;
      color: #f1f1f1;
      border: 1px solid #3a3a3a;
      border-radius: 0.5em;
      padding: 0.2em 0.35em;
      font: inherit;
      cursor: pointer;
    }
    .queue { display: flex; flex-direction: column; gap: 0.15em; margin-top: 0.1em; }
    .qrow {
      display: flex;
      align-items: center;
      gap: 0.4em;
      width: 100%;
      text-align: left;
      border: 0;
      background: transparent;
      color: #9a9a9a;
      font: inherit;
      font-size: 0.88em;
      padding: 0.25em 0.5em;
      border-radius: 0.5em;
      cursor: default;
      box-sizing: border-box;
    }
    .qicon { flex: 0 0 1em; width: 1em; height: 1em; }
    .qicon svg { width: 100%; height: 100%; pointer-events: none; }
    .qlabel { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button.qrow { cursor: pointer; }
    button.qrow:hover { background: #2c2c2c; color: #f1f1f1; }
    .qrow.current { color: #ffffff; font-weight: 600; background: #2a2a2a; cursor: default; }
    .export-log {
      align-self: flex-end;
      border: 0;
      background: transparent;
      color: #6a6a6a;
      font-size: 0.78em;
      cursor: pointer;
      padding: 0.15em 0.3em;
    }
    .export-log:hover { color: #f1f1f1; }
    :focus-visible { outline: 2px solid #3ea6ff; outline-offset: 1px; }
    @media (prefers-reduced-motion: reduce) { .row button, body { transition: none; } }
  `;

  function currentScale() {
    const fs = parseFloat(doc.documentElement.style.fontSize) || BASE_FONT;
    return fs / BASE_FONT;
  }

  function applyScale() {
    if (!doc) return;
    const w = doc.documentElement.clientWidth;
    const h = doc.documentElement.clientHeight;
    const baseH = expanded ? BASE_H_COLLAPSED + PANEL_BASE_H : BASE_H_COLLAPSED;
    const scale = Math.min(w / BASE_W, h / baseH);
    const fs = Math.min(BASE_FONT * MAX_SCALE, Math.max(BASE_FONT * MIN_SCALE, BASE_FONT * (scale || 1)));
    doc.documentElement.style.fontSize = fs + "px";
  }

  function resetIdle() {
    if (!doc || pinned) return;
    doc.body.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => doc.body.classList.add("idle"), IDLE_MS);
  }

  function spaceBelowPx() {
    try {
      const avail = pipWin.screen.availHeight;
      const bottom = pipWin.screenY + pipWin.outerHeight;
      const gap = avail - bottom;
      return Number.isFinite(gap) ? gap : Infinity;
    } catch (e) {
      return Infinity;
    }
  }

  function setPinned(on) {
    pinned = on;
    pinBtn.classList.toggle("active", on);
    pinBtn.setAttribute("aria-pressed", String(on));
    pinBtn.setAttribute("aria-label", on ? "Unpin" : "Pin (see-through)");
    pinBtn.title = on ? "Unpin" : "Pin (see-through)";
    if (on) {
      clearTimeout(idleTimer);
      doc.body.classList.remove("idle");
      doc.body.classList.add("ghost");
    } else {
      doc.body.classList.remove("ghost");
      resetIdle();
    }
    log("panel", { pinned: on });
  }

  function setExpanded(on) {
    expanded = on;
    if (on) {
      panel.hidden = false;
      refreshQueueUI();
      const needed = panel.offsetHeight || PANEL_BASE_H * currentScale();
      lastPanelHeight = needed;
      grewUp = spaceBelowPx() < needed;
      panel.style.order = grewUp ? "-1" : "1";
      try {
        if (grewUp) pipWin.moveBy(0, -needed);
        pipWin.resizeBy(0, needed);
      } catch (e) { /* window resize not permitted */ }
      syncProgress();
    } else {
      const needed = lastPanelHeight || PANEL_BASE_H * currentScale();
      try {
        pipWin.resizeBy(0, -needed);
        if (grewUp) pipWin.moveBy(0, needed);
      } catch (e) { /* window resize not permitted */ }
      panel.hidden = true;
      grewUp = false;
    }
    toggleBtn.innerHTML = on ? ICON.up : ICON.down;
    toggleBtn.setAttribute("aria-label", on ? "Collapse" : "Expand");
    toggleBtn.setAttribute("aria-expanded", String(on));
    log("panel", { expanded: on });
    setTimeout(applyScale, 0);
  }

  async function openPip() {
    if (!("documentPictureInPicture" in window)) {
      alert("This browser does not support Document Picture-in-Picture (requires Chrome 116+).");
      return;
    }
    if (documentPictureInPicture.window) {
      documentPictureInPicture.window.focus();
      return;
    }

    pipWin = await documentPictureInPicture.requestWindow({
      width: BASE_W,
      height: BASE_H_COLLAPSED,
      disallowReturnToOpener: true,
      preferInitialWindowPlacement: true
    });
    log("pip", { open: true });

    try {
      const dw = BASE_W - pipWin.innerWidth;
      const dh = BASE_H_COLLAPSED - pipWin.innerHeight;
      if (Math.abs(dw) > 4 || Math.abs(dh) > 4) {
        pipWin.resizeBy(dw, dh);
        log("pip", { forcedResize: { dw, dh } });
      }
    } catch (e) { /* window resize not permitted */ }

    doc = pipWin.document;
    doc.title = "Playback controls";

    const style = doc.createElement("style");
    style.textContent = PIP_CSS;
    doc.head.appendChild(style);

    const wrap = doc.createElement("div");
    wrap.className = "wrap";

    titleEl = doc.createElement("div");
    titleEl.className = "track";

    const row = doc.createElement("div");
    row.className = "row";

    const mk = (cls, icon, label, handler) => {
      const b = doc.createElement("button");
      b.className = cls;
      b.type = "button";
      b.innerHTML = icon;
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", handler);
      return b;
    };

    playBtn = mk("play", ICON.play, "Play", actions.toggle);
    pinBtn = mk("pin", ICON.pin, "Pin (see-through)", () => setPinned(!pinned));
    pinBtn.setAttribute("aria-pressed", "false");
    toggleBtn = mk("toggle", ICON.down, "Expand", () => setExpanded(!expanded));
    toggleBtn.setAttribute("aria-expanded", "false");
    row.append(
      mk("prev", ICON.prev, "Previous track", actions.prev),
      playBtn,
      mk("next", ICON.next, "Next track", actions.next),
      //pinBtn,
      toggleBtn
    );

    panel = doc.createElement("div");
    panel.className = "panel";
    panel.hidden = true;

    const seekRow = doc.createElement("div");
    seekRow.className = "seek-row";
    timeEl = doc.createElement("span");
    timeEl.textContent = "0:00";
    durEl = doc.createElement("span");
    durEl.textContent = "0:00";
    seek = doc.createElement("input");
    seek.type = "range";
    seek.min = "0";
    seek.max = "0";
    seek.step = "0.1";
    seek.value = "0";
    seek.setAttribute("aria-label", "Progress");
    seek.addEventListener("pointerdown", () => (scrubbing = true));
    seek.addEventListener("input", () => {
      timeEl.textContent = fmt(Number(seek.value));
    });
    const commitSeek = () => {
      const v = getVideo();
      if (v) v.currentTime = Number(seek.value);
      scrubbing = false;
      log("action", { name: "seek", to: Number(seek.value) });
    };
    seek.addEventListener("change", commitSeek);
    seek.addEventListener("pointerup", commitSeek);
    seekRow.append(timeEl, seek, durEl);

    const speedRow = doc.createElement("div");
    speedRow.className = "speed-row";
    loopBtn = doc.createElement("button");
    loopBtn.type = "button";
    loopBtn.className = "loop-btn";
    loopBtn.innerHTML = ICON.loop;
    loopBtn.title = "Loop";
    loopBtn.setAttribute("aria-label", "Loop");
    loopBtn.setAttribute("aria-pressed", "false");
    loopBtn.addEventListener("click", actions.toggleLoop);
    const speedLabel = doc.createElement("label");
    speedLabel.textContent = "Speed";
    rateEl = doc.createElement("select");
    rateEl.setAttribute("aria-label", "Playback speed");
    for (const r of RATES) {
      const o = doc.createElement("option");
      o.value = String(r);
      o.textContent = r === 1 ? "1x (Normal)" : `${r}x`;
      rateEl.appendChild(o);
    }
    rateEl.value = "1";
    rateEl.addEventListener("change", () => {
      const v = getVideo();
      if (v) v.playbackRate = Number(rateEl.value);
      log("action", { name: "rate", value: rateEl.value });
    });
    speedLabel.appendChild(rateEl);
    speedRow.append(loopBtn, speedLabel);

    queueList = doc.createElement("div");
    queueList.className = "queue";

    const exportBtn = doc.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "export-log";
    exportBtn.textContent = "Export log (.log)";
    exportBtn.addEventListener("click", exportLog);

    panel.append(seekRow, speedRow, queueList, exportBtn);
    wrap.append(titleEl, row, panel);
    doc.body.appendChild(wrap);

    doc.addEventListener("keydown", e => {
      if (e.target === rateEl || e.target === seek) return;
      if (e.code === "Space" || e.key === "k") { e.preventDefault(); actions.toggle(); }
      if (e.key === "ArrowRight") actions.next();
      if (e.key === "ArrowLeft") actions.prev();
    });

    ["pointerdown", "pointermove", "keydown", "wheel", "focusin", "input"].forEach(evt =>
      doc.addEventListener(evt, resetIdle, true)
    );
    resetIdle();

    pipWin.addEventListener("resize", applyScale);
    applyScale();

    pipWin.addEventListener("pagehide", () => {
      log("pip", { open: false });
      clearTimeout(idleTimer);
      pipWin = doc = playBtn = toggleBtn = loopBtn = pinBtn = titleEl = panel = seek = timeEl = durEl = rateEl = queueList = null;
      expanded = false;
      grewUp = false;
      pinned = false;
      scrubbing = false;
    });

    watchTitle();
    syncAll();
  }

  let titleObserver = null;
  function watchTitle() {
    const node = document.querySelector("title");
    if (!node) return;
    titleObserver?.disconnect();
    titleObserver = new MutationObserver(syncTitle);
    titleObserver.observe(node, { childList: true, characterData: true, subtree: true });
  }

  function injectLauncher() {
    if (document.getElementById(LAUNCHER_ID)) return;
    const b = document.createElement("button");
    b.id = LAUNCHER_ID;
    b.type = "button";
    b.innerHTML = ICON.launch;
    b.title = "Open floating controls";
    b.setAttribute("aria-label", "Open floating controls");
    Object.assign(b.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      width: "40px",
      height: "40px",
      display: "grid",
      placeItems: "center",
      padding: "0",
      border: "1px solid rgba(255,255,255,.18)",
      borderRadius: "12px",
      background: "rgba(18,18,18,.85)",
      color: "#f1f1f1",
      cursor: "pointer",
      backdropFilter: "blur(6px)",
      opacity: "0.55"
    });
    b.addEventListener("mouseenter", () => (b.style.opacity = "1"));
    b.addEventListener("mouseleave", () => (b.style.opacity = "0.55"));
    const svg = b.querySelector("svg");
    svg.style.width = "22px";
    svg.style.pointerEvents = "none";
    b.addEventListener("click", openPip);
    document.documentElement.appendChild(b);
  }

  injectLauncher();
  new MutationObserver(injectLauncher).observe(document.documentElement, { childList: true });
  loadLog();
  initHistory();
})();