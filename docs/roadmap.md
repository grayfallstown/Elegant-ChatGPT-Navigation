# Roadmap – Elegant ChatGPT Navigation

This roadmap focuses on **small, well-defined steps**.  
Each stage should be shippable and reasonably testable.

---

## Stage 0 – Foundations ✅ (this prototype)

**Goal:** Get a minimal but robust navigation working end-to-end.

- [x] Project structure with `src/`, `docs/`, `icons/`
- [x] `manifest.json` for Manifest V3
- [x] `package.json` with esbuild-based bundling
- [x] Logging module with:
  - global log buffer (`globalThis.ECGPTN_LOGS`)
  - emojis per log level
  - UTC timestamps
- [x] DOM adapter to:
  - find messages and their roles
  - locate the main scroll container
- [x] POI model:
  - prompts, responses, `h1`, code blocks
  - basic titles and stable IDs
- [x] Navigation panel:
  - Shadow DOM
  - Right-side fixed panel
  - Top-level + child POIs
- [x] Scroll sync:
  - IntersectionObserver for POI anchors
  - Active POI highlight in the panel
- [x] Keyboard shortcuts:
  - next / previous POI

---

## Stage 1 – Better Anchors & Highlighting (Next step)

**Goal:** Make navigation more precise and more visually obvious.

- [ ] Improve anchor selection for POIs
  - [ ] Top-level messages: scroll to message root, not some inner child
  - [ ] Child POIs (heading / code): scroll to the child node itself
- [ ] Chat highlighting:
  - [ ] Add `.ecgptn-active-message` class to the active message root
  - [ ] Optionally add `.ecgptn-active-child` to the child element for heading/code POIs
- [ ] Scroll offset tuning:
  - [ ] Ensure the POI is not hidden behind fixed headers
  - [ ] Provide sensible defaults (e.g. align near top, with a small margin)
- [ ] Make the scroll container detection more robust
  - [ ] First try “closest scrollable ancestor of the first message”
  - [ ] Fallback to known ChatGPT layout selectors

---

## Stage 2 – Panel Behaviour & UX

**Goal:** Make the panel feel polished and less intrusive.

- [x] Add a dedicated toggle shortcut (e.g. `Alt`+`Shift`+`N`)
- [x] Persist panel collapsed/expanded state per origin
- [ ] Add subtle hover + active styles (no visual noise)
- [ ] Ensure the panel never overlaps ChatGPT’s own right-side panels:
  - [ ] Use a dedicated CSS variable for panel width
  - [ ] Adjust body / root margins accordingly
- [ ] Handle very small window widths more gracefully

---

## Stage 3 – POI Marking & Filtering

**Goal:** Give users tools to mark important POIs.

- [x] Introduce “mark” state per POI:
  - [x] Unmarked / Marked (one default color)
- [x] Basic UI:
  - [x] Small icon on POI row to toggle mark
- [x] Filters:
  - [x] Show all
  - [x] Show only marked (panel-level toggle, persisted)
- [ ] Keyboard shortcuts:
  - [ ] Jump to next/previous **marked** POI

(*Future expansion: multiple colors / tags, persisted across sessions.*)

---

## Stage 4 – Settings & Persistence

**Goal:** Make behaviour configurable and persistent.

- [ ] Settings schema (in memory)
- [ ] Persist settings to `chrome.storage.sync`
- [ ] Settings UI (simple modal or mini-panel):
  - [ ] Which POI types are enabled
  - [ ] Keyboard shortcut preferences
  - [ ] Scroll animation style / speed
- [ ] Export/import settings as JSON

---

## Stage 5 – Theming & Advanced Visuals

**Goal:** Allow different visual styles.

- [ ] Theme system:
  - [ ] Built-in dark theme (current)
  - [ ] Light theme
  - [ ] High-contrast theme for accessibility
- [ ] Highlight styles:
  - [ ] Border-based highlight
  - [ ] Background-based highlight
  - [ ] Optional subtle pulse animation when the active POI changes

---

## Stage 6 – Advanced Features (Idea Pool)

These are more ambitious and **not** scheduled yet:

- [ ] Scroll history:
  - [ ] Track how the user moved between POIs
  - [ ] Provide “back/forward in history” buttons
- [ ] Bookmarks:
  - [ ] Persist user-defined POI bookmarks per chat URL
- [ ] Cross-device sync:
  - [ ] Use browser sync APIs to share bookmarks and marks
- [ ] Code-aware POIs:
  - [ ] Parse code blocks to detect functions / classes as child POIs
- [ ] Smart “section” detection inside long responses

When Stage 0–5 are stable, we can reprioritize items from this pool.
