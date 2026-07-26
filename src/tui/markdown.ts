import type { TuiStyle } from "./style";
import { terminalGraphemes, terminalTextWidth } from "./terminal-text";

export interface RenderedMarkdownLine {
  readonly value: string;
  readonly visibleLength: number;
}

type InlineStyle = "bold" | "code" | "dim" | "link" | "normal";

interface InlineSpan {
  readonly style: InlineStyle;
  readonly text: string;
}

interface InlineUnit {
  readonly style: InlineStyle;
  readonly text: string;
}

/**
 * Renders a practical Markdown subset into styled, wrapped terminal lines.
 *
 * @param markdown - Original Markdown log message.
 * @param width - Available terminal columns.
 * @param style - Terminal style provider.
 * @returns Styled lines and their visible widths.
 * @internal
 */
export function renderTerminalMarkdown(
  markdown: string,
  width: number,
  style: TuiStyle,
): RenderedMarkdownLine[] {
  const lines: RenderedMarkdownLine[] = [];
  let inCodeFence = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const sourceLine = sanitizeTerminalText(rawLine);
    if (/^\s*```/.test(sourceLine)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      appendWrapped(lines, sourceLine, width, "│ ", style, "code");
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(sourceLine);
    if (heading?.[2] !== undefined) {
      appendWrapped(lines, heading[2], width, "", style, "heading");
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(sourceLine);
    if (unordered?.[1] !== undefined) {
      appendWrapped(lines, unordered[1], width, "• ", style, "normal");
      continue;
    }

    const ordered = /^\s*(\d+\.)\s+(.+)$/.exec(sourceLine);
    if (ordered?.[1] !== undefined && ordered[2] !== undefined) {
      appendWrapped(
        lines,
        ordered[2],
        width,
        `${ordered[1]} `,
        style,
        "normal",
      );
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(sourceLine);
    if (quote?.[1] !== undefined) {
      appendWrapped(lines, quote[1], width, "│ ", style, "quote");
      continue;
    }

    if (!sourceLine.trim()) {
      lines.push({ value: "", visibleLength: 0 });
      continue;
    }

    appendWrapped(lines, sourceLine, width, "", style, "normal");
  }

  return lines;
}

function sanitizeTerminalText(value: string): string {
  return [...value]
    .map((character) => {
      if (character === "\t") {
        return "  ";
      }
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || (codePoint >= 127 && codePoint <= 159)
        ? ""
        : character;
    })
    .join("");
}

function appendWrapped(
  output: RenderedMarkdownLine[],
  content: string,
  width: number,
  prefix: string,
  style: TuiStyle,
  kind: "code" | "heading" | "normal" | "quote",
): void {
  const prefixWidth = terminalTextWidth(prefix);
  const contentWidth = Math.max(width - prefixWidth, 1);
  const wrapped = wrapInlineMarkdown(content, contentWidth, style);

  for (let index = 0; index < wrapped.length; index += 1) {
    const linePrefix = index === 0 ? prefix : " ".repeat(prefixWidth);
    const line = wrapped[index] ?? { plain: "", rendered: "" };
    const plain = `${linePrefix}${line.plain}`;
    const rendered = `${linePrefix}${line.rendered}`;
    output.push({
      value:
        kind === "heading"
          ? style.bold(rendered)
          : kind === "code"
            ? style.yellow(rendered)
            : kind === "quote"
              ? style.dim(rendered)
              : rendered,
      visibleLength: terminalTextWidth(plain),
    });
  }
}

function wrapInlineMarkdown(
  value: string,
  width: number,
  style: TuiStyle,
): Array<{ readonly plain: string; readonly rendered: string }> {
  const units = parseInlineMarkdown(value).flatMap((span) =>
    terminalGraphemes(span.text).map((text) => ({
      text,
      style: span.style,
    })),
  );
  const words = groupWords(units);
  const lines: InlineUnit[][] = [];
  let current: InlineUnit[] = [];

  for (const word of words) {
    const separator: InlineUnit[] =
      current.length === 0 ? [] : [{ text: " ", style: "normal" }];
    const candidate = [...current, ...separator, ...word];
    if (unitsWidth(candidate) <= width) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
    }

    if (unitsWidth(word) > width) {
      const chunks = splitStyledUnits(word, width);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) ?? [];
    } else {
      current = word;
    }
  }

  if (current.length > 0 || lines.length === 0) {
    lines.push(current);
  }
  return lines.map((line) => ({
    plain: line.map((unit) => unit.text).join(""),
    rendered: renderInlineUnits(line, style),
  }));
}

function parseInlineMarkdown(value: string): InlineSpan[] {
  const pattern =
    /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\)/g;
  const spans: InlineSpan[] = [];
  let previousIndex = 0;

  for (const match of value.matchAll(pattern)) {
    const matchIndex = match.index;
    if (matchIndex > previousIndex) {
      spans.push({
        text: value.slice(previousIndex, matchIndex),
        style: "normal",
      });
    }

    if (match[1] !== undefined) {
      spans.push({ text: match[1], style: "code" });
    } else if (match[2] !== undefined || match[3] !== undefined) {
      spans.push({ text: match[2] ?? match[3] ?? "", style: "bold" });
    } else if (match[4] !== undefined || match[5] !== undefined) {
      spans.push({ text: match[4] ?? match[5] ?? "", style: "dim" });
    } else if (match[6] !== undefined && match[7] !== undefined) {
      spans.push({ text: match[6], style: "link" });
      spans.push({ text: ` (${match[7]})`, style: "dim" });
    }
    previousIndex = matchIndex + match[0].length;
  }

  if (previousIndex < value.length) {
    spans.push({ text: value.slice(previousIndex), style: "normal" });
  }
  return spans;
}

function groupWords(units: readonly InlineUnit[]): InlineUnit[][] {
  const words: InlineUnit[][] = [];
  let current: InlineUnit[] = [];
  for (const unit of units) {
    if (/\s/u.test(unit.text)) {
      if (current.length > 0) {
        words.push(current);
        current = [];
      }
    } else {
      current.push(unit);
    }
  }
  if (current.length > 0) {
    words.push(current);
  }
  return words;
}

function splitStyledUnits(
  units: readonly InlineUnit[],
  width: number,
): InlineUnit[][] {
  const chunks: InlineUnit[][] = [];
  let current: InlineUnit[] = [];
  let currentWidth = 0;
  for (const unit of units) {
    const unitWidth = terminalTextWidth(unit.text);
    if (current.length > 0 && currentWidth + unitWidth > width) {
      chunks.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(unit);
    currentWidth += unitWidth;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function unitsWidth(units: readonly InlineUnit[]): number {
  return terminalTextWidth(units.map((unit) => unit.text).join(""));
}

function renderInlineUnits(
  units: readonly InlineUnit[],
  style: TuiStyle,
): string {
  let rendered = "";
  let currentStyle: InlineStyle | undefined;
  let currentText = "";
  const flush = (): void => {
    if (!currentText || currentStyle === undefined) {
      return;
    }
    rendered +=
      currentStyle === "bold"
        ? style.bold(currentText)
        : currentStyle === "code"
          ? style.yellow(currentText)
          : currentStyle === "dim"
            ? style.dim(currentText)
            : currentStyle === "link"
              ? style.cyan(currentText)
              : currentText;
    currentText = "";
  };

  for (const unit of units) {
    if (unit.style !== currentStyle) {
      flush();
      currentStyle = unit.style;
    }
    currentText += unit.text;
  }
  flush();
  return rendered;
}
