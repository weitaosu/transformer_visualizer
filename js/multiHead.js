/* §3 Multi-Head Attention.
 * Visual: 3 heads run in parallel. Each head shows its own attention pattern
 * over the same Clifford sentence. Animated reveal: heads light up one by one,
 * arrows fan out from a "split" then concatenate into a final output.
 */

(function () {
  const WORDS = ["This", "is", "my", "big", "red", "dog", "Clifford"];
  const N = WORDS.length;

  const HEADS = [
    {
      name: "Head 1: Content",
      color: "#ff6f7a",
      desc: "Focuses on subject nouns",
      // attention from each word over all others; dummy but plausible
      pattern: [0.05, 0.05, 0.05, 0.10, 0.05, 0.30, 0.40], // accumulator: target words
      targets: [5, 6],
    },
    {
      name: "Head 2: Description",
      color: "#6aa6ff",
      desc: "Focuses on adjectives",
      pattern: [0.05, 0.05, 0.05, 0.40, 0.30, 0.10, 0.05],
      targets: [3, 4],
    },
    {
      name: "Head 3: Reference",
      color: "#5fcf90",
      desc: "Focuses on possessives",
      pattern: [0.05, 0.10, 0.50, 0.10, 0.10, 0.10, 0.05],
      targets: [2],
    },
  ];

  let activeRun = null;

  function build() {
    const svg = document.getElementById("mh-svg");
    if (!svg) return;
    svg.innerHTML = "";

    const W = 1200, H = 480;

    // Top: input sentence (centered)
    const wordSpacing = 130;
    const wordsTotalW = (N - 1) * wordSpacing;
    const startX = (W - wordsTotalW) / 2;
    WORDS.forEach((w, i) => {
      const x = startX + i * wordSpacing;
      const g = svgEl("g", { transform: `translate(${x - 50}, 30)`, id: `mh-word-${i}` }, svg);
      svgEl("rect", { x: 0, y: 0, width: 100, height: 36, rx: 8, class: "token-box" }, g);
      svgEl("text", { x: 50, y: 23, "text-anchor": "middle", "font-weight": "700", "font-size": 19, text: w }, g);
    });

    // Below words: 3 head boxes side-by-side
    const headW = 320, headH = 200, headY = 130;
    const headStartX = (W - (3 * headW + 60)) / 2; // 30px gap between
    HEADS.forEach((H_, hi) => {
      const x = headStartX + hi * (headW + 30);
      const g = svgEl("g", { transform: `translate(${x}, ${headY})`, id: `mh-head-${hi}`, opacity: 0.35 }, svg);
      svgEl("rect", { x: 0, y: 0, width: headW, height: headH, rx: 10,
        fill: "rgba(255,255,255,0.04)", stroke: H_.color, "stroke-width": 1.5 }, g);
      svgEl("text", { x: headW/2, y: 22, "text-anchor": "middle",
        "font-size": 18, "font-weight": "700", fill: H_.color,
        text: H_.name }, g);
      svgEl("text", { x: headW/2, y: 38, "text-anchor": "middle",
        "font-size": 16, class: "label-soft",
        text: H_.desc }, g);

      // Inside head: a mini bar chart of attention over the 7 words
      const bcStartX = 16, bcStartY = 60, bcWidth = headW - 32, bcSpacing = bcWidth / N, bcMaxH = 90;
      H_.pattern.forEach((p, i) => {
        const xx = bcStartX + i * bcSpacing;
        // bg
        svgEl("rect", {
          x: xx + 2, y: bcStartY + bcMaxH, width: bcSpacing - 6, height: 0,
          fill: H_.color, opacity: 0.85, rx: 2,
          id: `mh-bar-${hi}-${i}`,
        }, g);
        svgEl("text", {
          x: xx + bcSpacing/2, y: bcStartY + bcMaxH + 16,
          "text-anchor": "middle", "font-size": 10,
          class: "label-soft",
          text: WORDS[i],
        }, g);
      });
    });

    // Bottom: concat & projection box
    const concatY = 380;
    const concatW = 360, concatH = 50;
    const concatX = (W - concatW)/2;
    const cg = svgEl("g", { transform: `translate(${concatX}, ${concatY})`, id: "mh-concat", opacity: 0.3 }, svg);
    svgEl("rect", { x: 0, y: 0, width: concatW, height: concatH, rx: 8,
      fill: "rgba(255,84,112,0.15)", stroke: "var(--accent)", "stroke-width": 1.5 }, cg);
    svgEl("text", { x: concatW/2, y: 30, "text-anchor": "middle",
      "font-weight": "700", "font-size": 18, fill: "#fff",
      text: "Concat → Linear projection → output (d)" }, cg);

    // Lines from each head to concat (drawn but invisible at first)
    HEADS.forEach((_, hi) => {
      const x = headStartX + hi * (headW + 30) + headW/2;
      svgEl("line", {
        x1: x, y1: headY + headH,
        x2: concatX + concatW * (hi + 0.5) / 3,
        y2: concatY,
        stroke: "var(--ink-soft)", "stroke-width": 1.2,
        opacity: 0,
        id: `mh-line-${hi}`,
      }, svg);
    });
  }

  function setNarration(html) {
    const el = document.getElementById("mh-narration");
    if (el) el.innerHTML = html;
  }

  function reset() {
    const svg = document.getElementById("mh-svg");
    if (!svg) return;
    HEADS.forEach((_, hi) => {
      const headEl = svg.querySelector(`#mh-head-${hi}`);
      headEl.style.transition = "none";
      headEl.style.opacity = 0.35;
      HEADS[hi].pattern.forEach((_, i) => {
        svg.querySelector(`#mh-bar-${hi}-${i}`).setAttribute("height", 0);
        svg.querySelector(`#mh-bar-${hi}-${i}`).setAttribute("y", 60 + 90);
      });
      svg.querySelector(`#mh-line-${hi}`).style.opacity = 0;
    });
    svg.querySelector("#mh-concat").style.opacity = 0.3;
    WORDS.forEach((_, i) => {
      svg.querySelector(`#mh-word-${i}`).style.opacity = 1;
      const r = svg.querySelector(`#mh-word-${i} rect`);
      r.setAttribute("stroke", "#ffffff66");
      r.setAttribute("stroke-width", "1");
      r.setAttribute("fill", "rgba(255,255,255,0.05)");
    });
    setNarration(`<span class="step-tag">Watch</span> Three heads run in parallel. Each one cares about a different kind of relationship in the same sentence.`);
  }

  function buildSteps() {
    const svg = document.getElementById("mh-svg");
    const bcMaxH = 90, bcStartY = 60;

    function makeHeadStep(hi) {
      return async () => {
        setActiveStep("mh-steps", hi);
        const head = HEADS[hi];
        const explain = [
          `<span class="step-tag">Head 1 / 4</span> The <b style="color:${head.color}">content head</b> looks at the <em>nouns</em> — what is the sentence actually about?`,
          `<span class="step-tag">Head 2 / 4</span> The <b style="color:${head.color}">description head</b> looks at <em>adjectives</em> — what describes what?`,
          `<span class="step-tag">Head 3 / 4</span> The <b style="color:${head.color}">reference head</b> looks at <em>possessives & pronouns</em> — who owns what?`,
        ];
        setNarration(explain[hi]);

        const headEl = svg.querySelector(`#mh-head-${hi}`);
        headEl.style.transition = "opacity 250ms";
        headEl.style.opacity = 1;

        const bars = HEADS[hi].pattern;
        await delay(150);
        await Promise.all(bars.map((p, i) => {
          const bar = svg.querySelector(`#mh-bar-${hi}-${i}`);
          const targetH = p * bcMaxH * 2;
          const finalH = Math.min(bcMaxH, targetH);
          return interruptibleAnim(900, t => {
            const h = finalH * t;
            bar.setAttribute("height", h);
            bar.setAttribute("y", bcStartY + bcMaxH - h);
          });
        }));

        await delay(150);
        for (const ti of head.targets) {
          const wEl = svg.querySelector(`#mh-word-${ti}`);
          const rect = wEl.querySelector("rect");
          rect.setAttribute("stroke", head.color);
          rect.setAttribute("stroke-width", "2.5");
          rect.setAttribute("fill", head.color + "33");
        }
        await delay(450);
      };
    }

    return [
      makeHeadStep(0),
      makeHeadStep(1),
      makeHeadStep(2),
      async () => {
        setActiveStep("mh-steps", 3);
        setNarration(`<span class="step-tag">Combine · 4 / 4</span> The three heads' outputs are <b>concatenated</b> and projected — so the next layer sees content + descriptions + references all at once.`);
        HEADS.forEach((_, hi) => {
          svg.querySelector(`#mh-line-${hi}`).style.transition = "opacity 400ms";
          svg.querySelector(`#mh-line-${hi}`).style.opacity = 0.7;
        });
        await delay(450);
        svg.querySelector("#mh-concat").style.transition = "opacity 400ms";
        svg.querySelector("#mh-concat").style.opacity = 1;
        await delay(400);
      },
    ];
  }

  const STEPS = [
    "Head 1: content (nouns)",
    "Head 2: descriptions",
    "Head 3: references",
    "Concat → projection",
  ];

  let nav = null;
  const play     = (end) => nav && nav.play(end);
  const goToStep = (idx) => nav && nav.goToStep(idx);

  function init() {
    build();
    nav = makeStepNavigator({
      stepsFn: buildSteps,
      reset:   reset,
      listId:  "mh-steps",
      animKey: "multihead",
    });
    setupStepList("mh-steps", STEPS, (i) => goToStep(i));
    window.replayHandlers = window.replayHandlers || {};
    window.replayHandlers.multihead = () => play();
    window.autoplayHandlers = window.autoplayHandlers || {};
    window.autoplayHandlers.multihead = () => play();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
