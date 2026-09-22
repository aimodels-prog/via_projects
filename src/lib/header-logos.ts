export const MAX_HEADER_LOGOS = 12;
export type HeaderLogo = { name: string; dataUrl: string };
/** Equal-size cells, with every row independently centred. Coordinates measured from page top. */
export function headerLogoLayout(count: number, pageWidth = 595.32) {
  if (!Number.isInteger(count) || count < 0 || count > MAX_HEADER_LOGOS)
    throw new Error("Use up to 12 header logos per A4 report.");
  if (!count) return { height: 0, boxes: [] };
  const rows = Math.ceil(count / 4),
    columns = Math.ceil(count / rows);
  const cellWidth = (pageWidth - 48 - (columns - 1) * 12) / columns;
  const boxes = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns),
      column = i % columns;
    const inRow = Math.min(columns, count - row * columns);
    const rowWidth = inRow * cellWidth + (inRow - 1) * 12;
    return {
      x: (pageWidth - rowWidth) / 2 + column * (cellWidth + 12),
      top: 16 + row * 48,
      width: cellWidth,
      height: 36,
    };
  });
  return { height: 16 + rows * 48, boxes };
}
