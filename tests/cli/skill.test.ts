import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  installWorkflowCreatorSkill,
  runSkillCommand,
} from "../../src/cli/skill";

const projectDirectory = resolve(".");
const cliPath = resolve("src/cli.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("deer-workflow skill", () => {
  test("copies the Skill into existing Agent and Claude directories", async () => {
    const sourceDirectory = await createTemporaryDirectory("source");
    const homeDirectory = await createTemporaryDirectory("home");
    await writeFile(join(sourceDirectory, "SKILL.md"), "# Test Skill", "utf8");
    await mkdir(join(homeDirectory, ".agents/skills/workflow-creator"), {
      recursive: true,
    });
    await writeFile(
      join(homeDirectory, ".agents/skills/workflow-creator/SKILL.md"),
      "# Old Skill",
      "utf8",
    );
    await mkdir(join(homeDirectory, ".claude/skills"), { recursive: true });

    const result = await installWorkflowCreatorSkill(
      sourceDirectory,
      homeDirectory,
    );

    expect(result.installed).toEqual([
      join(homeDirectory, ".agents/skills/workflow-creator"),
      join(homeDirectory, ".claude/skills/workflow-creator"),
    ]);
    expect(result.skipped).toEqual([]);
    expect(
      await readFile(
        join(homeDirectory, ".agents/skills/workflow-creator/SKILL.md"),
        "utf8",
      ),
    ).toBe("# Test Skill");
    expect(
      await readFile(
        join(homeDirectory, ".claude/skills/workflow-creator/SKILL.md"),
        "utf8",
      ),
    ).toBe("# Test Skill");
  });

  test("skips Agent Skill directories that do not exist", async () => {
    const sourceDirectory = await createTemporaryDirectory("source");
    const homeDirectory = await createTemporaryDirectory("home");
    await writeFile(join(sourceDirectory, "SKILL.md"), "# Test Skill", "utf8");
    await mkdir(join(homeDirectory, ".agents/skills"), { recursive: true });

    const result = await installWorkflowCreatorSkill(
      sourceDirectory,
      homeDirectory,
    );

    expect(result.installed).toEqual([
      join(homeDirectory, ".agents/skills/workflow-creator"),
    ]);
    expect(result.skipped).toEqual([join(homeDirectory, ".claude/skills")]);
  });

  test("installs through the CLI and reports every destination", async () => {
    const homeDirectory = await createTemporaryDirectory("cli-home");
    await mkdir(join(homeDirectory, ".agents/skills"), { recursive: true });

    const result = await runCli(["skill", "install"], { HOME: homeDirectory });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "Installed or updated workflow-creator Skill:",
    );
    expect(result.stdout).toContain(
      join(homeDirectory, ".agents/skills/workflow-creator"),
    );
    expect(result.stdout).toContain("Skipped missing Skill directories:");
    expect(result.stdout).toContain(join(homeDirectory, ".claude/skills"));
    expect(
      await readFile(
        join(homeDirectory, ".agents/skills/workflow-creator/SKILL.md"),
        "utf8",
      ),
    ).toContain("name: workflow-creator");
  });

  test("rejects a missing subcommand", async () => {
    expect(runSkillCommand([])).rejects.toThrow(
      "The skill command requires a subcommand.",
    );
  });

  test("rejects an unknown subcommand", async () => {
    expect(runSkillCommand(["remove"])).rejects.toThrow(
      "Unknown skill command: remove",
    );
  });

  test("rejects unknown install options", async () => {
    expect(runSkillCommand(["install", "--global"])).rejects.toThrow(
      "Unknown skill install option: --global",
    );
  });

  test("prints skill install help without starting the installer", async () => {
    const result = await runCli(["skill", "install", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("deer-workflow skill install");
    expect(result.stdout).toContain("~/.agents/skills");
    expect(result.stdout).toContain("~/.claude/skills");
  });

  test("lists skill install in top-level help", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("deer-workflow skill install");
    expect(result.stdout).toContain("skill   Manage bundled Agent Skills");
  });
});

async function createTemporaryDirectory(label: string): Promise<string> {
  const directory = await mkdtemp(
    join(process.env.TMPDIR ?? "/tmp", `deer-workflow-skill-${label}-`),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function runCli(
  args: readonly string[],
  environment: Readonly<Record<string, string>> = {},
) {
  const subprocess = Bun.spawn([process.execPath, cliPath, ...args], {
    cwd: projectDirectory,
    env: { ...process.env, ...environment },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

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
