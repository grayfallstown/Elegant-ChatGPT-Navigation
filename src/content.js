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
 * Merkt sich Scroll-Position + Verhältnis (für robuste Restore-Logik)
 */
function captureScrollState(scrollContainer) {
  try {
    if (!scrollContainer) return null;

    const scrollTop = scrollContainer.scrollTop || 0;
    const maxScrollTop = Math.max(0, (scrollContainer.scrollHeight || 0) - (scrollContainer.clientHeight || 0));
    const ratio = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;

    return {
      scrollTop,
      ratio,
      scrollHeight: scrollContainer.scrollHeight || 0,
      clientHeight: scrollContainer.clientHeight || 0
    };
  } catch (err) {
    log.warn("captureScrollState failed", { error: String(err) });
    return null;
  }
}

/**
 * Stellt Scroll-Position wieder her (erst direkt, dann nochmal im nächsten Frame)
 * → doppelt, weil DOM/Observer manchmal nachträglich Layout/Scroll beeinflussen
 */
function restoreScrollState(scrollContainer, state) {
  try {
    if (!scrollContainer || !state) return;

    const maxScrollTop = Math.max(0, (scrollContainer.scrollHeight || 0) - (scrollContainer.clientHeight || 0));
    const targetTop = Number.isFinite(state.scrollTop) ? state.scrollTop : 0;

    // Wenn sich die Höhe stark geändert hat: prozentual restaurieren
    const heightChangedALot =
      Math.abs((scrollContainer.scrollHeight || 0) - (state.scrollHeight || 0)) > 200;

    const nextTop = heightChangedALot
      ? Math.round(maxScrollTop * (state.ratio || 0))
      : Math.min(maxScrollTop, Math.max(0, targetTop));

    scrollContainer.scrollTop = nextTop;

    // Safety: nochmal im nächsten Paint (und nochmal im rAF danach)
    window.requestAnimationFrame(() => {
      try {
        const max2 = Math.max(0, (scrollContainer.scrollHeight || 0) - (scrollContainer.clientHeight || 0));
        const top2 = heightChangedALot
          ? Math.round(max2 * (state.ratio || 0))
          : Math.min(max2, Math.max(0, targetTop));
        scrollContainer.scrollTop = top2;

        window.requestAnimationFrame(() => {
          try {
            const max3 = Math.max(0, (scrollContainer.scrollHeight || 0) - (scrollContainer.clientHeight || 0));
            const top3 = heightChangedALot
              ? Math.round(max3 * (state.ratio || 0))
              : Math.min(max3, Math.max(0, targetTop));
            scrollContainer.scrollTop = top3;
          } catch {
            // nope
          }
        });
      } catch {
        // nope
      }
    });
  } catch (err) {
    log.warn("restoreScrollState failed", { error: String(err) });
  }
}

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

    // 💥 FIX: Scroll-Position vor Rebuild merken
    const scrollStateBefore = captureScrollState(scrollContainer);

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

    // 💥 FIX: Scroll-Position nach Rebuild wiederherstellen
    restoreScrollState(scrollContainer, scrollStateBefore);

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
