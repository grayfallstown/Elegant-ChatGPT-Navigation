// src/logging.js
// 🧠 Konsolidiertes Logging mit Emojis und Speicher-Puffer

const GLOBAL_LOG_KEY = "ECGPTN_LOGS";
const GLOBAL_DEBUG_FLAG = "ECGPTN_DEBUG";

const LEVELS = {
  trace: { emoji: "🧵", priority: 10 },
  debug: { emoji: "🐛", priority: 20 },
  info:  { emoji: "ℹ️", priority: 30 },
  warn:  { emoji: "⚠️", priority: 40 },
  error: { emoji: "💥", priority: 50 }
};

let spanCounter = 0;
let traceCounter = 0;

/**
 * Stellt sicher, dass globale Puffer/Flags existieren
 */
function ensureGlobals() {
  const g = globalThis;

  if (!Object.prototype.hasOwnProperty.call(g, GLOBAL_LOG_KEY)) {
    Object.defineProperty(g, GLOBAL_LOG_KEY, {
      value: [],
      writable: true,
      configurable: true
    });
  }

  if (!Object.prototype.hasOwnProperty.call(g, GLOBAL_DEBUG_FLAG)) {
    Object.defineProperty(g, GLOBAL_DEBUG_FLAG, {
      value: true,
      writable: true,
      configurable: true
    });
  }
}

/**
 * Erstellt UTC-Zeitstempel im ISO-Format
 */
function utcNowIso() {
  return new Date().toISOString();
}

/**
 * Schreibt Log-Eintrag in globalen Puffer und gibt auf Konsole aus
 */
function pushLog(entry) {
  ensureGlobals();
  const list = globalThis[GLOBAL_LOG_KEY];
  list.push(entry);

  const prefix = `[ECGPTN][${entry.scope}][${entry.level.toUpperCase()}]`;
  const emoji = entry.emoji || "";
  if (entry.data !== undefined) {
    console.log(emoji, prefix, entry.message, entry.data);
  } else {
    console.log(emoji, prefix, entry.message);
  }
}

/**
 * Factory für einen bereichsspezifischen Logger
 */
export function createLogger(scope) {
  ensureGlobals();

  function emit(level, message, data, spanInfo) {
    const meta = LEVELS[level] || LEVELS.info;
    const debug = !!globalThis[GLOBAL_DEBUG_FLAG];

    if (!debug && meta.priority < LEVELS.info.priority) {
      // Wenn Debug aus ist, trace/debug Level ignorieren
      return;
    }

    const entry = {
      timestamp: utcNowIso(),
      level,
      emoji: meta.emoji,
      scope,
      message,
      data,
      traceId: spanInfo ? spanInfo.traceId : undefined,
      spanId: spanInfo ? spanInfo.spanId : undefined
    };

    pushLog(entry);
  }

  function startSpan(message, data) {
    const traceId = `t-${++traceCounter}`;
    const spanId = `s-${++spanCounter}`;

    emit("trace", `▶️ span start: ${message}`, data, { traceId, spanId });

    return {
      traceId,
      spanId,
      event: (msg, extra) => emit("trace", msg, extra, { traceId, spanId }),
      end: (extra) => emit("trace", `⏹ span end: ${message}`, extra, { traceId, spanId }),
      error: (err) => emit("error", `❌ span error: ${message}`, { error: String(err) }, { traceId, spanId })
    };
  }

  return {
    trace: (msg, data) => emit("trace", msg, data),
    debug: (msg, data) => emit("debug", msg, data),
    info:  (msg, data) => emit("info", msg, data),
    warn:  (msg, data) => emit("warn", msg, data),
    error: (msg, data) => emit("error", msg, data),
    startSpan
  };
}