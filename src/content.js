// src/content.js
// 🚀 Consolidated v9 entry point with all features unified

import { createLogger } from "./logging.js";
import { extractMessages, findScrollContainer, findChatRoot, scrollElementIntoView } from "./domAdapter.js";
import { buildPoisFromMessages } from "./model.js";
import { setPois, setActivePoiId, getStateSnapshot } from "./state.js";
import { mountPanel } from "./panel.js";
import { setupIntersectionObserver, setupMutationObserver, setupResizeObserver, disposeAllObservers } from "./observers.js";
import { setupKeyboardShortcuts } from "./keyboard.js";

const log = createLogger("content");

let rebuildScheduled = false;
let rebuildTimeoutId = null;
let cleanupIntersection = null;
let cleanupMutation = null;
let cleanupResize = null;
let cleanupKeyboard = null;
let scrollContainerRef = null;
let lastActiveMessageEl = null;
let lastActiveChildEl = null;

/**
 * Debounced rebuild trigger with improved error handling
 */
function scheduleRebuild(reason = "mutation") {
  log.debug("scheduleRebuild", { reason });
  if (rebuildTimeoutId !== null) {
    clearTimeout(rebuildTimeoutId);
    rebuildTimeoutId = null;
  }
  rebuildTimeoutId = window.setTimeout(() => {
    rebuildTimeoutId = null;
    performRebuild("scheduled:" + reason);
  }, 250);
}

/**
 * Perform a full rebuild of the POI model and observers with consolidation
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

    // Cleanup existing observers
    if (cleanupIntersection) {
      cleanupIntersection();
      cleanupIntersection = null;
    }
    if (cleanupResize) {
      cleanupResize();
      cleanupResize = null;
    }

    // Setup new observers with consolidated approach
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
 * Highlight active message in the chat DOM with consolidated highlighting
 */
function updateActiveMessageHighlight() {
  const { activePoiId, pois } = getStateSnapshot();
  const span = log.startSpan("updateActiveMessageHighlight", { activePoiId });

  try {
    // Clear previous highlights
    if (lastActiveChildEl && lastActiveChildEl.isConnected) {
      lastActiveChildEl.classList.remove("ecgptn-active-child");
      lastActiveChildEl = null;
    }

    if (lastActiveMessageEl && lastActiveMessageEl.isConnected) {
      lastActiveMessageEl.classList.remove("ecgptn-active-message");
      lastActiveMessageEl = null;
    }

    if (!activePoiId) {
      span.end({ ok: true, cleared: true });
      return;
    }

    const poi = pois.find((p) => p.id === activePoiId);
    if (!poi || !poi.anchorElement) {
      span.end({ ok: false, reason: "poi-or-anchor-missing" });
      return;
    }

    // Find message root for highlighting
    let messageRoot = poi.anchorElement;
    while (messageRoot && messageRoot !== document.body) {
      if (messageRoot.hasAttribute("data-message-author-role")) {
        break;
      }
      messageRoot = messageRoot.parentElement;
    }

    if (!messageRoot || !messageRoot.hasAttribute("data-message-author-role")) {
      span.end({ ok: false, reason: "no-message-root-found" });
      return;
    }

    messageRoot.classList.add("ecgptn-active-message");
    lastActiveMessageEl = messageRoot;

    // Highlight child elements for specific POI types
    if (poi.kind === "heading" || poi.kind === "code" || poi.kind === "table") {
      const anchor = poi.anchorElement;
      if (anchor && document.body.contains(anchor)) {
        anchor.classList.add("ecgptn-active-child");
        lastActiveChildEl = anchor;
      }
    }

    span.end({ ok: true });
  } catch (err) {
    span.error(err);
  }
}

/**
 * Scroll to a given POI by id with consolidated scrolling
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
 * Bootstraps the extension with consolidated initialization
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

    mountPanel((poiId) => {
      scrollToPoi(poiId);
    });

    performRebuild("init");

    cleanupMutation = setupMutationObserver(chatRoot, () => {
      scheduleRebuild("mutation");
    });

    cleanupKeyboard = setupKeyboardShortcuts((poiId) => {
      scrollToPoi(poiId);
    });

    // Subscribe to state changes for highlighting
    const unsubscribe = (() => {
      let lastActive = null;
      return (state) => {
        if (state.activePoiId !== lastActive) {
          lastActive = state.activePoiId;
          updateActiveMessageHighlight();
        }
      };
    })();

    // Poll for highlight updates (consolidated approach)
    const poller = window.setInterval(() => {
      updateActiveMessageHighlight();
    }, 250);

    span.end({ ok: true });

    // Store cleanup function
    globalThis.__ECGPTN_CLEANUP__ = () => {
      disposeAllObservers();
      if (cleanupKeyboard) cleanupKeyboard();
      window.clearInterval(poller);
      unsubscribe(getStateSnapshot());
    };
  } catch (err) {
    span.error(err);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });
} else {
  init();
}