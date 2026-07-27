import { agent, ClaudeAgent } from "../agents";
import type { AgentFunction } from "../agents";
import { TerminalUI } from "../tui";
import { formatAgentName, parseAgentSelection } from "./agent-selection";
import { CliUsageError } from "./errors";

/**
 * Executes the `deer-workflow agent` command.
 *
 * @param values - Prompt fragments following the `agent` command.
 * @param runAgent - Agent function used to execute the task.
 * @returns A Promise that resolves after the final Agent response is written.
 * @internal
 */
export async function runAgentCommand(
  values: readonly string[],
  runAgent?: AgentFunction,
): Promise<void> {
  if (values.includes("--help") || values.includes("-h")) {
    printAgentUsage();
    return;
  }

  const selection = parseAgentSelection(values);
  const prompt = await readAgentPrompt(selection.values);
  const runtime =
    selection.agentName === "claude" ? new ClaudeAgent() : undefined;
  const selectedAgent: AgentFunction =
    runAgent ??
    (runtime ? (prompt, options) => runtime.run(prompt, options) : agent);
  const agentName = formatAgentName(selection.agentName);
  const task = new TerminalUI().startTask({
    activity: `Running the Agent with ${agentName}`,
    estimate: "Usually takes a few seconds to several minutes",
    successMessage: "Agent completed",
    failureMessage: "Agent failed",
  });

  try {
    const output = await selectedAgent(prompt, { cwd: process.cwd() });
    task.succeed();
    console.log(output);
  } catch (error) {
    task.fail();
    throw error;
  } finally {
    task.dispose();
  }
}

/**
 * Prints help for the `agent` command.
 *
 * @internal
 */
export function printAgentUsage(): void {
  console.log(`Usage:
  deer-workflow agent [--agent codex|claude] "Your task"
  echo "Your task" | deer-workflow agent [--agent codex|claude]

Options:
  --agent <codex|claude>  Agent runtime (default: codex)
`);
}

async function readAgentPrompt(values: readonly string[]): Promise<string> {
  const argumentPrompt = values.join(" ").trim();
  const prompt =
    argumentPrompt ||
    (process.stdin.isTTY ? "" : (await Bun.stdin.text()).trim());

  if (!prompt) {
    throw new CliUsageError(
      "The agent command requires a prompt argument or stdin.",
    );
  }

  return prompt;
}
