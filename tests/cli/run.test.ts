import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { WorkflowEvent } from "@deer-work-ai/workflow/events";

const projectDirectory = resolve(".");
const cliPath = resolve("src/cli.ts");

let temporaryDirectory: string;
let echoWorkflowPath: string;
let failingWorkflowPath: string;
let inputFilePath: string;

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "deer-workflow-cli-test-"));

  const flowModuleUrl = pathToFileURL(resolve("src/flow/index.ts")).href;
  const loggingModuleUrl = pathToFileURL(resolve("src/logging/index.ts")).href;

  echoWorkflowPath = join(temporaryDirectory, "echo.ts");
  await writeFile(
    echoWorkflowPath,
    `
import { phase } from ${JSON.stringify(flowModuleUrl)};
import { log } from ${JSON.stringify(loggingModuleUrl)};

export default function run(args, context) {
  phase("Echo");
  log("Returning CLI input");
  return {
    input: args,
    depth: context.depth,
  };
}
`,
    "utf8",
  );

  failingWorkflowPath = join(temporaryDirectory, "failing.ts");
  await writeFile(
    failingWorkflowPath,
    "export default () => { throw new Error('workflow failed'); };\n",
    "utf8",
  );

  inputFilePath = join(temporaryDirectory, "input.json");
  await writeFile(inputFilePath, JSON.stringify({ source: "file" }), "utf8");
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("deer-workflow run", () => {
  test("runs a Workflow with inline JSON input", async () => {
    const result = await runCli([
      "run",
      echoWorkflowPath,
      "--input",
      JSON.stringify({ source: "inline" }),
    ]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      input: { source: "inline" },
      depth: 0,
    });

    const events = parseEventLines(result.stderr);
    expect(events.map((event) => event.type)).toEqual([
      "workflow:start",
      "workflow:phase:start",
      "log",
      "workflow:phase:end",
      "workflow:end",
    ]);
  });

  test("accepts JSON input from a file", async () => {
    const result = await runCli([
      "run",
      echoWorkflowPath,
      "--input-file",
      inputFilePath,
    ]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      input: { source: "file" },
      depth: 0,
    });
  });

  test("accepts JSON input from stdin", async () => {
    const result = await runCli(
      ["run", echoWorkflowPath],
      JSON.stringify({ source: "stdin" }),
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      input: { source: "stdin" },
      depth: 0,
    });
  });

  test("rejects invalid JSON before starting the Workflow", async () => {
    const result = await runCli([
      "run",
      echoWorkflowPath,
      "--input",
      "{invalid",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid JSON from --input");
    expect(parseEventLines(result.stderr)).toEqual([]);
  });

  test("returns a failing exit code after emitting workflow:error", async () => {
    const result = await runCli(["run", failingWorkflowPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("workflow failed");
    expect(parseEventLines(result.stderr).map((event) => event.type)).toEqual([
      "workflow:start",
      "workflow:error",
    ]);
  });
});

async function runCli(args: readonly string[], stdin = "") {
  const subprocess = Bun.spawn([process.execPath, cliPath, ...args], {
    cwd: projectDirectory,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  subprocess.stdin.write(stdin);
  subprocess.stdin.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
  };
}

function parseEventLines(stderr: string): WorkflowEvent[] {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as WorkflowEvent);
}
