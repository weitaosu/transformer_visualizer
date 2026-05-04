/* Slide 4 — Self-Attention.
 *
 * Now: ONE thing happens at a time. Every step has a big plain-English
 * narration banner above the stage. Math is small and always next to a
 * concrete English label.
 *
 * Default query: "black". The animation walks through:
 *   Step 1.  This word ("black") is asking a question.
 *   Step 2.  Make 3 versions of every word: Q, K, V.
 *            (Q = "what I'm looking for"; K = "what I am"; V = "info I carry".)
 *   Step 3.  Compare black's Q against every K. (Show the dot product
 *            with a plain-English label "match strength".)
 *   Step 4.  Softmax → percentages that sum to 100%.
 *   Step 5.  Mix the V's by those percentages → the new "black" vector.
 */

(function () {
  const TOKENS = window.SA_TOKENS;
  const Q = window.SA_Q, K = window.SA_K, V = window.SA_V, D = window.SA_D;
  const N = TOKENS.length;

  // Plain-English captions for each token (what each word "is" / "carries")
  // Kept short so they don't collide with neighbouring columns.
  const SEMANTIC_KEY = ["pronoun", "verb", "adjective", "noun"];
  const SEMANTIC_VAL = ["speaker", "preference", "color", "drink"];

  const STEPS = [
    "Pick a word",
    "Make Q, K, V",
    "Use that word's Q",
    "Match Q vs every K",
    "Softmax → percentages",
    "Mix V's by weight",
  ];

  let queryIdx = 2;       // "black"
  let activeRun = null;

  // Layout (viewBox 1200 x 480)
  const colSpacing = 250;
  const baseX = 130;
  function colX(i) { return baseX + i * colSpacing; }

  const Y_TOKENS = 410;
  const Y_QKV = 110;
  const Y_MATCH = 230;
  const Y_SOFT = 290;
  const CELL_W = 22, CELL_H = 14;
  const OUT_X = 990, OUT_Y = Y_SOFT + 50, OUT_W = 200, OUT_H = 50;

  function setNarration(html) {
    const el = document.getElementById("attn-narration");
    if (el) el.innerHTML = html;
  }

  function build() {
    const svg = document.getElementById("attn-svg");
    if (!svg) return;
    svg.innerHTML = "";

    // ===== Bottom: 4 input tokens =====
    TOKENS.forEach((t, i) => {
      const cx = colX(i);
      const g = svgEl("g", { id: `sa-tok-${i}`, transform: `translate(${cx-50}, ${Y_TOKENS})` }, svg);
      svgEl("rect", { x: 0, y: 0, width: 100, height: 36, rx: 8, class: "token-box" }, g);
      svgEl("text", { x: 50, y: 23, "text-anchor": "middle", "font-weight": "700", "font-size": 18, text: t }, g);
    });

    // ===== Q / K / V "factory" labels (visible when projections are made) =====
    // Each token has 3 small badges above its Q,K,V vectors showing the kind.
    TOKENS.forEach((t, i) => {
      const cx = colX(i);
      drawBadge(svg, cx - 80, Y_QKV - 26, 56, 24, "Q", "var(--q)", "rgba(197,168,255,0.22)", `sa-qbadge-${i}`);
      drawBadge(svg, cx     , Y_QKV - 26, 56, 24, "K", "var(--k)", "rgba(255,182,115,0.22)", `sa-kbadge-${i}`);
      drawBadge(svg, cx + 80, Y_QKV - 26, 56, 24, "V", "var(--v)", "rgba(125,214,163,0.22)", `sa-vbadge-${i}`);
      [`sa-qbadge-${i}`, `sa-kbadge-${i}`, `sa-vbadge-${i}`].forEach(id => svg.querySelector(`#${id}`).style.opacity = 0);
    });

    // ===== Q vectors (small) per token + plain-English "what it is/wants" labels =====
    TOKENS.forEach((t, i) => {
      const cx = colX(i);
      drawVector(svg, Q[i], cx - 80 - CELL_W*2, Y_QKV, CELL_W, CELL_H, "v-q", { id: `sa-q-${i}` });
      drawVector(svg, K[i], cx       - CELL_W*2, Y_QKV, CELL_W, CELL_H, "v-k", { id: `sa-k-${i}` });
      drawVector(svg, V[i], cx + 80 - CELL_W*2, Y_QKV, CELL_W, CELL_H, "v-v", { id: `sa-v-${i}` });

      // Plain-English label below each Q/K/V (readable size; kept compact)
      svgEl("text", { id: `sa-q-tag-${i}`, x: cx - 80, y: Y_QKV + CELL_H * D + 18,
        "text-anchor": "middle", "font-size": 13, fill: "var(--q)", "font-weight": "600",
        opacity: 0,
        text: i === queryIdx ? `"who matches?"` : `query`,
      }, svg);
      svgEl("text", { id: `sa-k-tag-${i}`, x: cx, y: Y_QKV + CELL_H * D + 18,
        "text-anchor": "middle", "font-size": 13, fill: "var(--k)", "font-weight": "600",
        opacity: 0,
        text: SEMANTIC_KEY[i],
      }, svg);
      svgEl("text", { id: `sa-v-tag-${i}`, x: cx + 80, y: Y_QKV + CELL_H * D + 18,
        "text-anchor": "middle", "font-size": 13, fill: "var(--v)", "font-weight": "600",
        opacity: 0,
        text: SEMANTIC_VAL[i],
      }, svg);

      [`sa-q-${i}`, `sa-k-${i}`, `sa-v-${i}`].forEach(id => svg.querySelector(`#${id}`).style.opacity = 0);
    });

    // ===== Score / match-strength row =====
    // Below Q/K/V tags, show a "match strength" gauge per word.
    TOKENS.forEach((t, i) => {
      const cx = colX(i);
      const g = svgEl("g", { id: `sa-match-${i}`, opacity: 0 }, svg);
      svgEl("rect", { x: cx - 80, y: Y_MATCH, width: 160, height: 18, rx: 4,
        fill: "rgba(255,255,255,0.06)" }, g);
      svgEl("rect", { x: cx - 80, y: Y_MATCH, width: 0, height: 18, rx: 4,
        fill: "var(--accent)",
        id: `sa-match-fill-${i}` }, g);
      svgEl("text", { x: cx, y: Y_MATCH + 13, "text-anchor": "middle",
        "font-size": 16, "font-weight": "700", fill: "#fff",
        id: `sa-match-text-${i}`, text: "—" }, g);
      // word label below
      svgEl("text", { x: cx, y: Y_MATCH + 32, "text-anchor": "middle",
        "font-size": 10, fill: "var(--ink-soft)",
        text: TOKENS[i] }, g);
    });
    // Big "Match strength" header for the row
    svgEl("text", { id: "sa-match-header",
      x: colX(0) - 110, y: Y_MATCH + 13,
      "text-anchor": "end", "font-size": 16, "font-weight": "700",
      fill: "var(--ink-soft)", opacity: 0,
      text: "match strength →"
    }, svg);

    // ===== Softmax row (percentages) =====
    TOKENS.forEach((t, i) => {
      const cx = colX(i);
      const g = svgEl("g", { id: `sa-soft-${i}`, opacity: 0 }, svg);
      svgEl("rect", { x: cx - 80, y: Y_SOFT, width: 160, height: 18, rx: 4,
        fill: "rgba(255,255,255,0.06)" }, g);
      svgEl("rect", { x: cx - 80, y: Y_SOFT, width: 0, height: 18, rx: 4,
        fill: "var(--v)",
        id: `sa-soft-fill-${i}` }, g);
      svgEl("text", { x: cx, y: Y_SOFT + 13, "text-anchor": "middle",
        "font-size": 16, "font-weight": "700", fill: "#fff",
        id: `sa-soft-text-${i}`, text: "0%" }, g);
    });
    svgEl("text", { id: "sa-soft-header",
      x: colX(0) - 110, y: Y_SOFT + 13,
      "text-anchor": "end", "font-size": 16, "font-weight": "700",
      fill: "var(--ink-soft)", opacity: 0,
      text: "as % (softmax) →"
    }, svg);

    // ===== Output: at right side, a single output box (OUT_* constants at top) =====
    const og = svgEl("g", { id: "sa-output", opacity: 0, transform: `translate(${OUT_X}, ${OUT_Y})` }, svg);
    svgEl("rect", { x: 0, y: 0, width: OUT_W, height: OUT_H, rx: 10,
      fill: "rgba(255,84,112,0.18)", stroke: "var(--accent)", "stroke-width": 1.8 }, og);
    svgEl("text", { x: 100, y: 18, "text-anchor": "middle",
      "font-size": 9, "font-weight": "800", fill: "var(--accent)",
      text: "NEW MEANING",
      id: "sa-out-label",
    }, og);
    svgEl("text", { x: 100, y: 38, "text-anchor": "middle",
      "font-size": 17, "font-weight": "700", fill: "#fff",
      id: "sa-out-summary",
      text: "—" }, og);
  }

  function drawBadge(svg, x, y, w, h, label, color, bg, id) {
    const g = svgEl("g", { id, transform: `translate(${x - w/2}, ${y - h/2})` }, svg);
    svgEl("rect", { x: 0, y: 0, width: w, height: h, rx: 5,
      fill: bg, stroke: color, "stroke-width": 1.5 }, g);
    svgEl("text", { x: w/2, y: h - 6, "text-anchor": "middle",
      "font-size": 14, "font-weight": "800", fill: color,
      text: label }, g);
    return g;
  }

  function clearDynamic() {
    const svg = document.getElementById("attn-svg");
    svg.querySelectorAll(".dynamic").forEach(el => el.remove());
  }

  function reset() {
    const svg = document.getElementById("attn-svg");
    if (!svg) return;
    clearDynamic();

    TOKENS.forEach((_, i) => {
      [`sa-q-${i}`,`sa-k-${i}`,`sa-v-${i}`,`sa-qbadge-${i}`,`sa-kbadge-${i}`,`sa-vbadge-${i}`,
       `sa-q-tag-${i}`,`sa-k-tag-${i}`,`sa-v-tag-${i}`,
       `sa-match-${i}`, `sa-soft-${i}`].forEach(id => {
        const el = svg.querySelector("#" + id);
        if (el) {
          el.style.transition = "none";
          el.style.opacity = 0;
        }
      });
      svg.querySelector(`#sa-match-fill-${i}`).setAttribute("width", 0);
      svg.querySelector(`#sa-soft-fill-${i}`).setAttribute("width", 0);
      svg.querySelector(`#sa-match-text-${i}`).textContent = "—";
      svg.querySelector(`#sa-soft-text-${i}`).textContent = "0%";
      svg.querySelector(`#sa-tok-${i}`).style.opacity = 1;
      const tr = svg.querySelector(`#sa-tok-${i} rect`);
      tr.style.transition = "none";
      tr.style.fill = "rgba(255,255,255,0.05)";
      tr.style.stroke = "var(--ink-soft)";
      tr.style.strokeWidth = "";
    });
    const qEl = svg.querySelector(`#sa-q-${queryIdx}`);
    if (qEl) qEl.classList.remove("pulsing");
    svg.querySelector("#sa-output").style.opacity = 0;
    svg.querySelector("#sa-match-header").style.opacity = 0;
    svg.querySelector("#sa-soft-header").style.opacity = 0;
    svg.querySelector("#sa-out-summary").textContent = "—";
  }

  function buildSteps() {
    const svg = document.getElementById("attn-svg");
    return [
      // Step 1 — pick a word
      async () => {
        setActiveStep("attn-steps", 0);
        setNarration(`<span class="step-tag">Step 1 / 6</span> The word <b>"${TOKENS[queryIdx]}"</b> is going to figure out its own meaning by looking at every other word. Watch how.`);
        // highlight the chosen token
        const r = svg.querySelector(`#sa-tok-${queryIdx} rect`);
        r.style.transition = "fill 350ms, stroke 350ms";
        r.style.fill = "rgba(197,168,255,0.25)";
        r.style.stroke = "var(--q)";
        r.style.strokeWidth = "2";
        await delay(1400);
      },

      // Step 2 — make Q, K, V for every word
      async () => {
        setActiveStep("attn-steps", 1);
        setNarration(`<span class="step-tag">Step 2 / 6</span> Every word is split into <b style="color:var(--q)">Q</b> (what I'm looking for), <b style="color:var(--k)">K</b> (what I am), <b style="color:var(--v)">V</b> (info I carry). It's called <em>"self"</em>-attention because all three come from the <em>same sentence</em>.`);
        // animate badges and vectors fading in column by column
        for (let i = 0; i < N; i++) {
          [`sa-qbadge-${i}`,`sa-kbadge-${i}`,`sa-vbadge-${i}`,
           `sa-q-${i}`,`sa-k-${i}`,`sa-v-${i}`,
           `sa-q-tag-${i}`,`sa-k-tag-${i}`,`sa-v-tag-${i}`].forEach(id => {
            const el = svg.querySelector("#" + id);
            if (el) {
              el.style.transition = "opacity 280ms";
              el.style.opacity = 1;
            }
          });
          await delay(180);
        }
        await delay(1000);
      },

      // Step 3 — only the searcher's Q matters; dim everything else; show its plain question
      async () => {
        setActiveStep("attn-steps", 2);
        setNarration(`<span class="step-tag">Step 3 / 6</span> We only need <b style="color:var(--q)">"${TOKENS[queryIdx]}"</b>'s query. Its question: <em>"who in this sentence matters for understanding me?"</em>`);
        // dim other Q's and Q badges
        for (let i = 0; i < N; i++) {
          if (i === queryIdx) continue;
          ["sa-q-","sa-qbadge-","sa-q-tag-"].forEach(p => {
            const el = svg.querySelector("#" + p + i);
            if (el) {
              el.style.transition = "opacity 350ms";
              el.style.opacity = 0.15;
            }
          });
        }
        // pulse the searcher's Q
        const qEl = svg.querySelector(`#sa-q-${queryIdx}`);
        qEl.classList.add("pulsing");
        await delay(1600);
      },

      // Step 4 — compare the searcher's Q to every K and show "match strength"
      async () => {
        setActiveStep("attn-steps", 3);
        setNarration(`<span class="step-tag">Step 4 / 6</span> Compare <b style="color:var(--q)">"${TOKENS[queryIdx]}"</b>'s Q to every word's K. Big match = relevant.  &nbsp;<span style="color:var(--ink-soft)">(math: <b>q·k / √d</b>. We divide by √d because dot products grow with the dimension d — this scaling keeps the next softmax stable.)</span>`);
        svg.querySelector("#sa-match-header").style.transition = "opacity 350ms";
        svg.querySelector("#sa-match-header").style.opacity = 1;

        // raw scores — we display them normalized to a 0..1 "match" gauge for plain English
        const scores = K.map(k => dot(Q[queryIdx], k) / Math.sqrt(D));
        const minS = Math.min(...scores), maxS = Math.max(...scores);
        const norm = scores.map(s => (s - minS) / (maxS - minS + 1e-9));

        // animate match bars in
        for (let i = 0; i < N; i++) {
          svg.querySelector(`#sa-match-${i}`).style.transition = "opacity 250ms";
          svg.querySelector(`#sa-match-${i}`).style.opacity = 1;
          const fill = svg.querySelector(`#sa-match-fill-${i}`);
          const txt  = svg.querySelector(`#sa-match-text-${i}`);
          const target = norm[i] * 160;
          await interruptibleAnim(900, t => {
            fill.setAttribute("width", target * t);
            txt.textContent = `${(scores[i] * t).toFixed(2)}`;
          });
          await delay(80);
        }
        await delay(1200);
      },

      // Step 5 — softmax to percentages
      async () => {
        setActiveStep("attn-steps", 4);
        setNarration(`<span class="step-tag">Step 5 / 6</span> Turn those raw scores into <b>percentages</b> that sum to 100%. <span style="color:var(--ink-soft)">(math: softmax)</span>`);
        svg.querySelector("#sa-soft-header").style.transition = "opacity 350ms";
        svg.querySelector("#sa-soft-header").style.opacity = 1;

        const scores = K.map(k => dot(Q[queryIdx], k) / Math.sqrt(D));
        const alpha = softmax(scores);

        for (let i = 0; i < N; i++) {
          svg.querySelector(`#sa-soft-${i}`).style.transition = "opacity 250ms";
          svg.querySelector(`#sa-soft-${i}`).style.opacity = 1;
          const fill = svg.querySelector(`#sa-soft-fill-${i}`);
          const txt  = svg.querySelector(`#sa-soft-text-${i}`);
          const target = alpha[i] * 160;
          await interruptibleAnim(1100, t => {
            fill.setAttribute("width", target * t);
            txt.textContent = `${Math.round(alpha[i] * 100 * t)}%`;
          });
        }
        // identify the dominant OTHER word (excluding self — that's the
        // pedagogically interesting relationship).
        let maxIdx = -1, maxA = -1;
        for (let i = 0; i < N; i++) {
          if (i === queryIdx) continue;
          if (alpha[i] > maxA) { maxA = alpha[i]; maxIdx = i; }
        }
        await delay(800);
        setNarration(`<span class="step-tag">Step 5 / 6</span> Besides itself, "<b>${TOKENS[queryIdx]}</b>" pays most attention to "<b>${TOKENS[maxIdx]}</b>" (${Math.round(alpha[maxIdx]*100)}%). Each word still contributes some, but those two dominate.`);
        await delay(1500);
      },

      // Step 6 — mix V's by alpha to make new "meaning" for the searcher
      async () => {
        setActiveStep("attn-steps", 5);
        setNarration(`<span class="step-tag">Step 6 / 6</span> Mix every word's V (info) by those percentages. The result is <b>"${TOKENS[queryIdx]}"</b>'s new vector — now it knows the context.`);

        const scores = K.map(k => dot(Q[queryIdx], k) / Math.sqrt(D));
        const alpha = softmax(scores);

        // dim each V according to alpha
        for (let i = 0; i < N; i++) {
          const vEl = svg.querySelector(`#sa-v-${i}`);
          vEl.style.transition = "opacity 500ms";
          vEl.style.opacity = 0.2 + 0.8 * alpha[i];
          const tag = svg.querySelector(`#sa-v-tag-${i}`);
          tag.style.transition = "opacity 500ms, font-weight 200ms";
          tag.style.opacity = 0.4 + 0.6 * alpha[i];
        }
        await delay(550);

        // draw merge curves from each V to the output box
        const outX = OUT_X + OUT_W/2, outY = OUT_Y + OUT_H/2;  // center of output box
        for (let j = 0; j < N; j++) {
          const sx = colX(j) + 80;
          const sy = Y_QKV + CELL_H * D + 6;
          const path = svgEl("path", {
            d: `M ${sx} ${sy} Q ${(sx+outX)/2} ${sy + 60}, ${outX} ${outY}`,
            stroke: "var(--v)", "stroke-width": 1 + 4 * alpha[j],
            fill: "none", opacity: 0,
            class: "dynamic",
          }, svg);
          path.style.opacity = 0.5 + 0.5 * alpha[j];
          await drawAnimated(path, 320);
        }

        // reveal output box with a plain-English summary —
        // pick the dominant OTHER word so the summary describes a
        // genuine context-mixing effect (not "X is X-flavored" tautology).
        let maxIdx = -1, maxA = -1;
        for (let i = 0; i < N; i++) {
          if (i === queryIdx) continue;
          if (alpha[i] > maxA) { maxA = alpha[i]; maxIdx = i; }
        }
        const out = svg.querySelector("#sa-output");
        out.style.transition = "opacity 500ms";
        out.style.opacity = 1;
        const summary = `${SEMANTIC_VAL[queryIdx]} + ${SEMANTIC_VAL[maxIdx]}-flavored`;
        svg.querySelector("#sa-out-summary").textContent = summary;
        await delay(1200);

        setNarration(`<span class="step-tag">Done</span> The new vector for "<b>${TOKENS[queryIdx]}</b>" still carries its own meaning, but now mixed with <b>${SEMANTIC_VAL[maxIdx]}</b> from "<b>${TOKENS[maxIdx]}</b>". Every other word does this same search in parallel — that's a self-attention layer.`);
      },
    ];
  }

  let nav = null;
  const play     = (end) => nav && nav.play(end);
  const goToStep = (idx) => nav && nav.goToStep(idx);

  function setupControls() {
    document.querySelectorAll("#attn .token-pick").forEach(b => {
      b.addEventListener("click", () => {
        document.querySelectorAll("#attn .token-pick").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        queryIdx = parseInt(b.dataset.q, 10);
        play();
      });
    });
  }

  function init() {
    build();
    setupControls();
    nav = makeStepNavigator({
      stepsFn: buildSteps,
      reset:   reset,
      listId:  "attn-steps",
      animKey: "attn",
    });
    setupStepList("attn-steps", STEPS, (i) => goToStep(i));
    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.attn = () => play();
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.attn = () => play();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
