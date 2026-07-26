import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CodexAgent,
  CodexAgentError,
  CodexCliNotFoundError,
} from "@deer-work-ai/workflow/agents";

let temporaryDirectory: string;
let stubPath: string;

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    join(tmpdir(), "deer-workflow-agent-test-"),
  );
  stubPath = join(temporaryDirectory, "codex-stub.ts");

  await writeFile(
    stubPath,
    `
const args = Bun.argv.slice(2);
const prompt = await Bun.stdin.text();

if (prompt.trim() === "fail") {
  console.error("mock failure");
  process.exit(7);
}

const outputIndex = args.indexOf("--output-last-message");
const schemaIndex = args.indexOf("--output-schema");
const outputPath = args[outputIndex + 1];

if (!outputPath) {
  console.error("missing output path");
  process.exit(8);
}

const body = schemaIndex >= 0
  ? JSON.stringify({ ok: true, prompt })
  : \`mock: \${prompt}\`;

await Bun.write(outputPath, body);
console.log(body);
`,
    "utf8",
  );
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("CodexAgent", () => {
  test("returns the final text response", async () => {
    const runtime = createStubAgent();

    const result = await runtime.run("hello");

    expect(result).toBe("mock: hello");
  });

  test("parses a schema-backed response as JSON", async () => {
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

  test("preserves Codex stderr on failure", async () => {
    const runtime = createStubAgent();

    try {
      await runtime.run("fail");
      throw new Error("Expected the Agent run to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(CodexAgentError);
      expect((error as CodexAgentError).exitCode).toBe(7);
      expect((error as CodexAgentError).stderr).toContain("mock failure");
    }
  });

  test("explains how to install Codex CLI when the command is missing", async () => {
    const runtime = new CodexAgent({
      command: "deer-workflow-missing-codex-command",
    });

    try {
      await runtime.run("inspect");
      throw new Error("Expected the Codex CLI lookup to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(CodexCliNotFoundError);
      expect((error as Error).message).toContain(
        "npm install -g @openai/codex",
      );
      expect((error as Error).message).toContain("codex login");
      expect((error as Error).message).toContain(
        "Codex CLI and Codex Desktop are separate installations",
      );
    }
  });
});

function createStubAgent(): CodexAgent {
  return new CodexAgent({
    command: process.execPath,
    commandArgs: [stubPath],
    cwd: temporaryDirectory,
  });
}
