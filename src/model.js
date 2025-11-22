// src/model.js
// 🧩 Consolidated POI model with all types unified

import { createLogger } from "./logging.js";

const log = createLogger("model");

/**
 * @typedef {Object} PoiNode
 * @property {string} id
 * @property {string} kind
 * @property {string} title
 * @property {Element} anchorElement
 * @property {string|null} parentId
 * @property {number} depth
 * @property {boolean} marked
 */

function shortText(text, maxLen = 80) {
  if (!text) return "";
  const firstLine = text.trim().split(/\r?\n/)[0];
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + "…";
}

/**
 * Try to extract a reasonable language / label for a code block
 */
function extractCodeLabel(preOrCode) {
  if (!preOrCode) return "Code";

  const classAttr = preOrCode.getAttribute("class") || "";
  const langMatch = classAttr.match(/language-([\w-]+)/i);
  if (langMatch) {
    return langMatch[1];
  }

  // Try header-like first child text (ChatGPT sometimes renders language in a header area)
  const header = preOrCode.querySelector("div > div:first-child");
  if (header && (header.innerText || header.textContent)) {
    return shortText(header.innerText || header.textContent, 40);
  }

  return "Code";
}

/**
 * Build POIs from message descriptors with consolidated logic
 */
export function buildPoisFromMessages(messages) {
  const span = log.startSpan("buildPoisFromMessages", { messageCount: messages.length });
  /** @type {PoiNode[]} */
  const result = [];

  try {
    for (const msg of messages) {
      const isUser = msg.role === "user";
      const baseId = `msg_${msg.index + 1}_${isUser ? "prompt" : "response"}`;

      const textContent = msg.element.textContent || "";
      const baseTitle = shortText(textContent, 100);
      const kind = isUser ? "prompt" : "response";

      result.push({
        id: baseId,
        kind,
        title: baseTitle || (isUser ? "User message" : "Assistant message"),
        anchorElement: msg.element,
        parentId: null,
        depth: 0,
        marked: false
      });

      if (!isUser) {
        // Process headings (h1, h2, h3)
        const headings = msg.element.querySelectorAll("h1, h2, h3");
        let hIndex = 0;
        headings.forEach((h) => {
          hIndex += 1;
          const level = h.tagName.toLowerCase();
          const id = `${baseId}_${level}_${hIndex}`;
          const title = shortText(h.textContent || "", 100) || "Heading";
          const depth = level === "h1" ? 1 : level === "h2" ? 2 : 3;

          result.push({
            id,
            kind: "heading",
            title,
            anchorElement: h,
            parentId: baseId,
            depth,
            marked: false
          });
        });

        // Process code blocks
        const codeBlocks = msg.element.querySelectorAll("pre");
        let cIndex = 0;
        codeBlocks.forEach((pre) => {
          cIndex += 1;
          const id = `${baseId}_code_${cIndex}`;
          const codeElement = pre.querySelector("code") || pre;
          const rawCode = codeElement.textContent || "";
          const label = extractCodeLabel(codeElement);
          const preview = shortText(rawCode, 80);
          const title = `${label}: ${preview || "Code block"}`;

          result.push({
            id,
            kind: "code",
            title,
            anchorElement: pre,
            parentId: baseId,
            depth: 1,
            marked: false
          });
        });

        // Process tables
        const tables = msg.element.querySelectorAll("table");
        let tIndex = 0;
        tables.forEach((tbl) => {
          tIndex += 1;
          const id = `${baseId}_table_${tIndex}`;

          // Try to build a helpful title from the first row/header
          let title = "Table";
          const headerRow = tbl.querySelector("thead tr, tr");
          if (headerRow) {
            const firstHeaderCell = headerRow.querySelector("th, td");
            const headerText = firstHeaderCell ? firstHeaderCell.textContent || "" : "";
            const compact = shortText(headerText, 80);
            if (compact) {
              title = `Table: ${compact}`;
            }
          }

          result.push({
            id,
            kind: "table",
            title,
            anchorElement: tbl,
            parentId: baseId,
            depth: 1,
            marked: false
          });
        });
      }
    }

    // 🔀 POIs nach tatsächlicher DOM-Position sortieren
    try {
      result.sort((a, b) => {
        const elA = a.anchorElement;
        const elB = b.anchorElement;

        if (!elA || !elB || elA === elB) return 0;

        const pos = elA.compareDocumentPosition(elB);

        // A kommt vor B im Dokument
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        // A kommt nach B im Dokument
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;

        return 0;
      });
      span.end({ poiCount: result.length, sorted: true });
    } catch (sortErr) {
      span.error(sortErr);
      span.end({ poiCount: result.length, sorted: false });
    }

    return result;
  } catch (err) {
    span.error(err);
    return result;
  }
}
