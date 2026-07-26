import { agent } from "@deer-work/workflow/agents";
import { phase, pipeline } from "@deer-work/workflow/flow";
import { log } from "@deer-work/workflow/logging";

import type {
  BlogArticle,
  BlogOutline,
  BlogSection,
  BlogWriterInput,
} from "./types";

/**
 * Declares the Workflow's identity and observable phase plan.
 */
export const meta = {
  name: "blog-writer",
  description: "Outlines, drafts, reviews, and assembles a technical article.",
  phases: [
    { title: "Outline" },
    { title: "Draft and review" },
    { title: "Assembly" },
  ],
};

/**
 * Demonstrates outline, draft, editorial review, and assembly stages.
 *
 * @param args - Topic, audience, tone, and optional keywords.
 * @returns A complete Markdown article.
 */
export default async function blogWriter(
  args: BlogWriterInput,
): Promise<BlogArticle> {
  const topic = args.topic.trim();
  const audience = args.audience.trim();
  if (!topic || !audience) {
    throw new TypeError("Blog Writer requires a topic and audience.");
  }

  const tone = args.tone?.trim() || "clear, practical, and direct";
  const keywords = args.keywords?.join(", ") || "none";

  phase("Outline");
  log("Creating the editorial structure");

  const outline = await agent<BlogOutline>(
    [
      `Design a technical article about: ${topic}`,
      `Audience: ${audience}`,
      `Tone: ${tone}`,
      `Keywords: ${keywords}`,
      "Return a strong title and an ordered list of section briefs.",
    ].join("\n\n"),
    {
      sandbox: "read-only",
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          sections: {
            type: "array",
            minItems: 3,
            items: { type: "string" },
          },
        },
        required: ["title", "sections"],
        additionalProperties: false,
      },
    },
  );

  phase("Draft and review");
  log(`Drafting ${outline.sections.length} sections through a Pipeline`);

  const sectionResults = await pipeline(
    outline.sections,
    (sectionBrief) =>
      agent<BlogSection>(
        [
          `Draft this article section: ${sectionBrief}`,
          `Article title: ${outline.title}`,
          `Audience: ${audience}`,
          `Tone: ${tone}`,
          "Use concrete explanations and return Markdown without a top-level title.",
        ].join("\n\n"),
        {
          sandbox: "read-only",
          schema: sectionSchema,
        },
      ),
    (draft) =>
      agent<BlogSection>(
        [
          "Act as a demanding technical editor.",
          "Remove repetition, unsupported claims, filler, and generic AI phrasing.",
          "Preserve the heading and return the improved Markdown section.",
          `Draft: ${JSON.stringify(draft)}`,
        ].join("\n\n"),
        {
          sandbox: "read-only",
          schema: sectionSchema,
        },
      ),
  );

  const sections = sectionResults.filter(
    (section): section is BlogSection => section !== null,
  );

  phase("Assembly");
  log(`Assembling ${sections.length} reviewed sections`);

  return agent<BlogArticle>(
    [
      "Assemble a cohesive final article from the reviewed sections.",
      `Working title: ${outline.title}`,
      `Audience: ${audience}`,
      `Tone: ${tone}`,
      "Add transitions, remove duplicated ideas, and keep the result in Markdown.",
      `Sections: ${JSON.stringify(sections)}`,
    ].join("\n\n"),
    {
      sandbox: "read-only",
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          markdown: { type: "string" },
        },
        required: ["title", "summary", "markdown"],
        additionalProperties: false,
      },
    },
  );
}

const sectionSchema = {
  type: "object",
  properties: {
    heading: { type: "string" },
    markdown: { type: "string" },
  },
  required: ["heading", "markdown"],
  additionalProperties: false,
};
