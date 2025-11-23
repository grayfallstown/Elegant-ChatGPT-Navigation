// src/content.js
// 🚀 Konsolidierter Entry-Point – fokussiert auf POIs, Panel, Scroll & Observer

import { createLogger } from "./logging.js";
import {
  extractMessages,
  findScrollContainer,
  findChatRoot,
  scrollElementIntoView
} from "./domAdapter.js";
import { buildPoisFromMessages } from "./model.js";
import { setPois, setActivePoiId, getStateSnapshot } from "./state.js";
import { mountPanel } from "./panel.js";
import {
  setupIntersectionObserver,
  setupMutationObserver,
  setupResizeObserver,
  disposeAllObservers
} from "./observers.js";
import { setupKeyboardShortcuts } from "./keyboard.js";

const log = createLogger("content");

let rebuildTimeoutId = null;
let cleanupIntersection = null;
let cleanupMutation = null;
let cleanupResize = null;
let cleanupKeyboard = null;
let scrollContainerRef = null;

/**
 * Debounced Rebuild-Trigger
 */
function scheduleRebuild(reason = "mutation") {
  log.debug("scheduleRebuild", { reason });
  if (rebuildTimeoutId !== null) {
    window.clearTimeout(rebuildTimeoutId);
    rebuildTimeoutId = null;
  }
  rebuildTimeoutId = window.setTimeout(() => {
    rebuildTimeoutId = null;
    performRebuild("scheduled:" + reason);
  }, 250);
}

/**
 * Voller Rebuild der POI-Struktur + Observer
 */
function performRebuild(reason = "manual") {
  const span = log.startSpan("performRebuild", { reason });

  try {
    const messages = extractMessages(document);
    if (!messages || messages.length === 0) {
      span.end({ ok: false, reason: "no-messages" });
      return;
    }

    let scrollContainer = scrollContainerRef;
    if (!scrollContainer || !document.body.contains(scrollContainer)) {
      scrollContainer = findScrollContainer(document);
      scrollContainerRef = scrollContainer;
    }

    if (!scrollContainer) {
      span.end({ ok: false, reason: "no-scroll-container" });
      return;
    }

    const pois = buildPoisFromMessages(messages);
    setPois(pois);

    // Alte Observer abbauen
    if (cleanupIntersection) {
      cleanupIntersection();
      cleanupIntersection = null;
    }
    if (cleanupResize) {
      cleanupResize();
      cleanupResize = null;
    }

    // Neue Observer aufsetzen
    cleanupIntersection = setupIntersectionObserver(scrollContainer, pois);
    cleanupResize = setupResizeObserver(scrollContainer, () => {
      const { pois: latestPois } = getStateSnapshot();
      if (cleanupIntersection) {
        cleanupIntersection();
      }
      cleanupIntersection = setupIntersectionObserver(scrollContainer, latestPois);
    });

    span.end({ ok: true, poiCount: pois.length });
  } catch (err) {
    span.error(err);
  }
}

/**
 * Scrollt zu einem POI
 */
function scrollToPoi(poiId) {
  const { pois } = getStateSnapshot();
  const poi = pois.find((p) => p.id === poiId);
  if (!poi) {
    log.warn("scrollToPoi: unknown POI", { poiId });
    return;
  }

  if (!poi.anchorElement) {
    log.warn("scrollToPoi: missing anchorElement", { poiId });
    return;
  }

  const scrollContainer = scrollContainerRef || findScrollContainer(document);
  if (!scrollContainer) {
    log.warn("scrollToPoi: missing scrollContainer", { poiId });
    return;
  }

  setActivePoiId(poiId);
  scrollElementIntoView(scrollContainer, poi.anchorElement, {
    offset: 60,
    behavior: "smooth"
  });
}

/**
 * Bootstrap der Extension
 */
function init() {
  if (globalThis.__ECGPTN_BOOTED__) {
    log.info("already booted – skipping");
    return;
  }
  globalThis.__ECGPTN_BOOTED__ = true;

  const span = log.startSpan("init");

  try {
    const chatRoot = findChatRoot(document);
    scrollContainerRef = findScrollContainer(document);

    // Panel mounten
    mountPanel((poiId) => {
      scrollToPoi(poiId);
    });

    // Erstes POI-Build
    performRebuild("init");

    // MutationObserver → Rebuild
    cleanupMutation = setupMutationObserver(chatRoot, () => {
      scheduleRebuild("mutation");
    });

    // Keyboard-Shortcuts (next/prev, toggle usw.)
    cleanupKeyboard = setupKeyboardShortcuts((poiId) => {
      scrollToPoi(poiId);
    });

    span.end({ ok: true });

    // Cleanup-Hook (falls man im DevMode neu lädt)
    globalThis.__ECGPTN_CLEANUP__ = () => {
      disposeAllObservers();
      if (cleanupKeyboard) cleanupKeyboard();
      if (cleanupMutation) cleanupMutation();
      if (cleanupIntersection) cleanupIntersection();
      if (cleanupResize) cleanupResize();
    };
  } catch (err) {
    span.error(err);
  }
}

// Init, sobald DOM bereit
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
} else {
  init();
}
