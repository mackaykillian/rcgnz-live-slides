import { routeHref } from '../../lib/useRoute';
import { Slide } from '../../slides/Slide';
import { SlideFrame } from '../../slides/SlideFrame';
import type { ResolvedDeck } from '../../slideshows/deck';

/**
 * Back-to-front stack of the deck's first three session slides, positioned as in the
 * Figma "Preview Stack" (percentages of the card's preview box).
 */
const STACK = [
  { top: '15.69%', left: '28.13%', width: '43.74%' }, // 3rd slide (back)
  { top: '21.72%', left: '19.2%', width: '61.6%' }, // 2nd slide
  { top: '28.36%', left: '12.95%', width: '74.35%' }, // 1st slide (front)
];

function DeckCard({ deck }: { deck: ResolvedDeck }) {
  // Skip separators (every deck starts with the Holding slide) so each card shows its own sessions.
  const first = deck.items.filter((item) => item.slide.session).slice(0, 3);
  const layers = STACK.slice(3 - first.length).map((pos, i) => ({ pos, item: first[first.length - 1 - i]! }));
  const count = deck.items.length;

  return (
    <a
      href={routeHref({ section: 'slideshow', deck: deck.definition.id, slide: null })}
      className="group flex flex-col gap-[8px] rounded-[16px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <div className="relative aspect-[269/199] w-full overflow-hidden rounded-[16px] bg-white/10 transition-colors group-hover:bg-white/15">
        {layers.map(({ pos, item }) => (
          <div key={item.key} className="absolute drop-shadow-[0px_-4px_5px_rgba(37,108,250,0.25)]" style={pos}>
            <SlideFrame>
              <Slide item={item.slide} />
            </SlideFrame>
          </div>
        ))}
        {count === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-[12px] text-white/50">No sessions yet</p>
        )}
      </div>
      <div className="flex flex-col gap-[4px] text-[12px] leading-[1.5]">
        <p className="text-white">{deck.definition.name}</p>
        <p className="text-[#e5e5e5]">
          {count} slide{count === 1 ? '' : 's'}
        </p>
      </div>
    </a>
  );
}

export function SlideshowGallery({ decks }: { decks: ResolvedDeck[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-[16px] gap-y-[24px]">
      {decks.map((deck) => (
        <DeckCard key={deck.definition.id} deck={deck} />
      ))}
    </div>
  );
}
