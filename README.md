# Transformer Visualization Demo

An interactive, animated walkthrough of the Transformer architecture for first-time learners — self-attention, multi-head attention, masking, positional encoding, cross-attention, and the full encoder–decoder, all in one page.

Pure HTML / CSS / vanilla JavaScript. No build step, no frameworks, no dependencies.

## How to run

**Easiest** — just open `index.html` in a browser.

```bash
# Windows
start index.html

# macOS
open index.html

# or double-click index.html in your file explorer
```

**With a local server** (recommended if `file://` causes any issues):

```bash
python -m http.server 8765
```

Then visit `http://localhost:8765/index.html`.

**Static hosting** — drop the folder onto Netlify, Vercel, GitHub Pages, or any static host. Required files: `index.html`, `styles.css`, and the `js/` folder.

## How to use

- **Scroll** or press **↓ / ↑** to move between slides.
- **← / →** step forward/backward inside an animated slide.
- Click any **step in the side list** to jump to it.
- **P** pauses animations, **?** opens the keyboard help, **Esc** closes it.
- Use the floating **speed slider** (top-right) to slow down or speed up.

## File layout

```
extra_credit/
├── index.html      # all 10 slides + nav + control panel
├── styles.css      # design system, dark theme
└── js/
    ├── utils.js          # shared helpers, math, step navigator
    ├── main.js           # deck nav, autoplay, keyboard, hash routing
    ├── problem.js        # §1 — ambiguity motivation
    ├── intuition.js      # §2 — soft DB lookup analogy
    ├── embed.js          # §3 — words → vectors
    ├── selfAttention.js  # §4 — Q/K/V step-by-step
    ├── multiHead.js      # §5 — multiple heads
    ├── masking.js        # §6 — causal attention
    ├── posEncoding.js    # §7 — sinusoidal positional encoding
    ├── crossAttention.js # §8 — encoder→decoder attention
    └── architecture.js   # §9 — full encoder–decoder
```
