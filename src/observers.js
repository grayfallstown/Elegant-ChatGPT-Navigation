// src/observers.js
// 👀 Konsolidierte Observer: IntersectionObserver, MutationObserver, ResizeObserver

import { createLogger } from "./logging.js";
import { setActivePoiId } from "./state.js";

const log = createLogger("observers");

let intersectionObserver = null;
let mutationObserver = null;
let resizeObserver = null;

/**
 * Setup IntersectionObserver für POIs mit verbesserter Sichtbarkeitslogik
 */
export function setupIntersectionObserver(scrollContainer, pois) {
  if (!scrollContainer) {
    log.warn("setupIntersectionObserver: missing scrollContainer");
    return () => {};
  }

  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }

  const elementToPoiId = new Map();
  const visibility = new Map();

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const poiId = elementToPoiId.get(entry.target);
        if (!poiId) continue;

        visibility.set(poiId, {
          ratio: entry.intersectionRatio,
          top: entry.boundingClientRect.top
        });
      }

      // Bestimme bestes sichtbares POI
      let bestId = null;
      let bestRatio = 0;
      let bestTop = Infinity;

      for (const [poiId, info] of visibility) {
        if (info.ratio <= 0) continue;

        if (info.ratio > bestRatio) {
          bestRatio = info.ratio;
          bestTop = info.top;
          bestId = poiId;
        } else if (info.ratio === bestRatio && info.top < bestTop) {
          bestTop = info.top;
          bestId = poiId;
        }
      }

      if (bestId) {
        setActivePoiId(bestId);
      }
    },
    {
      root: scrollContainer,
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
    }
  );

  // Beobachte alle POI-Anchor-Elemente
  for (const poi of pois) {
    if (!poi.anchorElement) continue;
    try {
      intersectionObserver.observe(poi.anchorElement);
      elementToPoiId.set(poi.anchorElement, poi.id);
    } catch (err) {
      log.warn("failed to observe POI anchor", { id: poi.id, error: String(err) });
    }
  }

  log.info("IntersectionObserver set up", { observedCount: elementToPoiId.size });

  return () => {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
  };
}

/**
 * Setup MutationObserver auf dem Chat-Root
 */
export function setupMutationObserver(root, onRelevantChange) {
  if (!root) {
    log.warn("setupMutationObserver: missing root");
    return () => {};
  }

  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  mutationObserver = new MutationObserver((mutations) => {
    if (!mutations || mutations.length === 0) return;
    
    // Prüfe auf relevante Änderungen
    const hasRelevantChange = mutations.some(m => 
      (m.addedNodes && m.addedNodes.length > 0) || 
      (m.removedNodes && m.removedNodes.length > 0)
    );
    
    if (hasRelevantChange) {
      onRelevantChange();
    }
  });

  mutationObserver.observe(root, {
    childList: true,
    subtree: true
  });

  log.info("MutationObserver attached");

  return () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  };
}

/**
 * Setup ResizeObserver auf dem Scroll-Container
 */
export function setupResizeObserver(scrollContainer, onResize) {
  if (!scrollContainer) {
    log.warn("setupResizeObserver: missing scrollContainer");
    return () => {};
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  resizeObserver = new ResizeObserver(() => {
    onResize();
  });

  try {
    resizeObserver.observe(scrollContainer);
    log.info("ResizeObserver attached");
  } catch (err) {
    log.error("ResizeObserver failed", { error: String(err) });
  }

  return () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  };
}

/**
 * Trennt alle Observer
 */
export function disposeAllObservers() {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}