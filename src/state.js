// src/state.js
// 🗺️ Consolidated state management with persistence

import { createLogger } from "./logging.js";

const log = createLogger("state");

// Storage keys (scoped by version for evolution)
const PANEL_COLLAPSED_STORAGE_KEY = "ECGPTN_panelCollapsed_v1";
const POI_MARKS_STORAGE_PREFIX = "ECGPTN_marks_v1::";
const SHOW_ONLY_MARKED_STORAGE_KEY = "ECGPTN_showOnlyMarked_v1";
const COLOR_TAGS_STORAGE_PREFIX = "ECGPTN_colorTags_v1::";

/**
 * Global in-memory state with consolidated structure
 */
const state = {
  /** @type {Array<any>} */
  pois: [],
  /** @type {string|null} */
  activePoiId: null,
  /** @type {boolean} */
  panelCollapsed: loadPanelCollapsed(),
  /** @type {boolean} */
  showOnlyMarked: loadShowOnlyMarked()
};

/** @type {Set<(snapshot: any) => void>} */
const subscribers = new Set();

/**
 * Notify all subscribers with a shallow copy of current state
 */
function notify() {
  for (const fn of subscribers) {
    try {
      fn({ ...state });
    } catch (err) {
      log.error("subscriber error", { error: String(err) });
    }
  }
}

/**
 * Subscribe to state changes
 * @param {(snapshot: any) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribeState(fn) {
  subscribers.add(fn);
  // Initial push so the UI can render immediately
  fn({ ...state });
  return () => {
    subscribers.delete(fn);
  };
}

/**
 * Replace the current POI list with mark & color preservation
 * @param {Array<any>} nextPois
 */
export function setPois(nextPois) {
  const span = log.startSpan("setPois", { count: Array.isArray(nextPois) ? nextPois.length : 0 });

  try {
    // Preserve marks from current state
    /** @type {Set<string>} */
    const fromStateMarks = new Set();
    /** @type {Map<string,string>} */
    const fromStateColors = new Map();

    for (const p of state.pois) {
      if (!p || p.id == null) continue;
      const id = String(p.id);
      if (p.marked) {
        fromStateMarks.add(id);
      }
      if (p.colorTag) {
        fromStateColors.set(id, String(p.colorTag));
      }
    }

    // Load marks & colors from storage
    const marksFromStorage = loadMarksForCurrentChat();
    const colorsFromStorage = loadColorTagsForCurrentChat();

    const mergedMarkedIds = new Set([...marksFromStorage, ...fromStateMarks]);
    const mergedColors = new Map([...colorsFromStorage, ...fromStateColors]);

    // Apply marks & colors to new POI list
    const safeNext = Array.isArray(nextPois) ? nextPois : [];
    state.pois = safeNext.map((p) => {
      const id = p && p.id != null ? String(p.id) : "";
      if (!id) return p;

      const marked = mergedMarkedIds.has(id);
      const colorTag = mergedColors.get(id) || null;

      const base = { ...p };

      // Ensure both props exist and are clean
      base.marked = !!marked;
      base.colorTag = colorTag;

      return base;
    });

    span.end({
      ok: true,
      pois: state.pois.length,
      markedCount: mergedMarkedIds.size,
      colorTaggedCount: Array.from(mergedColors.values()).filter(Boolean).length
    });
    notify();
  } catch (err) {
    span.error(err);
  }
}

/**
 * Set the active POI id
 * @param {string|null} id
 */
export function setActivePoiId(id) {
  state.activePoiId = id;
  log.debug("setActivePoiId", { id });
  notify();
}

/**
 * Toggle collapsed/expanded state of the side panel
 */
export function togglePanelCollapsed() {
  state.panelCollapsed = !state.panelCollapsed;
  log.debug("togglePanelCollapsed", { panelCollapsed: state.panelCollapsed });
  persistPanelCollapsed();
  notify();
}

/**
 * Toggle the "show only marked" filter flag
 */
export function toggleShowOnlyMarked() {
  state.showOnlyMarked = !state.showOnlyMarked;
  log.debug("toggleShowOnlyMarked", { showOnlyMarked: state.showOnlyMarked });
  persistShowOnlyMarked();
  notify();
}

/**
 * Toggle the `marked` flag for a given POI
 * @param {string} id
 */
export function togglePoiMarked(id) {
  const span = log.startSpan("togglePoiMarked", { id });

  try {
    if (!id) {
      span.end({ ok: false, reason: "empty-id" });
      return;
    }

    let updated = false;

    state.pois = state.pois.map((p) => {
      if (!p || p.id == null) return p;
      if (String(p.id) !== String(id)) return p;

      const nextMarked = !p.marked;
      updated = true;
      return { ...p, marked: nextMarked };
    });

    if (!updated) {
      span.end({ ok: false, reason: "poi-not-found" });
      return;
    }

    persistMarksForCurrentChat(state.pois);
    notify();
    span.end({ ok: true });
  } catch (err) {
    span.error(err);
  }
}

/**
 * Set or clear a colorTag for a given POI
 * @param {string} id
 * @param {string|null} colorTag
 */
export function setPoiColorTag(id, colorTag) {
  const span = log.startSpan("setPoiColorTag", { id, colorTag });

  try {
    if (!id) {
      span.end({ ok: false, reason: "empty-id" });
      return;
    }

    let updated = false;

    state.pois = state.pois.map((p) => {
      if (!p || p.id == null) return p;
      if (String(p.id) !== String(id)) return p;

      updated = true;
      return { ...p, colorTag: colorTag || null };
    });

    if (!updated) {
      span.end({ ok: false, reason: "poi-not-found" });
      return;
    }

    persistColorTagsForCurrentChat(state.pois);
    notify();
    span.end({ ok: true });
  } catch (err) {
    span.error(err);
  }
}

/**
 * Get a shallow copy of the current state
 */
export function getStateSnapshot() {
  return { ...state };
}

// Storage helper functions
function loadPanelCollapsed() {
  try {
    const raw = window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw);
    const result = Boolean(value);
    log.debug("panelCollapsed: restored from storage", { value: result });
    return result;
  } catch (err) {
    log.warn("failed to restore panelCollapsed from storage", { error: String(err) });
    return false;
  }
}

function persistPanelCollapsed() {
  try {
    window.localStorage.setItem(
      PANEL_COLLAPSED_STORAGE_KEY,
      JSON.stringify(state.panelCollapsed)
    );
    log.debug("persisted panelCollapsed", { panelCollapsed: state.panelCollapsed });
  } catch (err) {
    log.warn("failed to persist panelCollapsed", { error: String(err) });
  }
}

function loadShowOnlyMarked() {
  try {
    const raw = window.localStorage.getItem(SHOW_ONLY_MARKED_STORAGE_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw);
    const result = Boolean(value);
    log.debug("showOnlyMarked: restored from storage", { value: result });
    return result;
  } catch (err) {
    log.warn("failed to restore showOnlyMarked from storage", { error: String(err) });
    return false;
  }
}

function persistShowOnlyMarked() {
  try {
    window.localStorage.setItem(
      SHOW_ONLY_MARKED_STORAGE_KEY,
      JSON.stringify(state.showOnlyMarked)
    );
    log.debug("persisted showOnlyMarked", { showOnlyMarked: state.showOnlyMarked });
  } catch (err) {
    log.warn("failed to persist showOnlyMarked", { error: String(err) });
  }
}

function getMarksStorageKey() {
  const href = typeof window !== "undefined" && window.location ? window.location.href : "unknown";
  return `${POI_MARKS_STORAGE_PREFIX}${href}`;
}

function loadMarksForCurrentChat() {
  const key = getMarksStorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const ids = new Set(parsed.map((x) => String(x)));
    log.debug("loaded poi marks from storage", { key, count: ids.size });
    return ids;
  } catch (err) {
    log.warn("failed to load poi marks from storage", { key, error: String(err) });
    return new Set();
  }
}

function persistMarksForCurrentChat(pois) {
  const key = getMarksStorageKey();
  try {
    const markedIds = [];
    for (const p of pois) {
      if (!p || p.id == null) continue;
      if (p.marked) {
        markedIds.push(String(p.id));
      }
    }
    window.localStorage.setItem(key, JSON.stringify(markedIds));
    log.debug("persisted poi marks", { key, count: markedIds.length });
  } catch (err) {
    log.warn("failed to persist poi marks", { key, error: String(err) });
  }
}

function getColorTagsStorageKey() {
  const href = typeof window !== "undefined" && window.location ? window.location.href : "unknown";
  return `${COLOR_TAGS_STORAGE_PREFIX}${href}`;
}

function loadColorTagsForCurrentChat() {
  const key = getColorTagsStorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const map = new Map();
    for (const item of parsed) {
      if (!item || typeof item.id !== "string" || typeof item.colorTag !== "string") continue;
      map.set(item.id, item.colorTag);
    }
    log.debug("loaded color tags from storage", { key, count: map.size });
    return map;
  } catch (err) {
    log.warn("failed to load color tags from storage", { key, error: String(err) });
    return new Map();
  }
}

function persistColorTagsForCurrentChat(pois) {
  const key = getColorTagsStorageKey();
  try {
    const items = [];
    for (const p of pois) {
      if (!p || p.id == null || !p.colorTag) continue;
      items.push({ id: String(p.id), colorTag: String(p.colorTag) });
    }
    window.localStorage.setItem(key, JSON.stringify(items));
    log.debug("persisted color tags", { key, count: items.length });
  } catch (err) {
    log.warn("failed to persist color tags", { key, error: String(err) });
  }
}
