const SCREENSHOT_LIMIT_BYTES = 32 * 1024 * 1024;
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Conservative pre-encode bound: raw RGBA bytes plus base64 overhead, plus the
// data-URL prefix. Real PNGs are smaller; refusing above this bound never
// allocates or transfers a huge image to discover it is oversized.
function maxPixelsForLimit(limit = SCREENSHOT_LIMIT_BYTES) {
  return Math.floor((limit * 3) / 4 / 4);
}

function validateScreenshotData(data, limit = SCREENSHOT_LIMIT_BYTES) {
  if (typeof data !== 'string' || !data.startsWith(PNG_DATA_URL_PREFIX)) return { ok: false, error: 'That screenshot was not a PNG image. Try again.' };
  if (data.length > limit) return { ok: false, error: 'That screenshot is too large to save (over 32 MiB encoded). Select a lower capture mode and try again.' };
  let bytes;
  try { bytes = Buffer.from(data.slice(PNG_DATA_URL_PREFIX.length), 'base64'); }
  catch { return { ok: false, error: 'That screenshot could not be decoded. Try again.' }; }
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) return { ok: false, error: 'That screenshot was not a valid PNG image. Try again.' };
  return { ok: true, bytes };
}

// Scheme-aware reveal decision for the persisted last capture. Local files use
// the OS file manager; anything else gets a clear message instead of a silent
// or failing reveal. `exists` is injected so tests do not touch disk.
function lastCaptureAction(uri, exists = true) {
  if (!uri) return { kind: 'none' };
  if (uri.scheme !== 'file') return { kind: 'remote' };
  if (!exists) return { kind: 'missing' };
  return { kind: 'reveal' };
}

module.exports = { SCREENSHOT_LIMIT_BYTES, PNG_DATA_URL_PREFIX, maxPixelsForLimit, validateScreenshotData, lastCaptureAction };
