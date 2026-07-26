import { access, cp, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CliUsageError } from "./errors";

const workflowCreatorSkillDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../skills/workflow-creator",
);

interface SkillInstallResult {
  installed: string[];
  skipped: string[];
}

type SkillInstaller = (
  skillDirectory: string,
  homeDirectory?: string,
) => Promise<SkillInstallResult>;

/**
 * Executes the `deer-workflow skill` command.
 *
 * @param values - Arguments following the `skill` command.
 * @param installSkill - Installer used to add the bundled Skill to an Agent.
 * @returns A Promise that resolves after the selected command completes.
 * @internal
 */
export async function runSkillCommand(
  values: readonly string[],
  installSkill: SkillInstaller = installWorkflowCreatorSkill,
): Promise<void> {
  const [command, ...options] = values;

  if (command === "--help" || command === "-h") {
    printSkillUsage();
    return;
  }

  if (command === "install") {
    if (options.length === 1 && ["--help", "-h"].includes(options[0] ?? "")) {
      printSkillInstallUsage();
      return;
    }

    if (options.length > 0) {
      throw new CliUsageError(
        `Unknown skill install option: ${options[0] ?? ""}`,
      );
    }

    await assertWorkflowCreatorSkillExists();
    const result = await installSkill(workflowCreatorSkillDirectory);
    printSkillInstallResult(result);
    return;
  }

  if (command === undefined) {
    throw new CliUsageError(
      "The skill command requires a subcommand. Try: deer-workflow skill install",
    );
  }

  throw new CliUsageError(`Unknown skill command: ${command}`);
}

/**
 * Prints help for the `skill` command.
 *
 * @internal
 */
export function printSkillUsage(): void {
  console.log(`Usage:
  deer-workflow skill install

Commands:
  install  Install the bundled workflow-creator Skill into an Agent
`);
}

/**
 * Prints help for the `skill install` command.
 *
 * @internal
 */
export function printSkillInstallUsage(): void {
  console.log(`Usage:
  deer-workflow skill install

Installs into existing user Skill directories:
  ~/.agents/skills
  ~/.claude/skills
`);
}

/**
 * Copies the bundled Workflow Creator Skill into existing user Skill
 * directories.
 *
 * @param skillDirectory - Absolute path to the bundled Skill directory.
 * @param homeDirectory - User home directory containing Agent configuration.
 * @returns Installed and skipped destination directories.
 * @internal
 */
export async function installWorkflowCreatorSkill(
  skillDirectory: string,
  homeDirectory = homedir(),
): Promise<SkillInstallResult> {
  const skillRoots = [
    resolve(homeDirectory, ".agents/skills"),
    resolve(homeDirectory, ".claude/skills"),
  ];
  const result: SkillInstallResult = { installed: [], skipped: [] };

  for (const skillRoot of skillRoots) {
    if (!(await isDirectory(skillRoot))) {
      result.skipped.push(skillRoot);
      continue;
    }

    const destination = resolve(skillRoot, "workflow-creator");
    await cp(skillDirectory, destination, { recursive: true, force: true });
    result.installed.push(destination);
  }

  return result;
}

async function assertWorkflowCreatorSkillExists(): Promise<void> {
  try {
    await access(resolve(workflowCreatorSkillDirectory, "SKILL.md"));
  } catch (cause) {
    throw new Error(
      `The bundled workflow-creator Skill is missing at ${workflowCreatorSkillDirectory}. Reinstall deer-workflow.`,
      { cause },
    );
  }
}

function printSkillInstallResult(result: SkillInstallResult): void {
  if (result.installed.length > 0) {
    console.log("Installed or updated workflow-creator Skill:");
    for (const destination of result.installed) {
      console.log(`  ${destination}`);
    }
  } else {
    console.log("No workflow-creator Skill was installed.");
  }

  if (result.skipped.length > 0) {
    console.log("Skipped missing Skill directories:");
    for (const destination of result.skipped) {
      console.log(`  ${destination}`);
    }
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
