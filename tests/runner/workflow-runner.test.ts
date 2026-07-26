import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { WorkflowEvent } from "@deerwork-ai/deer-workflow/events";
import { WorkflowRunner } from "@deerwork-ai/deer-workflow/runner";

let temporaryDirectory: string;
let successfulWorkflowPath: string;
let failingWorkflowPath: string;
let simpleWorkflowPath: string;

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    join(tmpdir(), "deer-workflow-runner-test-"),
  );

  const flowModuleUrl = pathToFileURL(resolve("src/flow/index.ts")).href;
  const loggingModuleUrl = pathToFileURL(resolve("src/logging/index.ts")).href;

  successfulWorkflowPath = join(temporaryDirectory, "successful.ts");
  await writeFile(
    successfulWorkflowPath,
    `
import { phase } from ${JSON.stringify(flowModuleUrl)};
import { log } from ${JSON.stringify(loggingModuleUrl)};

export const meta = {
  name: "successful",
  description: "Runs research and synthesis.",
  phases: [{ title: "Research" }, { title: "Synthesis" }],
  exampleArgs: { topic: "Agent runtimes" },
};

export default function run() {
  phase("Research");
  log("Collecting sources");
  phase("Synthesis");
  log("Writing report");
  return "done";
}
`,
    "utf8",
  );

  failingWorkflowPath = join(temporaryDirectory, "failing.ts");
  await writeFile(
    failingWorkflowPath,
    `
import { phase } from ${JSON.stringify(flowModuleUrl)};
import { log } from ${JSON.stringify(loggingModuleUrl)};

export default function run() {
  phase("Verify");
  log("Checking output");
  throw new Error("verification failed");
}
`,
    "utf8",
  );

  simpleWorkflowPath = join(temporaryDirectory, "simple.ts");
  await writeFile(simpleWorkflowPath, "export default () => 42;\n", "utf8");
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("WorkflowRunner", () => {
  test("writes ordered lifecycle, phase, and log events as JSON Lines", async () => {
    const lines: string[] = [];
    const runner = new WorkflowRunner({
      logWriter: (line) => lines.push(line),
    });

    const result = await runner.run<string>(successfulWorkflowPath);
    const events = lines.map(parseEvent);

    expect(result).toBe("done");
    expect(events.map((event) => event.type)).toEqual([
      "workflow:start",
      "workflow:meta",
      "workflow:phase:start",
      "log",
      "workflow:phase:end",
      "workflow:phase:start",
      "log",
      "workflow:phase:end",
      "workflow:end",
    ]);
    expect(events.map((event) => event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(new Set(events.map((event) => event.workflowId)).size).toBe(1);

    const metadata = events[1];
    expect(metadata?.type).toBe("workflow:meta");
    if (metadata?.type === "workflow:meta") {
      expect(metadata.meta.name).toBe("successful");
      expect(metadata.meta.phases.map((phase) => phase.title)).toEqual([
        "Research",
        "Synthesis",
      ]);
      expect(metadata.meta.exampleArgs).toEqual({ topic: "Agent runtimes" });
    }

    const firstLog = events[3];
    expect(firstLog?.type).toBe("log");
    if (firstLog?.type === "log") {
      expect(firstLog.phase).toBe("Research");
      expect(firstLog.message).toBe("Collecting sources");
    }

    runner.dispose();
  });

  test("closes the active phase and serializes execution errors", async () => {
    const lines: string[] = [];
    const runner = new WorkflowRunner({
      logWriter: (line) => lines.push(line),
    });

    await expect(runner.run(failingWorkflowPath)).rejects.toThrow(
      "verification failed",
    );

    const events = lines.map(parseEvent);
    expect(events.map((event) => event.type)).toEqual([
      "workflow:start",
      "workflow:phase:start",
      "log",
      "workflow:phase:end",
      "workflow:error",
    ]);

    const failure = events.at(-1);
    expect(failure?.type).toBe("workflow:error");
    if (failure?.type === "workflow:error") {
      expect(failure.error.name).toBe("Error");
      expect(failure.error.message).toBe("verification failed");
      expect(failure.durationMs).toBeGreaterThanOrEqual(0);
    }

    runner.dispose();
  });

  test("uses console.log as the default JSON line writer", async () => {
    const lines: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...values: unknown[]) => {
      lines.push(values.map(String).join(" "));
    };

    try {
      const runner = new WorkflowRunner();
      expect(await runner.run<number>(simpleWorkflowPath)).toBe(42);
      runner.dispose();
    } finally {
      console.log = originalConsoleLog;
    }

    expect(lines.map(parseEvent).map((event) => event.type)).toEqual([
      "workflow:start",
      "workflow:end",
    ]);
  });
});

function parseEvent(line: string): WorkflowEvent {
  return JSON.parse(line) as WorkflowEvent;
}
