import { basename, isAbsolute, relative, sep } from "node:path";

import type { WorkflowEvent } from "../events";
import { renderTerminalMarkdown } from "./markdown";
import type { RenderedMarkdownLine } from "./markdown";
import type { TuiStyle } from "./style";
import {
  terminalGraphemes,
  terminalTextWidth,
  truncateTerminalText,
} from "./terminal-text";
import type {
  TuiStream,
  WorkflowTuiTask,
  WorkflowTuiTaskOptions,
} from "./types";

const refreshIntervalMilliseconds = 120;
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

type DashboardState = "active" | "succeeded" | "failed" | "disposed";
type PhaseState = "pending" | "active" | "completed" | "failed";

interface DashboardPhase {
  readonly title: string;
  durationMs?: number;
  startedAt?: number;
  state: PhaseState;
}

/**
 * Responsive two-pane Workflow execution dashboard.
 *
 * @internal
 */
export class WorkflowDashboard implements WorkflowTuiTask {
  readonly #logs: string[] = [];
  readonly #phases: DashboardPhase[] = [];
  readonly #startedAt = Date.now();
  #activity: string;
  #animationTick = 0;
  #interval: ReturnType<typeof setInterval> | undefined;
  #renderedLineCount = 0;
  #scriptPath: string | undefined;
  #state: DashboardState = "active";
  #workflowName = "Loading…";

  constructor(
    private readonly options: WorkflowTuiTaskOptions,
    private readonly stream: TuiStream,
    private readonly style: TuiStyle,
    private readonly interactive: boolean,
    private readonly onFinish: () => void,
  ) {
    this.#activity = options.activity;
    if (interactive) {
      this.render();
      this.#interval = setInterval(() => {
        this.#animationTick += 1;
        this.render();
      }, refreshIntervalMilliseconds);
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
    this.render();
  }

  writeLine(line: string): void {
    if (!this.interactive) {
      this.stream.write(`${line}\n`);
    }
  }

  handleEvent(event: WorkflowEvent): void {
    if (event.depth > 0 && event.type === "workflow:meta") {
      return;
    }

    switch (event.type) {
      case "workflow:start":
        if (event.depth === 0) {
          this.#scriptPath = event.scriptPath;
          this.#workflowName = basename(event.scriptPath);
        }
        this.#activity =
          event.depth === 0
            ? "Loading Workflow metadata"
            : "Running a nested Workflow";
        break;
      case "workflow:meta":
        this.applyMeta(event.meta.phases.map((phase) => phase.title));
        this.#workflowName = event.meta.name;
        this.#activity = event.meta.description;
        break;
      case "workflow:phase:start":
        this.activatePhase(event.phase);
        this.#activity = `Running phase: ${event.phase}`;
        break;
      case "workflow:phase:end":
        this.completePhase(event.phase, event.durationMs);
        this.#activity = `Completed phase: ${event.phase}`;
        break;
      case "log":
        this.#logs.push(event.message);
        if (event.phase !== undefined) {
          this.#activity = `Running phase: ${event.phase}`;
        }
        break;
      case "workflow:end":
        this.#activity =
          event.depth === 0 ? "Preparing the result" : this.#activity;
        break;
      case "workflow:error":
        this.failActivePhase();
        this.#activity = "Stopping after an error";
        break;
    }
    this.render();
  }

  succeed(): void {
    if (!this.transitionTo("succeeded")) {
      return;
    }
    this.#activity = this.options.successMessage;
    this.render();
  }

  fail(): void {
    if (!this.transitionTo("failed")) {
      return;
    }
    this.failActivePhase();
    this.#activity = this.options.failureMessage;
    this.render();
  }

  dispose(): void {
    if (!this.transitionTo("disposed")) {
      return;
    }
    if (this.interactive && this.#renderedLineCount > 0) {
      this.clearPreviousRender();
    }
  }

  private activatePhase(title: string): void {
    let phase = this.#phases.find((candidate) => candidate.title === title);
    if (phase === undefined) {
      phase = { title, state: "pending" };
      this.#phases.push(phase);
    }
    for (const candidate of this.#phases) {
      if (candidate.state === "active") {
        candidate.state = "completed";
        candidate.durationMs =
          candidate.startedAt === undefined
            ? undefined
            : Date.now() - candidate.startedAt;
      }
    }
    phase.state = "active";
    phase.startedAt = Date.now();
    phase.durationMs = undefined;
  }

  private applyMeta(titles: readonly string[]): void {
    if (this.#phases.length > 0) {
      return;
    }
    this.#phases.push(
      ...titles.map((title) => ({ title, state: "pending" as const })),
    );
  }

  private clearPreviousRender(): void {
    this.stream.write(`\u001B[${this.#renderedLineCount}A\r\u001B[J`);
  }

  private completePhase(title: string, durationMs: number): void {
    const phase = this.#phases.find((candidate) => candidate.title === title);
    if (phase !== undefined) {
      phase.state = "completed";
      phase.durationMs = durationMs;
    }
  }

  private elapsed(): string {
    const totalSeconds = Math.floor((Date.now() - this.#startedAt) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes === 0
      ? `${seconds}s`
      : `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }

  private failActivePhase(): void {
    const active = this.#phases.find((phase) => phase.state === "active");
    if (active !== undefined) {
      active.state = "failed";
      active.durationMs =
        active.startedAt === undefined
          ? undefined
          : Date.now() - active.startedAt;
    }
  }

  private phaseLines(width: number, height: number): RenderedMarkdownLine[] {
    if (this.#phases.length === 0) {
      const waiting = "○ Loading phase plan…";
      return [
        {
          value: this.style.dim(truncateTerminalText(waiting, width)),
          visibleLength: Math.min(terminalTextWidth(waiting), width),
        },
      ];
    }

    return this.#phases.slice(0, height).map((phase) => {
      const symbol =
        phase.state === "active"
          ? (spinnerFrames[this.#animationTick % spinnerFrames.length] ??
            spinnerFrames[0])
          : phase.state === "completed"
            ? "✓"
            : phase.state === "failed"
              ? "✗"
              : "○";
      const durationMs =
        phase.state === "active" && phase.startedAt !== undefined
          ? Date.now() - phase.startedAt
          : phase.durationMs;
      const duration =
        durationMs === undefined ? "" : ` · ${formatDuration(durationMs)}`;
      const title = truncateTerminalText(
        phase.title,
        Math.max(width - 2 - terminalTextWidth(duration), 1),
      );
      const plain = `${symbol} ${title}${duration}`;
      const value =
        phase.state === "active"
          ? `${this.style.cyan(symbol)} ${renderShimmer(title, this.#animationTick, this.style)}${this.style.dim(duration)}`
          : phase.state === "completed"
            ? `${this.style.green(`${symbol} ${title}`)}${this.style.dim(duration)}`
            : phase.state === "failed"
              ? `${this.style.red(`${symbol} ${title}`)}${this.style.dim(duration)}`
              : this.style.dim(plain);
      return { value, visibleLength: terminalTextWidth(plain) };
    });
  }

  private logLines(width: number, height: number): RenderedMarkdownLine[] {
    const rendered = this.#logs.flatMap((message) => [
      ...renderTerminalMarkdown(message, width, this.style),
      { value: "", visibleLength: 0 },
    ]);
    if (rendered.length === 0) {
      const waiting = "Waiting for log() output…";
      return [
        {
          value: this.style.dim(truncateTerminalText(waiting, width)),
          visibleLength: Math.min(terminalTextWidth(waiting), width),
        },
      ];
    }
    return rendered.slice(-height);
  }

  private render(): void {
    if (!this.interactive || this.#state === "disposed") {
      return;
    }

    const width = Math.max(this.stream.columns ?? 100, 40);
    const height = Math.max(Math.min((this.stream.rows ?? 24) - 10, 18), 7);
    const lines =
      width >= 76
        ? this.renderColumns(width, height)
        : this.renderStacked(width, height);

    if (this.#renderedLineCount > 0) {
      this.clearPreviousRender();
    } else {
      this.stream.write("\n");
    }
    this.stream.write(`${lines.join("\n")}\n`);
    this.#renderedLineCount = lines.length;
  }

  private renderColumns(width: number, height: number): string[] {
    const leftWidth = Math.min(Math.max(Math.floor(width * 0.3), 22), 34);
    const rightWidth = width - leftWidth - 3;
    const contentHeight = Math.max(height - 2, 1);
    const phases = this.phaseLines(leftWidth - 2, contentHeight);
    const logs = this.logLines(rightWidth - 2, contentHeight);
    const lines = this.renderHeader(width);
    lines.push(`┌${"─".repeat(leftWidth)}┬${"─".repeat(rightWidth)}┐`);
    lines.push(
      `│${cell(this.style.bold("Phases"), "Phases".length, leftWidth)}│${cell(this.style.bold("Logs"), "Logs".length, rightWidth)}│`,
    );
    lines.push(`│${cell("", 0, leftWidth)}│${cell("", 0, rightWidth)}│`);
    for (let index = 0; index < contentHeight; index += 1) {
      const phase = phases[index] ?? { value: "", visibleLength: 0 };
      const log = logs[index] ?? { value: "", visibleLength: 0 };
      lines.push(
        `│${cell(phase.value, phase.visibleLength, leftWidth)}│${cell(log.value, log.visibleLength, rightWidth)}│`,
      );
    }
    lines.push(`└${"─".repeat(leftWidth)}┴${"─".repeat(rightWidth)}┘`);
    this.appendStopHint(lines);
    return lines;
  }

  private renderHeader(width: number): string[] {
    const symbol =
      this.#state === "succeeded"
        ? "✓"
        : this.#state === "failed"
          ? "✗"
          : (spinnerFrames[this.#animationTick % spinnerFrames.length] ??
            spinnerFrames[0]);
    const plain = truncateTerminalText(
      `${symbol} ${this.#activity} · ${this.elapsed()}`,
      width,
    );
    const styledSymbol =
      this.#state === "succeeded"
        ? this.style.green(symbol)
        : this.#state === "failed"
          ? this.style.red(symbol)
          : this.style.cyan(symbol);
    const activity = `${styledSymbol}${plain.slice(symbol.length)}`;
    return [
      `🦌 ${this.style.bold("Deer Workflow")}`,
      metadataLine("Workflow", this.#workflowName, width, this.style),
      metadataLine("File", this.displayScriptPath(), width, this.style),
      metadataLine(
        "Directory",
        this.options.workingDirectory,
        width,
        this.style,
      ),
      activity,
    ];
  }

  private displayScriptPath(): string {
    if (this.#scriptPath === undefined) {
      return "Loading…";
    }
    const relativePath = relative(
      this.options.workingDirectory,
      this.#scriptPath,
    );
    if (!relativePath) {
      return `.${sep}${basename(this.#scriptPath)}`;
    }
    return relativePath.startsWith("..") || isAbsolute(relativePath)
      ? this.#scriptPath
      : `.${sep}${relativePath}`;
  }

  private renderStacked(width: number, height: number): string[] {
    const innerWidth = width - 2;
    const phaseHeight = Math.max(Math.min(this.#phases.length, 5), 2);
    const logHeight = Math.max(height - phaseHeight - 4, 3);
    const phases = this.phaseLines(innerWidth - 2, phaseHeight);
    const logs = this.logLines(innerWidth - 2, logHeight);
    const lines = this.renderHeader(width);
    lines.push(`┌${"─".repeat(innerWidth)}┐`);
    lines.push(`│${cell(this.style.bold("Phases"), 6, innerWidth)}│`);
    lines.push(`│${cell("", 0, innerWidth)}│`);
    for (let index = 0; index < phaseHeight; index += 1) {
      const phase = phases[index] ?? { value: "", visibleLength: 0 };
      lines.push(`│${cell(phase.value, phase.visibleLength, innerWidth)}│`);
    }
    lines.push(`├${"─".repeat(innerWidth)}┤`);
    lines.push(`│${cell(this.style.bold("Logs"), 4, innerWidth)}│`);
    lines.push(`│${cell("", 0, innerWidth)}│`);
    for (let index = 0; index < logHeight; index += 1) {
      const log = logs[index] ?? { value: "", visibleLength: 0 };
      lines.push(`│${cell(log.value, log.visibleLength, innerWidth)}│`);
    }
    lines.push(`└${"─".repeat(innerWidth)}┘`);
    this.appendStopHint(lines);
    return lines;
  }

  private appendStopHint(lines: string[]): void {
    if (this.#state === "active") {
      lines.push(this.style.dim("Press Ctrl+C to stop"));
    }
  }

  private stopInterval(): void {
    if (this.#interval !== undefined) {
      clearInterval(this.#interval);
      this.#interval = undefined;
    }
  }

  private transitionTo(next: Exclude<DashboardState, "active">): boolean {
    if (this.#state !== "active") {
      return false;
    }
    this.#state = next;
    this.stopInterval();
    this.onFinish();
    return true;
  }
}

function cell(value: string, visibleLength: number, width: number): string {
  const contentWidth = Math.max(width - 2, 0);
  return ` ${value}${" ".repeat(Math.max(contentWidth - visibleLength, 0))} `;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) {
    return `${Math.max(Math.floor(durationMs / 1_000), 0)}s`;
  }
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function metadataLine(
  label: string,
  value: string,
  width: number,
  style: TuiStyle,
): string {
  const paddedLabel = label.padEnd(10);
  const safeValue = sanitizeTerminalText(value);
  const displayValue = truncateTerminalText(
    safeValue,
    Math.max(width - terminalTextWidth(paddedLabel) - 1, 1),
  );
  const styledValue =
    label === "Workflow" ? style.bold(displayValue) : displayValue;
  return `${style.dim(paddedLabel)} ${styledValue}`;
}

function renderShimmer(
  value: string,
  animationTick: number,
  style: TuiStyle,
): string {
  const characters = terminalGraphemes(value);
  const highlight = animationTick % (characters.length + 4);
  return characters
    .map((character, index) => {
      const distance = Math.abs(index - highlight);
      if (distance === 0) {
        return style.brightWhite(character);
      }
      if (distance === 1) {
        return style.brightCyan(character);
      }
      return style.cyan(character);
    })
    .join("");
}

function sanitizeTerminalText(value: string): string {
  return [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && !(codePoint >= 127 && codePoint <= 159);
    })
    .join("");
}
