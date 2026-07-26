import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CodexAgent } from "../agents";
import type { AgentFunction } from "../agents";
import { CliUsageError } from "./errors";

const workflowCreatorSkillPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../skills/workflow-creator/SKILL.md",
);

const defaultCreateAgent = new CodexAgent({
  skipGitRepositoryCheck: true,
});

/**
 * Executes the `deer-workflow create` command.
 *
 * @remarks
 * The command explicitly directs the default Codex Agent to read the bundled
 * Workflow Creator Skill, then appends the user's request. Generated source is
 * written to stdout and may be redirected to a file.
 *
 * @param values - Prompt fragments following the `create` command.
 * @param runAgent - Agent function used to generate the Workflow.
 * @returns A Promise that resolves after generated source is written.
 * @internal
 */
export async function runCreateCommand(
  values: readonly string[],
  runAgent: AgentFunction = (prompt, options) =>
    defaultCreateAgent.run(prompt, options),
): Promise<void> {
  if (values.length === 1 && (values[0] === "--help" || values[0] === "-h")) {
    printCreateUsage();
    return;
  }

  const userPrompt = await readCreatePrompt(values);
  await assertWorkflowCreatorSkillExists();

  const output = await runAgent(buildWorkflowCreatorPrompt(userPrompt), {
    cwd: process.cwd(),
    sandbox: "read-only",
  });

  console.log(unwrapSourceFence(output));
}

/**
 * Builds the explicit Workflow Creator Skill invocation sent to the Agent.
 *
 * @param userPrompt - User's description of the desired Workflow.
 * @returns A self-contained Agent prompt ending with the user's request.
 * @internal
 */
export function buildWorkflowCreatorPrompt(userPrompt: string): string {
  return [
    "$workflow-creator",
    "",
    "Execute the bundled workflow-creator Skill located at:",
    workflowCreatorSkillPath,
    "",
    "Read SKILL.md completely and follow every referenced file required for the task.",
    "Return only the complete Workflow module as raw source text, without Markdown fences or explanation.",
    "The output must be suitable for redirecting directly into a .ts or .js file.",
    "",
    "--- USER REQUEST ---",
    userPrompt,
  ].join("\n");
}

/**
 * Prints help for the `create` command.
 *
 * @internal
 */
export function printCreateUsage(): void {
  console.log(`Usage:
  deer-workflow create "Describe the Workflow"
  echo "Describe the Workflow" | deer-workflow create

Output:
  stdout  Generated Workflow source
  stderr  Agent errors
`);
}

async function readCreatePrompt(values: readonly string[]): Promise<string> {
  const argumentPrompt = values.join(" ").trim();
  const prompt =
    argumentPrompt ||
    (process.stdin.isTTY ? "" : (await Bun.stdin.text()).trim());

  if (!prompt) {
    throw new CliUsageError(
      "The create command requires a prompt argument or stdin.",
    );
  }

  return prompt;
}

async function assertWorkflowCreatorSkillExists(): Promise<void> {
  try {
    await access(workflowCreatorSkillPath);
  } catch (cause) {
    throw new Error(
      `The bundled workflow-creator Skill is missing at ${workflowCreatorSkillPath}. Reinstall deer-workflow.`,
      { cause },
    );
  }
}

function unwrapSourceFence(output: string): string {
  const normalized = output.trim();
  if (!normalized) {
    throw new Error("The workflow-creator Agent returned an empty response.");
  }

  const match =
    /^```(?:typescript|ts|javascript|js)?\r?\n([\s\S]*?)\r?\n```$/.exec(
      normalized,
    );
  return match?.[1] ?? normalized;
}
