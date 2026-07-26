#!/usr/bin/env bun

import { agent, CodexAgentError } from "./agents";

const [command, ...values] = Bun.argv.slice(2);

if (command === "--help" || command === "-h" || command === undefined) {
  printUsage();
  process.exit(command === undefined ? 1 : 0);
}

if (command !== "agent") {
  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

const argumentPrompt = values.join(" ").trim();
const prompt = argumentPrompt ||
  (process.stdin.isTTY ? "" : (await Bun.stdin.text()).trim());

if (!prompt) {
  console.error("The agent command requires a prompt argument or stdin.");
  process.exit(1);
}

try {
  const output = await agent(prompt, { cwd: process.cwd() });
  console.log(output);
} catch (error) {
  if (error instanceof CodexAgentError) {
    console.error(error.message);
    if (error.stderr.trim()) {
      console.error(error.stderr.trimEnd());
    }
  } else {
    console.error(error);
  }
  process.exit(1);
}

function printUsage(): void {
  console.log(`deer-workflow

Usage:
  deer-workflow agent "Your task"
  echo "Your task" | deer-workflow agent
`);
}
