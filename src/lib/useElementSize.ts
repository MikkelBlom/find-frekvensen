import { useEffect, useRef, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

/**
 * Observe an element's content-box size. Used so each field canvas can size its
 * backing store to the CSS pixels it actually occupies (crisp at any DPI).
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
