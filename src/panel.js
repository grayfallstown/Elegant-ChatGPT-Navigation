// src/panel.js
// 🪟 Konsolidiertes Navigationspanel mit Shadow DOM

import { createLogger } from "./logging.js";
import { subscribeState, togglePanelCollapsed, togglePoiMarked, toggleShowOnlyMarked } from "./state.js";

const log = createLogger("panel");

const PANEL_WIDTH = 320;
const PANEL_COLLAPSED_WIDTH = 32;

let hostElement = null;
let shadowRoot = null;
let onPoiClickGlobal = null;

/**
 * Injiziert globale Styles für Highlighting
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
      /* Highlight-Klassen für aktive Chat-Nachrichten */
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

function renderPanelContent(state) {
  if (!shadowRoot || !hostElement) return;

  const doc = hostElement.ownerDocument || document;

  let wrapper = shadowRoot.getElementById("ecgptn-root");
  if (!wrapper) {
    wrapper = doc.createElement("div");
    wrapper.id = "ecgptn-root";
    shadowRoot.appendChild(wrapper);
  }

  const { pois, activePoiId, panelCollapsed, showOnlyMarked } = state;
  updateBodyMargin(panelCollapsed);

  // aktuellen Scrollstand der Liste sichern (falls vorhanden)
  let previousScrollTop = 0;
  const existingList = wrapper.querySelector(".ecgptn-list");
  if (existingList && existingList instanceof HTMLElement) {
    previousScrollTop = existingList.scrollTop;
  }

  // Panel-Inhalt neu aufbauen
  wrapper.innerHTML = "";

  const container = doc.createElement("div");
  container.className = "ecgptn-container";

  if (panelCollapsed) {
    container.classList.add("ecgptn-collapsed");
  }

  const header = doc.createElement("div");
  header.className = "ecgptn-header";

  const title = doc.createElement("div");
  title.className = "ecgptn-title";
  title.textContent = "Navigator";

  const spacer = doc.createElement("div");
  spacer.style.flex = "1";

  // Filter-Button für Markierungen
  const filterBtn = doc.createElement("button");
  filterBtn.className = "ecgptn-filter-marked";
  filterBtn.textContent = showOnlyMarked ? "★" : "☆";
  filterBtn.title = showOnlyMarked
    ? "Zeige nur markierte Einträge"
    : "Zeige nur markierte Einträge";

  filterBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    toggleShowOnlyMarked();
  });

  // Toggle-Button für Panel
  const toggleBtn = doc.createElement("button");
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

  const list = doc.createElement("div");
  list.className = "ecgptn-list";

  // Filtere POIs wenn nur Markierte gezeigt werden sollen
  const visiblePois = showOnlyMarked ? pois.filter((p) => p && p.marked) : pois;

  visiblePois.forEach((poi) => {
    const row = doc.createElement("div");
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
    row.dataset.poiId = poi.id;

    const icon = doc.createElement("span");
    icon.className = "ecgptn-icon";
    icon.textContent = iconForKind(poi.kind);

    const label = doc.createElement("span");
    label.className = "ecgptn-label";
    label.textContent = poi.title || poi.id;

    // Markierungs-Button
    const markBtn = doc.createElement("button");
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
      } catch (err) {
        // Logging wird im State-Modul gemacht
      }
    });

    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(markBtn);

    row.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = row.dataset.poiId;
      if (id && onPoiClickGlobal) {
        onPoiClickGlobal(id);
      }
    });

    list.appendChild(row);
  });

  container.appendChild(header);
  container.appendChild(list);
  wrapper.appendChild(container);

  // Scrollposition wiederherstellen
  if (previousScrollTop > 0) {
    list.scrollTop = previousScrollTop;
  }
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
      }

      .ecgptn-mark-btn {
        margin-left: auto;
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
    // Kein globales Chat-Highlighting mehr
    // injectGlobalHighlightStyles(document);

    subscribeState((state) => {
      renderPanelContent(state);
    });

    span.end({ ok: true });
  } catch (err) {
    span.error(err);
  }
}
