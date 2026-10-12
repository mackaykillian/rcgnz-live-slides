import { useCallback, useEffect, useRef, useState } from 'react';

// One ResizeObserver shared by every slide thumbnail instead of one per card.
const callbacks = new WeakMap<Element, (width: number) => void>();
let observer: ResizeObserver | null = null;

function getObserver() {
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) callbacks.get(entry.target)?.(entry.contentRect.width);
  });
  return observer;
}

/** Track an element's content width. Returns a callback ref and the current width. */
export function useElementWidth<T extends Element>(): [(node: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const nodeRef = useRef<T | null>(null);

  const ref = useCallback((node: T | null) => {
    if (nodeRef.current) {
      getObserver().unobserve(nodeRef.current);
      callbacks.delete(nodeRef.current);
    }
    nodeRef.current = node;
    if (node) {
      callbacks.set(node, setWidth);
      getObserver().observe(node);
    }
  }, []);

  useEffect(
    () => () => {
      if (nodeRef.current) getObserver().unobserve(nodeRef.current);
    },
    [],
  );

  return [ref, width];
}
