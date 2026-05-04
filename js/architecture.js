/* §7 Full Transformer architecture — animated end-to-end translation.
 *
 * Layout (viewBox 1200 x 500):
 *   LEFT  (encoder, x ~ 80..480):  source tokens at bottom -> Embedding+PE -> Encoder block -> Encoder output
 *   RIGHT (decoder, x ~ 720..1120): target prefix at bottom -> Embedding+PE -> Decoder block (Masked SA + Cross-Attn + FF) -> Linear -> next token
 *   MIDDLE: a "highway" path from encoder output to decoder cross-attn (animated particles)
 *
 * On Play:
 *   Step 0 (once): encoder fires - all 4 source tokens light up in parallel,
 *                   pulses of light flow up through encoder layers.
 *   Step 1..4: each step generates one German token:
 *      - decoder prefix lights up
 *      - pulse up through Masked SA
 *      - cross-attn highlights, particle flies from encoder highway
 *      - FF lights up, linear+softmax flashes, the next German token reveals at top
 */

(function () {
  const SRC = ["I", "like", "black", "coffee"];
  const TGT = ["Ich", "mag", "schwarzen", "Kaffee"];

  let stepIdx = 0;
  let activeRun = null;

  const W = 1200, H = 500;

  function build() {
    const svg = document.getElementById("full-svg");
    if (!svg) return;
    svg.innerHTML = "";

    // No arrow markers — the diagram uses only plain hairlines and a
    // dashed yellow skip curve, no arrowheads anywhere.
    const defs = svgEl("defs", {}, svg);

    // ---- ENCODER ----
    const eX = 80, eW = 380;
    drawSide({
      svg, x: eX, w: eW, isEncoder: true,
      tokens: SRC, side: "enc", labelColor: "var(--k)",
    });

    // ---- DECODER ----
    const dX = 720, dW = 400;
    drawSide({
      svg, x: dX, w: dW, isEncoder: false,
      tokens: TGT, side: "dec", labelColor: "var(--q)",
    });

    // ---- BRIDGE: encoder output -> decoder cross-attn ----
    // encoder output strip is at y=180-208; decoder cross-attn op box is at
    // dec slot 254..314 with op at 292..314 (matches drawSubLayer math).
    const bridgeStartX = eX + eW;
    const bridgeStartY = 194;
    const bridgeEndX = dX;
    const bridgeEndY = 303;

    // Bridge path
    const bridge = svgEl("path", {
      d: `M ${bridgeStartX} ${bridgeStartY} C ${(bridgeStartX+bridgeEndX)/2} ${bridgeStartY}, ${(bridgeStartX+bridgeEndX)/2} ${bridgeEndY}, ${bridgeEndX} ${bridgeEndY}`,
      stroke: "var(--accent)",
      "stroke-width": 2,
      fill: "none",
      opacity: 0.5,
      id: "arch-bridge",
    }, svg);
    svgEl("text", {
      x: (bridgeStartX + bridgeEndX) / 2, y: ((bridgeStartY + bridgeEndY)/2) - 12,
      "text-anchor": "middle",
      "font-size": 16, class: "label-soft",
      text: "K, V from encoder",
    }, svg);
  }

  // Draw one sub-layer: operation box + small "Add & Norm" strip above it +
  // a dashed residual skip arrow that bypasses the operation and merges before
  // the Add & Norm. The "+" marker shows where the residual is summed in.
  // Layout coords: subY..subY+subH is the whole sub-layer slot (data flows UP).
  // Returns { opTop, opBottom, normTop } so the caller can connect sub-layers.
  function drawSubLayer(svg, x, subY, w, subH, opLabel, opId, normId) {
    const opH = 22, normH = 14;
    // Op box sits at the BOTTOM of the slot (input is at slot bottom).
    const opTop = subY + subH - opH;
    const opBottom = subY + subH;
    drawBlock(svg, x, opTop, w, opH, opLabel, opId);
    // Add & Norm sits at the TOP of the slot.
    const normTop = subY;
    const normG = svgEl("g", { id: normId }, svg);
    svgEl("rect", { x, y: normTop, width: w, height: normH, rx: 4,
      fill: "rgba(255,209,102,0.18)",
      stroke: "rgba(255,209,102,0.7)",
      "stroke-width": 1 }, normG);
    svgEl("text", { x: x + w/2, y: normTop + normH - 3, "text-anchor": "middle",
      "font-size": 12, "font-weight": "700", fill: "#ffd166",
      text: "+ Add & Norm" }, normG);
    // Merge "+" between op-top and norm-bottom (small + soft)
    const mergeY = (opTop + normTop + normH) / 2;
    svgEl("circle", { cx: x + w/2, cy: mergeY, r: 5,
      fill: "rgba(255,209,102,0.6)", stroke: "rgba(255,209,102,0.7)", "stroke-width": 1 }, svg);
    svgEl("text", { x: x + w/2, y: mergeY + 3, "text-anchor": "middle",
      "font-size": 10, "font-weight": "800", fill: "#0a1124", text: "+" }, svg);
    // No internal arrows between op / merge / norm. The three are stacked
    // tightly with the "+" circle physically sitting between them — adding
    // 10-px-long arrows here just creates visual clutter (they're basically
    // arrowheads with no shaft). The vertical alignment alone communicates
    // the data flow.
    // Residual skip: thin dashed Bezier curve, soft yellow. NO arrowhead.
    const skipOutX = x + w + 14;
    svgEl("path", {
      d: `M ${x + w/2} ${opBottom}
          C ${skipOutX} ${opBottom}, ${skipOutX} ${mergeY}, ${x + w/2 + 6} ${mergeY}`,
      stroke: "rgba(255,209,102,0.45)",
      "stroke-width": 1,
      "stroke-dasharray": "3 3",
      fill: "none",
    }, svg);
    // tiny "skip" label, soft so it doesn't dominate
    svgEl("text", { x: skipOutX + 3, y: mergeY + 3, "text-anchor": "start",
      "font-size": 9, "font-weight": "600",
      fill: "rgba(255,209,102,0.6)", text: "skip" }, svg);
    return { opTop, opBottom, normTop };
  }

  function drawSide({ svg, x, w, isEncoder, tokens, side, labelColor }) {
    // Side title
    svgEl("text", {
      x: x + w/2, y: 28, "text-anchor": "middle",
      "font-size": 19, "font-weight": "800",
      fill: labelColor,
      text: isEncoder ? "ENCODER" : "DECODER",
    }, svg);

    // Token row at bottom
    const tokensY = 470;
    tokens.forEach((t, i) => {
      const cx = x + 60 + i * ((w - 120) / Math.max(1, tokens.length - 1));
      const g = svgEl("g", {
        id: `arch-${side}-tok-${i}`,
        transform: `translate(${cx - 36}, ${tokensY - 16})`,
        opacity: isEncoder ? 1 : 0.2,
      }, svg);
      svgEl("rect", { x: 0, y: 0, width: 72, height: 32, rx: 6, class: "token-box" }, g);
      svgEl("text", { x: 36, y: 21, "text-anchor": "middle", "font-weight": "700", "font-size": 18, text: t }, g);
    });

    // Embedding + PE box (combined)
    const embY = 400, embH = 32;
    drawBlock(svg, x + 30, embY, w - 60, embH, "Embedding + Positional Encoding", `arch-${side}-emb`);

    if (isEncoder) {
      // Encoder block (xN) — outer
      const encOuterY = 220, encOuterH = 170;
      drawBlock(svg, x + 30, encOuterY, w - 60, encOuterH, "", `arch-${side}-outer`, true);
      svgEl("text", { x: x + w/2, y: encOuterY + 16, "text-anchor": "middle",
        "font-size": 14, "font-weight": "700",
        fill: labelColor, text: "Encoder block × N" }, svg);

      const innerX = x + 50, innerW = w - 100;
      // SA sub-layer (lower) — data enters at SA's op bottom
      const sa = drawSubLayer(svg, innerX, encOuterY + 92, innerW, 70, "Self-Attention",
                              `arch-${side}-sa`, `arch-${side}-sa-norm`);
      // FF sub-layer (upper)
      const ff = drawSubLayer(svg, innerX, encOuterY + 22, innerW, 60, "Feed Forward",
                              `arch-${side}-ff`, `arch-${side}-ff-norm`);

      // Inter-sub-layer connector: SA norm-top → FF op-bottom (plain line)
      thread(svg, x + w/2, sa.normTop, x + w/2, ff.opBottom);

      // Encoder output strip (above the encoder block)
      drawBlock(svg, x + 30, 180, w - 60, 28, "Encoder output", `arch-${side}-out`);

      // Macro connectors: plain lines (data flow direction is obvious from
      // the vertical stack). Arrowheads cluttered the diagram; reserved for
      // truly directional moments (the final next-token arrow on the decoder).
      thread(svg, x + w/2, 470 - 20, x + w/2, embY + embH);          // tokens -> emb
      thread(svg, x + w/2, embY,     x + w/2, sa.opBottom);          // emb -> SA op bottom
      thread(svg, x + w/2, ff.normTop, x + w/2, 208);                // FF norm top -> encoder output
    } else {
      // Decoder block — outer
      const decOuterY = 168, decOuterH = 222;
      drawBlock(svg, x + 30, decOuterY, w - 60, decOuterH, "", `arch-${side}-outer`, true);
      svgEl("text", { x: x + w/2, y: decOuterY + 14, "text-anchor": "middle",
        "font-size": 14, "font-weight": "700",
        fill: labelColor, text: "Decoder block × N" }, svg);

      const innerX = x + 50, innerW = w - 100;
      // 3 sub-layers from BOTTOM to TOP (data flows UP):
      //   MSA → Cross-Attn → FF
      const msa = drawSubLayer(svg, innerX, decOuterY + 152, innerW, 60, "Masked Self-Attention",
                               `arch-${side}-msa`, `arch-${side}-msa-norm`);
      const cross = drawSubLayer(svg, innerX, decOuterY + 86, innerW, 60, "Cross-Attention",
                                 `arch-${side}-cross`, `arch-${side}-cross-norm`);
      const dff = drawSubLayer(svg, innerX, decOuterY + 20, innerW, 60, "Feed Forward",
                               `arch-${side}-ff`, `arch-${side}-ff-norm`);

      // Inter-sub-layer connectors: MSA → Cross, Cross → FF (plain lines)
      thread(svg, x + w/2, msa.normTop,   x + w/2, cross.opBottom);
      thread(svg, x + w/2, cross.normTop, x + w/2, dff.opBottom);

      // Linear + softmax above the decoder block
      drawBlock(svg, x + 30, 130, w - 60, 28, "Linear → softmax", `arch-${side}-linear`);

      // Predicted token box (no static label — predicted word fills it)
      drawBlock(svg, x + 30, 70, w - 60, 46, "", `arch-${side}-pred`);

      svgEl("text", {
        x: x + w/2, y: 60,
        "text-anchor": "middle", "font-size": 13, "font-weight": "600",
        fill: "var(--ink-soft)",
        text: "next predicted token →",
      }, svg);

      // Macro connectors: plain lines, EXCEPT the final "next predicted token"
      // arrow (that's the model's output — directional matters there).
      thread(svg, x + w/2, 470 - 20, x + w/2, embY + embH);    // tokens -> emb
      thread(svg, x + w/2, embY,     x + w/2, msa.opBottom);   // emb -> MSA op bottom
      thread(svg, x + w/2, dff.normTop, x + w/2, 158);         // FF norm top -> linear
      thread(svg, x + w/2, 130,       x + w/2, 116);            // linear -> next token

      // Predicted-word text
      svgEl("text", {
        id: "arch-pred-text", x: x + w/2, y: 100,
        "text-anchor": "middle", "font-size": 20, "font-weight": "800",
        fill: "var(--ink-soft)", text: "(waiting)",
      }, svg);
    }
  }

  function drawBlock(svg, x, y, w, h, label, id, outer = false) {
    const g = svgEl("g", { id }, svg);
    svgEl("rect", {
      x, y, width: w, height: h, rx: 8,
      class: "matrix-box",
      "stroke-width": outer ? 1.5 : 1,
    }, g);
    if (label) {
      svgEl("text", {
        x: x + w/2, y: y + h/2 + 4,
        "text-anchor": "middle",
        "font-size": 17, "font-weight": "600",
        text: label,
      }, g);
    }
    return g;
  }

  // Plain connector line, NO arrowhead — for short links between boxes
  // where the direction is already obvious from layout.  Very subtle.
  function thread(svg, x1, y1, x2, y2) {
    return svgEl("path", {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      stroke: "rgba(255,255,255,0.18)", "stroke-width": 0.8, fill: "none",
    }, svg);
  }

  function setBlockOn(id, color) {
    const svg = document.getElementById("full-svg");
    const g = svg.querySelector("#" + id);
    if (!g) return;
    const rect = g.querySelector("rect");
    if (rect) {
      rect.style.transition = "fill 350ms, stroke 350ms";
      rect.style.fill = color || "rgba(255,84,112,0.15)";
      rect.style.stroke = color ? color.replace("0.15", "0.6") : "var(--accent)";
      rect.style.strokeWidth = "2";
    }
  }
  function clearBlock(id) {
    const svg = document.getElementById("full-svg");
    const g = svg.querySelector("#" + id);
    if (!g) return;
    const rect = g.querySelector("rect");
    if (rect) {
      rect.style.fill = "";
      rect.style.stroke = "";
      rect.style.strokeWidth = "";
    }
  }
  function clearAll() {
    ["enc-emb","enc-outer","enc-sa","enc-ff","enc-out",
     "dec-emb","dec-outer","dec-msa","dec-cross","dec-ff","dec-linear","dec-pred",
    ].forEach(s => clearBlock("arch-" + s));
  }

  // pulse a single block briefly
  async function pulseBlock(id, color, ms = 450) {
    setBlockOn(id, color);
    await delay(ms);
  }

  // Bridge animation showing cross-attention as a round-trip handshake:
  //   Phase A: a purple "Q" particle goes from the decoder cross-attn block
  //            UP to the encoder output (decoder asking the question).
  //   Phase B: an orange "K/V" particle returns from the encoder DOWN to
  //            the decoder cross-attn block (encoder answering).
  // The bridge path is drawn enc -> dec, so phase A walks t: 1->0,
  // and phase B walks t: 0->1.
  async function bridgePulse() {
    const svg = document.getElementById("full-svg");
    const path = svg.querySelector("#arch-bridge");
    if (!path) return;
    const len = path.getTotalLength();

    // Phase A: decoder asks the encoder ("Q" goes up to encoder output)
    const qDot = svgEl("circle", {
      r: 6, fill: "var(--q)",
      "filter": "drop-shadow(0 0 8px rgba(197,168,255,0.9))",
    }, svg);
    // small "Q" label that travels with it
    const qLabel = svgEl("text", {
      "text-anchor": "middle", "font-size": 13, "font-weight": "800",
      fill: "var(--q)", text: "Q",
    }, svg);
    await interruptibleAnim(700, t => {
      // walk from decoder side (t=1) up to encoder side (t=0)
      const p = path.getPointAtLength((1 - t) * len);
      qDot.setAttribute("cx", p.x);
      qDot.setAttribute("cy", p.y);
      qLabel.setAttribute("x", p.x);
      qLabel.setAttribute("y", p.y - 12);
    });
    qDot.remove(); qLabel.remove();

    // Brief pause: encoder "looks up" K/V
    await delay(180);

    // Phase B: encoder returns K/V to the decoder cross-attn block
    const kvDot = svgEl("circle", {
      r: 6, fill: "var(--k)",
      "filter": "drop-shadow(0 0 8px rgba(255,182,115,0.9))",
    }, svg);
    const kvLabel = svgEl("text", {
      "text-anchor": "middle", "font-size": 13, "font-weight": "800",
      fill: "var(--k)", text: "K, V",
    }, svg);
    await interruptibleAnim(700, t => {
      const p = path.getPointAtLength(t * len);
      kvDot.setAttribute("cx", p.x);
      kvDot.setAttribute("cy", p.y);
      kvLabel.setAttribute("x", p.x);
      kvLabel.setAttribute("y", p.y - 12);
    });
    kvDot.remove(); kvLabel.remove();
  }

  // pulse all source tokens at once
  function lightTokens(side, count) {
    const svg = document.getElementById("full-svg");
    SRC.forEach((_, i) => {
      const el = svg.querySelector(`#arch-${side}-tok-${i}`);
      if (!el) return;
      el.style.transition = "opacity 350ms";
      el.style.opacity = i < count ? 1 : 0.2;
    });
  }
  function lightTgtTokens(count) {
    const svg = document.getElementById("full-svg");
    TGT.forEach((_, i) => {
      const el = svg.querySelector(`#arch-dec-tok-${i}`);
      if (!el) return;
      el.style.transition = "opacity 350ms";
      el.style.opacity = i < count ? 1 : 0.2;
    });
  }

  async function runEncoderPass() {
    const svg = document.getElementById("full-svg");
    const cap = document.getElementById("full-narration");
    setActiveStep("full-steps", 0);
    if (cap) cap.innerHTML = `<span class="step-tag">Encoder</span> All 4 English tokens are processed <em>at the same time</em>: embedding → self-attention → feed forward. Fast & parallel.`;

    lightTokens("enc", SRC.length);
    await pulseBlock("arch-enc-emb",  "rgba(255,182,115,0.25)", 400);
    await pulseBlock("arch-enc-sa",   "rgba(255,182,115,0.35)", 500);
    await pulseBlock("arch-enc-ff",   "rgba(255,182,115,0.35)", 500);
    setBlockOn("arch-enc-out", "rgba(255,182,115,0.45)");
    await delay(300);
  }

  async function runDecoderStep(stepIdxLocal) {
    const cap = document.getElementById("full-narration");
    const out = document.getElementById("full-output");
    const svg = document.getElementById("full-svg");

    setActiveStep("full-steps", stepIdxLocal + 1);
    if (cap) cap.innerHTML = `<span class="step-tag">Decoder · word ${stepIdxLocal + 1}</span> Read what's written so far → look back at the English (cross-attention) → predict next German word: <b>${TGT[stepIdxLocal]}</b>.`;

    // tokens visible: all generated so far, plus the START at index 0 (we treat tokens shown = stepIdxLocal+1 because START is implicit)
    lightTgtTokens(stepIdxLocal);

    // pulse decoder pipeline
    await pulseBlock("arch-dec-emb",   "rgba(197,168,255,0.25)", 350);
    await pulseBlock("arch-dec-msa",   "rgba(197,168,255,0.35)", 400);

    // cross-attention: bridge particle
    setBlockOn("arch-dec-cross", "rgba(255,84,112,0.25)");
    await bridgePulse();
    await delay(150);

    await pulseBlock("arch-dec-ff",     "rgba(197,168,255,0.35)", 350);
    await pulseBlock("arch-dec-linear", "rgba(255,84,112,0.30)", 350);

    // Reveal predicted token
    setBlockOn("arch-dec-pred", "rgba(255,84,112,0.45)");
    const predText = svg.querySelector("#arch-pred-text");
    predText.textContent = TGT[stepIdxLocal];
    predText.setAttribute("fill", "var(--accent)");
    await delay(500);

    // Add the predicted token to the output sentence
    out.textContent = TGT.slice(0, stepIdxLocal + 1).join(" ");

    // Make this decoder token visible at the bottom now
    lightTgtTokens(stepIdxLocal + 1);

    // Reset cross-attn / linear / pred for next step
    await delay(300);
    clearBlock("arch-dec-cross");
    clearBlock("arch-dec-linear");
    clearBlock("arch-dec-emb");
    clearBlock("arch-dec-msa");
    clearBlock("arch-dec-ff");
  }

  function reset() {
    clearAll();
    document.getElementById("full-output").textContent = "—";
    const predResetEl = document.getElementById("arch-pred-text");
    if (predResetEl) {
      predResetEl.textContent = "(waiting)";
      predResetEl.setAttribute("fill", "var(--ink-soft)");
    }
    lightTokens("enc", 0);
    lightTgtTokens(0);
  }

  function buildSteps() {
    const steps = [
      // Step 0: encoder pass
      async () => { await runEncoderPass(); },
    ];
    // Steps 1..N: each decoder step
    for (let i = 0; i < TGT.length; i++) {
      steps.push(async () => { await runDecoderStep(i); });
    }
    // Done banner is handled inside the last decoder step's runDecoderStep,
    // so no separate finalize step needed.
    return steps;
  }

  const STEPS = [
    "Encoder reads English",
    "Generate \"Ich\"",
    "Generate \"mag\"",
    "Generate \"schwarzen\"",
    "Generate \"Kaffee\"",
  ];

  let nav = null;
  const play     = (end) => nav && nav.play(end);
  const goToStep = (idx) => nav && nav.goToStep(idx);

  function init() {
    build();
    nav = makeStepNavigator({
      stepsFn: buildSteps,
      reset:   reset,
      listId:  "full-steps",
      animKey: "full",
    });
    setupStepList("full-steps", STEPS, (i) => goToStep(i));
    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.full = () => play();
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.full = () => play();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
