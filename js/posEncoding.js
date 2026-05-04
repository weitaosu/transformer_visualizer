/* §7 Positional Encoding — smooth canvas heatmap + animated sine-curve overlays.
 *
 * The previous version only revealed the heatmap row by row. The new animation
 * additionally visualises that each *column* of the heatmap is just a sine/cosine
 * wave at a different frequency. After the heatmap reveals, the demo:
 *   1. Pauses to let the eye settle.
 *   2. For 4 chosen columns (smallest, small, medium, large period), it
 *      a) draws a vertical highlight box around that column,
 *      b) traces an actual sin/cos curve down the column showing the wave,
 *      c) labels the column with its frequency.
 *      then fades out and moves to the next column.
 *   3. Loops or ends with the static heatmap visible.
 */

(function () {
  let activeRun = null;
  let canvas, ctx;        // raster heatmap
  let overlay;            // SVG overlay for curves on top

  function pe(pos, i, d) {
    const idx = Math.floor(i/2);
    const angle = pos / Math.pow(10000, (2 * idx) / d);
    return (i % 2 === 0) ? Math.sin(angle) : Math.cos(angle);
  }

  // 3-stop colormap: blue (-1) → dark (0) → red (+1).
  function colormap(v) {
    const t = (v + 1) / 2; // 0..1
    const a = [ 60, 120, 220];
    const b = [ 30,  40,  70];
    const c = [255,  90, 110];
    let r, g, bl;
    if (t < 0.5) {
      const u = t * 2;
      r  = a[0] * (1 - u) + b[0] * u;
      g  = a[1] * (1 - u) + b[1] * u;
      bl = a[2] * (1 - u) + b[2] * u;
    } else {
      const u = (t - 0.5) * 2;
      r  = b[0] * (1 - u) + c[0] * u;
      g  = b[1] * (1 - u) + c[1] * u;
      bl = b[2] * (1 - u) + c[2] * u;
    }
    return `rgb(${r|0}, ${g|0}, ${bl|0})`;
  }

  function ensureLayers() {
    const host = document.getElementById("pos-heatmap");
    if (!host) return null;

    if (!canvas) {
      host.innerHTML = "";
      // wrapper around canvas+overlay
      host.style.position = "relative";

      canvas = document.createElement("canvas");
      canvas.style.cssText = "position:absolute; inset:0; width:100%; height:100%; display:block; border-radius:4px;";
      host.appendChild(canvas);
      ctx = canvas.getContext("2d");

      overlay = document.createElementNS(SVG_NS, "svg");
      overlay.setAttribute("preserveAspectRatio", "none");
      overlay.style.cssText = "position:absolute; inset:0; width:100%; height:100%; pointer-events:none;";
      host.appendChild(overlay);
    }

    const dpr = window.devicePixelRatio || 1;
    const cssW = host.clientWidth;
    const cssH = host.clientHeight;
    canvas.width  = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));

    overlay.setAttribute("viewBox", `0 0 ${cssW} ${cssH}`);
    return { dpr, cssW, cssH };
  }

  function drawHeatmap(seqLen, d, cssW, cssH) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width  / d;
    const cellH = canvas.height / seqLen;

    function drawRow(pos) {
      for (let i = 0; i < d; i++) {
        const v = pe(pos, i, d);
        ctx.fillStyle = colormap(v);
        ctx.fillRect(
          i * cellW,
          pos * cellH,
          Math.ceil(cellW + 0.5),
          Math.ceil(cellH + 0.5),
        );
      }
    }
    return drawRow;
  }

  function clearOverlay() {
    if (overlay) overlay.innerHTML = "";
  }

  function svgPath(d, attrs = {}) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    Object.assign(p.style, { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" });
    for (const k in attrs) p.setAttribute(k, attrs[k]);
    return p;
  }

  // Trace one column's sine wave on the overlay.
  // The wave's y goes top-to-bottom (positions 0..seqLen-1), x oscillates around the column center.
  // dimIdx = which column. period grows with dimIdx (smaller dimIdx = faster oscillation).
  async function traceColumn(dimIdx, seqLen, d, cssW, cssH, color) {
    const cellW = cssW / d;
    const cellH = cssH / seqLen;
    const colCx = (dimIdx + 0.5) * cellW;
    const amp = cellW * 1.6;  // amplitude — let the wave extend a bit beyond the column

    // Build path through (cssW domain) y -> oscillation
    const points = [];
    for (let pos = 0; pos < seqLen; pos++) {
      const v = pe(pos, dimIdx, d);
      const y = (pos + 0.5) * cellH;
      const x = colCx + amp * v;
      points.push([x, y]);
    }
    const dStr = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");

    // Highlight box around the column
    const boxX = dimIdx * cellW;
    const box = document.createElementNS(SVG_NS, "rect");
    box.setAttribute("x", boxX);
    box.setAttribute("y", 0);
    box.setAttribute("width", cellW);
    box.setAttribute("height", cssH);
    box.setAttribute("fill", "rgba(255,255,255,0.08)");
    box.setAttribute("stroke", color);
    box.setAttribute("stroke-width", 1);
    box.style.opacity = 0;
    box.style.transition = "opacity 350ms";
    overlay.appendChild(box);
    void box.getBoundingClientRect();
    box.style.opacity = 1;

    // Draw curve animated
    const curve = svgPath(dStr, {
      stroke: color, "stroke-width": 2.5,
    });
    curve.style.opacity = 0.95;
    overlay.appendChild(curve);
    await drawAnimated(curve, 900);

    // Label: dimension index + plain English period hint
    const idx = Math.floor(dimIdx/2);
    const period = Math.round(2 * Math.PI * Math.pow(10000, (2 * idx) / d));
    const lbl = document.createElementNS(SVG_NS, "text");
    lbl.setAttribute("x", colCx);
    lbl.setAttribute("y", 14);
    lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("font-size", "11");
    lbl.setAttribute("font-weight", "700");
    lbl.setAttribute("fill", color);
    lbl.style.opacity = 0;
    lbl.style.transition = "opacity 350ms";
    lbl.textContent = `dim ${dimIdx} · period ≈ ${period}`;
    overlay.appendChild(lbl);
    void lbl.getBoundingClientRect();
    lbl.style.opacity = 1;

    await delay(1200);

    // fade out this column's overlays so the next one is clear
    [box, curve, lbl].forEach(el => {
      el.style.transition = "opacity 500ms";
      el.style.opacity = 0;
    });
    await delay(500);
    [box, curve, lbl].forEach(el => el.remove());
  }

  async function render(animated = false) {
    if (activeRun) activeRun.cancel();

    const seqInput = document.getElementById("pos-seq");
    const dimInput = document.getElementById("pos-dim");
    const seqVal = document.getElementById("pos-seq-val");
    const dimVal = document.getElementById("pos-dim-val");

    const seqLen = parseInt(seqInput.value, 10);
    const d = parseInt(dimInput.value, 10);
    seqVal.textContent = seqLen;
    dimVal.textContent = d;

    const layers = ensureLayers();
    if (!layers) return;
    const { cssW, cssH } = layers;

    clearOverlay();
    const drawRow = drawHeatmap(seqLen, d, cssW, cssH);

    if (!animated) {
      for (let pos = 0; pos < seqLen; pos++) drawRow(pos);
      return;
    }

    activeRun = runSequence([
      // Phase 1: row-by-row reveal
      async () => {
        for (let pos = 0; pos < seqLen; pos++) {
          drawRow(pos);
          await delay(35);
        }
        await delay(800);
      },
      // Phase 2: trace 4 representative columns to show the underlying waves
      async () => {
        // Pick 4 dimension indices spaced log-ish so we sample fast → slow
        const picks = [
          { d: 0,                 c: "#ff5470" },
          { d: Math.floor(d/4),   c: "#ffb673" },
          { d: Math.floor(d/2),   c: "#7dd6a3" },
          { d: Math.max(d - 2, d - 1), c: "#c5a8ff" },
        ];

        // Brief banner above heatmap
        const banner = document.createElementNS(SVG_NS, "text");
        banner.setAttribute("x", cssW / 2);
        banner.setAttribute("y", cssH - 10);
        banner.setAttribute("text-anchor", "middle");
        banner.setAttribute("font-size", "12");
        banner.setAttribute("font-weight", "700");
        banner.setAttribute("fill", "rgba(255,255,255,0.85)");
        banner.style.opacity = 0;
        banner.style.transition = "opacity 350ms";
        banner.textContent = "Each column = a sine wave at a unique frequency";
        overlay.appendChild(banner);
        void banner.getBoundingClientRect();
        banner.style.opacity = 1;

        for (const p of picks) {
          await traceColumn(p.d, seqLen, d, cssW, cssH, p.c);
        }
        // remove banner
        banner.style.opacity = 0;
        await delay(400);
        banner.remove();
      },
    ]);
  }

  function init() {
    const seqInput = document.getElementById("pos-seq");
    const dimInput = document.getElementById("pos-dim");
    seqInput.addEventListener("input", () => render(false));
    dimInput.addEventListener("input", () => render(false));

    // Debounced resize: re-render canvas at fresh DPR-correct dimensions
    let resizeT = null;
    window.addEventListener("resize", () => {
      if (resizeT) clearTimeout(resizeT);
      resizeT = setTimeout(() => render(false), 120);
    });

    setTimeout(() => render(true), 100);

    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.pos = () => render(true);
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.pos = () => render(true);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
