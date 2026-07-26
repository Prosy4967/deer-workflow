import { agent } from "@deer-work/workflow/agents";
import { parallel, phase } from "@deer-work/workflow/flow";
import { log } from "@deer-work/workflow/logging";

import type {
  DeepResearchInput,
  DeepResearchReport,
  ResearchFinding,
} from "./types";

/**
 * Declares the Workflow's identity and observable phase plan.
 */
export const meta = {
  name: "deep-research",
  description:
    "Researches independent angles and synthesizes a sourced report.",
  phases: [{ title: "Plan" }, { title: "Research" }, { title: "Synthesis" }],
};

/**
 * Demonstrates a plan, parallel research, and synthesis Workflow.
 *
 * @param args - Research question and optional additional angles.
 * @returns A structured report with findings, sources, and limitations.
 */
export default async function deepResearch(
  args: DeepResearchInput,
): Promise<DeepResearchReport> {
  const question = args.question.trim();
  if (!question) {
    throw new TypeError("Deep Research requires a non-empty question.");
  }

  phase("Plan");
  log("Planning independent research angles");

  const plan = await agent<{ angles: string[] }>(
    [
      "Create a research plan for the following question.",
      "Return distinct, non-overlapping angles that can be investigated independently.",
      `Question: ${question}`,
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
        },
        required: ["angles"],
        additionalProperties: false,
      },
    },
  );

  const angles = [...new Set([...plan.angles, ...(args.angles ?? [])])];

  phase("Research");
  log(`Researching ${angles.length} angles in parallel`);

  const researchResults = await parallel(
    angles.map(
      (angle) => () =>
        agent<ResearchFinding>(
          [
            `Research this angle: ${angle}`,
            `Original question: ${question}`,
            "Use available search tools and prefer primary sources.",
            "Make uncertainty explicit and include source URLs.",
          ].join("\n\n"),
          {
            sandbox: "read-only",
            schema: {
              type: "object",
              properties: {
                angle: { type: "string" },
                summary: { type: "string" },
                sources: {
                  type: "array",
                  items: { type: "string", format: "uri" },
                },
              },
              required: ["angle", "summary", "sources"],
              additionalProperties: false,
            },
          },
        ),
    ),
  );

  const findings = researchResults.filter(
    (finding): finding is ResearchFinding => finding !== null,
  );

  phase("Synthesis");
  log(`Synthesizing ${findings.length} completed findings`);

  return agent<DeepResearchReport>(
    [
      "Act as the lead researcher.",
      `Answer this question: ${question}`,
      "Synthesize the supplied findings without inventing unsupported claims.",
      "Call out evidence gaps in limitations.",
      `Findings: ${JSON.stringify(findings)}`,
    ].join("\n\n"),
    {
      sandbox: "read-only",
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          executiveSummary: { type: "string" },
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                angle: { type: "string" },
                summary: { type: "string" },
                sources: {
                  type: "array",
                  items: { type: "string", format: "uri" },
                },
              },
              required: ["angle", "summary", "sources"],
              additionalProperties: false,
            },
          },
          limitations: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["title", "executiveSummary", "findings", "limitations"],
        additionalProperties: false,
      },
    },
  );
}
