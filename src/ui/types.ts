import type { SlideItem } from '../slides/templates';

export interface SlideActions {
  open: (item: SlideItem) => void;
  copy: (item: SlideItem) => void;
  download: (item: SlideItem) => void;
  toggleSelect: (item: SlideItem) => void;
}
