import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { WorkflowRunner } from "../runner";
import { CliUsageError } from "./errors";
import type { RunCommandArguments } from "./types";

/**
 * Executes the `deer-workflow run` command.
 *
 * @remarks
 * Workflow events are written as JSON Lines to stderr. The final Workflow
 * result is written to stdout so shell pipelines can consume it independently.
 *
 * @param values - Arguments following the `run` command.
 * @returns A Promise that resolves after the Workflow completes.
 * @internal
 */
export async function runWorkflowCommand(
  values: readonly string[],
): Promise<void> {
  if (values.includes("--help") || values.includes("-h")) {
    printRunUsage();
    return;
  }

  const arguments_ = parseRunArguments(values);
  const input = await readRunInput(arguments_);
  const runner = new WorkflowRunner({
    logWriter: (line) => console.error(line),
  });

  try {
    const result = await runner.run(arguments_.scriptPath, input);
    writeResult(result);
  } finally {
    runner.dispose();
  }
}

/**
 * Prints help for the `run` command.
 *
 * @internal
 */
export function printRunUsage(): void {
  console.log(`Usage:
  deer-workflow run <workflow>
  deer-workflow run <workflow> --input '<json>'
  deer-workflow run <workflow> --input-file <path>
  echo '<json>' | deer-workflow run <workflow>

Output:
  stdout  Final Workflow result
  stderr  Workflow events as JSON Lines
`);
}

function parseRunArguments(values: readonly string[]): RunCommandArguments {
  let scriptPath: string | undefined;
  let inlineInput: string | undefined;
  let inputFile: string | undefined;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--input" || value === "--input-file") {
      const optionValue = values[index + 1];
      if (optionValue === undefined) {
        throw new CliUsageError(`${value} requires a value.`);
      }

      if (value === "--input") {
        inlineInput = optionValue;
      } else {
        inputFile = optionValue;
      }
      index += 1;
      continue;
    }

    if (value?.startsWith("-")) {
      throw new CliUsageError(`Unknown run option: ${value}`);
    }

    if (scriptPath !== undefined) {
      throw new CliUsageError(
        `The run command accepts one Workflow path; received an extra value: ${value}`,
      );
    }

    scriptPath = value;
  }

  if (!scriptPath?.trim()) {
    throw new CliUsageError("The run command requires a Workflow path.");
  }

  if (inlineInput !== undefined && inputFile !== undefined) {
    throw new CliUsageError(
      "Use only one input source: --input, --input-file, or stdin.",
    );
  }

  return {
    scriptPath,
    ...(inlineInput === undefined ? {} : { inlineInput }),
    ...(inputFile === undefined ? {} : { inputFile }),
  };
}

async function readRunInput(arguments_: RunCommandArguments): Promise<unknown> {
  if (arguments_.inlineInput !== undefined) {
    return parseJsonInput(arguments_.inlineInput, "--input");
  }

  if (arguments_.inputFile !== undefined) {
    const inputPath = resolve(arguments_.inputFile);
    let contents: string;

    try {
      contents = await readFile(inputPath, "utf8");
    } catch (cause) {
      throw new CliUsageError(
        `Unable to read --input-file at ${inputPath}: ${formatCause(cause)}`,
      );
    }

    return parseJsonInput(contents, inputPath);
  }

  if (!process.stdin.isTTY) {
    const contents = await Bun.stdin.text();
    if (contents.trim()) {
      return parseJsonInput(contents, "stdin");
    }
  }

  return undefined;
}

function parseJsonInput(contents: string, source: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch (cause) {
    throw new CliUsageError(
      `Invalid JSON from ${source}: ${formatCause(cause)}`,
    );
  }
}

function writeResult(result: unknown): void {
  if (result === undefined) {
    return;
  }

  if (typeof result === "string") {
    console.log(result);
    return;
  }

  try {
    console.log(JSON.stringify(result));
  } catch (cause) {
    throw new Error(
      `Unable to serialize Workflow result: ${formatCause(cause)}`,
      { cause },
    );
  }
}

function formatCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
