import { useCallback, useEffect, useState } from 'react';
import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';

import { APP_MAX_WIDTH } from '@/constants/theme';

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Width of the app column: the window on phones, capped on desktop browsers. */
export const useAppWidth = () => Math.min(useWindowDimensions().width, APP_MAX_WIDTH);

/** Measured width of a view for charts and pagers; `fallback` until the first layout pass. */
export function useWidth(fallback = 0): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width)), []);
  return [width || fallback, onLayout];
}
