/* Slide 1 — "The Problem".
 *
 * Shows the classic ambiguity sentence:
 *   "The animal didn't cross the street because IT was too tired."
 *
 * Animation:
 *   1. Sentence appears word by word.
 *   2. The word "it" highlights with a question mark.
 *   3. Two candidate referents glow: "animal" and "street".
 *   4. A wrong arrow goes "it" → "street" (red, marked X)
 *   5. A correct arrow goes "it" → "animal" (green, big check)
 *   6. Final caption: "Attention lets the model figure out which word IT refers to."
 */

(function () {
  const SENTENCE = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "too", "tired."];
  const IT_IDX = 7;
  const ANIMAL_IDX = 1;
  const STREET_IDX = 5;

  let activeRun = null;

  function build() {
    const svg = document.getElementById("problem-svg");
    if (!svg) return;
    svg.innerHTML = "";

    const W = 1200, H = 460;

    // Sentence layout — single line centered horizontally near the middle
    const tokenY = 280;
    let pen = 60;
    const tokens = SENTENCE.map((w, i) => {
      const widthGuess = 14 + 11 * w.length;
      const g = svgEl("g", {
        id: `prob-w-${i}`,
        transform: `translate(${pen}, ${tokenY})`,
        opacity: 0,
      }, svg);
      svgEl("rect", { x: 0, y: 0, width: widthGuess, height: 44, rx: 8, class: "token-box" }, g);
      svgEl("text", { x: widthGuess/2, y: 28, "text-anchor": "middle", "font-weight": "700", "font-size": 19, text: w }, g);
      const ret = { x: pen, w: widthGuess };
      pen += widthGuess + 12;
      return ret;
    });
    // center the sentence
    const totalWidth = pen - 12 - 60;
    const offset = (W - totalWidth) / 2 - 60;
    SENTENCE.forEach((w, i) => {
      const g = svg.querySelector(`#prob-w-${i}`);
      const x = parseFloat(g.getAttribute("transform").match(/translate\(([\d.]+)/)[1]);
      g.setAttribute("transform", `translate(${x + offset}, ${tokenY})`);
      tokens[i].x += offset;
    });

    // Big "?" bubble that will appear above "it"
    const itTok = tokens[IT_IDX];
    const qg = svgEl("g", { id: "prob-question", transform: `translate(${itTok.x + itTok.w/2}, ${tokenY - 50})`, opacity: 0 }, svg);
    svgEl("circle", { cx: 0, cy: 0, r: 22, fill: "var(--accent)", opacity: 0.85 }, qg);
    svgEl("text", { x: 0, y: 8, "text-anchor": "middle", "font-size": 28, "font-weight": "800", fill: "#fff", text: "?" }, qg);

    // Arrows from "it" back to candidate referents
    function bezier(x1, y1, x2, y2) {
      const cx = (x1 + x2) / 2;
      const dy = Math.min(y1, y2) - 90;
      return `M ${x1} ${y1} Q ${cx} ${dy}, ${x2} ${y2}`;
    }
    const itX = itTok.x + itTok.w/2, itY = tokenY;
    const animalTok = tokens[ANIMAL_IDX];
    const streetTok = tokens[STREET_IDX];

    // Wrong arrow (street)
    const wrongPath = svgEl("path", {
      id: "prob-wrong-arrow",
      d: bezier(itX, itY, streetTok.x + streetTok.w/2, tokenY),
      stroke: "#ff5470", "stroke-width": 3, fill: "none", opacity: 0,
      "stroke-dasharray": "8 4",
    }, svg);
    // X marker for wrong
    svgEl("text", { id: "prob-wrong-x", x: (itX + streetTok.x + streetTok.w/2)/2, y: tokenY - 80,
      "text-anchor": "middle", "font-size": 28, "font-weight": "800", fill: "#ff5470", opacity: 0, text: "✗" }, svg);

    // Right arrow (animal)
    const rightPath = svgEl("path", {
      id: "prob-right-arrow",
      d: bezier(itX, itY, animalTok.x + animalTok.w/2, tokenY),
      stroke: "#5fcf90", "stroke-width": 4, fill: "none", opacity: 0,
    }, svg);
    svgEl("text", { id: "prob-right-check", x: (itX + animalTok.x + animalTok.w/2)/2, y: tokenY - 80,
      "text-anchor": "middle", "font-size": 28, "font-weight": "800", fill: "#5fcf90", opacity: 0, text: "✓" }, svg);

    // Top narration text (within SVG so it sits inside the stage)
    svgEl("text", { id: "prob-narration",
      x: W/2, y: 80,
      "text-anchor": "middle",
      "font-size": 26, "font-weight": "600",
      fill: "#fff",
      text: "",
    }, svg);

    // Bottom hint
    svgEl("text", { id: "prob-hint",
      x: W/2, y: 410,
      "text-anchor": "middle",
      "font-size": 19, "font-weight": "500",
      fill: "var(--ink-soft)",
      text: "",
    }, svg);
  }

  function setText(id, t) {
    const el = document.getElementById(id) || document.querySelector(`#problem-svg #${id}`);
    if (el) el.textContent = t;
  }

  function reset() {
    const svg = document.getElementById("problem-svg");
    if (!svg) return;
    SENTENCE.forEach((_, i) => {
      const g = svg.querySelector(`#prob-w-${i}`);
      g.style.transition = "none";
      g.style.opacity = 0;
      const rect = g.querySelector("rect");
      rect.style.transition = "none";
      rect.style.fill = "rgba(255,255,255,0.05)";
      rect.style.stroke = "var(--ink-soft)";
      rect.style.strokeWidth = "1";
    });
    svg.querySelector("#prob-question").style.opacity = 0;
    svg.querySelector("#prob-wrong-arrow").style.opacity = 0;
    svg.querySelector("#prob-wrong-x").style.opacity = 0;
    svg.querySelector("#prob-right-arrow").style.opacity = 0;
    svg.querySelector("#prob-right-check").style.opacity = 0;
    svg.querySelector("#prob-narration").textContent = "";
    svg.querySelector("#prob-hint").textContent = "";
  }

  function buildSteps() {
    const svg = document.getElementById("problem-svg");
    return [
      // 1. Words appear
      async () => {
        setActiveStep("problem-steps", 0);
        svg.querySelector("#prob-narration").textContent = `"The animal didn't cross the street because it was too tired."`;
        for (let i = 0; i < SENTENCE.length; i++) {
          const g = svg.querySelector(`#prob-w-${i}`);
          g.style.transition = "opacity 200ms";
          g.style.opacity = 1;
          await delay(80);
        }
        await delay(700);
      },
      // 2. Highlight "it" and ask the question
      async () => {
        setActiveStep("problem-steps", 1);
        const itG = svg.querySelector(`#prob-w-${IT_IDX}`);
        const r = itG.querySelector("rect");
        r.style.transition = "fill 350ms, stroke 350ms";
        r.style.fill = "rgba(255,84,112,0.25)";
        r.style.stroke = "var(--accent)";
        r.style.strokeWidth = "2.5";

        svg.querySelector("#prob-question").style.transition = "opacity 350ms";
        svg.querySelector("#prob-question").style.opacity = 1;

        svg.querySelector("#prob-narration").textContent = `What does "it" refer to?`;
        await delay(1200);
      },
      // 3. Show the wrong guess: it → street
      async () => {
        setActiveStep("problem-steps", 2);
        svg.querySelector("#prob-hint").textContent = `Could "it" mean the street?`;
        const wp = svg.querySelector("#prob-wrong-arrow");
        wp.style.opacity = 1;
        await drawAnimated(wp, 600);
        // street briefly highlights
        const sg = svg.querySelector(`#prob-w-${STREET_IDX}`);
        const sr = sg.querySelector("rect");
        sr.style.transition = "fill 250ms, stroke 250ms";
        sr.style.fill = "rgba(255,84,112,0.18)";
        sr.style.stroke = "#ff5470";
        await delay(700);
        // show X
        const x = svg.querySelector("#prob-wrong-x");
        x.style.transition = "opacity 350ms";
        x.style.opacity = 1;
        svg.querySelector("#prob-hint").textContent = `No — a street can't be tired.`;
        await delay(1500);

        // fade wrong arrow + X
        wp.style.transition = "opacity 500ms"; wp.style.opacity = 0.15;
        x.style.opacity = 0.4;
        sr.style.fill = "rgba(255,255,255,0.05)";
        sr.style.stroke = "var(--ink-soft)";
      },
      // 4. Show the correct guess: it → animal
      async () => {
        setActiveStep("problem-steps", 3);
        svg.querySelector("#prob-hint").textContent = `Or the animal?`;
        const rp = svg.querySelector("#prob-right-arrow");
        rp.style.opacity = 1;
        await drawAnimated(rp, 700);

        const ag = svg.querySelector(`#prob-w-${ANIMAL_IDX}`);
        const ar = ag.querySelector("rect");
        ar.style.transition = "fill 250ms, stroke 250ms";
        ar.style.fill = "rgba(95,207,144,0.25)";
        ar.style.stroke = "#5fcf90";
        ar.style.strokeWidth = "2.5";
        await delay(700);

        const c = svg.querySelector("#prob-right-check");
        c.style.transition = "opacity 350ms";
        c.style.opacity = 1;
        svg.querySelector("#prob-hint").textContent = `Yes — animals get tired. "It" refers to "animal".`;
        await delay(1500);
      },
      // 5. Conclusion
      async () => {
        setActiveStep("problem-steps", 4);
        svg.querySelector("#prob-narration").textContent = `To understand any word, look at the others.`;
        svg.querySelector("#prob-hint").textContent = `That's exactly what attention does — automatically, for every word.`;
      },
    ];
  }

  let nav = null;
  const play     = (end) => nav && nav.play(end);
  const goToStep = (idx) => nav && nav.goToStep(idx);

  const STEPS = [
    "Read the sentence",
    "Spot the ambiguous word",
    "Try \"street\" — wrong",
    "Try \"animal\" — right",
    "Conclusion",
  ];

  function init() {
    build();
    nav = makeStepNavigator({
      stepsFn: buildSteps,
      reset: reset,
      listId: "problem-steps",
      animKey: "problem",
    });
    setupStepList("problem-steps", STEPS, (i) => goToStep(i));
    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.problem = () => play();
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.problem = () => play();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
