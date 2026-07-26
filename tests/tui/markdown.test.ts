import { describe, expect, test } from "bun:test";

import { renderTerminalMarkdown } from "../../src/tui";
import { TuiStyle } from "../../src/tui/style";

describe("renderTerminalMarkdown", () => {
  test("renders headings, lists, quotes, links, and inline styles", () => {
    const lines = renderTerminalMarkdown(
      [
        "## Research update",
        "- **Primary** evidence from [source](https://example.com)",
        "> Confidence is *moderate*.",
        "`complete`",
      ].join("\n"),
      80,
      new TuiStyle(false),
    );

    expect(lines.map((line) => line.value)).toEqual([
      "Research update",
      "• Primary evidence from source (https://example.com)",
      "│ Confidence is moderate.",
      "complete",
    ]);
  });

  test("renders fenced code and wraps long lines", () => {
    const lines = renderTerminalMarkdown(
      "```text\nresearch --all --verify\n```\nA deliberately long sentence that must wrap.",
      24,
      new TuiStyle(false),
    );

    expect(lines.map((line) => line.value)).toEqual([
      "│ research --all",
      "  --verify",
      "A deliberately long",
      "sentence that must wrap.",
    ]);
  });

  test("removes terminal control characters from untrusted logs", () => {
    const lines = renderTerminalMarkdown(
      "Safe\u001B[2J text\taligned",
      80,
      new TuiStyle(false),
    );

    expect(lines.map((line) => line.value)).toEqual(["Safe[2J text aligned"]);
  });

  test("wraps Chinese text by terminal columns", () => {
    const lines = renderTerminalMarkdown(
      "- Starting **正在核验公开履历时间线，并对比多个独立来源，确认相关字段何时发生变化。**",
      24,
      new TuiStyle(false),
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((line) => line.value).join("\n")).not.toContain("**");
    for (const line of lines) {
      expect(line.visibleLength).toBe(Bun.stringWidth(line.value));
      expect(line.visibleLength).toBeLessThanOrEqual(24);
    }
  });
});
