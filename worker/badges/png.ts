/**
 * Stamp a PNG with its print resolution (pHYs chunk), so print/design tools
 * open the badge at its physical size instead of assuming 72 DPI.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const SIGNATURE_LENGTH = 8;

/** Returns a copy of `png` with a pHYs chunk for `dpi` (any existing pHYs is replaced). */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Uint8Array[] = [png.subarray(0, SIGNATURE_LENGTH)];
  let offset = SIGNATURE_LENGTH;

  while (offset < png.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (type !== 'pHYs') chunks.push(png.subarray(offset, end));
    if (type === 'IHDR') chunks.push(physChunk(dpi));
    offset = end;
  }

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

function physChunk(dpi: number): Uint8Array {
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1; // unit: meter
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/** Read back the DPI (for tests and sanity checks). */
export function readPngDpi(png: Uint8Array): number | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let offset = SIGNATURE_LENGTH; offset < png.byteLength; ) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === 'pHYs') return Math.round(view.getUint32(offset + 8) * 0.0254);
    offset += 12 + length;
  }
  return null;
}
