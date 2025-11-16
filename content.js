(function() {
  'use strict';

  const LOG_PREFIX = "[NAV-TREE]";
  const log = (...args) => console.log(LOG_PREFIX, ...args);

  // 🔗 Deine echten URLs
  const NAV_ICON_URL    = "https://grayfallstown.sirv.com/Unbenannt.svg";
  const DONATE_ICON_URL = "https://grayfallstown.sirv.com/Unbenanadsasdnt.svg";
  const DONATE_LINK_URL = "https://www.paypal.com/donate/?hosted_button_id=HDW4PAEKX7VUJ";

  let panel, tree;
  let rebuildTimer = null;

  const targetMap = new Map();   // id → Chat-Element
  const navItemMap = new Map();  // baseId → Navigator-Item
  let currentActiveId = null;

  const ICON_PROMPT   = "🙋";
  const ICON_RESPONSE = "🤖";
  const ICON_H1       = "🟥";
  const ICON_CODE     = "</>";

  let scrollPollerId = null;
  let lastScrollTop = null;

  let syncAfterRebuildTimer = null;
  const SYNC_AFTER_REBUILD_DELAY = 150;

  // ⚙️ Lock: programmatisches Scrollen vs. User-Scroll
  let isProgrammaticChatScroll = false;
  let programmaticScrollUntil = 0;
  const PROGRAMMATIC_SCROLL_LOCK_MS = 2000; // 💥 2 Sekunden Lock

  // ---------------------- Helpers ----------------------
  function short(text, len = 100) {
    if (!text) return "";
    const t = text.trim().split("\n")[0];
    return t.length > len ? t.slice(0, len) + "…" : t;
  }

  function getMessages() {
    return Array.from(document.querySelectorAll("[data-message-author-role]"));
  }

  function getScrollContainer() {
    const list = document.querySelectorAll(".flex.h-full.flex-col.overflow-y-auto");
    const sc = list[1] || list[0] || null;
    return sc;
  }

  function scrollNavigatorToEnd() {
    if (!tree) return;
    tree.scrollTo({
      top: tree.scrollHeight,
      behavior: "smooth"
    });
  }

  function refreshProgrammaticLock() {
    const now = Date.now();
    if (isProgrammaticChatScroll && now >= programmaticScrollUntil) {
      isProgrammaticChatScroll = false;
    }
  }

  // Heuristik: ChatGPT streamt, wenn Stop-Button sichtbar
  function isStreaming() {
    const stopTestId = document.querySelector('button[data-testid*="stop"]');
    if (stopTestId) return true;

    const btns = Array.from(document.querySelectorAll("button"));
    return btns.some(b => {
      const t = (b.innerText || "").toLowerCase();
      if (!t) return false;
      return (
        t.includes("stop generating") ||
        t.includes("stopp") ||
        t.includes("stoppen") ||
        t.includes("generierung anhalten")
      );
    });
  }

  // ---------------------- Scroll-Logik: Chat ----------------------
  function performScrollToTarget(target, id) {
    const sc = getScrollContainer();
    if (!sc || !target) {
      log("performScrollToTarget: missing scroll container or target", { sc: !!sc, target: !!target, id });
      return;
    }

    const tRect = target.getBoundingClientRect();
    const cRect = sc.getBoundingClientRect();

    const relTop   = tRect.top - cRect.top;
    const finalTop = Math.max(0, sc.scrollTop + relTop - 60);

    log("performScrollToTarget", {
      id,
      targetTag: target.tagName,
      targetClass: target.className,
      relTop,
      currentScrollTop: sc.scrollTop,
      finalTop
    });

    sc.scrollTo({
      top: finalTop,
      behavior: "smooth"
    });
  }

  function jump(id) {
    const el = targetMap.get(id);
    if (!el) {
      log("jump: target not found for id", id);
      return;
    }

    const baseId = getBaseIdFromAnyId(id);
    if (baseId) {
      setActiveNav(baseId);
    }

    // 🔒 Lock setzen: programmatischer Scroll
    isProgrammaticChatScroll = true;
    programmaticScrollUntil = Date.now() + PROGRAMMATIC_SCROLL_LOCK_MS;

    el.classList.add("navtree-highlight");
    setTimeout(() => el.classList.remove("navtree-highlight"), 1200);

    // Doppel-Scroll: sofort + kurz danach
    performScrollToTarget(el, id);
    setTimeout(() => {
      performScrollToTarget(el, id);
    }, 50);

    // Safety-Lock-Löser
    setTimeout(() => {
      refreshProgrammaticLock();
    }, PROGRAMMATIC_SCROLL_LOCK_MS + 150);
  }

  function getBaseIdFromAnyId(id) {
    const m = /^article\d+/.exec(id);
    return m ? m[0] : null;
  }

  // ---------------------- Navigator Active-Highlight + Scroll-Sync ----------------------
  function setActiveNav(baseId) {
    if (!tree) return;
    if (currentActiveId === baseId) return;

    if (currentActiveId) {
      const prevItem = navItemMap.get(currentActiveId);
      if (prevItem) prevItem.classList.remove("nt-active");
    }

    currentActiveId = baseId;

    const item = navItemMap.get(baseId);
    if (item) {
      item.classList.add("nt-active");
      scrollNavigatorToActive(item);
    }
  }

  function scrollNavigatorToActive(item) {
    if (!tree || !item) return;

    const navHeight = tree.clientHeight;
    const itemTop   = item.offsetTop;
    const desired   = itemTop - navHeight * 0.8;

    const maxScroll = tree.scrollHeight - navHeight;
    const targetTop = Math.max(0, Math.min(desired, maxScroll));

    tree.scrollTo({
      top: targetTop,
      behavior: "smooth"
    });
  }

  function updateActiveFromScroll() {
    refreshProgrammaticLock();
    if (isProgrammaticChatScroll) {
      return;
    }

    const sc = getScrollContainer();
    const msgs = getMessages();

    if (!sc || !msgs.length) {
      scrollNavigatorToEnd();
      return;
    }

    const cRect = sc.getBoundingClientRect();

    const gapBottom = sc.scrollHeight - (sc.scrollTop + cRect.height);
    if (gapBottom < 100) {
      const lastIdx = msgs.length - 1;
      const activeId = `article${lastIdx + 1}`;
      setActiveNav(activeId);
      return;
    }

    const readingLineY = cRect.top + cRect.height * 0.25;

    let bestIdx = 0;
    let bestTop = -Infinity;
    let found = false;

    msgs.forEach((msg, idx) => {
      const r = msg.getBoundingClientRect();
      const top = r.top;
      if (top <= readingLineY && top > bestTop) {
        bestTop = top;
        bestIdx = idx;
        found = true;
      }
    });

    if (!found) {
      let firstVisibleIdx = 0;
      let hasVisible = false;
      msgs.forEach((msg, idx) => {
        const r = msg.getBoundingClientRect();
        if (r.bottom >= cRect.top) {
          firstVisibleIdx = idx;
          hasVisible = true;
          return;
        }
      });
      if (hasVisible) {
        bestIdx = firstVisibleIdx;
      } else {
        scrollNavigatorToEnd();
        return;
      }
    }

    const activeId = `article${bestIdx + 1}`;
    setActiveNav(activeId);
  }

  function scheduleSyncToScroll() {
    if (syncAfterRebuildTimer) {
      clearTimeout(syncAfterRebuildTimer);
    }
    syncAfterRebuildTimer = setTimeout(() => {
      syncAfterRebuildTimer = null;
      updateActiveFromScroll();
    }, SYNC_AFTER_REBUILD_DELAY);
  }

  function startScrollPoller() {
    if (scrollPollerId !== null) return;

    scrollPollerId = window.setInterval(() => {
      const sc = getScrollContainer();
      if (!sc) {
        lastScrollTop = null;
        return;
      }

      const cur = sc.scrollTop;
      if (lastScrollTop === null) {
        lastScrollTop = cur;
        return;
      }

      if (cur !== lastScrollTop) {
        lastScrollTop = cur;

        refreshProgrammaticLock();
        if (isProgrammaticChatScroll) {
          return;
        }

        updateActiveFromScroll();
      }
    }, 80);
    log("scroll-poller: started");
  }

  // ---------------------- Responsive Layout ----------------------
  function applyResponsiveLayout() {
    if (!panel) return;
    const rootStyle = document.documentElement.style;

    if (window.innerWidth < 1024) {
      rootStyle.setProperty("--nt-panel-width", "220px");
      panel.classList.add("collapsed");
    } else {
      rootStyle.setProperty("--nt-panel-width", "330px");
    }
  }

  // ---------------------- Panel UI ----------------------
  function createPanel() {
    if (panel) return;

    panel = document.createElement("div");
    panel.id = "nt-panel";

    // Header
    const header = document.createElement("div");
    header.id = "nt-header";

    const headerLeft = document.createElement("div");
    headerLeft.id = "nt-header-left";

    const logoWrap = document.createElement("div");
    logoWrap.id = "nt-logo-wrap";

    const logoImg = document.createElement("img");
    logoImg.id = "nt-logo";
    logoImg.alt = "Navigator";

    if (NAV_ICON_URL) {
      logoImg.src = NAV_ICON_URL;
    }

    logoWrap.appendChild(logoImg);

    const titleSpan = document.createElement("span");
    titleSpan.id = "nt-title-text";
    titleSpan.textContent = "Navigator";

    headerLeft.appendChild(logoWrap);
    headerLeft.appendChild(titleSpan);

    const headerRight = document.createElement("div");
    headerRight.id = "nt-header-right";

    const donateBtn = document.createElement("button");
    donateBtn.id = "nt-donate";
    donateBtn.title = "Donate / Support";

    const donateImg = document.createElement("img");
    donateImg.id = "nt-donate-icon";
    donateImg.alt = "Donate";

    if (DONATE_ICON_URL) {
      donateImg.src = DONATE_ICON_URL;
    }

    donateBtn.appendChild(donateImg);

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "nt-toggle";
    toggleBtn.title = "Toggle Navigator";
    toggleBtn.textContent = "⯈";

    headerRight.appendChild(donateBtn);
    headerRight.appendChild(toggleBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Tree-Container
    const treeDiv = document.createElement("div");
    treeDiv.id = "nt-tree";

    panel.appendChild(header);
    panel.appendChild(treeDiv);

    document.body.appendChild(panel);
    tree = treeDiv;

    const toggleFn = () => {
      panel.classList.toggle("collapsed");
    };

    toggleBtn.onclick = toggleFn;
    headerLeft.onclick = toggleFn;
    headerLeft.style.cursor = "pointer";

    if (DONATE_LINK_URL) {
      donateBtn.onclick = (e) => {
        e.stopPropagation();
        window.open(DONATE_LINK_URL, "_blank", "noopener");
      };
    }

    injectStyles();
    panel.addEventListener("click", onPanelClick);

    applyResponsiveLayout();
    window.addEventListener("resize", applyResponsiveLayout);
  }

  function injectStyles() {
    const css = `
      #nt-panel {
        position: fixed;
        top: 0; right: 0;
        width: var(--nt-panel-width, 330px);
        height: 100vh;
        background: #0f0f0f;
        color: white;
        z-index: 999999999;
        border-left: 2px solid #222;
        font-family: "Inter", system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        transition: transform 0.15s ease-out;
      }
      #nt-panel.collapsed {
        transform: translateX(calc(var(--nt-panel-width, 330px) - 40px));
      }

      #nt-header {
        padding: 8px 10px;
        background: #111;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
        gap: 6px;
      }

      #nt-header-left {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      #nt-logo-wrap {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        overflow: hidden;
        flex-shrink: 0;
      }

      #nt-logo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      #nt-title-text {
        font-size: 13px;
        white-space: nowrap;
      }

      #nt-header-right {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Donate-Button & Icon: beide 125px breit */
      #nt-donate {
        border: none;
        background: transparent;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 125px;
      }

      #nt-donate-icon {
        width: 125px;
        height: auto;
        display: block;
      }

      #nt-toggle {
        border: none;
        background: #222;
        color: #eee;
        border-radius: 4px;
        padding: 2px 6px;
        cursor: pointer;
        font-size: 12px;
        flex-shrink: 0;
      }

      #nt-toggle:hover,
      #nt-donate:hover img {
        filter: brightness(1.1);
      }

      #nt-tree {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        font-size: 13px;
      }

      .nt-item {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 12px;
        transition: background-color 0.15s ease-out, border-color 0.15s ease-out;
      }

      .nt-item.nt-active {
        border-color: #f97316;
        background: linear-gradient(90deg, #3b2410, #1a1a1a);
      }

      .nt-title,
      .nt-h1,
      .nt-code {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }

      .nt-title {
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .nt-h1 {
        margin-top: 6px;
        font-size: 14px;
      }

      .nt-code {
        margin-top: 6px;
        margin-left: 10px;
        background: #222;
        border: 1px solid #444;
        border-radius: 5px;
        padding: 6px;
        font-family: monospace;
      }

      .nt-sub {
        margin-left: 16px;
        padding-left: 10px;
        border-left: 1px solid #444;
      }

      .nt-title:hover,
      .nt-h1:hover,
      .nt-code:hover {
        background-color: #272727;
      }

      .navtree-highlight {
        outline: 3px solid #f97316;
        outline-offset: 3px;
        transition: outline-color 0.3s ease-out;
      }
    `;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------------------- Codeblock-Preview ----------------------
  function buildCodePreview(pre) {
    if (!pre) return "Codeblock";

    let language = "";
    const headerLang = pre.querySelector("div > div:first-child");
    if (headerLang) {
      language = (headerLang.innerText || headerLang.textContent || "").trim().split("\n")[0];
    }

    let codeText = "";
    const codeEl = pre.querySelector("code");
    if (codeEl) {
      codeText = codeEl.innerText || codeEl.textContent || "";
    } else {
      codeText = pre.innerText || pre.textContent || "";
    }

    const lines = codeText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const firstTwo = lines.slice(0, 2).join(" ⏎ ");

    let raw = "";
    if (language && firstTwo) {
      raw = `${language}: ${firstTwo}`;
    } else if (firstTwo) {
      raw = firstTwo;
    } else if (language) {
      raw = language;
    } else {
      raw = "Codeblock";
    }

    return short(raw, 80);
  }

  // ---------------------- Rebuild ----------------------
  function rebuild() {
    if (!tree) return;

    const msgs = getMessages();
    tree.innerHTML = "";
    targetMap.clear();
    navItemMap.clear();

    log("rebuild: found messages", msgs.length);

    msgs.forEach((msg, msgIndex) => {
      const role   = msg.dataset.messageAuthorRole;
      const isUser = role === "user";
      const icon   = isUser ? ICON_PROMPT : ICON_RESPONSE;

      const baseId    = `article${msgIndex + 1}`;
      const titleText = short(msg.textContent, 100);

      targetMap.set(baseId, msg);

      const box = document.createElement("div");
      box.className = "nt-item";

      const titleDiv = document.createElement("div");
      titleDiv.className = "nt-title nt-clickable";
      titleDiv.dataset.targetId = baseId;
      titleDiv.title = titleText;
      titleDiv.textContent = `${icon} #${msgIndex + 1}: ${titleText}`;
      box.appendChild(titleDiv);

      navItemMap.set(baseId, box);

      if (!isUser) {
        const sub = document.createElement("div");
        sub.className = "nt-sub";

        let hCount = 0;
        let cCount = 0;

        const blocks = msg.querySelectorAll("h1, pre");
        blocks.forEach(node => {
          if (node.tagName === "H1") {
            hCount += 1;
            const hId  = `${baseId}-h1-${hCount}`;
            const text = short(node.textContent || "", 150);

            targetMap.set(hId, node);

            const hDiv = document.createElement("div");
            hDiv.className = "nt-h1 nt-clickable";
            hDiv.dataset.targetId = hId;
            hDiv.title = text;
            hDiv.textContent = `${ICON_H1} ${text}`;
            sub.appendChild(hDiv);
          } else if (node.tagName === "PRE") {
            cCount += 1;
            const cId   = `${baseId}-code-${cCount}`;
            const label = buildCodePreview(node);

            targetMap.set(cId, node);

            const cDiv = document.createElement("div");
            cDiv.className = "nt-code nt-clickable";
            cDiv.dataset.targetId = cId;
            cDiv.title = label;
            cDiv.textContent = `${ICON_CODE} ${label}`;
            sub.appendChild(cDiv);
          }
        });

        box.appendChild(sub);
      }

      tree.appendChild(box);
    });

    scheduleSyncToScroll();
  }

  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer);

    const streaming = isStreaming();
    const delay = streaming ? 3000 : 300;
    log("scheduleRebuild: delay chosen", { delay, streaming });

    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      rebuild();
    }, delay);
  }

  // ---------------------- Panel-Klick ----------------------
  function onPanelClick(e) {
    const row = e.target.closest(".nt-clickable");
    if (!row) return;
    const id = row.dataset.targetId;
    jump(id);
  }

  // ---------------------- Scroll-Down-Button Hook ----------------------
  function onGlobalClickScrollDownHook(e) {
    const btn = e.target.closest("button.cursor-pointer");
    if (!btn) return;
    if (panel && panel.contains(btn)) return;

    const sc = getScrollContainer();
    if (!sc) return;

    if (!sc.contains(btn)) return;
    if (!btn.querySelector("svg")) return;

    setTimeout(() => {
      scrollNavigatorToEnd();
    }, 100);
  }

  // ---------------------- Observer ----------------------
  function initObserver() {
    const observer = new MutationObserver(mutations => {
      const relevant = mutations.some(m => !panel || !panel.contains(m.target));
      if (!relevant) return;
      scheduleRebuild();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    log("observer: attached to document.body");
  }

  // ---------------------- Init ----------------------
  function init() {
    createPanel();
    scheduleRebuild();
    initObserver();
    startScrollPoller();
    document.addEventListener("click", onGlobalClickScrollDownHook, true);
    log("initialized");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
