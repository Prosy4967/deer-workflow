import type { TuiStyle } from "./style";
import { terminalTextWidth, truncateTerminalText } from "./terminal-text";
import type {
  TuiNextStep,
  TuiStream,
  TuiTask,
  TuiTaskCompletion,
  TuiTaskOptions,
} from "./types";

const spinnerFrames = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;
const clearCurrentLine = "\r\u001B[2K";
const refreshIntervalMilliseconds = 80;

type TaskState = "active" | "succeeded" | "failed" | "disposed";

/**
 * Indefinite animated terminal task implementation.
 *
 * @internal
 */
export class AnimatedTuiTask implements TuiTask {
  readonly #startedAt = Date.now();
  #activity: string;
  #frameIndex = 0;
  #interval: ReturnType<typeof setInterval> | undefined;
  #state: TaskState = "active";

  constructor(
    private readonly options: TuiTaskOptions,
    private readonly stream: TuiStream,
    private readonly style: TuiStyle,
    private readonly interactive: boolean,
    private readonly onFinish: () => void,
  ) {
    this.#activity = options.activity;
    if (interactive) {
      this.renderIntroduction();
      this.renderFrame();
      this.#interval = setInterval(
        () => this.renderFrame(),
        refreshIntervalMilliseconds,
      );
      this.#interval.unref?.();
    }
  }

  updateActivity(activity: string): void {
    const normalized = activity.trim();
    if (
      this.#state !== "active" ||
      !normalized ||
      normalized === this.#activity
    ) {
      return;
    }

    this.#activity = normalized;
    if (this.interactive) {
      this.clearFrame();
      this.renderFrame();
    }
  }

  writeLine(line: string): void {
    if (!this.interactive) {
      this.stream.write(`${line}\n`);
      return;
    }

    if (this.#state === "active") {
      this.clearFrame();
      this.stream.write(`${line}\n`);
      this.renderFrame();
      return;
    }

    this.stream.write(`${line}\n`);
  }

  succeed(completion?: TuiTaskCompletion): void {
    if (!this.transitionTo("succeeded")) {
      return;
    }

    if (this.interactive) {
      this.clearFrame();
      this.stream.write(
        `  ${this.style.green("✓")} ${this.options.successMessage} ${this.style.dim(`· ${this.elapsed()}`)}\n`,
      );
      this.renderNextSteps(completion?.nextSteps ?? this.options.nextSteps);
    }
  }

  fail(): void {
    if (!this.transitionTo("failed")) {
      return;
    }

    if (this.interactive) {
      this.clearFrame();
      this.stream.write(
        `  ${this.style.red("✗")} ${this.options.failureMessage} ${this.style.dim(`· ${this.elapsed()}`)}\n`,
      );
    }
  }

  dispose(): void {
    if (!this.transitionTo("disposed")) {
      return;
    }

    if (this.interactive) {
      this.clearFrame();
    }
  }

  private clearFrame(): void {
    this.stream.write(clearCurrentLine);
  }

  private elapsed(): string {
    return formatElapsed(Date.now() - this.#startedAt);
  }

  private renderFrame(): void {
    if (this.#state !== "active") {
      return;
    }

    const frame = spinnerFrames[this.#frameIndex] ?? spinnerFrames[0];
    this.#frameIndex = (this.#frameIndex + 1) % spinnerFrames.length;
    const elapsed = `· ${this.elapsed()}`;
    const activity = truncateActivity(
      this.#activity,
      this.stream.columns,
      terminalTextWidth(elapsed),
    );
    const content = `  ${this.style.cyan(frame)} ${activity} ${this.style.dim(elapsed)}`;
    this.stream.write(`${clearCurrentLine}${content}`);
  }

  private renderIntroduction(): void {
    const title = this.options.title ?? "Deer Workflow";
    this.stream.write(`\n🦌 ${this.style.bold(title)}\n`);
    this.stream.write(`  ${this.options.activity}\n`);
    this.stream.write(`  ${this.style.dim(this.options.estimate)}\n\n`);
  }

  private renderNextSteps(nextSteps: readonly TuiNextStep[] | undefined): void {
    if (nextSteps === undefined || nextSteps.length === 0) {
      return;
    }

    this.stream.write(
      `\n  ${this.style.cyan("→")} ${this.style.bold("Next")}\n`,
    );
    for (const step of nextSteps) {
      this.stream.write(`    ${step.label}\n`);
      this.stream.write(`    ${this.style.cyan(step.command)}\n`);
    }
    this.stream.write("\n");
  }

  private stopInterval(): void {
    if (this.#interval !== undefined) {
      clearInterval(this.#interval);
      this.#interval = undefined;
    }
  }

  private transitionTo(nextState: Exclude<TaskState, "active">): boolean {
    if (this.#state !== "active") {
      return false;
    }

    this.#state = nextState;
    this.stopInterval();
    this.onFinish();
    return true;
  }
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function truncateActivity(
  value: string,
  columns: number | undefined,
  elapsedLength: number,
): string {
  if (columns === undefined || columns < 20) {
    return value;
  }

  const maximumLength = Math.max(columns - elapsedLength - 7, 1);
  return truncateTerminalText(value, maximumLength);
}
