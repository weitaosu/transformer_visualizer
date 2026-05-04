/* §6 Cross-Attention.
 * Encoder K/V at top, decoder input prefix at bottom, predicted-output row below.
 * After each decoder step:
 *   1. cross-attention edges fan up to encoder
 *   2. predicted German word fills the output slot under that decoder
 *   3. a green "feedback" arrow loops the predicted word back to the NEXT
 *      decoder position's input — visualizing autoregressive generation.
 */

(function () {
  const ENC = ["I", "like", "black", "coffee"];
  const DEC = ["<START>", "Ich", "mag", "schwarzen"];
  const OUT = ["Ich", "mag", "schwarzen", "Kaffee"]; // what each decoder step produces
  const ATTN = [
    [0.30, 0.25, 0.20, 0.25],   // <START>
    [0.78, 0.12, 0.06, 0.04],   // Ich -> I
    [0.10, 0.74, 0.10, 0.06],   // mag -> like
    [0.05, 0.10, 0.78, 0.07],   // schwarzen -> black
  ];

  const W = 1200, H = 520;
  const ENC_Y = 95;       // center y of encoder boxes
  const DEC_Y = 290;      // center y of decoder boxes
  const OUT_Y = 400;      // center y of output boxes
  const ENC_W = 130, ENC_H = 44;
  const DEC_W = 130, DEC_H = 44;
  const OUT_W = 130, OUT_H = 38;

  function build() {
    const svg = document.getElementById("cross-svg");
    if (!svg) return;
    svg.innerHTML = "";

    // arrow marker for feedback arrows
    const defs = svgEl("defs", {}, svg);
    const fbMarker = svgEl("marker", { id: "fb-arrow",
      markerWidth: 9, markerHeight: 9, refX: 7, refY: 4.5, orient: "auto" }, defs);
    svgEl("polygon", { points: "0 0, 9 4.5, 0 9", fill: "#5fcf90" }, fbMarker);

    // section labels
    svgEl("text", { x: W/2, y: 28, "text-anchor": "middle", "font-size": 19, "font-weight": "700",
      fill: "var(--k)", text: "Encoder output  ·  provides Keys & Values" }, svg);
    svgEl("text", { x: W/2, y: H - 12, "text-anchor": "middle", "font-size": 19, "font-weight": "700",
      fill: "var(--q)", text: "Decoder  ·  takes the prefix as Queries (autoregressive)" }, svg);

    const encSpacing = 220, encStart = (W - (ENC.length - 1) * encSpacing) / 2;
    const decSpacing = 220, decStart = (W - (DEC.length - 1) * decSpacing) / 2;

    // encoder tokens
    ENC.forEach((t, i) => {
      const x = encStart + i * encSpacing;
      const g = svgEl("g", { transform: `translate(${x - ENC_W/2}, ${ENC_Y - ENC_H/2})`, id: `cross-enc-${i}` }, svg);
      svgEl("rect", { x: 0, y: 0, width: ENC_W, height: ENC_H, rx: 8,
        fill: "rgba(255,182,115,0.18)", stroke: "var(--k)", "stroke-width": 1.5 }, g);
      svgEl("text", { x: ENC_W/2, y: ENC_H/2 + 6, "text-anchor": "middle",
        "font-weight": "700", "font-size": 20, text: t }, g);
    });

    // decoder tokens (input prefix)
    DEC.forEach((t, i) => {
      const x = decStart + i * decSpacing;
      const g = svgEl("g", { transform: `translate(${x - DEC_W/2}, ${DEC_Y - DEC_H/2})`, id: `cross-dec-${i}`, opacity: 0.4 }, svg);
      svgEl("rect", { x: 0, y: 0, width: DEC_W, height: DEC_H, rx: 8,
        fill: "rgba(197,168,255,0.14)", stroke: "var(--q)", "stroke-width": 1.5 }, g);
      svgEl("text", { x: DEC_W/2, y: DEC_H/2 + 6, "text-anchor": "middle",
        "font-weight": "700", "font-size": 20, text: t }, g);
    });

    // small "Q" labels above each decoder box
    DEC.forEach((_, i) => {
      const x = decStart + i * decSpacing;
      svgEl("text", { x, y: DEC_Y - DEC_H/2 - 8, "text-anchor": "middle",
        "font-size": 12, "font-weight": "700", fill: "var(--q)",
        text: "Q",
      }, svg);
    });

    // output slot below each decoder box (initially "?", filled by animation)
    DEC.forEach((_, i) => {
      const x = decStart + i * decSpacing;
      const g = svgEl("g", { transform: `translate(${x - OUT_W/2}, ${OUT_Y - OUT_H/2})`, id: `cross-out-${i}`, opacity: 0.35 }, svg);
      svgEl("rect", { x: 0, y: 0, width: OUT_W, height: OUT_H, rx: 8,
        fill: "rgba(255,84,112,0.10)", stroke: "var(--accent)", "stroke-width": 1.5,
        "stroke-dasharray": "4 3",
        id: `cross-out-rect-${i}`,
      }, g);
      svgEl("text", { x: OUT_W/2, y: OUT_H/2 + 6, "text-anchor": "middle",
        "font-weight": "700", "font-size": 20, fill: "var(--ink-soft)",
        id: `cross-out-text-${i}`,
        text: "?" }, g);
      // small "predicted" label above the slot
      svgEl("text", { x, y: OUT_Y - OUT_H/2 - 6, "text-anchor": "middle",
        "font-size": 11, "font-weight": "700", fill: "var(--accent)",
        text: "PREDICTED",
      }, svg);
    });

    // small downward arrow from each decoder to its output slot
    DEC.forEach((_, i) => {
      const x = decStart + i * decSpacing;
      svgEl("path", {
        d: `M ${x} ${DEC_Y + DEC_H/2} L ${x} ${OUT_Y - OUT_H/2 - 4}`,
        stroke: "rgba(255,84,112,0.4)",
        "stroke-width": 1.5,
        fill: "none",
        id: `cross-down-${i}`,
        opacity: 0.4,
      }, svg);
    });

    // pre-create cross-attention edges (decoder Q → encoder K/V), hidden
    DEC.forEach((_, di) => {
      const dx = decStart + di * decSpacing;
      ENC.forEach((_, ei) => {
        const ex = encStart + ei * encSpacing;
        svgEl("path", {
          d: `M ${dx} ${DEC_Y - DEC_H/2} C ${dx} ${(ENC_Y + DEC_Y)/2}, ${ex} ${(ENC_Y + DEC_Y)/2}, ${ex} ${ENC_Y + ENC_H/2}`,
          stroke: "var(--accent)",
          "stroke-width": 1 + 4 * ATTN[di][ei],
          fill: "none",
          opacity: 0,
          id: `cross-edge-${di}-${ei}`,
        }, svg);
      });
    });

    // pre-create autoregressive feedback arrows: output[i] → decoder[i+1].
    // Path: leaves the right edge of output[di], arcs up-and-over, lands
    // pointing INTO the top of decoder[di+1] (arrow tip touches the box).
    for (let di = 0; di < DEC.length - 1; di++) {
      const x0 = decStart + di * decSpacing;        // center of output[di]
      const x1 = decStart + (di + 1) * decSpacing;  // center of decoder[di+1]

      // Source: right side of output[di] (where it "exits")
      const srcX = x0 + OUT_W / 2;
      const srcY = OUT_Y;                            // mid-height of output box
      // Destination: just above the top edge of decoder[di+1] so the marker
      // arrowhead's tip visually touches the box.
      const dstX = x1;
      const dstY = DEC_Y - DEC_H / 2 - 2;

      // S-curve passing through the gap between output[di] and decoder[di+1].
      const c1x = srcX + 70;
      const c1y = srcY;
      const c2x = dstX - 70;
      const c2y = dstY + 40;

      svgEl("path", {
        d: `M ${srcX} ${srcY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${dstX} ${dstY}`,
        stroke: "#5fcf90",
        "stroke-width": 2.4,
        fill: "none",
        opacity: 0,
        "marker-end": "url(#fb-arrow)",
        "stroke-dasharray": "7 5",
        id: `cross-fb-${di}`,
      }, svg);
      // "feeds back as next input" label, placed near the arc apex
      svgEl("text", {
        x: (srcX + dstX) / 2,
        y: (srcY + dstY) / 2 + 18,
        "text-anchor": "middle",
        "font-size": 12, "font-weight": "700", fill: "#5fcf90",
        id: `cross-fb-label-${di}`, opacity: 0,
        text: "feeds back as next input",
      }, svg);
    }

    // hint label (cleared during play)
    svgEl("text", { x: W/2, y: (ENC_Y + DEC_Y)/2, "text-anchor": "middle",
      "font-size": 16, fill: "rgba(255,255,255,0.35)",
      id: "cross-mid-label",
      text: "▶ click play to watch each German word be generated"  }, svg);
  }

  function reset() {
    const svg = document.getElementById("cross-svg");
    if (!svg) return;
    DEC.forEach((_, di) => {
      svg.querySelector(`#cross-dec-${di}`).style.transition = "none";
      svg.querySelector(`#cross-dec-${di}`).style.opacity = 0.4;
      svg.querySelector(`#cross-out-${di}`).style.opacity = 0.35;
      const tEl = svg.querySelector(`#cross-out-text-${di}`);
      tEl.textContent = "?";
      tEl.setAttribute("fill", "var(--ink-soft)");
      const rEl = svg.querySelector(`#cross-out-rect-${di}`);
      rEl.setAttribute("stroke-dasharray", "4 3");
      rEl.style.fill = "rgba(255,84,112,0.10)";
      ENC.forEach((_, ei) => {
        const e = svg.querySelector(`#cross-edge-${di}-${ei}`);
        e.style.transition = "none";
        e.style.opacity = 0;
        e.style.strokeDasharray = "";
        e.style.strokeDashoffset = "";
      });
      const fb = svg.querySelector(`#cross-fb-${di}`);
      const fbL = svg.querySelector(`#cross-fb-label-${di}`);
      if (fb) {
        fb.style.transition = "none";
        fb.style.opacity = 0;
        fb.style.strokeDashoffset = "";   // clear any flow offset from prev run
      }
      if (fbL) fbL.style.opacity = 0;
    });
    svg.querySelector("#cross-mid-label").textContent = "";
  }

  const HINTS = [
    `<span class="step-tag">Step 1 / 4</span> The decoder starts with just <b>&lt;START&gt;</b>. It looks broadly at the English. The model predicts the first German word: <b>"Ich"</b>.`,
    `<span class="step-tag">Step 2 / 4</span> "Ich" feeds back in. Now position 2's query attends to the English <b>"like"</b>, and predicts <b>"mag"</b>.`,
    `<span class="step-tag">Step 3 / 4</span> "mag" feeds back. Position 3's query attends to <b>"black"</b>, predicting <b>"schwarzen"</b>.`,
    `<span class="step-tag">Step 4 / 4</span> "schwarzen" feeds back. Position 4 attends to <b>"coffee"</b>, predicting the final word: <b>"Kaffee"</b>.`,
  ];

  function buildSteps() {
    const svg = document.getElementById("cross-svg");
    const cap = document.getElementById("cross-narration");

    function makeDecStep(di) {
      return async () => {
        setActiveStep("cross-steps", di);

        // dim previous decoder steps' edges
        for (let prevDi = 0; prevDi < di; prevDi++) {
          ENC.forEach((_, ei) => {
            const e = svg.querySelector(`#cross-edge-${prevDi}-${ei}`);
            e.style.transition = "opacity 400ms";
            e.style.opacity = 0.06;
          });
        }

        // light up this decoder token
        svg.querySelector(`#cross-dec-${di}`).style.transition = "opacity 350ms";
        svg.querySelector(`#cross-dec-${di}`).style.opacity = 1;
        if (cap) cap.innerHTML = HINTS[di] + ` &nbsp;<span style="color:var(--ink-soft)">(Q from decoder, K & V from encoder.)</span>`;
        await delay(400);

        // animate cross-attention edges
        const order = ENC.map((_, i) => i).sort((a, b) => ATTN[di][a] - ATTN[di][b]);
        for (const ei of order) {
          const e = svg.querySelector(`#cross-edge-${di}-${ei}`);
          e.style.opacity = 0.2 + 0.8 * ATTN[di][ei];
          await drawAnimated(e, 400);
        }
        await delay(400);

        // fill in the output box for this decoder position
        const outG    = svg.querySelector(`#cross-out-${di}`);
        const outRect = svg.querySelector(`#cross-out-rect-${di}`);
        const outText = svg.querySelector(`#cross-out-text-${di}`);
        outG.style.transition = "opacity 350ms";
        outG.style.opacity = 1;
        outRect.setAttribute("stroke-dasharray", "");        // make solid
        outRect.style.transition = "fill 350ms";
        outRect.style.fill = "rgba(255,84,112,0.25)";
        outText.textContent = OUT[di];
        outText.setAttribute("fill", "#fff");
        await delay(700);

        // draw the autoregressive feedback arrow to next position (if not last)
        if (di < DEC.length - 1) {
          const fb = svg.querySelector(`#cross-fb-${di}`);
          const fbL = svg.querySelector(`#cross-fb-label-${di}`);

          // 1) Reveal the arrow line itself
          fb.style.transition = "opacity 200ms";
          fb.style.opacity = 1;
          await drawAnimated(fb, 700);

          // 2) Make dashes flow CONTINUOUSLY along the arrow (visually alive)
          const stopFlow = startFlowingDashes(fb, 90);

          // 3) Pulse the source endpoint (right edge of output box) — matches
          //    where the new feedback arrow actually starts.
          const sourceX = decStart + di * decSpacing + OUT_W / 2;
          const pulseSrc = svgEl("circle", {
            cx: sourceX, cy: OUT_Y, r: 5, fill: "#5fcf90",
            "filter": "drop-shadow(0 0 8px #5fcf90)",
          }, svg);

          // Show the label
          fbL.style.transition = "opacity 350ms";
          fbL.style.opacity = 1;

          // 4) Send THREE staggered particles racing along the path
          await Promise.all([
            sendParticleAlongPath(svg, fb, "#5fcf90", 900, 7),
            delay(220).then(() => sendParticleAlongPath(svg, fb, "#5fcf90", 900, 6)),
            delay(440).then(() => sendParticleAlongPath(svg, fb, "#5fcf90", 900, 5)),
          ]);

          // 5) Pulse the destination — at the top edge of decoder[di+1],
          //    where the arrowhead actually lands.
          const destX = decStart + (di + 1) * decSpacing;
          const destY = DEC_Y - DEC_H/2 - 2;
          const pulseDst = svgEl("circle", {
            cx: destX, cy: destY, r: 4, fill: "#5fcf90",
            "filter": "drop-shadow(0 0 10px #5fcf90)",
            opacity: 0,
          }, svg);
          pulseDst.style.transition = "opacity 220ms, r 260ms";
          await delay(40);
          pulseDst.style.opacity = 1;
          pulseDst.setAttribute("r", 11);
          await delay(280);
          pulseDst.style.opacity = 0;
          await delay(220);
          pulseDst.remove();
          pulseSrc.remove();

          // 6) Stop the dashes flow but leave the static dashed arrow visible
          stopFlow();
          await delay(100);
        }
      };
    }

    return [makeDecStep(0), makeDecStep(1), makeDecStep(2), makeDecStep(3)];
  }

  const STEPS = [
    "<START> → predict \"Ich\"",
    "Ich → predict \"mag\"",
    "mag → predict \"schwarzen\"",
    "schwarzen → predict \"Kaffee\"",
  ];

  let nav = null;
  const play     = (end) => nav && nav.play(end);
  const goToStep = (idx) => nav && nav.goToStep(idx);

  function init() {
    build();
    nav = makeStepNavigator({
      stepsFn: buildSteps,
      reset:   reset,
      listId:  "cross-steps",
      animKey: "cross",
    });
    setupStepList("cross-steps", STEPS, (i) => goToStep(i));
    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.cross = () => play();
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.cross = () => play();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
