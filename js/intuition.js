/* Slide 2 — "The Intuition: a fuzzy YouTube search".
 *
 * Concrete metaphor:
 *   - The "searcher" word (e.g. "black") types a QUERY:  "what describes me?"
 *   - Other words advertise what they ARE  -> their KEY:   "I'm a noun-food", "I'm an article", etc.
 *   - The match score for each (query · key) decides how loud each word's VALUE is heard.
 *   - The output is the VALUES blended by the match scores.
 *
 * Animation:
 *   1. Show the sentence "I like black coffee".
 *   2. Highlight "black" and show its query bubble: "looking for: thing I describe"
 *   3. Each other word lights up with a "key" tag describing what it is.
 *   4. Match meter for each pair fills (low for I/like, high for coffee).
 *   5. Each word's "value" badge slides into a blender, sized by its match strength.
 *   6. Output: "black + lots of coffee → a coffee-flavored 'black'."
 */

(function () {
  // Word, KEY meaning, VALUE meaning, match strength (against "black"'s query)
  const WORDS = [
    { word: "I",      key: "[pronoun · subject]",       value: "speaker",      match: 0.10 },
    { word: "like",   key: "[verb · preference]",       value: "preference",   match: 0.18 },
    { word: "black",  key: "[adjective · color]",       value: "color",        match: 0.07 },
    { word: "coffee", key: "[noun · drink/food]",       value: "drink",        match: 0.65 },
  ];
  const QUERIER = 2; // "black" is the searcher

  let activeRun = null;

  function build() {
    const svg = document.getElementById("intuition-svg");
    if (!svg) return;
    svg.innerHTML = "";

    const W = 1200, H = 460;

    // Top: full sentence
    const tokenY = 70;
    const wordW = 110, wordSpacing = 130;
    const startX = (W - (WORDS.length - 1) * wordSpacing) / 2 - wordW/2;
    WORDS.forEach((W_, i) => {
      const x = startX + i * wordSpacing;
      const g = svgEl("g", { id: `int-w-${i}`, transform: `translate(${x}, ${tokenY})` }, svg);
      svgEl("rect", { x: 0, y: 0, width: wordW, height: 40, rx: 8, class: "token-box" }, g);
      svgEl("text", { x: wordW/2, y: 26, "text-anchor": "middle", "font-weight": "700", "font-size": 19, text: W_.word }, g);
    });

    // Querier's query bubble (sits ABOVE "black", inside viewBox top)
    const qx = startX + QUERIER * wordSpacing + wordW/2;
    const bubW = 420, bubH = 52;
    const qbubble = svgEl("g", { id: "int-query-bubble", opacity: 0, transform: `translate(${qx - bubW/2}, 8)` }, svg);
    svgEl("rect", { x: 0, y: 0, width: bubW, height: bubH, rx: 10,
      fill: "rgba(197,168,255,0.18)", stroke: "var(--q)", "stroke-width": 1.5 }, qbubble);
    svgEl("text", { x: bubW/2, y: 19, "text-anchor": "middle",
      "font-size": 16, "font-weight": "800", fill: "var(--q)",
      text: "QUERY  ·  what is 'black' looking for?" }, qbubble);
    svgEl("text", { x: bubW/2, y: 41, "text-anchor": "middle",
      "font-size": 19, "font-weight": "600", fill: "#fff",
      text: "\"a thing I describe (a noun)\"" }, qbubble);
    // pointer triangle pointing down to "black"
    svgEl("path", { d: `M ${bubW/2 - 5} ${bubH} L ${bubW/2 + 5} ${bubH} L ${bubW/2} ${bubH + 8} Z`, fill: "var(--q)" }, qbubble);

    // Per-word: key tag (below word), match bar, value chip
    const matchY = 220;
    const valueY = 320;

    WORDS.forEach((W_, i) => {
      const x = startX + i * wordSpacing;
      const cx = x + wordW/2;

      // KEY tag
      const kg = svgEl("g", { id: `int-key-${i}`, opacity: 0, transform: `translate(${x - 10}, 130)` }, svg);
      svgEl("rect", { x: 0, y: 0, width: wordW + 20, height: 28, rx: 6,
        fill: "rgba(255,182,115,0.18)", stroke: "var(--k)", "stroke-width": 1 }, kg);
      svgEl("text", { x: (wordW+20)/2, y: 18, "text-anchor": "middle",
        "font-size": 16, "font-weight": "700", fill: "var(--k)",
        text: "KEY" }, kg);
      // key tag text below
      svgEl("text", { x: cx, y: 174, "text-anchor": "middle",
        "font-size": 16, "font-weight": "500", fill: "var(--ink-soft)",
        id: `int-key-text-${i}`, opacity: 0,
        text: W_.key }, svg);

      // MATCH meter (thin bar)
      const mg = svgEl("g", { id: `int-match-${i}`, opacity: 0, transform: `translate(${x - 10}, ${matchY})` }, svg);
      svgEl("rect", { x: 0, y: 0, width: wordW + 20, height: 14, rx: 3,
        fill: "rgba(255,255,255,0.08)" }, mg);
      svgEl("rect", { x: 0, y: 0, width: 0, height: 14, rx: 3,
        fill: "var(--accent)",
        id: `int-match-fill-${i}` }, mg);
      svgEl("text", { x: (wordW+20)/2, y: 30, "text-anchor": "middle",
        "font-size": 16, "font-weight": "700", fill: "#fff",
        id: `int-match-text-${i}`,
        text: "0%" }, mg);
      svgEl("text", { x: (wordW+20)/2, y: 46, "text-anchor": "middle",
        "font-size": 10, "font-weight": "500", fill: "var(--ink-soft)",
        text: "match" }, mg);

      // VALUE badge
      const vg = svgEl("g", { id: `int-val-${i}`, opacity: 0, transform: `translate(${x - 10}, ${valueY})` }, svg);
      svgEl("rect", { x: 0, y: 0, width: wordW + 20, height: 32, rx: 6,
        fill: "rgba(125,214,163,0.18)", stroke: "var(--v)", "stroke-width": 1 }, vg);
      svgEl("text", { x: (wordW+20)/2, y: 13, "text-anchor": "middle",
        "font-size": 9, "font-weight": "700", fill: "var(--v)", text: "VALUE" }, vg);
      svgEl("text", { x: (wordW+20)/2, y: 26, "text-anchor": "middle",
        "font-size": 16, "font-weight": "600", fill: "#fff",
        text: W_.value }, vg);
    });

    // KEY label gutter
    svgEl("text", { x: startX - 20, y: 144, "text-anchor": "end",
      "font-size": 16, class: "label-soft", id: "int-key-gutter", opacity: 0,
      text: "what each word IS:" }, svg);
    svgEl("text", { x: startX - 20, y: matchY + 12, "text-anchor": "end",
      "font-size": 16, class: "label-soft", id: "int-match-gutter", opacity: 0,
      text: "match strength:" }, svg);
    svgEl("text", { x: startX - 20, y: valueY + 18, "text-anchor": "end",
      "font-size": 16, class: "label-soft", id: "int-val-gutter", opacity: 0,
      text: "info each word carries:" }, svg);

    // Output box (right-bottom)
    const obx = W - 230, oby = valueY - 6;
    const og = svgEl("g", { id: "int-output", opacity: 0, transform: `translate(${obx}, ${oby})` }, svg);
    svgEl("rect", { x: 0, y: 0, width: 200, height: 60, rx: 10,
      fill: "rgba(255,84,112,0.18)", stroke: "var(--accent)", "stroke-width": 1.8 }, og);
    svgEl("text", { x: 100, y: 18, "text-anchor": "middle",
      "font-size": 10, "font-weight": "800", fill: "var(--accent)",
      text: "BLACK's NEW MEANING" }, og);
    svgEl("text", { x: 100, y: 38, "text-anchor": "middle",
      "font-size": 17, "font-weight": "600", fill: "#fff",
      text: "mostly drink-flavored", id: "int-out-line1" }, og);
    svgEl("text", { x: 100, y: 52, "text-anchor": "middle",
      "font-size": 10, "font-weight": "500", fill: "var(--ink-soft)",
      text: "(a coffee-y kind of black)", id: "int-out-line2" }, og);

    // Bottom line: explainer that updates per phase
    svgEl("text", {
      x: W/2, y: 420,
      "text-anchor": "middle",
      "font-size": 19, "font-weight": "500",
      fill: "var(--ink-soft)",
      id: "int-bottom",
      text: "",
    }, svg);
  }

  function reset() {
    const svg = document.getElementById("intuition-svg");
    if (!svg) return;
    WORDS.forEach((_, i) => {
      svg.querySelector(`#int-key-${i}`).style.opacity = 0;
      svg.querySelector(`#int-key-text-${i}`).style.opacity = 0;
      svg.querySelector(`#int-match-${i}`).style.opacity = 0;
      svg.querySelector(`#int-match-fill-${i}`).setAttribute("width", 0);
      svg.querySelector(`#int-match-text-${i}`).textContent = "0%";
      svg.querySelector(`#int-val-${i}`).style.opacity = 0;
      const r = svg.querySelector(`#int-w-${i} rect`);
      r.style.transition = "none";
      r.style.fill = "rgba(255,255,255,0.05)";
      r.style.stroke = "var(--ink-soft)";
      r.style.strokeWidth = "1";
    });
    svg.querySelector("#int-query-bubble").style.opacity = 0;
    svg.querySelector("#int-output").style.opacity = 0;
    ["int-key-gutter","int-match-gutter","int-val-gutter"].forEach(id => svg.querySelector("#" + id).style.opacity = 0);
    svg.querySelector("#int-bottom").textContent = "";
  }

  function buildSteps() {
    const svg = document.getElementById("intuition-svg");
    return [
      // Step 1: highlight "black" as the searcher
      async () => {
        setActiveStep("intuition-steps", 0);
        svg.querySelector("#int-bottom").textContent = `Pretend the word "black" is doing a search to figure out its own meaning.`;
        const r = svg.querySelector(`#int-w-${QUERIER} rect`);
        r.style.transition = "fill 300ms, stroke 300ms";
        r.style.fill = "rgba(197,168,255,0.25)";
        r.style.stroke = "var(--q)";
        r.style.strokeWidth = "2.5";
        await delay(700);
      },
      // Step 2: query bubble
      async () => {
        setActiveStep("intuition-steps", 1);
        const qb = svg.querySelector("#int-query-bubble");
        qb.style.transition = "opacity 400ms";
        qb.style.opacity = 1;
        svg.querySelector("#int-bottom").textContent = `It types its QUERY: "I'm a color — what noun do I describe?"`;
        await delay(1500);
      },
      // Step 3: every word advertises a KEY
      async () => {
        setActiveStep("intuition-steps", 2);
        svg.querySelector("#int-key-gutter").style.transition = "opacity 350ms";
        svg.querySelector("#int-key-gutter").style.opacity = 1;
        svg.querySelector("#int-bottom").textContent = `Every other word advertises a KEY — a label saying what it IS.`;

        for (let i = 0; i < WORDS.length; i++) {
          if (i === QUERIER) continue;  // querier's own key fades in too
          const k = svg.querySelector(`#int-key-${i}`);
          const t = svg.querySelector(`#int-key-text-${i}`);
          k.style.transition = "opacity 250ms";
          t.style.transition = "opacity 250ms";
          k.style.opacity = 1;
          t.style.opacity = 1;
          await delay(160);
        }
        // also show the querier's key (it has one too)
        const k = svg.querySelector(`#int-key-${QUERIER}`);
        const t = svg.querySelector(`#int-key-text-${QUERIER}`);
        k.style.transition = "opacity 250ms";
        t.style.transition = "opacity 250ms";
        k.style.opacity = 0.4;
        t.style.opacity = 0.5;
        await delay(700);
      },
      // Step 4: match strengths
      async () => {
        setActiveStep("intuition-steps", 3);
        svg.querySelector("#int-match-gutter").style.opacity = 1;
        svg.querySelector("#int-match-gutter").style.transition = "opacity 350ms";
        svg.querySelector("#int-bottom").textContent = `The query is compared to each KEY. Best match: "coffee" — a noun, perfect.`;

        for (let i = 0; i < WORDS.length; i++) {
          const m = svg.querySelector(`#int-match-${i}`);
          m.style.transition = "opacity 350ms";
          m.style.opacity = 1;
        }
        await delay(300);

        // animate fills
        const max_w = 130;
        await Promise.all(WORDS.map((W_, i) => {
          const fill = svg.querySelector(`#int-match-fill-${i}`);
          const txt  = svg.querySelector(`#int-match-text-${i}`);
          const target = W_.match * max_w;
          return interruptibleAnim(1100, t => {
            fill.setAttribute("width", target * t);
            txt.textContent = `${Math.round(W_.match * 100 * t)}%`;
          });
        }));
        await delay(800);
      },
      // Step 5: values
      async () => {
        setActiveStep("intuition-steps", 4);
        svg.querySelector("#int-val-gutter").style.opacity = 1;
        svg.querySelector("#int-val-gutter").style.transition = "opacity 350ms";
        svg.querySelector("#int-bottom").textContent = `Each word also has a VALUE — a packet of info it's willing to share.`;

        for (let i = 0; i < WORDS.length; i++) {
          const v = svg.querySelector(`#int-val-${i}`);
          v.style.transition = "opacity 250ms";
          v.style.opacity = 1;
          await delay(140);
        }
        await delay(800);
      },
      // Step 6: blend by match -> output
      async () => {
        setActiveStep("intuition-steps", 5);
        svg.querySelector("#int-bottom").textContent = `Mix the values, weighted by the match. Coffee dominates → black is now "coffee-flavored".`;

        // dim values according to match
        WORDS.forEach((W_, i) => {
          const v = svg.querySelector(`#int-val-${i}`);
          v.style.transition = "opacity 500ms";
          v.style.opacity = 0.2 + 0.8 * (W_.match / 0.65); // normalize to max
        });
        await delay(500);

        const out = svg.querySelector("#int-output");
        out.style.transition = "opacity 500ms";
        out.style.opacity = 1;
        await delay(800);

        svg.querySelector("#int-bottom").textContent = `That's all attention is. Every word does this same search, in parallel — so the model fills in context everywhere at once.`;
      },
    ];
  }

  const STEPS = [
    "Pick a word to search",
    "Type its query",
    "Read everyone's keys",
    "Score the matches",
    "See each value",
    "Mix → new meaning",
  ];

  let nav = null;
  const play     = (end) => nav && nav.play(end);
  const goToStep = (idx) => nav && nav.goToStep(idx);

  function init() {
    build();
    nav = makeStepNavigator({
      stepsFn: buildSteps,
      reset:   reset,
      listId:  "intuition-steps",
      animKey: "intuition",
    });
    setupStepList("intuition-steps", STEPS, (i) => goToStep(i));
    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.intuition = () => play();
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.intuition = () => play();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
