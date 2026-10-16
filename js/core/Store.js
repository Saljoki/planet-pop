/**
 * What the game remembers between visits, kept in this browser's localStorage. Storage can be missing or blocked
 * (private browsing, strict settings), so every read falls back to a default and every write may quietly do nothing.
 * Keys all start with "planetpop." and the stored formats never change, so saved progress survives updates.
 */

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key, text) {
  try { localStorage.setItem(key, text); } catch { /* storage unavailable */ }
}

/** A JSON value, or `fallback` if there's nothing (or nothing readable) saved. */
export function loadJson(key, fallback) {
  const text = read(key);
  if (text === null) return fallback;
  try { return JSON.parse(text) ?? fallback; } catch { return fallback; }
}

export function saveJson(key, value) { write(key, JSON.stringify(value)); }

/** An on/off switch saved as '1' or '0'. */
export function loadFlag(key, fallback) {
  const text = read(key);
  return text === null ? fallback : text === '1';
}

export function saveFlag(key, on) { write(key, on ? '1' : '0'); }

/** A number saved as text. */
export function loadNumber(key, fallback) {
  const text = read(key), n = Number(text);
  return text === null || !Number.isFinite(n) ? fallback : n;
}

export function saveNumber(key, n) { write(key, String(n)); }

export function forget(key) {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

/** Exactly what's saved under `key` (null if nothing), and putting it back: for save codes (SaveCode.js). */
export function loadText(key) { return read(key); }

export function saveText(key, text) { write(key, text); }

let keeping = null;
/**
 * Ask the browser to keep what's saved here even when it's short of space or the site hasn't been visited for a
 * while (Safari clears sites after a week otherwise). Browsers decide for themselves (some ask the player), so it's
 * asked once a visit, and only once there's progress worth keeping.
 */
export function keepSaves() {
  keeping ??= (async () => {
    try { return (await navigator.storage?.persisted?.()) || !!(await navigator.storage?.persist?.()); } catch { return false; }
  })();
  return keeping;
}
