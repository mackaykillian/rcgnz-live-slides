import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { domToBlob } from 'modern-screenshot';
import { slideFileName } from '../lib/filename';
import { Slide } from '../slides/Slide';
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../slides/SlideFrame';
import type { SlideItem } from '../slides/templates';

/** 1920×1080 × 2 = 3840×2160 (4K UHD). */
const EXPORT_SCALE = 2;

const SLIDE_FONTS = [
  '400 56px Crystal',
  '500 18px Crystal',
  '600 32px Crystal',
  '400 28px "Space Mono"',
  '700 72px "Space Mono"',
  'italic 400 100px Emilio',
];

async function waitForAssets(node: HTMLElement) {
  await Promise.all(SLIDE_FONTS.map((font) => document.fonts.load(font).catch(() => [])));
  await document.fonts.ready;
  await Promise.all(
    Array.from(node.querySelectorAll('img')).map((img) => img.decode().catch(() => undefined)),
  );
}

/**
 * Render a slide off-screen at its native 1920×1080 and capture it as a 4K PNG.
 * Each export mounts a fresh copy, so it never depends on what's visible.
 */
export async function renderSlidePng(item: SlideItem): Promise<Blob> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-${SLIDE_WIDTH * 2}px;top:0;width:${SLIDE_WIDTH}px;height:${SLIDE_HEIGHT}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() => root.render(<Slide item={item} />));
    const node = host.firstElementChild as HTMLElement;
    await waitForAssets(node);
    return await domToBlob(node, {
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      scale: EXPORT_SCALE,
      type: 'image/png',
      backgroundColor: '#020e1e',
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Copy one slide to the clipboard as a 4K PNG. */
export async function copySlide(item: SlideItem): Promise<void> {
  // Pass the promise straight to ClipboardItem so Safari keeps the click's user activation.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderSlidePng(item) })]);
}

export async function downloadSlide(item: SlideItem): Promise<void> {
  saveBlob(await renderSlidePng(item), slideFileName(item));
}

/** Download several slides — a single PNG for one, otherwise a .zip. */
export async function downloadSlides(
  items: SlideItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (items.length === 1) return downloadSlide(items[0]!);

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();

  for (const [i, item] of items.entries()) {
    onProgress?.(i, items.length);
    let name = slideFileName(item);
    for (let n = 2; used.has(name); n++) name = slideFileName(item).replace(/\.png$/, `_${n}.png`);
    used.add(name);
    zip.file(name, await renderSlidePng(item));
  }
  onProgress?.(items.length, items.length);

  // PNGs are already compressed — STORE keeps zipping fast.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  saveBlob(blob, `RCGNZ-Slides_${items.length}.zip`);
}
