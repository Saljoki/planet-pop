import { loadText, saveText } from './Store.js';

/** What a save carries: progress, trophies and options (not this device's quality, tilt or volume settings). */
export const SAVED_KEYS = ['planetpop.courier', 'planetpop.best', 'planetpop.trophies', 'planetpop.worlds', 'planetpop.settings'];
const PACKED = 'PLANETPOP1-', PLAIN = 'PLANETPOP0-'; // compressed, and plain for browsers without CompressionStream
const MAX = 200000; // characters: far more than any real save

/**
 * A save code: everything in SAVED_KEYS as one line of text, to copy to another phone or browser (or keep in a file)
 * and load there with readSaveCode() + applySave(). Compressed where the browser can.
 */
export async function makeSaveCode() {
  const data = {};
  for (const key of SAVED_KEYS) {
    const text = loadText(key);
    if (text !== null) data[key] = text;
  }
  const json = JSON.stringify({ v: 1, data });
  if (typeof CompressionStream === 'undefined') return PLAIN + toBase64(new TextEncoder().encode(json));
  return PACKED + toBase64(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

/** The saved values in a save code ({ key: text }), or an Error saying what's wrong with it. */
export async function readSaveCode(code) {
  const text = String(code ?? '').replace(/\s+/g, '');
  if (text.length > MAX) throw new Error('That save code is far too long.');
  let bytes;
  try {
    if (text.startsWith(PACKED)) {
      if (typeof DecompressionStream === 'undefined') throw new Error('old browser');
      bytes = await pipe(fromBase64(text.slice(PACKED.length)), new DecompressionStream('deflate-raw'));
    } else if (text.startsWith(PLAIN)) bytes = fromBase64(text.slice(PLAIN.length));
    else throw new Error('not a save code');
  } catch (err) {
    throw new Error(err.message === 'old browser' ? 'This browser is too old to open that save code.' : 'That isn’t a Planet Pop save code.');
  }
  let save;
  try { save = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('That save code is damaged.'); }
  if (save?.v !== 1 || typeof save.data !== 'object' || !save.data) throw new Error('That save code is damaged.');
  const data = {};
  for (const key of SAVED_KEYS) {
    const value = save.data[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new Error('That save code is damaged.');
    try { JSON.parse(value); } catch { throw new Error('That save code is damaged.'); }
    data[key] = value;
  }
  if (!Object.keys(data).length) throw new Error('That save code is empty.');
  return data;
}

/** Replace what's saved here with a save's values (the page then reloads to pick them up). */
export function applySave(data) {
  for (const [key, text] of Object.entries(data)) if (SAVED_KEYS.includes(key)) saveText(key, text);
}

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('bad characters');
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
