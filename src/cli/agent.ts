import { agent } from "../agents";
import type { AgentFunction } from "../agents";
import { TerminalUI } from "../tui";
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
  runAgent: AgentFunction = agent,
): Promise<void> {
  const prompt = await readAgentPrompt(values);
  const task = new TerminalUI().startTask({
    activity: "Running the Agent",
    estimate: "Usually takes a few seconds to several minutes",
    successMessage: "Agent completed",
    failureMessage: "Agent failed",
  });

  try {
    const output = await runAgent(prompt, { cwd: process.cwd() });
    task.succeed();
    console.log(output);
  } catch (error) {
    task.fail();
    throw error;
  } finally {
    task.dispose();
  }
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
