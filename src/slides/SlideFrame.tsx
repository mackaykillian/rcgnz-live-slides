import type { ReactNode } from 'react';
import { useElementWidth } from '../lib/useElementWidth';

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

/**
 * A 16:9 box that renders its slide at the native 1920×1080 (1:1 with Figma)
 * and scales it to whatever width the box is given — thumbnails, list rows and
 * the large preview all render the exact same component.
 */
export function SlideFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return (
    <div ref={ref} className={`relative aspect-video w-full overflow-hidden ${className}`}>
      {width > 0 && (
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${width / SLIDE_WIDTH})` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
