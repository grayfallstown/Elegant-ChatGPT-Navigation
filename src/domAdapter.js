// src/domAdapter.js
// 🌐 Konsolidierter DOM-Adapter für ChatGPT

import { createLogger } from "./logging.js";

const log = createLogger("domAdapter");

/**
 * Findet alle Nachrichtenelemente in der ChatGPT-Unterhaltung
 */
export function findMessageElements(doc = document) {
  const span = log.startSpan("findMessageElements");
  try {
    const nodes = Array.from(doc.querySelectorAll("[data-message-author-role]"));
    span.end({ count: nodes.length });
    return nodes;
  } catch (err) {
    span.error(err);
    return [];
  }
}

/**
 * Extrahiert minimale Nachrichtenstruktur
 */
export function extractMessages(doc = document) {
  const elements = findMessageElements(doc);
  return elements.map((el, index) => {
    const role = el.getAttribute("data-message-author-role") || "unknown";
    const id = `msg_${index + 1}_${role}`;
    return { id, index, role, element: el };
  });
}

/**
 * Findet den hauptsächlichen scrollbaren Container für den Chat
 */
export function findScrollContainer(doc = document) {
  const span = log.startSpan("findScrollContainer");

  try {
    const messages = findMessageElements(doc);
    if (messages.length === 0) {
      span.end({ containerFound: false, reason: "no-messages" });
      return null;
    }

    const first = messages[0];
    let current = first.parentElement;

    while (current && current !== doc.body) {
      const style = current instanceof HTMLElement
        ? doc.defaultView.getComputedStyle(current)
        : null;

      if (style && (style.overflowY === "auto" || style.overflowY === "scroll")) {
        span.end({ containerFound: true, strategy: "ancestor-scrollable", tag: current.tagName });
        return current;
      }

      current = current.parentElement;
    }

    // Fallback: Bekannte ChatGPT-Container-Selektoren
    const knownSelectors = [
      ".flex.h-full.flex-col.overflow-y-auto",
      "[class*=overflow-y-auto]",
      ".react-scroll-to-bottom--css",
      "[data-testid='conversation']"
    ];

    for (const selector of knownSelectors) {
      const candidate = doc.querySelector(selector);
      if (!candidate) continue;

      const style = candidate instanceof HTMLElement
        ? doc.defaultView.getComputedStyle(candidate)
        : null;

      if (style && (style.overflowY === "auto" || style.overflowY === "scroll")) {
        span.end({ containerFound: true, strategy: "fallback-selector", selector });
        return candidate;
      }
    }

    span.end({ containerFound: false, reason: "no-scrollable-found" });
    return null;
  } catch (err) {
    span.error(err);
    return null;
  }
}

/**
 * Findet ein "Chat-Root"-Element, das alle Nachrichten enthält
 */
export function findChatRoot(doc = document) {
  const span = log.startSpan("findChatRoot");
  try {
    const messages = findMessageElements(doc);
    if (messages.length === 0) {
      span.end({ root: "body", reason: "no-messages" });
      return doc.body;
    }

    // Sammelt Vorfahrenketten für erste und letzte Nachricht
    const first = messages[0];
    const last = messages[messages.length - 1];

    function ancestry(node) {
      const result = [];
      let cur = node;
      while (cur) {
        result.push(cur);
        cur = cur.parentElement;
      }
      return result;
    }

    const firstAncestors = ancestry(first);
    const lastAncestors = new Set(ancestry(last));

    for (const candidate of firstAncestors) {
      if (lastAncestors.has(candidate)) {
        span.end({ root: candidate.tagName || "unknown" });
        return candidate;
      }
    }

    span.end({ root: "body", reason: "fallback" });
    return doc.body;
  } catch (err) {
    span.error(err);
    return doc.body;
  }
}

/**
 * Utility: Sanfter Scroll innerhalb des Scroll-Containers
 */
export function scrollElementIntoView(scrollContainer, target, options = {}) {
  const span = log.startSpan("scrollElementIntoView", { options });

  try {
    if (!scrollContainer || !target) {
      span.end({ ok: false, reason: "missing-container-or-target" });
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const offsetTop = targetRect.top - containerRect.top;

    const marginTop = typeof options.offset === "number" ? options.offset : 60;
    const finalTop = scrollContainer.scrollTop + offsetTop - marginTop;

    scrollContainer.scrollTo({
      top: Math.max(0, finalTop),
      behavior: options.behavior || "smooth"
    });

    span.end({ ok: true, finalTop });
  } catch (err) {
    span.error(err);
  }
}