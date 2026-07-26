import { mkdir, open } from "node:fs/promises";
import { basename, dirname, extname, parse, resolve } from "node:path";

import { agent } from "@deerwork-ai/deer-workflow/agents";
import { parallel, phase } from "@deerwork-ai/deer-workflow/flow";
import { log } from "@deerwork-ai/deer-workflow/logging";

import type {
  DeepResearchInput,
  DeepResearchReport,
  DeepResearchResult,
  ResearchDiscovery,
  ResearchFinding,
} from "./types";

/**
 * Declares the Workflow's identity and observable phase plan.
 */
export const meta = {
  name: "deep-research",
  description:
    "Scopes a question, researches independent angles, and synthesizes a sourced report.",
  phases: [
    { title: "Discover" },
    { title: "Plan" },
    { title: "Research" },
    { title: "Synthesis" },
    { title: "Present" },
  ],
  exampleArgs: {
    question: "How are Agent Skills and Dynamic Workflows evolving?",
  },
};

/**
 * Codex-compatible schema for the initial scoping search.
 */
export const researchDiscoverySchema = {
  type: "object",
  properties: {
    overview: { type: "string" },
    keyFacts: {
      type: "array",
      items: { type: "string" },
    },
    ambiguities: {
      type: "array",
      items: { type: "string" },
    },
    sources: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["overview", "keyFacts", "ambiguities", "sources"],
  additionalProperties: false,
};

/**
 * Codex-compatible schema for one independently researched angle.
 */
export const researchFindingSchema = {
  type: "object",
  properties: {
    angle: { type: "string" },
    summary: { type: "string" },
    sources: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["angle", "summary", "sources"],
  additionalProperties: false,
};

/**
 * Codex-compatible schema for the synthesized report.
 */
export const deepResearchReportSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    executiveSummary: { type: "string" },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          kicker: { type: "string" },
          title: { type: "string" },
          lede: { type: "string" },
          paragraphs: {
            type: "array",
            items: { type: "string" },
          },
          keyPoints: {
            type: "array",
            items: { type: "string" },
          },
          sources: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "kicker",
          "title",
          "lede",
          "paragraphs",
          "keyPoints",
          "sources",
        ],
        additionalProperties: false,
      },
    },
    limitations: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["title", "executiveSummary", "sections", "limitations"],
  additionalProperties: false,
};

/**
 * Demonstrates discovery, planning, parallel research, and synthesis.
 *
 * @param args - Research question and optional additional angles.
 * @returns A structured report with findings, sources, and limitations.
 */
export default async function deepResearch(
  args: DeepResearchInput,
): Promise<DeepResearchResult> {
  const question = args.question.trim();
  if (!question) {
    throw new TypeError("Deep Research requires a non-empty question.");
  }

  phase("Discover");
  log(
    [
      "## Scoping the research subject",
      `- **Question:** ${question}`,
      "- Running an initial search before designing the research plan",
      "- Identifying the subject, current context, and important ambiguities",
    ].join("\n"),
  );

  const discovery = await agent<ResearchDiscovery>(
    [
      "Perform a fast scoping search for the question below before any detailed research plan is created.",
      "Establish what the subject is, the relevant current context or timeline, and which assumptions may be ambiguous or contested.",
      "Use available search tools. Prefer primary or authoritative sources and return absolute source URLs.",
      "Keep this pass broad and concise; detailed verification will happen later.",
      `Question: ${question}`,
    ].join("\n\n"),
    {
      sandbox: "read-only",
      schema: researchDiscoverySchema,
    },
  );

  log(
    [
      "### Subject scoped",
      `> ${discovery.overview}`,
      `- **${discovery.keyFacts.length}** initial facts`,
      `- **${discovery.ambiguities.length}** ambiguities to verify`,
      `- **${discovery.sources.length}** seed sources`,
      ...discovery.keyFacts.slice(0, 3).map((fact) => `- ${fact}`),
    ].join("\n"),
  );

  phase("Plan");
  log(
    [
      "## Building the research plan",
      "- Using the initial search to avoid planning from an uninformed prompt",
      "- Looking for independent, non-overlapping angles",
      "- Dive deeper, and expand the depth of the research",
    ].join("\n"),
  );

  const plan = await agent<{ angles: string[]; outputFileName: string }>(
    [
      "Create a research plan for the following question.",
      "Return distinct, non-overlapping angles that can be investigated independently.",
      "Also propose a short, descriptive kebab-case HTML filename for the final report. Return only the filename, with no directory.",
      `Question: ${question}`,
      `Initial scoping research: ${JSON.stringify(discovery)}`,
      "Make the plan explicitly investigate the listed ambiguities and avoid treating unverified assumptions as facts.",
    ].join("\n\n"),
    {
      sandbox: "read-only",
      schema: {
        type: "object",
        properties: {
          angles: {
            type: "array",
            minItems: 3,
            maxItems: 6,
            items: { type: "string" },
          },
          outputFileName: { type: "string" },
        },
        required: ["angles", "outputFileName"],
        additionalProperties: false,
      },
    },
  );

  const angles = [...new Set([...plan.angles, ...(args.angles ?? [])])];
  const requestedOutputPath =
    args.outputPath?.trim() || normalizeProposedFileName(plan.outputFileName);
  log(
    [
      `### Plan ready — ${angles.length} angles`,
      `- **Proposed report:** \`${requestedOutputPath}\``,
      ...angles.map((angle) => `- ${angle}`),
    ].join("\n"),
  );

  phase("Research");
  log(
    `## Parallel research\nLaunching **${angles.length} independent research agents**.`,
  );

  const researchResults = await parallel(
    angles.map((angle) => async () => {
      log(`- Starting **${angle}**`);
      const finding = await agent<ResearchFinding>(
        [
          `Research this angle: ${angle}`,
          `Original question: ${question}`,
          `Initial scoping context: ${JSON.stringify(discovery)}`,
          "Use available search tools and prefer primary sources.",
          "Verify the scoping context independently rather than assuming it is correct.",
          "Make uncertainty explicit and include absolute source URLs.",
        ].join("\n\n"),
        {
          sandbox: "read-only",
          schema: researchFindingSchema,
        },
      );
      log(
        `- Completed **${angle}** · ${finding.sources.length} source${finding.sources.length === 1 ? "" : "s"}`,
      );
      return finding;
    }),
  );

  const findings = researchResults.filter(
    (finding): finding is ResearchFinding => finding !== null,
  );
  log(
    `> Research complete: **${findings.length}/${angles.length}** angles returned usable findings.`,
  );

  phase("Synthesis");
  log(
    [
      "## Synthesizing the report",
      `- Comparing **${findings.length} findings**`,
      "- Resolving conflicts and preserving uncertainty",
      "- Preparing a self-contained interactive HTML report",
    ].join("\n"),
  );

  const report = await agent<DeepResearchReport>(
    [
      "Act as the lead researcher.",
      `Answer this question: ${question}`,
      "Synthesize the supplied findings without inventing unsupported claims.",
      "Design the article structure from the evidence itself. Return 3–7 coherent editorial sections with specific titles; do not use a fixed template such as Research Question, Findings, and Conclusion.",
      "Each section should advance the argument, contain developed prose paragraphs, and cite only the sources that support it.",
      "Call out evidence gaps in limitations.",
      `Findings: ${JSON.stringify(findings)}`,
    ].join("\n\n"),
    {
      sandbox: "read-only",
      schema: deepResearchReportSchema,
    },
  );

  log(
    [
      "## Synthesis ready",
      `- **${report.sections.length}** editorial sections`,
      `- **${report.limitations.length}** limitations disclosed`,
    ].join("\n"),
  );

  const html = renderHtmlReport(report, question);
  const outputPath = await saveHtmlReport(html, requestedOutputPath);
  const sourceCount = new Set(
    report.sections.flatMap((section) => section.sources),
  ).size;

  phase("Present");
  log(
    [
      "## Presenting report",
      `- **File:** \`${outputPath}\``,
      "- **Format:** self-contained HTML",
      "- Asking the operating system to open the generated file",
    ].join("\n"),
  );

  let presented = true;
  try {
    await presentHtmlReport(outputPath);
    log(`# Report opened\n- \`${outputPath}\``);
  } catch (cause) {
    presented = false;
    log(
      [
        "## Report saved, but could not be opened automatically",
        `- Open manually: \`${outputPath}\``,
        `- Reason: ${formatError(cause)}`,
      ].join("\n"),
    );
  }

  return {
    outputPath,
    format: "html",
    sections: report.sections.length,
    sources: sourceCount,
    presented,
  };
}

/**
 * Writes a self-contained HTML report to a caller-selected destination.
 *
 * @param html - Complete report HTML.
 * @param requestedPath - Absolute or working-directory-relative output path.
 * @returns Absolute path to the written report.
 * @internal
 */
export async function saveHtmlReport(
  html: string,
  requestedPath: string,
): Promise<string> {
  const outputPath = resolve(requestedPath);
  const directory = dirname(outputPath);
  const { name, ext } = parse(outputPath);
  await mkdir(directory, { recursive: true });

  for (let number = 1; ; number += 1) {
    const candidate = resolve(
      directory,
      number === 1 ? `${name}${ext}` : `${name}-${number}${ext}`,
    );
    try {
      const file = await open(candidate, "wx");
      try {
        log(`## Writing report\n- **Destination:** \`${candidate}\``);
        await file.writeFile(html, "utf8");
      } finally {
        await file.close();
      }
      return candidate;
    } catch (cause) {
      if (isAlreadyExistsError(cause)) {
        continue;
      }
      throw cause;
    }
  }
}

function normalizeProposedFileName(value: string): string {
  const proposed = basename(value.trim())
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (!proposed) {
    return "./deep-research-report.html";
  }
  return extname(proposed).toLowerCase() === ".html"
    ? `./${proposed}`
    : `./${proposed}.html`;
}

function isAlreadyExistsError(value: unknown): boolean {
  return value instanceof Error && "code" in value && value.code === "EEXIST";
}

/**
 * Opens a generated report with the operating system's default application.
 *
 * @param outputPath - Absolute report path.
 * @returns A Promise that resolves after the opener command succeeds.
 * @throws An Error when the opener command cannot launch the report.
 * @internal
 */
export async function presentHtmlReport(outputPath: string): Promise<void> {
  const command = presentationCommand(outputPath);
  const subprocess = Bun.spawn(command, {
    stdout: "ignore",
    stderr: "pipe",
  });
  const [stderr, exitCode] = await Promise.all([
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);
  if (exitCode !== 0) {
    const detail = stderr.trim();
    throw new Error(
      detail
        ? `The operating system opener exited with status ${exitCode}: ${detail}`
        : `The operating system opener exited with status ${exitCode}.`,
    );
  }
}

/**
 * Selects the native file-opening command for an operating system.
 *
 * @param outputPath - Absolute report path.
 * @param platform - Operating system identifier.
 * @returns Executable and arguments suitable for `Bun.spawn()`.
 * @internal
 */
export function presentationCommand(
  outputPath: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform === "darwin") {
    return ["open", outputPath];
  }
  if (platform === "win32") {
    return ["explorer.exe", outputPath];
  }
  return ["xdg-open", outputPath];
}

function formatError(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

/**
 * Renders a structured synthesis as one portable paper-style HTML document.
 *
 * @param report - Structured synthesis returned by the final Agent.
 * @param question - Original research question.
 * @returns Self-contained HTML with inline CSS and JavaScript.
 * @internal
 */
export function renderHtmlReport(
  report: DeepResearchReport,
  question: string,
): string {
  const sections = report.sections
    .map((section, index) => {
      const sources = section.sources
        .map((source) => {
          const href = safeUrl(source);
          return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(source)}</a></li>`;
        })
        .join("");
      const paragraphs = section.paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");
      const keyPoints = section.keyPoints
        .map((point) => `<li>${escapeHtml(point)}</li>`)
        .join("");
      const searchText = [
        section.kicker,
        section.title,
        section.lede,
        ...section.paragraphs,
        ...section.keyPoints,
      ]
        .join(" ")
        .toLowerCase();
      return `<section class="report-section" id="section-${index + 1}" data-search="${escapeHtml(searchText)}">
        <div class="section-head">
          <span class="num">${String(index + 1).padStart(2, "0")} / ${escapeHtml(section.kicker)}</span>
          <h2>${escapeHtml(section.title)}</h2>
        </div>
        <div class="section-grid">
          <div class="section-index">${String(index + 1).padStart(2, "0")}</div>
          <div class="section-body">
            <p class="section-lede">${escapeHtml(section.lede)}</p>
            <div class="prose">${paragraphs}</div>
            ${keyPoints ? `<ul class="key-points">${keyPoints}</ul>` : ""}
            <details>
              <summary>${section.sources.length} source${section.sources.length === 1 ? "" : "s"}</summary>
              <ul class="sources">${sources || "<li>No source URL supplied</li>"}</ul>
            </details>
          </div>
        </div>
      </section>`;
    })
    .join("\n");
  const limitations = report.limitations
    .map(
      (limitation) =>
        `<li><strong>Evidence gap.</strong> ${escapeHtml(limitation)}</li>`,
    )
    .join("");
  const references = [
    ...new Set(report.sections.flatMap((section) => section.sources)),
  ]
    .map((source) => {
      const href = safeUrl(source);
      return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(source)}</a></li>`;
    })
    .join("");
  const date = new Date().toISOString().slice(0, 10);
  const sourceCount = new Set(
    report.sections.flatMap((section) => section.sources),
  ).size;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.title)}</title>
  <style>
    :root { --paper:#f4f1eb; --paper-bright:#fbfaf7; --ink:#171717; --ink-soft:#686864; --ink-faint:#92918c; --rule:#d9d5cd; --rule-soft:#e8e4dc; --cobalt:#0a4ecb; --cobalt-deep:#073a98; --cobalt-pale:#e5edfb; --panel:#ffffff; --silver:#e5e6eb; --warn:#9a6121; --warn-soft:#f4e9d8; --shadow:0 28px 80px rgba(32,38,51,.12); }
    html.dark { --paper:#151719; --paper-bright:#1b1e21; --ink:#f3f1eb; --ink-soft:#b0b1b0; --ink-faint:#777b80; --rule:#34383d; --rule-soft:#292d31; --cobalt:#5e91ff; --cobalt-deep:#8caeff; --cobalt-pale:#172b51; --panel:#202429; --silver:#24292f; --warn:#e5ad69; --warn-soft:#352a1e; --shadow:0 28px 80px rgba(0,0,0,.28); }
    * { box-sizing:border-box; margin:0; padding:0; }
    html { font-size:16px; scroll-behavior:smooth; }
    body { min-height:100vh; font-family:"Avenir Next","Helvetica Neue","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; background:var(--paper); color:var(--ink); line-height:1.72; -webkit-font-smoothing:antialiased; }
    body::before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.42; background-image:linear-gradient(rgba(70,73,79,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(70,73,79,.055) 1px,transparent 1px); background-size:72px 72px; mask-image:linear-gradient(to bottom,#000 0%,transparent 68%); }
    a { color:var(--cobalt); text-decoration:none; border-bottom:1px solid color-mix(in srgb,var(--cobalt) 30%,transparent); }
    a:hover { border-bottom-color:var(--cobalt); }
    .hero { position:relative; min-height:min(780px,92vh); overflow:hidden; padding:28px clamp(24px,4.4vw,72px) 36px; border-bottom:1px solid var(--rule); background:linear-gradient(132deg,var(--paper-bright) 0 64%,var(--silver) 64% 100%); }
    .hero::after { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg,transparent 0 49.9%,rgba(255,255,255,.24) 50%,transparent 50.1%); background-size:144px 100%; opacity:.35; }
    .hero-top,.hero-grid,.hero-foot { position:relative; z-index:1; max-width:1440px; margin-inline:auto; }
    .hero-top { display:flex; align-items:center; gap:14px; }
    .brand-mark { display:grid; place-items:center; width:42px; height:42px; background:var(--cobalt); color:white; font:800 16px/1 "SFMono-Regular",Consolas,monospace; box-shadow:5px 5px 0 color-mix(in srgb,var(--cobalt) 18%,transparent); }
    .kicker,.board-label,.hero-meta,.section-kicker,.finding-num,summary,#filter,.theme-toggle,footer,.tag,.map-node,.metric-label { font-family:"SFMono-Regular",Consolas,"Liberation Mono","PingFang SC",monospace; }
    .kicker { color:var(--ink-soft); font-size:12px; font-weight:700; letter-spacing:.23em; text-transform:uppercase; }
    .hero-grid { display:grid; grid-template-columns:minmax(0,1.08fr) minmax(380px,.92fr); align-items:center; gap:clamp(52px,8vw,140px); min-height:570px; padding:50px 0 34px; }
    .hero-copy { max-width:800px; animation:rise .75s cubic-bezier(.2,.7,.2,1) both; }
    .hero-title { max-width:780px; font-size:clamp(46px,6.5vw,92px); font-weight:300; letter-spacing:-.055em; line-height:1.04; text-wrap:balance; }
    .hero-title::first-line { color:var(--cobalt); }
    .title-rule { width:110px; height:3px; margin:28px 0 30px; background:var(--cobalt); }
    .hero-deck { max-width:660px; color:var(--ink-soft); font-size:clamp(16px,1.5vw,21px); line-height:1.65; }
    .evidence-board { position:relative; min-height:360px; padding:28px; background:var(--panel); box-shadow:var(--shadow); animation:rise .75s .14s cubic-bezier(.2,.7,.2,1) both; }
    .evidence-board::before { content:""; position:absolute; inset:10px; border:1px solid var(--rule-soft); pointer-events:none; }
    .board-label { position:relative; color:var(--ink-faint); font-size:10px; letter-spacing:.18em; text-transform:uppercase; }
    .evidence-map { position:relative; display:grid; grid-template-columns:repeat(4,1fr); align-items:center; gap:14px; min-height:206px; padding:36px 4px 20px; }
    .evidence-map::before { content:""; position:absolute; left:9%; right:9%; top:50%; height:1px; background:var(--ink); opacity:.32; }
    .map-node { position:relative; display:grid; place-items:center; min-height:78px; padding:12px 6px; border:1px solid var(--rule); background:var(--paper-bright); color:var(--ink-soft); font-size:9px; letter-spacing:.09em; text-align:center; text-transform:uppercase; }
    .map-node::before { content:attr(data-step); display:grid; place-items:center; width:30px; height:30px; margin-bottom:8px; border-radius:50%; background:var(--ink); color:var(--paper-bright); font-size:11px; }
    .map-node.accent { border-color:var(--cobalt); color:var(--cobalt); transform:translateY(-12px); }
    .map-node.accent::before { background:var(--cobalt); }
    .board-metrics { position:relative; display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid var(--rule); }
    .metric { padding:16px 12px 4px; border-right:1px solid var(--rule); }
    .metric:last-child { border-right:0; }
    .metric strong { display:block; color:var(--cobalt); font-size:25px; font-weight:500; line-height:1; }
    .metric-label { display:block; margin-top:7px; color:var(--ink-faint); font-size:9px; letter-spacing:.12em; text-transform:uppercase; }
    .hero-foot { display:flex; align-items:flex-end; justify-content:space-between; gap:30px; }
    .tags { display:flex; flex-wrap:wrap; gap:8px; }
    .tag { padding:7px 10px; border:1px solid var(--rule); background:color-mix(in srgb,var(--paper-bright) 80%,transparent); color:var(--ink-soft); font-size:9px; letter-spacing:.08em; text-transform:uppercase; }
    .hero-meta { color:var(--ink-faint); font-size:10px; text-align:right; line-height:1.8; }
    .doc { position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:100px 32px 120px; }
    .brief { display:grid; grid-template-columns:180px 1fr; gap:48px; margin-bottom:110px; padding:38px 0; border-top:3px solid var(--cobalt); border-bottom:1px solid var(--rule); }
    .section-kicker { color:var(--cobalt); font-size:11px; letter-spacing:.15em; text-transform:uppercase; }
    .brief p { max-width:780px; font-family:"Iowan Old Style","Songti SC",Georgia,serif; font-size:clamp(22px,3vw,36px); line-height:1.45; letter-spacing:-.02em; }
    section { margin-bottom:110px; }
    .section-head { display:grid; grid-template-columns:110px 1fr; align-items:end; gap:30px; margin-bottom:42px; padding-bottom:18px; border-bottom:1px solid var(--ink); }
    .num { color:var(--cobalt); font:500 13px/1 "SFMono-Regular",Consolas,monospace; letter-spacing:.12em; }
    h2 { font-size:clamp(27px,4vw,46px); font-weight:350; letter-spacing:-.04em; line-height:1.1; }
    .article-tools { display:flex; align-items:center; justify-content:space-between; gap:20px; margin:-50px 0 70px; }
    .article-tools span { color:var(--ink-faint); font:10px/1 "SFMono-Regular",Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
    #filter { width:min(360px,100%); padding:12px 14px; border:0; border-bottom:1px solid var(--ink); outline:0; background:transparent; color:var(--ink); font-size:11px; }
    #filter:focus { border-color:var(--cobalt); }
    .report-section[hidden] { display:none; }
    .section-grid { display:grid; grid-template-columns:110px 1fr; gap:30px; }
    .section-index { color:color-mix(in srgb,var(--cobalt) 22%,transparent); font-size:72px; font-weight:700; letter-spacing:-.08em; line-height:.9; }
    .section-body { max-width:820px; }
    .section-lede { margin:-7px 0 26px; color:var(--ink); font-size:clamp(20px,2.5vw,29px); font-weight:450; line-height:1.45; letter-spacing:-.02em; }
    .prose p { margin-bottom:20px; color:var(--ink-soft); font-family:"Iowan Old Style","Songti SC",Georgia,serif; font-size:18px; line-height:1.82; }
    .key-points { display:grid; gap:10px; margin:28px 0; padding:22px 28px 18px 46px; border-left:3px solid var(--cobalt); background:var(--cobalt-pale); color:var(--ink-soft); }
    .key-points li { padding-left:4px; }
    details { color:var(--ink-soft); }
    summary { cursor:pointer; width:max-content; color:var(--cobalt); font-size:10px; letter-spacing:.12em; text-transform:uppercase; }
    .sources { margin:16px 0 0; padding:18px 24px 12px 42px; background:var(--paper-bright); overflow-wrap:anywhere; font-size:12px; }
    .sources li { margin-bottom:8px; }
    .editor-note { display:grid; grid-template-columns:110px 1fr; gap:30px; margin-top:30px; padding:34px 0; border-top:1px solid var(--warn); border-bottom:1px solid var(--warn); }
    .editor-note h3 { color:var(--warn); font:11px/1.5 "SFMono-Regular",Consolas,monospace; letter-spacing:.13em; text-transform:uppercase; }
    .editor-note ol { padding:26px 34px 18px 52px; background:var(--warn-soft); }
    .editor-note li { margin-bottom:14px; }
    footer { margin-top:140px; padding-top:32px; border-top:3px solid var(--ink); color:var(--ink-faint); font-size:11px; }
    footer h4 { margin-bottom:20px; color:var(--ink); font-size:12px; letter-spacing:.14em; text-transform:uppercase; }
    footer ul { columns:2; column-gap:48px; list-style:none; overflow-wrap:anywhere; }
    footer li { break-inside:avoid; margin-bottom:10px; }
    .theme-toggle { position:fixed; top:18px; right:18px; padding:8px 11px; border:1px solid var(--rule); background:color-mix(in srgb,var(--paper-bright) 88%,transparent); color:var(--ink-soft); font-size:9px; letter-spacing:.12em; text-transform:uppercase; cursor:pointer; z-index:20; backdrop-filter:blur(12px); }
    .reading-progress { position:fixed; top:0; left:0; width:0; height:3px; background:var(--cobalt); z-index:30; }
    .toc { position:fixed; left:22px; bottom:22px; width:170px; padding-left:13px; border-left:2px solid var(--rule); font:9px/1.7 "SFMono-Regular",Consolas,monospace; z-index:10; }
    .toc a { display:block; color:var(--ink-faint); border:0; text-transform:uppercase; letter-spacing:.06em; }
    .toc a.active { color:var(--cobalt); }
    @keyframes rise { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
    @media (max-width:1180px) { .toc { display:none; } .hero-grid { grid-template-columns:1fr 440px; gap:48px; } }
    @media (max-width:900px) { .hero { background:linear-gradient(155deg,var(--paper-bright) 0 72%,var(--silver) 72%); } .hero-grid { grid-template-columns:1fr; padding-top:64px; } .evidence-board { min-height:320px; } .hero-foot { margin-top:28px; } }
    @media (max-width:640px) { .hero { min-height:auto; padding:20px 18px 28px; } .kicker { font-size:9px; letter-spacing:.13em; } .hero-grid { padding:52px 0 22px; gap:42px; } .hero-title { font-size:clamp(42px,14vw,62px); } .evidence-board { padding:20px 16px; min-height:300px; } .evidence-map { gap:5px; } .map-node { min-height:70px; font-size:7px; } .map-node::before { width:25px; height:25px; } .hero-foot { align-items:flex-start; flex-direction:column; } .hero-meta { text-align:left; } .doc { padding:72px 18px 90px; } .brief,.section-head,.section-grid,.editor-note { grid-template-columns:1fr; gap:18px; } .brief { margin-bottom:80px; } .article-tools { align-items:stretch; flex-direction:column; margin-top:-36px; } section { margin-bottom:80px; } .section-index { font-size:48px; } footer ul { columns:1; } }
    @media (prefers-reduced-motion:reduce) { * { scroll-behavior:auto!important; animation:none!important; } }
    @media print { .hero { min-height:auto; background:white; } body::before,.theme-toggle,.reading-progress,.toc,.filter-row { display:none; } .doc { padding-top:50px; } details { break-inside:avoid; } }
  </style>
</head>
<body>
  <div class="reading-progress" id="progress"></div>
  <button class="theme-toggle" id="theme-toggle" type="button">dark</button>
  <nav class="toc" id="toc"></nav>
  <header class="hero">
    <div class="hero-top">
      <div class="brand-mark">D</div>
      <div class="kicker">Deer Research / Evidence Intelligence</div>
    </div>
    <div class="hero-grid">
      <div class="hero-copy">
        <h1 class="hero-title">${escapeHtml(report.title)}</h1>
        <div class="title-rule"></div>
        <p class="hero-deck">${escapeHtml(question)}</p>
      </div>
      <aside class="evidence-board" aria-label="Research workflow summary">
        <div class="board-label">Evidence pipeline / verified synthesis</div>
        <div class="evidence-map">
          <div class="map-node" data-step="01">Discover</div>
          <div class="map-node" data-step="02">Plan</div>
          <div class="map-node accent" data-step="03">Verify</div>
          <div class="map-node" data-step="04">Present</div>
        </div>
        <div class="board-metrics">
          <div class="metric"><strong>${report.sections.length}</strong><span class="metric-label">Sections</span></div>
          <div class="metric"><strong>${sourceCount}</strong><span class="metric-label">Sources</span></div>
          <div class="metric"><strong>${report.limitations.length}</strong><span class="metric-label">Open gaps</span></div>
        </div>
      </aside>
    </div>
    <div class="hero-foot">
      <div class="tags">
        <span class="tag">Independent research</span>
        <span class="tag">Source backed</span>
        <span class="tag">Uncertainty preserved</span>
      </div>
      <div class="hero-meta">FINAL REPORT · ${date}<br>DEER WORKFLOW / ${String(report.sections.length).padStart(2, "0")} SECTIONS</div>
    </div>
  </header>
  <main class="doc">
    <div class="brief">
      <div class="section-kicker">Executive brief</div>
      <p>${escapeHtml(report.executiveSummary)}</p>
    </div>
    <div class="article-tools"><span>${report.sections.length} evidence-led sections</span><input id="filter" type="search" placeholder="filter this report…" aria-label="Filter report sections"></div>
    ${sections || "<p>No report sections were returned.</p>"}
    <aside class="editor-note">
      <h3>Editor’s note<br>Evidence limits</h3>
      <ol>${limitations || "<li>No limitations were supplied.</li>"}</ol>
    </aside>
    <footer><h4>References</h4><ul>${references || "<li>No references were supplied.</li>"}</ul></footer>
  </main>
  <script>
    (() => {
      const root=document.documentElement;
      const theme=document.querySelector("#theme-toggle");
      const apply=(mode)=>{root.classList.toggle("dark",mode==="dark");theme.textContent=mode==="dark"?"light":"dark";};
      apply(localStorage.getItem("theme")||"light");
      theme.addEventListener("click",()=>{const next=root.classList.contains("dark")?"light":"dark";localStorage.setItem("theme",next);apply(next);});
      document.querySelector("#filter").addEventListener("input",(event)=>{const query=event.target.value.toLowerCase();document.querySelectorAll(".report-section").forEach((item)=>{item.hidden=!item.dataset.search.includes(query);});});
      const toc=document.querySelector("#toc");
      const sections=[...document.querySelectorAll(".report-section")];
      sections.forEach((section)=>{const link=document.createElement("a");link.href="#"+section.id;link.textContent=section.querySelector("h2").textContent;toc.appendChild(link);});
      const links=[...toc.querySelectorAll("a")];
      const observer=new IntersectionObserver((entries)=>{entries.forEach((entry)=>{if(entry.isIntersecting){links.forEach((link)=>link.classList.toggle("active",link.getAttribute("href")==="#"+entry.target.id));}});},{rootMargin:"-40% 0px -50% 0px"});
      sections.forEach((section)=>observer.observe(section));
      const progress=document.querySelector("#progress");
      addEventListener("scroll",()=>{const height=document.documentElement.scrollHeight-innerHeight;progress.style.width=(height<=0?0:(scrollY/height)*100)+"%";});
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : "#";
  } catch {
    return "#";
  }
}
