const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

/**
 * Returns the number of terminal columns occupied by text.
 *
 * @internal
 */
export function terminalTextWidth(value: string): number {
  return Bun.stringWidth(value);
}

/**
 * Truncates text to a terminal column width and appends an ellipsis.
 *
 * @internal
 */
export function truncateTerminalText(
  value: string,
  maximumWidth: number,
): string {
  const width = Math.max(maximumWidth, 0);
  if (terminalTextWidth(value) <= width) {
    return value;
  }
  if (width === 0) {
    return "";
  }

  const contentWidth = width - terminalTextWidth("…");
  let result = "";
  let resultWidth = 0;
  for (const { segment } of graphemeSegmenter.segment(value)) {
    const segmentWidth = terminalTextWidth(segment);
    if (resultWidth + segmentWidth > contentWidth) {
      break;
    }
    result += segment;
    resultWidth += segmentWidth;
  }
  return `${result}…`;
}

/**
 * Returns user-perceived characters without splitting emoji sequences.
 *
 * @internal
 */
export function terminalGraphemes(value: string): string[] {
  return [...graphemeSegmenter.segment(value)].map(({ segment }) => segment);
}
