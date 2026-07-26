import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { emitWorkflowEvent } from "../events/context";
import { serializeWorkflowError } from "../events/error";
import {
  getWorkflowContext,
  runInWorkflowContext,
  toWorkflowEventContext,
} from "./context";
import { endCurrentPhase } from "./phase";
import type {
  WorkflowExecutionContext,
  WorkflowExampleValue,
  WorkflowHandler,
  WorkflowMeta,
  WorkflowTarget,
} from "./types";

const MAX_NESTED_WORKFLOW_DEPTH = 1;

/**
 * Error raised when a Workflow module cannot be loaded or does not export a
 * valid handler.
 */
export class WorkflowLoadError extends Error {
  /** Absolute path of the module that failed to load. */
  readonly scriptPath: string;

  /**
   * Creates a Workflow module loading error.
   *
   * @param scriptPath - Absolute path of the invalid module.
   * @param message - Human-readable failure summary.
   * @param options - Optional native error options, including the root cause.
   */
  constructor(scriptPath: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WorkflowLoadError";
    this.scriptPath = scriptPath;
  }
}

/**
 * Error raised when Workflow nesting exceeds the supported depth.
 */
export class WorkflowNestingError extends Error {
  /** Rejected nesting depth. */
  readonly depth: number;

  /**
   * Creates an error for an unsupported Workflow nesting depth.
   *
   * @param depth - Depth that the runtime refused to execute.
   */
  constructor(depth: number) {
    super(
      `Workflow nesting is limited to one level; attempted depth ${depth}.`,
    );
    this.name = "WorkflowNestingError";
    this.depth = depth;
  }
}

/**
 * Loads and runs a Workflow module.
 *
 * @remarks
 * A module must export a {@link WorkflowHandler} as either `default` or `run`.
 * Relative nested paths resolve from the parent Workflow module. Host-started
 * Workflows begin at depth `0`, and one nested Workflow level is supported.
 *
 * @typeParam TOutput - Expected final Workflow result.
 * @typeParam TArgs - Type of caller-supplied arguments.
 * @param target - Module path, file URL, or explicit script reference.
 * @param args - Value injected into the Workflow handler and context.
 * @returns The handler's final result.
 * @throws {@link WorkflowLoadError} When the module cannot load or lacks a
 * valid handler export.
 * @throws {@link WorkflowNestingError} When nesting exceeds one level.
 *
 * @example
 * ```ts
 * const artifacts = await workflow<string[]>(
 *   { scriptPath: "./workflows/release.ts" },
 *   { version: "3.0.0" },
 * );
 * ```
 */
export async function workflow<TOutput = unknown, TArgs = unknown>(
  target: WorkflowTarget,
  args?: TArgs,
): Promise<TOutput> {
  const parentContext = getWorkflowContext();
  const depth = parentContext ? parentContext.depth + 1 : 0;

  if (depth > MAX_NESTED_WORKFLOW_DEPTH) {
    throw new WorkflowNestingError(depth);
  }

  const scriptPath = resolveWorkflowPath(target, parentContext);
  const context: WorkflowExecutionContext<TArgs | undefined> = {
    id: crypto.randomUUID(),
    parentId: parentContext?.id,
    depth,
    scriptPath,
    args,
  };

  return runInWorkflowContext(context, async () => {
    const startedAt = performance.now();
    emitWorkflowEvent({
      type: "workflow:start",
      ...toWorkflowEventContext(context),
    });

    try {
      const definition = await loadWorkflowDefinition<
        TArgs | undefined,
        TOutput
      >(scriptPath);
      if (definition.meta !== undefined) {
        emitWorkflowEvent({
          type: "workflow:meta",
          ...toWorkflowEventContext(context),
          meta: definition.meta,
        });
      }
      const result = await definition.handler(args, context);
      endCurrentPhase(context);
      emitWorkflowEvent({
        type: "workflow:end",
        ...toWorkflowEventContext(context),
        durationMs: elapsedMilliseconds(startedAt),
      });
      return result;
    } catch (error) {
      endCurrentPhase(context);
      emitWorkflowEvent({
        type: "workflow:error",
        ...toWorkflowEventContext(context),
        durationMs: elapsedMilliseconds(startedAt),
        error: serializeWorkflowError(error),
      });
      throw error;
    }
  });
}

function resolveWorkflowPath(
  target: WorkflowTarget,
  parentContext: WorkflowExecutionContext | undefined,
): string {
  const rawPath = typeof target === "string" ? target : target.scriptPath;
  const normalizedPath = rawPath.trim();

  if (!normalizedPath) {
    throw new TypeError("workflow() requires a non-empty script path.");
  }

  if (normalizedPath.startsWith("file:")) {
    return fileURLToPath(normalizedPath);
  }

  if (isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  const baseDirectory = parentContext
    ? dirname(parentContext.scriptPath)
    : process.cwd();
  return resolve(baseDirectory, normalizedPath);
}

async function loadWorkflowDefinition<TArgs, TOutput>(
  scriptPath: string,
): Promise<{
  readonly handler: WorkflowHandler<TArgs, TOutput>;
  readonly meta?: WorkflowMeta;
}> {
  let workflowModule: unknown;

  try {
    workflowModule = await import(pathToFileURL(scriptPath).href);
  } catch (cause) {
    throw new WorkflowLoadError(
      scriptPath,
      `Unable to load Workflow module at ${scriptPath}.`,
      { cause },
    );
  }

  if (!isModuleRecord(workflowModule)) {
    throw new WorkflowLoadError(
      scriptPath,
      `Workflow module at ${scriptPath} did not expose module exports.`,
    );
  }

  const candidate = workflowModule.default ?? workflowModule.run;
  if (typeof candidate !== "function") {
    throw new WorkflowLoadError(
      scriptPath,
      `Workflow module at ${scriptPath} must export a default function or a named run() function.`,
    );
  }

  const meta = parseWorkflowMeta(workflowModule.meta, scriptPath);
  return {
    handler: candidate as WorkflowHandler<TArgs, TOutput>,
    ...(meta === undefined ? {} : { meta }),
  };
}

function isModuleRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWorkflowMeta(
  value: unknown,
  scriptPath: string,
): WorkflowMeta | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isModuleRecord(value)) {
    throw invalidWorkflowMeta(scriptPath, "meta must be an object");
  }

  const { name, description, phases } = value;
  if (typeof name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw invalidWorkflowMeta(scriptPath, "meta.name must be kebab-case");
  }
  if (
    typeof description !== "string" ||
    !description.trim() ||
    /[\r\n]/.test(description) ||
    hasControlCharacters(description)
  ) {
    throw invalidWorkflowMeta(
      scriptPath,
      "meta.description must be a non-empty, one-line string",
    );
  }
  if (!Array.isArray(phases) || phases.length === 0) {
    throw invalidWorkflowMeta(
      scriptPath,
      "meta.phases must be a non-empty array",
    );
  }

  const titles = phases.map((phase, index) => {
    if (
      !isModuleRecord(phase) ||
      typeof phase.title !== "string" ||
      !phase.title.trim() ||
      hasControlCharacters(phase.title)
    ) {
      throw invalidWorkflowMeta(
        scriptPath,
        `meta.phases[${index}].title must be a non-empty string`,
      );
    }
    return phase.title.trim();
  });
  if (new Set(titles).size !== titles.length) {
    throw invalidWorkflowMeta(scriptPath, "meta.phases titles must be unique");
  }

  const exampleArgs = parseExampleArgs(value.exampleArgs, scriptPath);
  return Object.freeze({
    name,
    description: description.trim(),
    phases: Object.freeze(titles.map((title) => Object.freeze({ title }))),
    ...(exampleArgs === undefined ? {} : { exampleArgs }),
  });
}

function parseExampleArgs(
  value: unknown,
  scriptPath: string,
): Readonly<Record<string, WorkflowExampleValue>> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isModuleRecord(value) || Array.isArray(value)) {
    throw invalidWorkflowMeta(
      scriptPath,
      "meta.exampleArgs must be a JSON-safe object",
    );
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneExampleValue(item, scriptPath),
      ]),
    ),
  );
}

function cloneExampleValue(
  value: unknown,
  scriptPath: string,
): WorkflowExampleValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw invalidWorkflowMeta(
        scriptPath,
        "meta.exampleArgs must contain only finite JSON numbers",
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) => cloneExampleValue(item, scriptPath)),
    );
  }
  if (isModuleRecord(value)) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          cloneExampleValue(item, scriptPath),
        ]),
      ),
    );
  }
  throw invalidWorkflowMeta(
    scriptPath,
    "meta.exampleArgs must contain only JSON-safe values",
  );
}

function invalidWorkflowMeta(
  scriptPath: string,
  detail: string,
): WorkflowLoadError {
  return new WorkflowLoadError(
    scriptPath,
    `Invalid Workflow metadata at ${scriptPath}: ${detail}.`,
  );
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || (codePoint >= 127 && codePoint <= 159);
  });
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt);
}
