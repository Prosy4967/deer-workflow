import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";

const projectDirectory = resolve(".");
const cliPath = resolve("src/cli.ts");

let temporaryDirectory: string;

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    join(process.env.TMPDIR ?? "/tmp", "deer-workflow-agent-test-"),
  );

  const codexStubPath = join(temporaryDirectory, "codex");
  await writeFile(
    codexStubPath,
    `#!/usr/bin/env bun
const args = Bun.argv.slice(2);
const prompt = await Bun.stdin.text();
const outputIndex = args.indexOf("--output-last-message");
const outputPath = args[outputIndex + 1];

if (!outputPath) {
  console.error("missing output path");
  process.exit(8);
}

await Bun.write(outputPath, \`Agent response: \${prompt}\`);
`,
    "utf8",
  );
  await chmod(codexStubPath, 0o755);

  const claudeStubPath = join(temporaryDirectory, "claude");
  await writeFile(
    claudeStubPath,
    `#!/usr/bin/env bun
const args = Bun.argv.slice(2);
const prompt = await Bun.stdin.text();

if (!args.includes("--print") || !args.includes("--no-session-persistence")) {
  console.error("missing Claude print arguments");
  process.exit(8);
}

console.log(JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: \`Claude response: \${prompt}\`,
}));
`,
    "utf8",
  );
  await chmod(claudeStubPath, 0o755);
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("deer-workflow agent", () => {
  test("runs an argument prompt without contaminating piped output", async () => {
    const result = await runCli(["agent", "Inspect", "the", "repository"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Agent response: Inspect the repository");
    expect(result.stderr).toBe("");
  });

  test("accepts a prompt from stdin", async () => {
    const result = await runCli(["agent"], "Review the release");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Agent response: Review the release");
    expect(result.stderr).toBe("");
  });

  test("uses Claude when selected", async () => {
    const result = await runCli([
      "agent",
      "--agent",
      "claude",
      "Inspect",
      "the",
      "repository",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Claude response: Inspect the repository");
    expect(result.stderr).toBe("");
  });

  test("accepts an explicit Codex selection", async () => {
    const result = await runCli([
      "agent",
      "Inspect",
      "--agent=codex",
      "the",
      "repository",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Agent response: Inspect the repository");
  });

  test("rejects an unsupported Agent", async () => {
    const result = await runCli([
      "agent",
      "--agent",
      "other",
      "Inspect the repository",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Invalid --agent value: other. Expected codex or claude.",
    );
  });

  test("documents Agent selection in command help", async () => {
    const result = await runCli(["agent", "--agent", "claude", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "deer-workflow agent [--agent codex|claude]",
    );
    expect(result.stdout).toContain(
      "--agent <codex|claude>  Agent runtime (default: codex)",
    );
  });

  test("documents Agent selection in top-level help", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "--agent <codex|claude>  Agent runtime for agent/create (default: codex)",
    );
  });

  test("rejects an empty prompt before starting the TUI", async () => {
    const result = await runCli(["agent"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "The agent command requires a prompt argument or stdin.",
    );
  });
});

async function runCli(args: readonly string[], stdin = "") {
  const path = [temporaryDirectory, process.env.PATH ?? ""].join(delimiter);
  const subprocess = Bun.spawn([process.execPath, cliPath, ...args], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      PATH: path,
    },
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
