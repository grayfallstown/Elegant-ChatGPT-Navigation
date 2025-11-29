// src/panel.js
// 🪟 Konsolidiertes Navigationspanel mit Shadow DOM + Farb-Markierungen

import { createLogger } from "./logging.js";
import {
  subscribeState,
  togglePanelCollapsed,
  togglePoiMarked,
  toggleShowOnlyMarked,
  setPoiColorTag
} from "./state.js";
import { COLOR_TAGS, colorClass } from "./colors.js";


const log = createLogger("panel");

const PANEL_WIDTH = 320;
const PANEL_COLLAPSED_WIDTH = 32;

let hostElement = null;
let shadowRoot = null;
let onPoiClickGlobal = null;
let openPalettePoiId = null;
let lastStateSnapshot = null;

/**
 * Injiziert globale Styles für Highlighting im Chat
 */
export function injectGlobalHighlightStyles(doc = document) {
  const span = log.startSpan("injectGlobalHighlightStyles");

  try {
    if (doc.getElementById("ecgptn-global-styles")) {
      span.end({ alreadyPresent: true });
      return;
    }

    const style = doc.createElement("style");
    style.id = "ecgptn-global-styles";
    style.textContent = `
      /* Highlight-Klassen für aktive Chat-Nachrichten (aktuell deaktiviert) */
      .ecgptn-active-message {
        outline: 2px solid #f97316;
        outline-offset: 3px;
        border-radius: 6px;
        transition: outline-color 0.2s ease-out;
      }

      .ecgptn-active-child {
        outline: 2px solid #38bdf8;
        outline-offset: 2px;
        border-radius: 4px;
        transition: outline-color 0.2s ease-out;
      }

      /* Farb-Tags im Chat (Message-Root & Child-Elemente) */
      .ecgptn-color-tag-sunrise {
        outline: 2px solid var(--ecgptn-color-sunrise, #fb923c);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-sunset {
        outline: 2px solid var(--ecgptn-color-sunset, #fbbf24);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-sky {
        outline: 2px solid var(--ecgptn-color-sky, #60a5fa);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-ocean {
        outline: 2px solid var(--ecgptn-color-ocean, #22d3ee);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-forest {
        outline: 2px solid var(--ecgptn-color-forest, #22c55e);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-violet {
        outline: 2px solid var(--ecgptn-color-violet, #a855f7);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-rose {
        outline: 2px solid var(--ecgptn-color-rose, #fb7185);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-amber {
        outline: 2px solid var(--ecgptn-color-amber, #eab308);
        outline-offset: 3px;
        border-radius: 6px;
      }
      .ecgptn-color-tag-mint {
        outline: 2px solid var(--ecgptn-color-mint, #14b8a6);
        outline-offset: 3px;
        border-radius: 6px;
      }
    `;
    doc.head.appendChild(style);
    span.end({ ok: true });
  } catch (err) {
    span.error(err);
  }
}

/**
 * Passt Body-Margin an, damit das Panel nicht überlappt
 */
function updateBodyMargin(collapsed) {
  const margin = collapsed ? `${PANEL_COLLAPSED_WIDTH}px` : `${PANEL_WIDTH}px`;
  document.body.style.marginRight = margin;
}

/**
 * Rendert die Navigationsliste im Shadow Root
 */
function renderPanelContent(state) {
  if (!shadowRoot) return;

  let wrapper = shadowRoot.getElementById("ecgptn-root");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = "ecgptn-root";
    shadowRoot.appendChild(wrapper);
  }

  const { pois, activePoiId, panelCollapsed, showOnlyMarked } = state;
  updateBodyMargin(panelCollapsed);

  wrapper.innerHTML = "";

  const container = document.createElement("div");
  container.className = "ecgptn-container";
  if (panelCollapsed) {
    container.classList.add("ecgptn-collapsed");

    // 👉 Wenn eingeklappt: kompletter schmaler Streifen klickbar zum Wieder-Aufklappen
    container.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      togglePanelCollapsed();
    });
  }

  const header = document.createElement("div");
  header.className = "ecgptn-header";

  const title = document.createElement("div");
  title.className = "ecgptn-title";
  title.textContent = "Navigator";

  const spacer = document.createElement("div");
  spacer.style.flex = "1";

  const filterBtn = document.createElement("button");
  filterBtn.className = "ecgptn-filter-marked";
  filterBtn.textContent = showOnlyMarked ? "★" : "☆";
  filterBtn.title = showOnlyMarked
    ? "Zeige nur markierte Einträge"
    : "Zeige nur markierte Einträge";

  filterBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleShowOnlyMarked();
  });

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "ecgptn-toggle";
  toggleBtn.textContent = panelCollapsed ? "⯈" : "⯇";
  toggleBtn.title = panelCollapsed ? "Panel erweitern" : "Panel einklappen";
  toggleBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    togglePanelCollapsed();
  });

  if (showOnlyMarked) {
    filterBtn.classList.add("ecgptn-filter-active");
  }

  header.appendChild(title);
  header.appendChild(spacer);
  header.appendChild(filterBtn);
  header.appendChild(toggleBtn);

  const list = document.createElement("div");
  list.className = "ecgptn-list";

  const visiblePois = showOnlyMarked ? pois.filter((p) => p && p.marked) : pois;

  visiblePois.forEach((poi) => {
    const row = document.createElement("div");
    row.className = "ecgptn-row";
    if (poi.depth > 0) {
      row.classList.add("ecgptn-row-child");
    }
    if (poi.id === activePoiId) {
      row.classList.add("ecgptn-row-active");
    }
    if (poi.marked) {
      row.classList.add("ecgptn-row-marked");
    }
    if (poi.colorTag) {
      row.classList.add(colorClass(poi.colorTag));
    }
    row.dataset.poiId = poi.id;

    const icon = document.createElement("span");
    icon.className = "ecgptn-icon";
    icon.textContent = iconForKind(poi.kind);

    const label = document.createElement("span");
    label.className = "ecgptn-label";
    label.textContent = poi.title || poi.id;

    // Farb-Button (Textmarker)
    const colorBtn = document.createElement("button");
    colorBtn.className = "ecgptn-color-btn";
    colorBtn.title = poi.colorTag
      ? `Farbmarkierung: ${poi.colorTag}`
      : "Farbmarkierung setzen";

    const dot = document.createElement("span");
    dot.className = "ecgptn-color-dot";
    if (poi.colorTag) {
      dot.classList.add(`ecgptn-color-swatch-${poi.colorTag}`);
    }
    colorBtn.appendChild(dot);

    colorBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      // Palette zu/aufklappen
      if (openPalettePoiId === poi.id) {
        openPalettePoiId = null;
        if (lastStateSnapshot) renderPanelContent(lastStateSnapshot);
        return;
      }

      // Wenn noch keine Farbe vergeben → auto pick
      if (!poi.colorTag && lastStateSnapshot) {
        const best = pickBestColorForPois(lastStateSnapshot.pois);
        if (best) {
          setPoiColorTag(poi.id, best);
        }
      }

      openPalettePoiId = poi.id;
      if (lastStateSnapshot) renderPanelContent(lastStateSnapshot);
    });

    // Bookmark-Button (wie bisher)
    const markBtn = document.createElement("button");
    markBtn.className = "ecgptn-mark-btn";
    const isMarked = !!poi.marked;
    markBtn.textContent = isMarked ? "★" : "☆";
    markBtn.title = isMarked ? "Markierung entfernen" : "Eintrag markieren";

    markBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!poi.id) return;
      try {
        togglePoiMarked(poi.id);
      } catch {
        // Logging im State-Modul
      }
    });

    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(colorBtn); // ← Textmarker zuerst
    row.appendChild(markBtn);  // ← Bookmark dahinter

    row.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = row.dataset.poiId;
      if (id && onPoiClickGlobal) {
        onPoiClickGlobal(id);
      }
    });

    // Farb-Palette als "Tooltip"
    if (openPalettePoiId === poi.id) {
      const palette = document.createElement("div");
      palette.className = "ecgptn-color-palette";

      COLOR_TAGS.forEach((tag) => {
        const swatch = document.createElement("div");
        swatch.className = `ecgptn-color-swatch ecgptn-color-swatch-${tag}`;
        swatch.title = tag;
        swatch.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setPoiColorTag(poi.id, tag);
          openPalettePoiId = null;
          // State-Änderung triggert automatisch neues Rendern
        });
        palette.appendChild(swatch);
      });

      row.appendChild(palette);
    }

    list.appendChild(row);
  });

  container.appendChild(header);
  container.appendChild(list);
  wrapper.appendChild(container);
}


function iconForKind(kind) {
  switch (kind) {
    case "prompt":
      return "🙋";
    case "response":
      return "🤖";
    case "heading":
      return "🟥";
    case "code":
      return "</>";
    case "table":
      return "📊";
    default:
      return "•";
  }
}

function ensureHost() {
  if (hostElement && shadowRoot) return;

  hostElement = document.getElementById("ecgptn-panel-host");
  if (!hostElement) {
    hostElement = document.createElement("div");
    hostElement.id = "ecgptn-panel-host";
    document.body.appendChild(hostElement);
  }

  if (!shadowRoot) {
    shadowRoot = hostElement.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
      }

      .ecgptn-container {
        position: fixed;
        top: 0;
        right: 0;
        width: ${PANEL_WIDTH}px;
        height: 100vh;
        background: #020617;
        color: #e5e7eb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        z-index: 999999;
        border-left: 1px solid #1e293b;
      }

      .ecgptn-container.ecgptn-collapsed {
        width: ${PANEL_COLLAPSED_WIDTH}px;
      }

      /* Im eingeklappten Zustand nur die Kopfzeile mit dem Toggle anzeigen */
      .ecgptn-container.ecgptn-collapsed .ecgptn-title,
      .ecgptn-container.ecgptn-collapsed .ecgptn-filter-marked,
      .ecgptn-container.ecgptn-collapsed .ecgptn-list {
        display: none;
      }

      .ecgptn-container.ecgptn-collapsed .ecgptn-toggle {
        width: 100%;
        justify-content: center;
      }

      .ecgptn-header {
        display: flex;
        align-items: center;
        padding: 6px 8px;
        border-bottom: 1px solid #1f2937;
        background: linear-gradient(to right, #020617, #0f172a);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.03em;
      }

      .ecgptn-title {
        white-space: nowrap;
      }

      .ecgptn-toggle {
        border: none;
        background: #111827;
        color: #e5e7eb;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        cursor: pointer;
      }

      .ecgptn-toggle:hover {
        background: #1f2937;
      }

      .ecgptn-filter-marked {
        border: none;
        background: transparent;
        color: #fbbf24;
        border-radius: 4px;
        padding: 2px 4px;
        font-size: 11px;
        cursor: pointer;
        flex-shrink: 0;
        margin-right: 4px;
        opacity: 0.85;
      }

      .ecgptn-filter-marked.ecgptn-filter-active {
        background: rgba(251, 191, 36, 0.12);
      }

      .ecgptn-filter-marked:hover {
        opacity: 1;
        filter: brightness(1.05);
      }

      .ecgptn-list {
        flex: 1;
        overflow-y: auto;
        padding: 6px 4px 8px 4px;
        font-size: 12px;
      }

      .ecgptn-row {
        position: relative;
        display: flex;
        align-items: center;
        padding: 4px 6px;
        margin-bottom: 3px;
        border-radius: 4px;
        cursor: pointer;
        gap: 4px;
        transition: background-color 0.12s ease-out, transform 0.08s ease-out;
      }

      .ecgptn-row-child {
        padding-left: 16px;
        font-size: 11px;
        opacity: 0.95;
      }

      .ecgptn-row:hover {
        background-color: #0f172a;
        transform: translateX(-1px);
      }

      .ecgptn-row-active {
        background: linear-gradient(90deg, #1d293b, #0b1120);
        border: 1px solid #f97316;
      }

      .ecgptn-icon {
        width: 16px;
        text-align: center;
        flex-shrink: 0;
      }

      .ecgptn-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1 1 auto;
      }

      .ecgptn-color-btn {
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 0 2px;
        flex-shrink: 0;
        opacity: 0.85;
      }

      .ecgptn-color-btn:hover {
        opacity: 1;
        transform: scale(1.05);
      }

      .ecgptn-color-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid rgba(148, 163, 184, 0.8);
        box-sizing: border-box;
        background: transparent;
      }

      .ecgptn-mark-btn {
        margin-left: 4px;
        border: none;
        background: transparent;
        color: #fbbf24;
        cursor: pointer;
        font-size: 12px;
        padding: 0 2px;
        flex-shrink: 0;
        opacity: 0.8;
      }

      .ecgptn-mark-btn:hover {
        opacity: 1;
        transform: scale(1.05);
      }

      .ecgptn-row.ecgptn-row-marked .ecgptn-label {
        color: #fbbf24;
      }

      .ecgptn-color-palette {
        position: absolute;
        top: 50%;
        right: 4px;
        transform: translateY(-50%);
        background: #020617;
        border: 1px solid #1e293b;
        border-radius: 6px;
        padding: 4px;
        display: grid;
        grid-template-columns: repeat(3, 14px);
        gap: 4px;
        z-index: 1000000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      }

      .ecgptn-color-swatch {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1px solid rgba(15, 23, 42, 0.9);
        cursor: pointer;
      }

      .ecgptn-color-swatch:hover {
        outline: 1px solid #e5e7eb;
      }

      /* Zeilenfarben für Farb-Tags */
      .ecgptn-row.ecgptn-color-tag-sunrise {
        border-left: 3px solid var(--ecgptn-color-sunrise, #fb923c);
        background: linear-gradient(90deg, rgba(251, 146, 60, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-sunset {
        border-left: 3px solid var(--ecgptn-color-sunset, #fbbf24);
        background: linear-gradient(90deg, rgba(251, 191, 36, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-sky {
        border-left: 3px solid var(--ecgptn-color-sky, #60a5fa);
        background: linear-gradient(90deg, rgba(96, 165, 250, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-ocean {
        border-left: 3px solid var(--ecgptn-color-ocean, #22d3ee);
        background: linear-gradient(90deg, rgba(34, 211, 238, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-forest {
        border-left: 3px solid var(--ecgptn-color-forest, #22c55e);
        background: linear-gradient(90deg, rgba(34, 197, 94, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-violet {
        border-left: 3px solid var(--ecgptn-color-violet, #a855f7);
        background: linear-gradient(90deg, rgba(168, 85, 247, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-rose {
        border-left: 3px solid var(--ecgptn-color-rose, #fb7185);
        background: linear-gradient(90deg, rgba(251, 113, 133, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-amber {
        border-left: 3px solid var(--ecgptn-color-amber, #eab308);
        background: linear-gradient(90deg, rgba(234, 179, 8, 0.08), transparent);
      }
      .ecgptn-row.ecgptn-color-tag-mint {
        border-left: 3px solid var(--ecgptn-color-mint, #14b8a6);
        background: linear-gradient(90deg, rgba(20, 184, 166, 0.08), transparent);
      }

      .ecgptn-color-swatch-sunrise {
        background: var(--ecgptn-color-sunrise, #fb923c);
      }
      .ecgptn-color-swatch-sunset {
        background: var(--ecgptn-color-sunset, #fbbf24);
      }
      .ecgptn-color-swatch-sky {
        background: var(--ecgptn-color-sky, #60a5fa);
      }
      .ecgptn-color-swatch-ocean {
        background: var(--ecgptn-color-ocean, #22d3ee);
      }
      .ecgptn-color-swatch-forest {
        background: var(--ecgptn-color-forest, #22c55e);
      }
      .ecgptn-color-swatch-violet {
        background: var(--ecgptn-color-violet, #a855f7);
      }
      .ecgptn-color-swatch-rose {
        background: var(--ecgptn-color-rose, #fb7185);
      }
      .ecgptn-color-swatch-amber {
        background: var(--ecgptn-color-amber, #eab308);
      }
      .ecgptn-color-swatch-mint {
        background: var(--ecgptn-color-mint, #14b8a6);
      }
    `;
    shadowRoot.appendChild(style);
  }
}

/**
 * Mountet das Panel und beginnt mit State-Updates
 */
export function mountPanel(onPoiClick) {
  const span = log.startSpan("mountPanel");
  try {
    onPoiClickGlobal = onPoiClick;
    ensureHost();
    injectGlobalHighlightStyles(document);

    subscribeState((state) => {
      lastStateSnapshot = state;
      renderPanelContent(state);
    });

    span.end({ ok: true });
  } catch (err) {
    span.error(err);
  }
}

function pickBestColorForPois(pois) {
  if (!Array.isArray(pois) || pois.length === 0) {
    return COLOR_TAGS[0];
  }

  const counts = new Map();
  COLOR_TAGS.forEach((tag) => counts.set(tag, 0));

  for (const p of pois) {
    if (!p || !p.colorTag) continue;
    if (counts.has(p.colorTag)) {
      counts.set(p.colorTag, (counts.get(p.colorTag) || 0) + 1);
    }
  }

  // zuerst unbenutzte Farbe
  for (const tag of COLOR_TAGS) {
    if ((counts.get(tag) || 0) === 0) {
      return tag;
    }
  }

  // sonst die am seltensten benutzte
  let bestTag = COLOR_TAGS[0];
  let bestCount = counts.get(bestTag) ?? 0;

  for (const tag of COLOR_TAGS) {
    const c = counts.get(tag) ?? 0;
    if (c < bestCount) {
      bestCount = c;
      bestTag = tag;
    }
  }

  return bestTag;
}

