/**
 * A value returned immediately or through a Promise-compatible object.
 */
export type Awaitable<T> = T | PromiseLike<T>;

/**
 * Lazily started unit of work accepted by {@link parallel}.
 *
 * @typeParam TOutput - Value produced by the task.
 */
export type ParallelTask<TOutput = unknown> = () => Awaitable<TOutput>;

/**
 * Ordered result tuple produced by {@link parallel}.
 *
 * @remarks
 * Each task retains its inferred output type. A failed task is represented by
 * `null`.
 */
export type ParallelResults<TTasks extends readonly ParallelTask[]> = {
  -readonly [TIndex in keyof TTasks]: TTasks[TIndex] extends ParallelTask<
    infer TOutput
  >
    ? Awaited<TOutput> | null
    : never;
};

/**
 * One transformation step in a {@link pipeline}.
 *
 * @typeParam TValue - Value produced by the previous stage.
 * @typeParam TOriginal - Original item before any stages ran.
 * @typeParam TNext - Value produced for the next stage.
 * @param value - Current pipeline value.
 * @param original - Original input item.
 * @param index - Original input index.
 */
export type PipelineStage<TValue, TOriginal, TNext> = (
  value: TValue,
  original: TOriginal,
  index: number,
) => Awaitable<TNext>;

/**
 * Type-erased stage used by the Pipeline implementation.
 *
 * @internal
 */
export type RuntimePipelineStage<TOriginal> = PipelineStage<
  never,
  TOriginal,
  unknown
>;

/**
 * Async-local state associated with one running Workflow module.
 *
 * @typeParam TArgs - Arguments supplied to the Workflow.
 */
export interface WorkflowExecutionContext<TArgs = unknown> {
  /** Unique identifier for this Workflow invocation. */
  readonly id: string;

  /** Identifier of the parent invocation for a nested Workflow. */
  readonly parentId?: string;

  /** Nesting depth, where a host-started Workflow begins at `0`. */
  readonly depth: number;

  /** Absolute path of the running Workflow module. */
  readonly scriptPath: string;

  /** Arguments supplied by the caller. */
  readonly args: TArgs;

  /** Most recently selected progress phase. */
  phase?: string;
}

/**
 * Explicit file reference accepted by {@link workflow}.
 */
export interface WorkflowReference {
  /** Absolute path, file URL, or path relative to the parent Workflow. */
  scriptPath: string;
}

/**
 * Workflow module location accepted by {@link workflow}.
 */
export type WorkflowTarget = string | WorkflowReference;

/**
 * One declared phase in a Workflow's static metadata.
 */
export interface WorkflowPhaseMeta {
  /** Phase title, exactly matching the corresponding `phase()` call. */
  readonly title: string;
}

/**
 * JSON-safe value used by a Workflow's example caller arguments.
 */
export type WorkflowExampleValue =
  | boolean
  | number
  | string
  | null
  | readonly WorkflowExampleValue[]
  | { readonly [key: string]: WorkflowExampleValue };

/**
 * Static identity and phase plan exported by a Workflow module.
 *
 * @remarks
 * The CLI uses this metadata to build its interactive execution view. A
 * Workflow may omit metadata for backward compatibility.
 */
export interface WorkflowMeta {
  /** Kebab-case Workflow identifier. */
  readonly name: string;
  /** Concise one-line description. */
  readonly description: string;
  /** Ordered phase plan. */
  readonly phases: readonly WorkflowPhaseMeta[];
  /** Minimal runnable example passed to the Handler's `args` parameter. */
  readonly exampleArgs?: Readonly<Record<string, WorkflowExampleValue>>;
}

/**
 * Function exported by a Workflow module as `default` or `run`.
 *
 * @typeParam TArgs - Arguments supplied by the caller.
 * @typeParam TOutput - Final Workflow result.
 * @param args - Caller-supplied arguments.
 * @param context - Read-only view of the current execution context.
 * @returns The Workflow result.
 */
export type WorkflowHandler<TArgs = unknown, TOutput = unknown> = (
  args: TArgs,
  context: Readonly<WorkflowExecutionContext<TArgs>>,
) => Awaitable<TOutput>;
