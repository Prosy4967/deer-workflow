import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";

const projectDirectory = resolve(".");
const cliPath = resolve("src/cli.ts");

let temporaryDirectory: string;

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    join(process.env.TMPDIR ?? "/tmp", "deer-workflow-create-test-"),
  );

  const codexStubPath = join(temporaryDirectory, "codex");
  await writeFile(
    codexStubPath,
    `#!/usr/bin/env bun
const args = Bun.argv.slice(2);
const prompt = await Bun.stdin.text();
const outputIndex = args.indexOf("--output-last-message");
const outputPath = args[outputIndex + 1];
const sandboxIndex = args.indexOf("--sandbox");

if (!outputPath) {
  console.error("missing output path");
  process.exit(8);
}

if (!args.includes("--skip-git-repo-check")) {
  console.error("missing --skip-git-repo-check");
  process.exit(9);
}

if (args[sandboxIndex + 1] !== "read-only") {
  console.error("create must use the read-only sandbox");
  process.exit(10);
}

await Bun.write(outputPath, \`\\\`\\\`\\\`ts\\n\${prompt}\\n\\\`\\\`\\\`\`);
`,
    "utf8",
  );
  await chmod(codexStubPath, 0o755);
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("deer-workflow create", () => {
  test("invokes the bundled Skill and appends an argument prompt", async () => {
    const result = await runCli(["create", "Research", "three", "markets"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toStartWith("$workflow-creator\n");
    expect(result.stdout).toContain("skills/workflow-creator/SKILL.md");
    expect(result.stdout).toEndWith(
      "--- USER REQUEST ---\nResearch three markets",
    );
    expect(result.stdout).not.toStartWith("```");
  });

  test("accepts the user prompt from stdin", async () => {
    const result = await runCli(
      ["create"],
      "Build a release verification Workflow",
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toEndWith(
      "--- USER REQUEST ---\nBuild a release verification Workflow",
    );
  });

  test("rejects an empty prompt", async () => {
    const result = await runCli(["create"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "The create command requires a prompt argument or stdin.",
    );
  });

  test("prints create help without starting an Agent", async () => {
    const result = await runCli(["create", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      'deer-workflow create "Describe the Workflow"',
    );
  });

  test("lists create in top-level help", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      'deer-workflow create "Describe the Workflow"',
    );
    expect(result.stdout).toContain(
      "create  Generate a Workflow with the bundled workflow-creator Skill",
    );
  });

  test("bundles the meta and args authoring contract", async () => {
    const skill = await readFile(
      resolve("skills/workflow-creator/SKILL.md"),
      "utf8",
    );

    expect(skill).toContain("export const meta");
    expect(skill).toContain('name: "workflow-name"');
    expect(skill).toContain('description: "One-line description');
    expect(skill).toContain('phases: [{ title: "Plan" }');
    expect(skill).toContain("args: WorkflowInput");
    expect(skill).toContain("`args` is not a JavaScript global");
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
