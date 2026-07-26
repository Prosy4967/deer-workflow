import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deepResearchReportSchema,
  presentationCommand,
  renderHtmlReport,
  researchDiscoverySchema,
  researchFindingSchema,
  saveHtmlReport,
} from "../../examples/deep-research/workflow";

describe("Deep Research report", () => {
  test("uses Codex-compatible structured output schemas", () => {
    expect(JSON.stringify(researchDiscoverySchema)).not.toContain(
      '"format":"uri"',
    );
    expect(JSON.stringify(researchFindingSchema)).not.toContain(
      '"format":"uri"',
    );
    expect(JSON.stringify(deepResearchReportSchema)).not.toContain(
      '"format":"uri"',
    );
  });

  test("renders a safe, self-contained paper-style HTML document", () => {
    const html = renderHtmlReport(
      {
        title: "Agents & <Workflows>",
        executiveSummary: "Evidence suggests measurable progress.",
        sections: [
          {
            kicker: "Market signal",
            title: "Primary **evidence**",
            lede: "A source-backed section.",
            paragraphs: [
              "The evidence supports a developed editorial argument.",
            ],
            keyPoints: ["A concise takeaway."],
            sources: [
              "https://example.com/research?q=agents&year=2026",
              "javascript:alert(1)",
            ],
          },
        ],
        limitations: ["Coverage is incomplete."],
      },
      "Are <agents> improving?",
    );

    expect(html).toStartWith("<!DOCTYPE html>");
    expect(html).toContain("--paper:#f4f1eb");
    expect(html).toContain("--cobalt:#0a4ecb");
    expect(html).toContain('class="hero"');
    expect(html).toContain('class="evidence-board"');
    expect(html).toContain('class="report-section"');
    expect(html).toContain("01 / Market signal");
    expect(html).toContain("The evidence supports");
    expect(html).not.toContain(">Research question<");
    expect(html).not.toContain(">Evidence synthesis<");
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('id="toc"');
    expect(html).toContain('id="filter"');
    expect(html).toContain("Agents &amp; &lt;Workflows&gt;");
    expect(html).toContain("Are &lt;agents&gt; improving?");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<link ");
    expect(html).not.toContain("<img ");
  });

  test("writes the report to a file and returns its absolute path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "deer-deep-research-"));
    const requestedPath = join(directory, "reports", "result.html");

    try {
      const outputPath = await saveHtmlReport(
        "<!DOCTYPE html><title>Research</title>",
        requestedPath,
      );

      expect(outputPath).toBe(requestedPath);
      expect(await readFile(outputPath, "utf8")).toBe(
        "<!DOCTYPE html><title>Research</title>",
      );

      const secondOutputPath = await saveHtmlReport(
        "<!DOCTYPE html><title>Second report</title>",
        requestedPath,
      );
      expect(secondOutputPath).toBe(
        join(directory, "reports", "result-2.html"),
      );
      expect(await readFile(secondOutputPath, "utf8")).toBe(
        "<!DOCTYPE html><title>Second report</title>",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("uses the native operating system command to present the report", () => {
    expect(presentationCommand("/tmp/report.html", "darwin")).toEqual([
      "open",
      "/tmp/report.html",
    ]);
    expect(presentationCommand("/tmp/report.html", "linux")).toEqual([
      "xdg-open",
      "/tmp/report.html",
    ]);
    expect(presentationCommand("C:\\report.html", "win32")).toEqual([
      "explorer.exe",
      "C:\\report.html",
    ]);
  });
});
