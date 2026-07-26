import { agent } from "@deerwork-ai/deer-workflow/agents";
import { phase, pipeline } from "@deerwork-ai/deer-workflow/flow";
import { log } from "@deerwork-ai/deer-workflow/logging";

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
  exampleArgs: {
    topic: "Dynamic Workflow",
    audience: "Agent builders",
  },
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
  log(
    [
      "## Creating the editorial structure",
      `- **Topic:** ${topic}`,
      `- **Audience:** ${audience}`,
      `- **Tone:** ${tone}`,
      `- **Keywords:** ${keywords}`,
    ].join("\n"),
  );

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
  log(
    [
      `### Outline ready — ${outline.sections.length} sections`,
      ...outline.sections.map((section) => `- ${section}`),
    ].join("\n"),
  );

  phase("Draft and review");
  log(
    `## Draft and review\nSending **${outline.sections.length} sections** through the writing pipeline.`,
  );

  const sectionResults = await pipeline(
    outline.sections,
    async (sectionBrief) => {
      log(`- Drafting \`${sectionBrief}\``);
      const draft = await agent<BlogSection>(
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
      );
      log(`- Draft complete: **${draft.heading}**`);
      return draft;
    },
    async (draft) => {
      log(`- Reviewing **${draft.heading}**`);
      const reviewed = await agent<BlogSection>(
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
      );
      log(`- Review complete: **${reviewed.heading}**`);
      return reviewed;
    },
  );

  const sections = sectionResults.filter(
    (section): section is BlogSection => section !== null,
  );
  log(
    `> Pipeline complete: **${sections.length}/${outline.sections.length}** sections survived drafting and review.`,
  );

  phase("Assembly");
  log(
    [
      "## Assembling the article",
      `- Combining **${sections.length} reviewed sections**`,
      "- Smoothing transitions",
      "- Removing repeated ideas",
    ].join("\n"),
  );

  const article = await agent<BlogArticle>(
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
  log(
    [
      "# Article ready",
      `- **Title:** ${article.title}`,
      `- **Sections:** ${sections.length}`,
      "- **Format:** Markdown",
    ].join("\n"),
  );
  return article;
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
