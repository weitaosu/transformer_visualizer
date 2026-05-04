/* §6 Masking — animated transition from full to masked attention.
 *
 * On autoplay (or "Replay"), the slide:
 *   1. Shows full self-attention (every word sees every word). Pause.
 *   2. Narrates the problem: "if we could see future words at training time,
 *      the model would just copy them."
 *   3. Animates the future-edges fading out, top-right of heatmap turning gray,
 *      one diagonal at a time so the user can SEE the lower triangle emerge.
 *   4. Finishes in masked state. The toggle switch reflects the current state.
 *
 * The toggle still works manually: clicking it switches state instantly without
 * the narrative pacing.
 */

(function () {
  const TOKENS = window.SA_TOKENS;
  const N = TOKENS.length;

  const W = 1200, H = 470;

  // LEFT region (0..600): bipartite diagram. RIGHT (700..1200): heatmap.
  const leftX = 60, leftW = 540;
  const yBot = 360, yTop = 90;
  const colW = leftW / (N - 1);

  const rightX = 720, rightY = 80, gridSize = 360, cellSize = gridSize / N;

  let masked = false;        // start in unmasked state on autoplay
  let activeRun = null;
  let manualOverride = false; // true if user toggled checkbox manually

  function build() {
    const svg = document.getElementById("mask-svg");
    if (!svg) return;
    svg.innerHTML = "";

    function drawBox(x, y, label, id = null) {
      const g = svgEl("g", { transform: `translate(${x - 40}, ${y - 22})` }, svg);
      if (id) g.setAttribute("id", id);
      svgEl("rect", { x: 0, y: 0, width: 80, height: 44, rx: 6, class: "token-box" }, g);
      svgEl("text", { x: 40, y: 28, "text-anchor": "middle", "font-weight": "700", "font-size": 19, text: label }, g);
    }

    // LEFT panel
    for (let j = 0; j < N; j++) drawBox(leftX + j * colW, yBot, TOKENS[j], `mask-in-${j}`);
    for (let j = 0; j < N; j++) drawBox(leftX + j * colW, yTop, "out " + (j+1), `mask-out-${j}`);

    svgEl("text", { x: leftX + leftW/2, y: 40, "text-anchor": "middle",
      "font-size": 18, "font-weight": "700", class: "label-soft",
      text: "Allowed connections" }, svg);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        svgEl("line", {
          x1: leftX + j * colW, y1: yBot - 22,
          x2: leftX + i * colW, y2: yTop + 22,
          stroke: "rgba(255,255,255,0.85)", "stroke-width": 1.5,
          opacity: 0.65,
          id: `mask-edge-${i}-${j}`,
        }, svg);
      }
    }

    // small "outputs/inputs" labels
    svgEl("text", { x: leftX - 30, y: yTop + 4, "text-anchor": "middle",
      "font-size": 16, class: "label-soft", text: "outputs" }, svg);
    svgEl("text", { x: leftX - 30, y: yBot + 4, "text-anchor": "middle",
      "font-size": 16, class: "label-soft", text: "inputs" }, svg);

    // RIGHT panel: heatmap
    svgEl("text", { x: rightX + gridSize/2, y: 40, "text-anchor": "middle",
      "font-size": 18, "font-weight": "700", class: "label-soft",
      text: "Attention matrix (each row sums to 1)" }, svg);

    for (let j = 0; j < N; j++) {
      svgEl("text", { x: rightX + (j + 0.5) * cellSize, y: rightY - 6,
        "text-anchor": "middle", "font-size": 16, class: "label-soft",
        text: TOKENS[j] }, svg);
    }
    for (let i = 0; i < N; i++) {
      svgEl("text", { x: rightX - 6, y: rightY + (i + 0.5) * cellSize + 4,
        "text-anchor": "end", "font-size": 16, class: "label-soft",
        text: TOKENS[i] }, svg);
    }

    // Row-overlay rectangles for the Phase-5 walk-through highlight
    // (drawn FIRST so they sit BEHIND the cells)
    for (let i = 0; i < N; i++) {
      svgEl("rect", {
        x: rightX - 2, y: rightY + i * cellSize - 2,
        width: gridSize + 4, height: cellSize + 4, rx: 4,
        fill: "rgba(255,209,102,0.0)",
        stroke: "rgba(255,209,102,0.0)",
        "stroke-width": 2,
        opacity: 1,  // visibility controlled via fill alpha
        id: `mask-row-overlay-${i}`,
      }, svg);
    }

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        svgEl("rect", {
          x: rightX + j * cellSize + 2, y: rightY + i * cellSize + 2,
          width: cellSize - 4, height: cellSize - 4, rx: 3,
          fill: "rgba(255,84,112,0.0)",
          stroke: "rgba(255,255,255,0.07)",
          id: `mask-cell-${i}-${j}`,
        }, svg);
        svgEl("text", {
          x: rightX + (j + 0.5) * cellSize, y: rightY + (i + 0.5) * cellSize + 4,
          "text-anchor": "middle", "font-size": 16, "font-weight": "600",
          fill: "#fff",
          id: `mask-cell-text-${i}-${j}`,
          text: "—",
        }, svg);
      }
    }

    // overlay "🔒" mask icon — drawn on demand near top-right corner
    svgEl("text", {
      id: "mask-padlock",
      x: rightX + gridSize - 14, y: rightY + 14,
      "text-anchor": "end", "font-size": 24, fill: "var(--accent)",
      opacity: 0,
      text: "🔒"
    }, svg);
  }

  function setNarration(html) {
    const el = document.getElementById("mask-narration");
    if (el) el.innerHTML = html;
  }

  // Render to a target state instantly (used by manual toggle).
  function renderState(maskedNow) {
    const svg = document.getElementById("mask-svg");
    if (!svg) return;
    const A = window.computeAttentionMatrix(maskedNow);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const e = svg.querySelector(`#mask-edge-${i}-${j}`);
        const allowed = !maskedNow || j <= i;
        e.style.transition = "opacity 500ms";
        e.style.opacity = allowed ? 0.65 : 0;

        const cell = svg.querySelector(`#mask-cell-${i}-${j}`);
        const txt  = svg.querySelector(`#mask-cell-text-${i}-${j}`);
        cell.style.transition = "fill 500ms";
        if (maskedNow && j > i) {
          cell.style.fill = "rgba(255,255,255,0.04)";
          txt.textContent = "—";
          txt.style.fill = "rgba(255,255,255,0.25)";
        } else {
          const w = A[i][j];
          cell.style.fill = `rgba(255,84,112, ${(0.18 + 0.82 * w).toFixed(2)})`;
          txt.textContent = w.toFixed(2);
          txt.style.fill = "#fff";
        }
      }
    }
    const padlock = svg.querySelector("#mask-padlock");
    padlock.style.transition = "opacity 500ms";
    padlock.style.opacity = maskedNow ? 1 : 0;
  }

  function reset() {
    const svg = document.getElementById("mask-svg");
    if (!svg) return;
    const toggle = document.getElementById("mask-toggle");
    const tlabel = document.getElementById("mask-toggle-label");
    if (toggle) { toggle.checked = false; }
    masked = false;
    if (tlabel) tlabel.textContent = "Full self-attention (every token sees every token)";

    const A_full = window.computeAttentionMatrix(false);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const cell = svg.querySelector(`#mask-cell-${i}-${j}`);
        const txt  = svg.querySelector(`#mask-cell-text-${i}-${j}`);
        cell.style.transition = "none";
        cell.style.fill = `rgba(255,84,112, ${(0.18 + 0.82 * A_full[i][j]).toFixed(2)})`;
        txt.textContent = A_full[i][j].toFixed(2);
        txt.style.fill = "#fff";
        const e = svg.querySelector(`#mask-edge-${i}-${j}`);
        e.style.transition = "none";
        e.style.opacity = 0.65;
      }
    }
    const padlock = svg.querySelector("#mask-padlock");
    padlock.style.transition = "none";
    padlock.style.opacity = 0;
    // clear any row-overlay highlights from phase 5
    for (let i = 0; i < N; i++) {
      const rowEl = svg.querySelector(`#mask-row-overlay-${i}`);
      if (rowEl) {
        rowEl.style.transition = "none";
        rowEl.setAttribute("stroke", "rgba(255,209,102,0.0)");
      }
    }
  }

  function buildSteps() {
    const svg = document.getElementById("mask-svg");
    const toggle = document.getElementById("mask-toggle");
    const tlabel = document.getElementById("mask-toggle-label");

    return [
      // Phase 1
      async () => {
        setActiveStep("mask-steps", 0);
        setNarration(`<span class="step-tag">Phase 1 / 5</span> Right now: <b>full self-attention</b>. Every word sees every other — n×n comparisons, so attention costs <b>O(n²)</b> in sequence length.`);
        await delay(2200);
      },
      // Phase 2
      async () => {
        setActiveStep("mask-steps", 1);
        setNarration(`<span class="step-tag">Phase 2 / 5</span> But what if the model is <b>generating text one word at a time</b>? It can't peek at words it hasn't written yet — that would be cheating.`);
        await delay(2400);
      },
      // Phase 3
      async () => {
        setActiveStep("mask-steps", 2);
        setNarration(`<span class="step-tag">Phase 3 / 5</span> So we hide the future. Watch the upper-right of the matrix go gray as the lines to future words disappear.`);

        const padlock = svg.querySelector("#mask-padlock");
        padlock.style.transition = "opacity 500ms";
        padlock.style.opacity = 1;

        for (let d_off = N - 1; d_off >= 1; d_off--) {
          for (let i = 0; i < N; i++) {
            const j = i + d_off;
            if (j >= N) continue;
            const e = svg.querySelector(`#mask-edge-${i}-${j}`);
            e.style.transition = "opacity 600ms";
            e.style.opacity = 0;
            const cell = svg.querySelector(`#mask-cell-${i}-${j}`);
            const txt  = svg.querySelector(`#mask-cell-text-${i}-${j}`);
            cell.style.transition = "fill 600ms";
            cell.style.fill = "rgba(255,255,255,0.04)";
            txt.style.transition = "fill 600ms";
            txt.style.fill = "rgba(255,255,255,0.25)";
            txt.textContent = "—";
          }
          await delay(700);
        }
        await delay(700);

        const A_masked = window.computeAttentionMatrix(true);
        for (let i = 0; i < N; i++) {
          for (let j = 0; j <= i; j++) {
            const cell = svg.querySelector(`#mask-cell-${i}-${j}`);
            const txt  = svg.querySelector(`#mask-cell-text-${i}-${j}`);
            cell.style.transition = "fill 600ms";
            cell.style.fill = `rgba(255,84,112, ${(0.18 + 0.82 * A_masked[i][j]).toFixed(2)})`;
            txt.textContent = A_masked[i][j].toFixed(2);
          }
        }
        await delay(800);
      },
      // Phase 4: final masked state + start the autoregressive walk
      async () => {
        setActiveStep("mask-steps", 3);
        masked = true;
        if (toggle) toggle.checked = true;
        if (tlabel) tlabel.textContent = "Masked self-attention (each word only sees itself + earlier)";
        setNarration(`<span class="step-tag">Phase 4 / 5</span> This is <b>masked self-attention</b>. Each word only sees itself and the words before it.`);
        await delay(1800);
      },
      // Phase 5: walk through each row, highlighting which positions can be seen
      async () => {
        setActiveStep("mask-steps", 4);
        setNarration(`<span class="step-tag">Phase 5 / 5</span> Walk through each row to see what each generation step can attend to. The yellow border highlights the current row — that's autoregressive generation.`);

        const A_masked = window.computeAttentionMatrix(true);

        for (let row = 0; row < N; row++) {
          // Highlight the active row with a yellow stroke; clear others
          for (let r = 0; r < N; r++) {
            const rowEl = svg.querySelector(`#mask-row-overlay-${r}`);
            if (!rowEl) continue;
            rowEl.style.transition = "stroke 300ms";
            rowEl.setAttribute("stroke", r === row ? "rgba(255,209,102,0.95)" : "rgba(255,209,102,0.0)");
          }

          const stepWord = ["I", "like", "black", "coffee"][row];
          const stepNarrText = `Generating word ${row + 1} ("<b>${stepWord}</b>") — it can attend to <b>${row + 1}</b> position${row > 0 ? "s" : ""}: itself${row > 0 ? " plus the earlier words" : ""}.`;
          setNarration(`<span class="step-tag">Phase 5 / 5</span> ${stepNarrText}`);

          // Pulse each visible cell in this row (j <= row) one at a time
          for (let j = 0; j <= row; j++) {
            const cell = svg.querySelector(`#mask-cell-${row}-${j}`);
            const baseFill = `rgba(255,84,112, ${(0.18 + 0.82 * A_masked[row][j]).toFixed(2)})`;
            const brightFill = `rgba(255,209,102,0.95)`;
            cell.style.transition = "fill 220ms";
            cell.style.fill = brightFill;
            await delay(280);
            cell.style.fill = baseFill;
          }
          await delay(700);
        }

        // clear the row highlights
        for (let r = 0; r < N; r++) {
          const rowEl = svg.querySelector(`#mask-row-overlay-${r}`);
          if (rowEl) {
            rowEl.style.transition = "stroke 400ms";
            rowEl.setAttribute("stroke", "rgba(255,209,102,0.0)");
          }
        }
        setNarration(`<span class="step-tag">Done</span> Earlier positions see fewer words — only the past. That's how the decoder generates one word at a time, exactly like reading left-to-right.`);
      },
    ];
  }

  const STEPS = [
    "Show full attention",
    "Why we need masking",
    "Animate mask falling",
    "Final masked state",
    "Walk through each step",
  ];

  let nav = null;
  const play     = (end) => nav && nav.play(end);
  const goToStep = (idx) => nav && nav.goToStep(idx);

  function init() {
    build();
    nav = makeStepNavigator({
      stepsFn: buildSteps,
      reset:   reset,
      listId:  "mask-steps",
      animKey: "mask",
    });
    setupStepList("mask-steps", STEPS, (i) => { manualOverride = false; goToStep(i); });

    const toggle = document.getElementById("mask-toggle");
    const label = document.getElementById("mask-toggle-label");

    toggle.addEventListener("change", () => {
      manualOverride = true;
      masked = toggle.checked;
      label.textContent = masked
        ? "Masked self-attention (each word only sees itself + earlier)"
        : "Full self-attention (every token sees every token)";
      const narr = document.getElementById("mask-narration");
      if (narr) {
        narr.innerHTML = masked
          ? `<span class="step-tag">Decoder mode</span> Each word can <b>only see itself and the words before it</b>. Otherwise the model would peek at the answer.`
          : `<span class="step-tag">Encoder mode</span> Every word can see every other — full bidirectional context.`;
      }
      renderState(masked);
    });

    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.mask = () => { manualOverride = false; play(); };
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.mask = () => { if (!manualOverride) play(); };
  }

  document.addEventListener("DOMContentLoaded", init);
})();
