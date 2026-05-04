/* §1 — Words → Embeddings → Embeddings + Positional Encoding.
 * Animation: tokens drop into Embedding box, vectors emerge,
 * then PE vectors fly in and ADD to the embeddings.
 */

(function () {
  const TOKENS = window.SA_TOKENS;
  const EMB    = window.SA_EMB;
  const D      = window.SA_D;

  // PE values (sinusoidal, matches §5 formula)
  function pe(pos, i) {
    const idx = Math.floor(i/2);
    const angle = pos / Math.pow(10000, (2 * idx) / D);
    return (i % 2 === 0) ? Math.sin(angle) : Math.cos(angle);
  }
  const PE = TOKENS.map((_, p) => Array.from({length: D}, (_, i) => pe(p, i)));

  let activeRun = null;

  function build() {
    const svg = document.getElementById("embed-svg");
    if (!svg) return;
    svg.innerHTML = "";

    const W = 1100, H = 460;
    const cellW = 28, cellH = 22;
    const colSpacing = 200;
    const startX = 110;

    // Static geometry: 4 columns, each with token / embedding / PE / sum
    // Bottom: token boxes
    // Then: arrow up into embedding lookup box
    // Then: emb vectors
    // Then: + sign
    // Then: PE vectors (from the right)
    // Then: final summed vectors

    // The "Embedding lookup" box (one big box across all columns)
    svgEl("rect", {
      x: startX - 30, y: 250,
      width: 4 * colSpacing, height: 38, rx: 6,
      class: "matrix-box",
    }, svg);
    svgEl("text", {
      x: startX - 30 + 2 * colSpacing, y: 273,
      "text-anchor": "middle",
      "font-size": 18, "font-weight": "600",
      class: "label-soft",
      text: "Embedding lookup (vocab → vector)",
    }, svg);

    // Positional encoding box (small, top-right)
    svgEl("rect", {
      x: 920, y: 100,
      width: 140, height: 38, rx: 6,
      class: "matrix-box",
    }, svg);
    svgEl("text", {
      x: 990, y: 124,
      "text-anchor": "middle",
      "font-size": 17, "font-weight": "600",
      class: "label-soft",
      text: "Positional Enc.",
    }, svg);

    TOKENS.forEach((t, i) => {
      const cx = startX + i * colSpacing;

      // 1. token box (bottom)
      const tg = svgEl("g", { id: `emb-tok-${i}`, transform: `translate(${cx - 36}, 380)`, opacity: 0 }, svg);
      svgEl("rect", { x: 0, y: 0, width: 72, height: 36, rx: 6, class: "token-box" }, tg);
      svgEl("text", { x: 36, y: 22, "text-anchor": "middle", "font-weight": "700", "font-size": 19, text: t }, tg);

      // 2. embedding vector (will fly OUT of the lookup box upward)
      drawVector(svg, EMB[i], cx - cellW/2, 320, cellW, cellH, "v-emb", { id: `emb-vec-${i}`, label: "embedding" });
      const evec = svg.querySelector(`#emb-vec-${i}`);
      evec.style.opacity = 0;

      // 3. plus sign
      const plus = svgEl("text", {
        id: `emb-plus-${i}`,
        x: cx, y: 220,
        "text-anchor": "middle",
        "font-size": 26, "font-weight": "700",
        fill: "var(--accent)",
        opacity: 0,
        text: "+",
      }, svg);

      // 4. positional encoding vector (will fly in from the PE box on the right)
      drawVector(svg, PE[i], cx - cellW/2, 165, cellW, cellH, "v-emb", { id: `emb-pe-${i}`, label: "pos enc." });
      const pvec = svg.querySelector(`#emb-pe-${i}`);
      pvec.style.opacity = 0;

      // 5. final summed vector (top)
      drawVector(svg, EMB[i].map((e, k) => e + PE[i][k]), cx - cellW/2, 60, cellW, cellH, "v-out", { id: `emb-sum-${i}`, label: "input to encoder" });
      const svec = svg.querySelector(`#emb-sum-${i}`);
      svec.style.opacity = 0;

      // arrow from token -> embedding box
      const arrow = svgEl("line", {
        x1: cx, y1: 378, x2: cx, y2: 290,
        stroke: "var(--ink-soft)", "stroke-width": 1.5,
        opacity: 0, id: `emb-arr-${i}`,
      }, svg);

      // arrow embedding box -> embedding vector area
      svgEl("line", {
        x1: cx, y1: 250, x2: cx, y2: 220,
        stroke: "var(--ink-soft)", "stroke-width": 1.5,
        opacity: 0.4,
      }, svg);
    });
  }

  async function play() {
    if (activeRun) activeRun.cancel();
    const svg = document.getElementById("embed-svg");
    if (!svg) return;

    // Reset opacities
    TOKENS.forEach((_, i) => {
      svg.querySelector(`#emb-tok-${i}`).style.opacity = 0;
      svg.querySelector(`#emb-vec-${i}`).style.opacity = 0;
      svg.querySelector(`#emb-plus-${i}`).style.opacity = 0;
      svg.querySelector(`#emb-pe-${i}`).style.opacity = 0;
      svg.querySelector(`#emb-sum-${i}`).style.opacity = 0;
      svg.querySelector(`#emb-arr-${i}`).style.opacity = 0;
    });

    activeRun = runSequence([
      // 1. tokens appear bottom
      async () => {
        for (let i = 0; i < TOKENS.length; i++) {
          const el = svg.querySelector(`#emb-tok-${i}`);
          el.style.transition = "opacity 250ms";
          el.style.opacity = 1;
          await delay(120);
        }
        await delay(200);
      },
      // 2. arrows up + embedding vectors emerge
      async () => {
        for (let i = 0; i < TOKENS.length; i++) {
          svg.querySelector(`#emb-arr-${i}`).style.transition = "opacity 250ms";
          svg.querySelector(`#emb-arr-${i}`).style.opacity = 0.7;
        }
        await delay(250);
        for (let i = 0; i < TOKENS.length; i++) {
          const el = svg.querySelector(`#emb-vec-${i}`);
          el.style.transition = "opacity 350ms";
          el.style.opacity = 1;
          await delay(100);
        }
        await delay(400);
      },
      // 3. plus signs appear, PE vectors fly in
      async () => {
        for (let i = 0; i < TOKENS.length; i++) {
          svg.querySelector(`#emb-plus-${i}`).style.transition = "opacity 250ms";
          svg.querySelector(`#emb-plus-${i}`).style.opacity = 1;
        }
        await delay(250);
        for (let i = 0; i < TOKENS.length; i++) {
          const el = svg.querySelector(`#emb-pe-${i}`);
          el.style.transition = "opacity 350ms";
          el.style.opacity = 1;
          await delay(100);
        }
        await delay(500);
      },
      // 4. emerge final summed input vector
      async () => {
        for (let i = 0; i < TOKENS.length; i++) {
          const el = svg.querySelector(`#emb-sum-${i}`);
          el.style.transition = "opacity 450ms";
          el.style.opacity = 1;
          await delay(120);
        }
      },
    ]);
  }

  function init() {
    build();
    // expose
    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.embed = play;
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.embed = play;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
