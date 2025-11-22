# Requirements & Feature Overview

This document captures the current requirements and mid-term feature ideas
for **Elegant ChatGPT Navigation**. It is a **living** document.

## 1. High-level Goals

1. Provide a **navigation panel** on the right side of ChatGPT that:
   - Shows all relevant Points of Interest (POIs) inside the chat
   - Makes it easy to jump to specific prompts / responses / sections
   - Stays in sync while the user scrolls
2. Keep the implementation:
   - **Robust** against ChatGPT DOM changes
   - **Testable** and modular
   - **Performant** on long chats

## 2. POI (Point of Interest) Model

### 2.1 POI Types (current)

- `prompt` – user messages
- `response` – assistant messages
- `heading` – `<h1>` elements inside assistant messages
- `code` – code blocks (currently derived from `<pre>`)

### 2.2 Future POI Types (idea backlog)

- `heading_h2`, `heading_h3`
- `table`
- `image`
- `paragraph`
- `quote`
- “virtual POIs” (e.g., sections detected in Markdown)

### 2.3 POI Identity

- Each POI has a **stable ID** (per page load), derived from:
  - Index of the message in DOM
  - Message role
  - Local index for child POIs
- Example IDs:
  - `msg_1_prompt`
  - `msg_4_response`
  - `msg_4_response_h1_1`
  - `msg_4_response_code_2`

### 2.4 POI Properties

Each POI must provide:

- `id: string` – stable ID as above
- `kind: "prompt" | "response" | "heading" | "code" | ...`
- `title: string` – short, human-readable label
- `anchorElement: Element` – DOM element to scroll to
- `parentId: string | null` – for hierarchical display
- `depth: number` – 0 for top-level, 1 for child, etc.

## 3. Navigation Panel

### 3.1 Layout

- Fixed right-side panel
- Uses **Shadow DOM** to be isolated from ChatGPT styles
- Pushes ChatGPT content to the left (via margin on `body`), instead of overlapping

### 3.2 Content

- Top-level POIs listed in order of appearance
- Children POIs indented under their parent
- Icons/emojis per POI type:
  - Prompt: 🙋
  - Response: 🤖
  - Heading: 🟥
  - Code: `</>`

### 3.3 Interaction

- Click on row → scroll chat to POI.anchorElement
- Active POI is highlighted:
  - In the **panel** (e.g. orange border / background)
  - In the **chat** (via a dedicated CSS class on the message root)

### 3.4 Future Features

- Collapsible children in the navigation panel
- Color-based markings / labels for POIs
- Filters (e.g. show only marked POIs)
- Bookmarking POIs to localStorage / IndexedDB
- Settings panel for enabling/disabling POI types

## 4. Scroll Sync Behaviour

### 4.1 Current behaviour

- Uses **IntersectionObserver** with the main chat scroll container as root
- Observes `anchorElement` of each POI
- The “best” visible POI (highest intersection ratio, tie-break by top position)
  becomes the `activePoiId` in global state

### 4.2 Future ideas

- Distinguish “user scroll” vs “jump scroll” for more precise behaviour
- Scroll history (stack of visited POIs with their source: click, scroll)

## 5. Keyboard Shortcuts

### 5.1 Implemented

- `Alt`+`Shift`+`ArrowDown` → Next POI
- `Alt`+`Shift`+`ArrowUp` → Previous POI

These shortcuts:

- Work only inside ChatGPT tabs
- Respect the current order of the POI list
- Use global state (`activePoiId`, `pois`) to find the next/previous entry

### 5.2 Future shortcuts (idea backlog)

- Jump to next/previous **marked** POI
- Jump between top-level POIs only
- Toggle the navigation panel (collapse / expand)

## 6. Theming & Styling

### 6.1 Current

- Single built-in dark theme in CSS
- All style rules are inside the panel’s Shadow DOM, except for:
  - `body` margin-right adjustments
  - `.ecgptn-active-message` class inside the main document

### 6.2 Future

- Multiple named themes
- Theme configuration (colors, border styles, highlight animations)
- Per-theme icon sets

## 7. Synchronization & Robustness

### 7.1 Observers

- `MutationObserver` on the chat root:
  - Detects when ChatGPT adds/removes messages
  - Triggers a debounced `rebuild` of the POI model
- `IntersectionObserver` on POI anchor elements:
  - Drives `activePoiId` based on visibility
- `ResizeObserver` on the chat scroll container:
  - Re-applies the IntersectionObserver when layout changes significantly

### 7.2 Error Handling & Logging

- Non-fatal errors are logged via the logger
- The extension attempts to **fail gracefully**:
  - If the scroll container cannot be found, the panel logs a warning and retries
  - If a POI anchor element is missing, clicks are ignored with a warning log

## 8. Out of Scope (for now)

The following ideas are acknowledged but **not** yet planned:

- Full-blown annotation system with comments per POI
- Cloud sync of POI marks/bookmarks (beyond browser sync)
- Generic DOM navigation support for arbitrary websites (this project is ChatGPT-specific)
