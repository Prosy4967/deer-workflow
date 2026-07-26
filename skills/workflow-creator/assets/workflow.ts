import { mkdir, open } from "node:fs/promises";
import { basename, dirname, extname, parse, resolve } from "node:path";

import { agent, log, parallel, phase } from "@deerwork-ai/deer-workflow";

export const meta = {
  name: "planned-workflow",
  description:
    "Plans independent tasks, executes them, and synthesizes results.",
  phases: [{ title: "Plan" }, { title: "Execute" }, { title: "Synthesize" }],
  exampleArgs: {
    objective: "Compare three approaches and recommend one",
  },
};

interface WorkflowInput {
  objective: string;
  outputPath?: string;
}

interface WorkflowOutput {
  outputPath: string;
  format: "markdown";
  completedTasks: number;
}

interface Plan {
  tasks: string[];
  outputFileName: string;
}

const planSchema = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
    outputFileName: { type: "string" },
  },
  required: ["tasks", "outputFileName"],
  additionalProperties: false,
};

/**
 * Replace this template's prompts, input, and output with the user's domain.
 */
export default async function run(
  args: WorkflowInput,
): Promise<WorkflowOutput> {
  phase("Plan");
  log(
    [
      "## Planning independent tasks",
      `- **Objective:** ${args.objective}`,
      "- Identifying work that can run concurrently",
    ].join("\n"),
  );

  const plan = await agent<Plan>(
    [
      `Break this objective into independent tasks:\n${args.objective}`,
      "Propose a short descriptive kebab-case Markdown filename for the final report.",
      "Return only the filename, with no directory, in outputFileName.",
    ].join("\n\n"),
    {
      sandbox: "read-only",
      schema: planSchema,
    },
  );
  log(
    [
      `### Plan ready — ${plan.tasks.length} tasks`,
      `- **Proposed report:** \`${plan.outputFileName}\``,
      ...plan.tasks.map((task) => `- ${task}`),
    ].join("\n"),
  );

  phase("Execute");
  log(
    `## Parallel execution\nRunning **${plan.tasks.length} tasks** concurrently.`,
  );

  const rawResults = await parallel(
    plan.tasks.map((task) => async () => {
      log(`- Starting \`${task}\``);
      const result = await agent(`Complete this task:\n${task}`, {
        sandbox: "read-only",
      });
      const finding = result.replaceAll(/\s+/g, " ").trim().slice(0, 160);
      log(
        [
          `### Completed \`${task}\``,
          finding ? `> ${finding}` : "> No textual finding was returned.",
        ].join("\n"),
      );
      return result;
    }),
  );
  const results = rawResults.filter(
    (result): result is string => result !== null,
  );

  phase("Synthesize");
  log(
    [
      "## Synthesizing results",
      `- **Completed:** ${results.length}/${plan.tasks.length}`,
      "- Combining evidence into one answer",
    ].join("\n"),
  );

  const summary = await agent(
    [
      `Original objective: ${args.objective}`,
      "Synthesize the completed task results into one concise answer.",
      `Results: ${JSON.stringify(results)}`,
    ].join("\n\n"),
    { sandbox: "read-only" },
  );

  const requestedOutputPath =
    args.outputPath?.trim() || normalizeFileName(plan.outputFileName);
  const outputPath = await writeWithoutOverwrite(requestedOutputPath, summary);
  log(
    [
      "### Report ready",
      `- Saved to \`${outputPath}\``,
      "- Existing files were preserved",
    ].join("\n"),
  );

  return {
    outputPath,
    format: "markdown",
    completedTasks: results.length,
  };
}

function normalizeFileName(value: string): string {
  const proposed = basename(value.trim())
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (!proposed) {
    return "./workflow-report.md";
  }
  return extname(proposed).toLowerCase() === ".md"
    ? `./${proposed}`
    : `./${proposed}.md`;
}

async function writeWithoutOverwrite(
  requestedPath: string,
  content: string,
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
        await file.writeFile(content, "utf8");
      } finally {
        await file.close();
      }
      return candidate;
    } catch (cause) {
      if (
        cause instanceof Error &&
        "code" in cause &&
        cause.code === "EEXIST"
      ) {
        continue;
      }
      throw cause;
    }
  }
}
