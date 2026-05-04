/* main.js — deck navigation + auto-play on viewport entry +
 * floating control panel (speed / pause), help modal, hash routing. */

document.addEventListener("DOMContentLoaded", () => {
  const deck = document.getElementById("deck");
  const slides = [...document.querySelectorAll(".slide")];
  const dots = [...document.querySelectorAll(".dotnav a")];
  const arrowUp = document.getElementById("arrow-up");
  const arrowDown = document.getElementById("arrow-down");

  // ===== Control panel: speed slider + pause button =====
  const speedInput = document.getElementById("ctrl-speed");
  const speedVal   = document.getElementById("ctrl-speed-val");
  const pauseBtn   = document.getElementById("ctrl-pause");
  const helpBtn    = document.getElementById("ctrl-help");
  const helpModal  = document.getElementById("help-modal");
  const helpClose  = document.getElementById("help-close");

  if (speedInput) {
    const setSpeed = (v) => {
      window.SPEED = parseFloat(v);
      if (speedVal) speedVal.textContent = window.SPEED.toFixed(1) + "×";
    };
    setSpeed(speedInput.value);
    speedInput.addEventListener("input", () => setSpeed(speedInput.value));
  }

  let isPaused = false;
  function setPaused(p) {
    isPaused = p;
    if (pauseBtn) {
      pauseBtn.classList.toggle("paused", p);
      pauseBtn.textContent = p ? "▶" : "⏸";
      pauseBtn.setAttribute("aria-label", p ? "Resume animations" : "Pause animations");
    }
    // Implementation: simulate pause by maxing out SPEED while paused so timeouts stretch,
    // OR by setting SKIP_DELAYS=true (which would skip — wrong). Simpler:
    // when paused, override delay() temporarily via a flag.
    window.PAUSED = p;
  }
  if (pauseBtn) pauseBtn.addEventListener("click", () => setPaused(!isPaused));

  // Patch delay so that when paused, it stalls until unpaused.
  // (Wrap once; preserves interruption semantics.)
  const _origDelay = window.delay;
  window.delay = function(ms) {
    if (window.SKIP_DELAYS) return Promise.resolve();
    if (!window.PAUSED) return _origDelay(ms);
    // While paused, poll until unpaused, then run remaining delay
    return new Promise(resolve => {
      const check = () => {
        if (window.SKIP_DELAYS) { resolve(); return; }
        if (!window.PAUSED) { _origDelay(ms).then(resolve); return; }
        setTimeout(check, 80);
      };
      check();
    });
  };

  // Help modal open/close
  function openHelp()  { if (helpModal) helpModal.hidden = false; }
  function closeHelp() { if (helpModal) helpModal.hidden = true;  }
  if (helpBtn)   helpBtn.addEventListener("click", openHelp);
  if (helpClose) helpClose.addEventListener("click", closeHelp);
  if (helpModal) helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) closeHelp();
  });

  let current = 0;

  function snapTo(idx) {
    idx = Math.max(0, Math.min(slides.length - 1, idx));
    slides[idx].scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Compute the active slide's index from the deck's actual scroll position.
  // More reliable than the IntersectionObserver state (which can lag).
  function getActiveSlideIdx() {
    const sT = deck.scrollTop;
    const h = deck.clientHeight || window.innerHeight;
    return Math.max(0, Math.min(slides.length - 1, Math.round(sT / h)));
  }

  function getActiveAnimKey() {
    const idx = getActiveSlideIdx();
    return slides[idx]?.dataset?.anim || null;
  }

  arrowUp.addEventListener("click", () => snapTo(getActiveSlideIdx() - 1));
  arrowDown.addEventListener("click", () => snapTo(getActiveSlideIdx() + 1));

  function refreshArrows() {
    const idx = getActiveSlideIdx();
    arrowUp.classList.toggle("hidden", idx === 0);
    arrowDown.classList.toggle("hidden", idx === slides.length - 1);
  }

  function handleStepArrow(dir) {
    const key = getActiveAnimKey();
    if (!key) return false;
    const total = window.totalSteps?.[key];
    const handler = window.gotoStepHandlers?.[key];
    if (!total || !handler) return false;
    // Read the user's most recent INTENDED step (set immediately by goToStep);
    // fall back to the actually-completed step. This lets quick consecutive
    // presses of → → → walk 0→1→2→3 even if each goto is still in flight.
    const cur = window.targetStep?.[key] ?? window.currentStep?.[key] ?? 0;
    const nxt = Math.max(0, Math.min(total - 1, cur + dir));
    if (nxt !== cur) {
      handler(nxt);
      return true;
    }
    return false;
  }

  // Keyboard navigation:
  //   ↑ / PageUp           → previous slide
  //   ↓ / PageDown / Space → next slide
  //   ← / →                → previous / next STEP within the current slide
  function onKey(e) {
    const tag = (e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (["ArrowDown", "PageDown", " "].includes(e.key)) {
      e.preventDefault();
      snapTo(getActiveSlideIdx() + 1);
    } else if (["ArrowUp", "PageUp"].includes(e.key)) {
      e.preventDefault();
      snapTo(getActiveSlideIdx() - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleStepArrow(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      handleStepArrow(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      const key = getActiveAnimKey();
      if (key && window.gotoStepHandlers?.[key]) window.gotoStepHandlers[key](0);
    } else if (e.key === "End") {
      e.preventDefault();
      const key = getActiveAnimKey();
      if (key && window.gotoStepHandlers?.[key]) {
        const total = window.totalSteps?.[key] ?? 1;
        window.gotoStepHandlers[key](total - 1);
      }
    } else if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      if (helpModal && helpModal.hidden) openHelp();
      else closeHelp();
    } else if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      setPaused(!isPaused);
    } else if (e.key === "Escape") {
      if (helpModal && !helpModal.hidden) { e.preventDefault(); closeHelp(); }
    }
  }
  // Single listener on document with capture=true so we get the event before
  // anything else can stop it. (Previously bound to BOTH window and document
  // which caused every press to fire twice → "jumps by 2" bug.)
  document.addEventListener("keydown", onKey, true);

  // Replay buttons (each section has its own .btn[data-replay="..."])
  document.querySelectorAll("[data-replay]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.replay;
      if (window.replayHandlers && window.replayHandlers[key]) {
        window.replayHandlers[key]();
      }
    });
  });

  // Update dot nav + autoplay when a new slide enters view
  function syncForActiveSlide() {
    const idx = getActiveSlideIdx();
    if (idx === current) return;
    current = idx;
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    refreshArrows();

    const animKey = slides[idx]?.dataset?.anim;
    if (animKey && window.autoplayHandlers && window.autoplayHandlers[animKey]) {
      const now = Date.now();
      const lastKey = `_lastAutoplay_${animKey}`;
      if (!window[lastKey] || now - window[lastKey] > 1500) {
        window[lastKey] = now;
        window.autoplayHandlers[animKey]();
      }
    }
  }

  // Use BOTH IntersectionObserver and a scroll listener for redundancy.
  const obs = new IntersectionObserver(() => syncForActiveSlide(), {
    root: deck,
    threshold: [0, 0.55, 1],
  });
  slides.forEach(s => obs.observe(s));

  let scrollTimer = null;
  deck.addEventListener("scroll", () => {
    if (scrollTimer) cancelAnimationFrame(scrollTimer);
    scrollTimer = requestAnimationFrame(syncForActiveSlide);
  }, { passive: true });

  // Update URL hash whenever active slide changes (history-replace, no spam)
  function syncHash() {
    const idx = getActiveSlideIdx();
    const id = slides[idx]?.id;
    if (!id) return;
    const newHash = "#" + id;
    if (window.location.hash !== newHash) {
      try { history.replaceState(null, "", newHash); } catch (_) {}
    }
  }
  deck.addEventListener("scroll", () => requestAnimationFrame(syncHash), { passive: true });

  // Honor incoming hash (#slide-id) on load and on hashchange.
  function applyHashFromURL() {
    const id = (window.location.hash || "").slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (target && slides.includes(target)) {
      target.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }
  window.addEventListener("hashchange", applyHashFromURL);

  // Initial sync (hash first if present, else slide 0)
  if (window.location.hash) {
    setTimeout(applyHashFromURL, 0);
  }
  syncForActiveSlide();
  refreshArrows();
  if (dots.length) dots[0].classList.add("active");
});
