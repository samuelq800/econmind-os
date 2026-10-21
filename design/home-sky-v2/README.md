# Home sky · v2

Homepage visual revision only. No account gates, database, routes or navigation
destinations change. Production publication of this visual revision was explicitly
requested by the user on 21 October 2026 after local preview.

## Art direction

Original architecture and navy/teal/champagne palette retained. Built-in image
generation produced a detailed celestial layer and extracted the original
architectural foreground with transparency. Originals are retained in this folder.
The generated texture is 1254 × 1254 and the architectural matte is 1672 × 941;
the delivered video is 1920 × 1080, not native 4K artwork.

The renderer turns the sky exactly 360 degrees in 120 seconds at 30 fps. The
architecture composites AFTER rotation and never moves. There is no reversal,
end fade, scene cut or crossfade: the last-to-first step equals one normal frame
of rotation. The still fallback is the exact first video frame. A 720p variant
limits mobile bandwidth; both MP4 files use fast-start progressive loading.

The webpage adds rare, staggered two-second meteors with tapered white/gold/teal
tails, invisible endpoints and no bright flashing discs. The video does not
restart when each meteor repeats. Only desktop headline/copy receives an extra
32–64px top inset; the large badge and existing links remain untouched.

Autoplay failure retains the poster; hidden/offscreen playback pauses. Reduced
motion and data saving avoid requesting video. The original image on other
pages is not replaced.

## Rebuild

Run `node scripts/render-home-sky-v2.mjs` with FFmpeg installed. It refuses to
overwrite output files; move an existing render aside before rebuilding.
Use `node scripts/verify-home-sky-loop.mjs` to check decoded loop frames and
`node scripts/preview-home-sky.mjs` after a static build for the range-enabled
local preview at `http://localhost:3052/`.

## Local acceptance

- Production static export: 476 pages, passed.
- Full Vitest: 130 files; 1075 passed, one existing skip.
- Typecheck and focused lint: passed.
- Video: 120.000 seconds, 3600 frames, Full HD / 720p, no audio, fast-start.
- Decoded RGB mean difference at seam: 1.89/255; adjacent-frame reference:
  1.36/255; quarter-turn change: 16.98/255. The small seam residual includes
  normal movement plus compression noise, not a scene cut or an exposure fade.
- Browser: actual loop boundary crosses without a poster flash; hidden/offscreen
  pause and visible resume; live reduced-motion switching; reduced-motion initial
  page requests zero MP4s; mobile selects 720p; no horizontal overflow.
- Desktop copy inset: 63.36px at 1920 CSS px; original badge width 520px and zero
  positional displacement from that copy adjustment.
- Dark/light desktop and mobile screenshots visually inspected. Badge navigation
  remains clickable and all image/video layers are decorative and non-interactive.
- Only visual files, their source artwork, reproduction tools and focused tests
  are part of this revision. Database publishing is a separate editorial action,
  not part of the visual release.

## Generation provenance and prompts

Tool: built-in `image_gen` (not API/CLI fallback). Reference for both calls:
`public/images/visual-pilot/observatory-atmosphere.jpg`.

### Starfield prompt

Use case: stylized-concept. Asset type: high-resolution square celestial matte
painting to animate as a rotating starfield behind an existing EconMind website.
Input reference is STYLE AND PALETTE ONLY, not an edit target. Create one square
2048x2048 artwork: deep midnight navy and blue-teal interstellar space, natural
detailed wisps of turquoise nebula and delicate sparse champagne-gold cosmic
dust, thousands of very fine sharp luminous stars with a small number of brighter
stars. Rich cinematic astrophotography mixed with premium science-fiction concept
art, restrained exposure, high microdetail, elegant depth. Nebulae curve loosely
around a dark open central expanse, so this image works beautifully under slow
rotation. Clouds remain subtle and organic, NOT a bright spiral logo or black
hole, no giant central luminous hub. Keep ample dark negative space for website
headline readability across all rotation angles. Full-bleed starfield, consistent
detail to all edges. Absolutely no architecture, no horizon, no buildings, no
rings, no planets, no frames, no text, no logos, no interface. The existing
architectural foreground will be a separate static layer. Prioritize cinematic
image quality over geometric effects.

### Foreground extraction prompt

Use case: background-extraction. Edit target: the supplied existing EconMind
sci-fi observatory painting. Extract ONLY the existing architectural foreground
into a genuine transparent RGBA PNG, preserving its exact wide 16:9 framing,
perspective and appearance. Keep the dark bronze/gold right-hand curved
observation-window structure and cyan illuminated ribs; keep the low dark curved
railing and reflective floor along the bottom and the tiny low railing at the
lower left. Remove ALL stars, nebulae and space sky from the window/open area,
replacing those sky areas with clean true alpha transparency. Keep the
architectural elements precisely at the existing right and bottom edges; do not
enlarge, reposition, redesign, add or remove architecture. This will overlay the
original webpage at full size over a separately rotating starfield, so its sky
hole must be clear and transparent, not filled black, not a checkerboard baked
in, and not semi-opaque smoke. No words, no logos, no people, no interface. Keep
subtle gold/cyan architectural lighting. Preserve crisp high-quality edge detail
and wide aspect ratio.
