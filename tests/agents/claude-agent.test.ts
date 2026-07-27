import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  ClaudeAgent,
  ClaudeAgentError,
  ClaudeCliNotFoundError,
} from "@deerwork-ai/deer-workflow/agents";

let temporaryDirectory: string;
let stubPath: string;

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    join(tmpdir(), "deer-workflow-claude-agent-test-"),
  );
  stubPath = join(temporaryDirectory, "claude-stub.ts");

  await writeFile(
    stubPath,
    `
const args = Bun.argv.slice(2);
const prompt = await Bun.stdin.text();

if (prompt.trim() === "fail") {
  console.log(JSON.stringify({
    type: "result",
    subtype: "error",
    is_error: true,
    result: "mock failure",
  }));
  process.exit(1);
}

if (prompt.trim() === "not-json") {
  console.log("not json");
  process.exit(0);
}

const schemaIndex = args.indexOf("--json-schema");
const message = schemaIndex >= 0
  ? {
      type: "result",
      subtype: "success",
      is_error: false,
      result: JSON.stringify({ ok: true, prompt }),
      structured_output: { ok: true, prompt },
    }
  : {
      type: "result",
      subtype: "success",
      is_error: false,
      result: \`mock: \${prompt}\`,
    };

console.log(JSON.stringify(message));
`,
    "utf8",
  );
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("ClaudeAgent", () => {
  test("returns the final text response", async () => {
    const runtime = createStubAgent();

    const result = await runtime.run("hello");

    expect(result).toBe("mock: hello");
  });

  test("parses a schema-backed response from structured_output", async () => {
    const runtime = createStubAgent();

    const result = await runtime.run<{
      ok: boolean;
      prompt: string;
    }>("inspect", {
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          prompt: { type: "string" },
        },
        required: ["ok", "prompt"],
        additionalProperties: false,
      },
    });

    expect(result).toEqual({ ok: true, prompt: "inspect" });
  });

  test("preserves Claude Code stderr and result on failure", async () => {
    const runtime = createStubAgent();

    try {
      await runtime.run("fail");
      throw new Error("Expected the Agent run to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaudeAgentError);
      expect((error as ClaudeAgentError).exitCode).toBe(1);
      expect((error as ClaudeAgentError).message).toContain("mock failure");
    }
  });

  test("fails clearly when Claude Code returns non-JSON output", async () => {
    const runtime = createStubAgent();

    try {
      await runtime.run("not-json");
      throw new Error("Expected the Agent run to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaudeAgentError);
      expect((error as ClaudeAgentError).message).toContain("non-JSON");
    }
  });

  test("explains how to install Claude Code CLI when the command is missing", async () => {
    const runtime = new ClaudeAgent({
      command: "deer-workflow-missing-claude-command",
    });

    try {
      await runtime.run("inspect");
      throw new Error("Expected the Claude Code CLI lookup to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaudeCliNotFoundError);
      expect((error as Error).message).toContain(
        "npm install -g @anthropic-ai/claude-code",
      );
      expect((error as Error).message).toContain("claude auth login");
    }
  });
});

function createStubAgent(): ClaudeAgent {
  return new ClaudeAgent({
    command: process.execPath,
    commandArgs: [stubPath],
    cwd: temporaryDirectory,
  });
}
