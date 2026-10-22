import { PDFDocument } from 'pdf-lib';
import { BLEED, BLEED_HEIGHT, BLEED_WIDTH, PAGE_HEIGHT, PAGE_WIDTH, SLUG, TRIM_HEIGHT, TRIM_WIDTH } from '../../shared/badges';

/**
 * Mark where to cut on every page: TrimBox (the finished 3.5" × 5.5" badge) and
 * BleedBox (trim + 0.125" bleed). Prepress tools read these instead of guessing
 * from the crop marks. Chrome's PDF output only sets the MediaBox (the page).
 */
export async function setPrintBoxes(pdf: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  for (const page of doc.getPages()) {
    page.setMediaBox(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    page.setBleedBox(SLUG, SLUG, BLEED_WIDTH, BLEED_HEIGHT);
    page.setTrimBox(SLUG + BLEED, SLUG + BLEED, TRIM_WIDTH, TRIM_HEIGHT);
  }
  return doc.save();
}
