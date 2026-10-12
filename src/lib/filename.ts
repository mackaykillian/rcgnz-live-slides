import { templateById, type SlideItem } from '../slides/templates';
import { fileStamp } from './time';

/** "Make It Count: Building a…" → "MakeItCountBuildingA…" */
export function pascalCase(text: string, maxLength = 80): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' And ')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join('')
    .slice(0, maxLength);
}

/**
 * `11092026_1345_SessionNameGoesHere_Standard.png`
 * Start date/time first so files sort chronologically; the template suffix keeps
 * a session's three slides from overwriting each other.
 */
export function slideFileName(item: SlideItem): string {
  const template = templateById[item.template].fileLabel;
  if (!item.session) return `${template}.png`;
  const stamp = item.session.start ? `${fileStamp(item.session.start)}_` : '';
  return `${stamp}${pascalCase(item.title) || 'Session'}_${template}.png`;
}
