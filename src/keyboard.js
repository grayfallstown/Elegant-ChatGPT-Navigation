// src/keyboard.js
// 🎹 Consolidated keyboard shortcuts with fixed duplication issues

import { createLogger } from "./logging.js";
import { getStateSnapshot, togglePanelCollapsed, togglePoiMarked, toggleShowOnlyMarked } from "./state.js";

const log = createLogger("keyboard");

let keydownHandler = null;

/**
 * Setup global keyboard shortcuts with consolidated logic
 */
export function setupKeyboardShortcuts(jumpToPoi) {
  if (keydownHandler) {
    window.removeEventListener("keydown", keydownHandler, true);
    keydownHandler = null;
  }

  keydownHandler = (ev) => {
    try {
      if (!ev.altKey || !ev.shiftKey) return;
      if (ev.defaultPrevented) return;

      const key = ev.key;

      // Toggle panel collapsed/expanded
      if (key === "N" || key === "n") {
        ev.preventDefault();
        log.debug("keyboard toggle panel");
        togglePanelCollapsed();
        return;
      }

      // Toggle POI marked state
      if (key === "M" || key === "m") {
        ev.preventDefault();
        const { activePoiId } = getStateSnapshot();
        if (!activePoiId) {
          log.debug("keyboard mark toggle ignored - no activePoiId");
          return;
        }
        log.debug("keyboard toggle mark", { id: activePoiId });
        try {
          togglePoiMarked(activePoiId);
        } catch (err) {
          log.error("togglePoiMarked from keyboard failed", { error: String(err) });
        }
        return;
      }

      // Navigation shortcuts
      if (key !== "ArrowDown" && key !== "ArrowUp") return;

      const { pois, activePoiId, showOnlyMarked } = getStateSnapshot();
      if (!pois || pois.length === 0) return;

      ev.preventDefault();

      // Filter POIs if showing only marked
      let navigable = Array.isArray(pois) ? pois : [];
      if (showOnlyMarked) {
        navigable = navigable.filter((p) => p && p.marked);
      }
      if (!navigable || navigable.length === 0) return;

      const index = navigable.findIndex((p) => p.id === activePoiId);
      let targetIndex = index;

      if (key === "ArrowDown") {
        targetIndex = index < 0 ? 0 : Math.min(navigable.length - 1, index + 1);
      } else if (key === "ArrowUp") {
        targetIndex = index < 0 ? 0 : Math.max(0, index - 1);
      }

      const target = navigable[targetIndex];
      if (!target) return;

      log.debug("keyboard jump", { from: activePoiId, to: target.id });
      jumpToPoi(target.id);
    } catch (err) {
      log.error("keydown handler error", { error: String(err) });
    }
  };

  window.addEventListener("keydown", keydownHandler, true);
  log.info("keyboard shortcuts enabled");

  return () => {
    if (keydownHandler) {
      window.removeEventListener("keydown", keydownHandler, true);
      keydownHandler = null;
    }
  };
}