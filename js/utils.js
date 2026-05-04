/* Shared SVG / animation utilities (no framework). */

window.SVG_NS = "http://www.w3.org/2000/svg";

/* Global speed multiplier — >1 makes everything slower so the user has time to read.
 * Tune here to globally retime the whole demo. */
window.SPEED = 1.7;
window.slow = function(ms) { return ms * (window.SPEED || 1); };

/* When SKIP_DELAYS is true, delays return immediately. Used for "jump to step n"
 * — we re-run the animation through previous steps but with no waiting. */
window.SKIP_DELAYS = false;

/* Interruptible delays: each in-flight delay registers a resolver. cancelAllDelays()
 * resolves them all immediately so a running animation can be aborted mid-step. */
const __pendingDelays = new Set();

window.delay = function(ms) {
  if (window.SKIP_DELAYS) return Promise.resolve();
  return new Promise(resolve => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      __pendingDelays.delete(handle);
      resolve();
    };
    const id = setTimeout(finish, ms * (window.SPEED || 1));
    const handle = () => { clearTimeout(id); finish(); };
    __pendingDelays.add(handle);
  });
};

window.cancelAllDelays = function() {
  // Snapshot first because handles mutate the set as they resolve.
  const snap = Array.from(__pendingDelays);
  __pendingDelays.clear();
  snap.forEach(h => h());
};

window.svgEl = function(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) {
    if (k === "text") el.textContent = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(el);
  return el;
};

// draw a vector (column of d cells) at (x, y), each cell w×h
window.drawVector = function(parent, values, x, y, w, h, kind = "v-emb", opts = {}) {
  const g = svgEl("g", { transform: `translate(${x}, ${y})` }, parent);
  if (opts.id) g.setAttribute("id", opts.id);
  values.forEach((v, i) => {
    const cell = svgEl("rect", {
      x: 0, y: i * h, width: w, height: h, rx: 2,
      class: `vec-cell ${kind}`,
    }, g);
    // optional text inside
    if (opts.showValues) {
      svgEl("text", {
        x: w/2, y: i*h + h/2 + 4,
        "text-anchor": "middle",
        "font-size": Math.min(11, h - 4),
        text: v.toFixed(1),
      }, g);
    }
  });
  if (opts.label) {
    svgEl("text", {
      x: w/2, y: -8,
      "text-anchor": "middle",
      "font-size": 16,
      class: "label-soft",
      text: opts.label,
    }, g);
  }
  return g;
};

// softmax
window.softmax = function(arr) {
  const m = Math.max(...arr);
  const e = arr.map(x => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / s);
};

window.dot = function(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]*b[i]; return s; };

/* Animation runner. The returned value is BOTH:
 *   - thenable / awaitable (await runSequence(...))
 *   - has a .cancel() method to stop iteration
 */
window.runSequence = function(steps) {
  let cancelled = false;
  let _resolve;
  const promise = new Promise(res => { _resolve = res; });
  (async () => {
    for (const step of steps) {
      if (cancelled) break;
      await step();
    }
    _resolve();
  })();
  promise.cancel = () => { cancelled = true; };
  return promise;
};

// fadeIn an SVG element by transitioning opacity
window.fadeIn = function(el, ms = 350) {
  if (!el) return Promise.resolve();
  el.style.transition = `opacity ${ms}ms`;
  el.style.opacity = "0";
  // force reflow
  void el.getBoundingClientRect();
  el.style.opacity = "1";
  return delay(ms);
};
window.fadeOut = function(el, ms = 350) {
  if (!el) return Promise.resolve();
  el.style.transition = `opacity ${ms}ms`;
  el.style.opacity = "1";
  void el.getBoundingClientRect();
  el.style.opacity = "0";
  return delay(ms);
};

/* Animate dashed-line drawing for any <path> or <line>. Interruptible. */
window.drawAnimated = function(el, durMs = 600) {
  if (window.SKIP_DELAYS) {
    el.style.strokeDasharray = "";
    el.style.strokeDashoffset = "";
    el.style.transition = "none";
    return Promise.resolve();
  }
  const slowed = durMs * (window.SPEED || 1);
  let len;
  if (el.getTotalLength) len = el.getTotalLength();
  else len = parseFloat(el.getAttribute("data-len") || "1000");
  el.style.strokeDasharray = len;
  el.style.strokeDashoffset = len;
  el.style.transition = `stroke-dashoffset ${slowed}ms ease-in-out`;
  void el.getBoundingClientRect();
  el.style.strokeDashoffset = 0;
  // Use the same interruptible-timeout mechanism as delay().
  return delay(durMs);
};

/* Send a glowing dot along an SVG <path>. Returns a promise that resolves
 * when the dot reaches the end. Interruptible. */
window.sendParticleAlongPath = function(svg, path, color = "#ff5470", durMs = 800, radius = 6) {
  if (!path || !path.getTotalLength) return Promise.resolve();
  if (window.SKIP_DELAYS) return Promise.resolve();
  const len = path.getTotalLength();
  const c = svgEl("circle", {
    r: radius, fill: color,
    "filter": "drop-shadow(0 0 6px " + color + ")",
  }, svg);
  return interruptibleAnim(durMs, t => {
    const p = path.getPointAtLength(t * len);
    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    if (t >= 1) c.remove();
  }).then(() => { try { c.remove(); } catch (_) {} });
};

/* Continuously animate a path's stroke-dashoffset so the dashes appear to
 * "flow" along the path. Returns a stop() function that ends the animation
 * and resets the offset. Interruptible: also stops on SKIP_DELAYS. */
window.startFlowingDashes = function(path, speedPxPerSec = 70) {
  if (!path) return () => {};
  let stopped = false;
  let offset = 0;
  let last = performance.now();
  function tick(now) {
    if (stopped || window.SKIP_DELAYS) return;
    const dt = Math.min(now - last, 100);
    last = now;
    offset -= speedPxPerSec * dt / 1000;
    path.style.strokeDashoffset = offset;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return () => {
    stopped = true;
    path.style.strokeDashoffset = "";
  };
};

/* Run a duration-based rAF animation that periodically checks SKIP_DELAYS so
 * it can be cut short the moment a goto is triggered.
 *   interruptibleAnim(900, t => { setProperty(t); })
 *   - callback(t) runs once per frame, t in [0, 1]; called once with t=1 on finish
 */
window.interruptibleAnim = function(durMs, callback) {
  return new Promise(res => {
    if (window.SKIP_DELAYS) {
      try { callback(1); } catch (_) {}
      res();
      return;
    }
    const t0 = performance.now();
    const dur = durMs * (window.SPEED || 1);
    function tick(now) {
      if (window.SKIP_DELAYS) {
        try { callback(1); } catch (_) {}
        res();
        return;
      }
      const t = Math.min(1, (now - t0) / dur);
      try { callback(t); } catch (_) {}
      if (t < 1) requestAnimationFrame(tick);
      else res();
    }
    requestAnimationFrame(tick);
  });
};

/* Move a group to (x, y) with a CSS transition. Returns a promise. */
window.moveTo = function(group, x, y, ms = 700) {
  group.style.transition = `transform ${ms}ms cubic-bezier(.5,.05,.35,1)`;
  group.setAttribute("transform", `translate(${x}, ${y})`);
  return delay(ms);
};

window.clamp = function(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

/* ===== Step list sidebar (the per-slide "what step are we on?" panel) =====
 *   setupStepList(containerId, steps, onClickHandler)
 *     - containerId: the <aside class="step-list" id="..."> element id
 *     - steps: array of strings (one per step title)
 *     - onClickHandler: optional (idx) => void called when user clicks a step
 *
 *   setActiveStep(containerId, idx) — visually mark idx as active
 *
 *   Animation modules also expose:
 *     window.gotoStepHandlers[animKey] = (idx) => Promise   // jump to step idx
 *     window.totalSteps[animKey]       = N                  // step count
 *     window.currentStep[animKey]      = i                  // last set step
 */
window.gotoStepHandlers = window.gotoStepHandlers || {};
window.totalSteps       = window.totalSteps       || {};
window.currentStep      = window.currentStep      || {};
/* targetStep = the step the USER asked for most recently (may be ahead of currentStep
 * if a goto is still resolving). Reading targetStep instead of currentStep prevents
 * lost arrow-key presses from quick-tap navigation. */
window.targetStep       = window.targetStep       || {};

window.setupStepList = function(containerId, steps, onClick) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  steps.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "step-item";
    item.dataset.idx = i;
    item.id = `${containerId}-${i}`;
    item.title = "Click to jump to this step";
    item.innerHTML =
      `<span class="step-num-circle">${i + 1}</span>` +
      `<span class="step-title">${s}</span>`;
    if (onClick) {
      item.style.cursor = "pointer";
      item.addEventListener("click", () => onClick(i));
    }
    el.appendChild(item);
  });
};

window.setActiveStep = function(containerId, idx) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const items = el.querySelectorAll(".step-item");
  items.forEach((item, i) => {
    item.classList.toggle("active", i === idx);
    item.classList.toggle("done",   i < idx);
  });
};

/* Helper used inside each animation module to make `gotoStep` trivially correct.
 * Pass:
 *   { stepsFn: () => [fn0, fn1, ...],   // called fresh each play
 *     reset:   () => void,              // called before each play / goto
 *     listId:  "attn-steps",            // the step-list container id
 *     animKey: "attn"                   // the data-anim key for the slide
 *   }
 *
 * Returns:
 *   { play(end?), goToStep(target) }
 *
 * Side effects:
 *   - Sets window.gotoStepHandlers[animKey] = goToStep
 *   - Sets window.totalSteps[animKey] = N
 *   - Updates window.currentStep[animKey]
 */
window.makeStepNavigator = function(opts) {
  const { stepsFn, reset, listId, animKey } = opts;
  let activeRun = null;
  let runVersion  = 0;   // any active animation
  let gotoVersion = 0;   // active goto-step request

  // best-effort initial step count
  try { window.totalSteps[animKey] = stepsFn().length; } catch (_) {}

  async function play(endIdx /* inclusive */) {
    if (reset) reset();
    const steps = stepsFn();
    window.totalSteps[animKey] = steps.length;
    if (endIdx === undefined) endIdx = steps.length - 1;
    endIdx = Math.max(0, Math.min(steps.length - 1, endIdx));
    // Cancel any in-flight delays AND mark previous run cancelled so it stops
    // looping into further steps.
    if (activeRun?.cancel) activeRun.cancel();
    cancelAllDelays();
    const myVersion = ++runVersion;
    activeRun = runSequence(steps.slice(0, endIdx + 1));
    await activeRun;
    if (myVersion === runVersion) {
      window.currentStep[animKey] = endIdx;
    }
  }

  async function goToStep(targetIdx) {
    const steps = stepsFn();
    targetIdx = Math.max(0, Math.min(steps.length - 1, targetIdx));
    // Set target IMMEDIATELY so consecutive arrow presses chain correctly.
    window.targetStep[animKey] = targetIdx;
    setActiveStep(listId, targetIdx);
    cancelAllDelays();   // interrupt any pending await delay()
    const myGoto = ++gotoVersion;
    window.SKIP_DELAYS = true;
    try {
      await play(targetIdx);
    } finally {
      // Only restore SKIP_DELAYS / commit currentStep if we're the latest goto.
      if (myGoto === gotoVersion) {
        window.SKIP_DELAYS = false;
        window.currentStep[animKey] = targetIdx;
      }
    }
  }

  window.gotoStepHandlers[animKey] = goToStep;

  return { play, goToStep };
};

/* =============== SHARED MODEL DATA (used by §2, §3, §4) =============== */
window.SA_TOKENS = ["I", "like", "black", "coffee"];
window.SA_D = 4;

window.SA_EMB = [
  [ 0.6, -0.1,  0.2,  0.0],
  [-0.1,  0.5,  0.3, -0.2],
  [ 0.0,  0.1,  0.7,  0.2],
  [ 0.2, -0.1,  0.6,  0.4],
];

window.SA_Q = [
  [ 0.9,  0.2, -0.3,  0.1],
  [ 0.4,  0.7,  0.2, -0.1],
  [-0.2,  0.1,  0.9,  0.3],
  [ 0.1,  0.0,  0.8,  0.5],
];
window.SA_K = [
  [ 0.8,  0.1, -0.2,  0.0],
  [ 0.3,  0.9,  0.0,  0.1],
  [-0.1,  0.2,  1.0,  0.4],
  [ 0.0,  0.1,  0.7,  0.6],
];
window.SA_V = [
  [ 0.5, -0.2,  0.1,  0.4],
  [-0.1,  0.6,  0.2,  0.0],
  [ 0.2,  0.1,  0.7, -0.3],
  [ 0.3,  0.0,  0.5,  0.6],
];

window.computeAttentionMatrix = function(causal = false) {
  const n = SA_TOKENS.length;
  const A = [];
  for (let i = 0; i < n; i++) {
    const scores = SA_K.map((k, j) => {
      let s = dot(SA_Q[i], k) / Math.sqrt(SA_D);
      if (causal && j > i) s = -1e9;
      return s;
    });
    A.push(softmax(scores));
  }
  return A;
};
