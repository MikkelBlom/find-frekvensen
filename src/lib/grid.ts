// Choose a column count for N fields that fills a 16:9 TV nicely and keeps every
// field the same size. Rows follow from ceil(n / cols).

const COLUMNS_BY_COUNT: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 4,
  9: 3,
  10: 5,
};

export function gridColumns(n: number): number {
  return COLUMNS_BY_COUNT[n] ?? Math.ceil(Math.sqrt(n));
}

export function gridRows(n: number): number {
  return Math.ceil(n / gridColumns(n));
}
