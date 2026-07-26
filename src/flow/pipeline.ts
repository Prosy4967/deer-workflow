import type {
  PipelineStage,
  RuntimePipelineStage,
} from "./types";

/**
 * Runs every item through a sequence of stages without a global stage Barrier.
 *
 * @remarks
 * Each item advances independently. A thrown or rejected stage changes that
 * item's final result to `null`, skips its remaining stages, and does not
 * cancel sibling items. The overloads preserve stage-to-stage types for up to
 * five stages; longer pipelines return `unknown`.
 *
 * @typeParam TOriginal - Type of each original input item.
 * @param items - Items that enter the Pipeline concurrently.
 * @param stages - Ordered transformations applied independently to each item.
 * @returns Final values in original item order, with `null` for failed items.
 *
 * @example
 * ```ts
 * const results = await pipeline(
 *   checks,
 *   (check) => diagnose(check),
 *   (diagnosis, original) => repair(original, diagnosis),
 *   (repairResult) => verify(repairResult),
 * );
 * ```
 */
export function pipeline<TOriginal>(
  items: readonly TOriginal[],
): Promise<Array<TOriginal | null>>;

export function pipeline<TOriginal, TStage1>(
  items: readonly TOriginal[],
  stage1: PipelineStage<TOriginal, TOriginal, TStage1>,
): Promise<Array<Awaited<TStage1> | null>>;

export function pipeline<TOriginal, TStage1, TStage2>(
  items: readonly TOriginal[],
  stage1: PipelineStage<TOriginal, TOriginal, TStage1>,
  stage2: PipelineStage<Awaited<TStage1>, TOriginal, TStage2>,
): Promise<Array<Awaited<TStage2> | null>>;

export function pipeline<TOriginal, TStage1, TStage2, TStage3>(
  items: readonly TOriginal[],
  stage1: PipelineStage<TOriginal, TOriginal, TStage1>,
  stage2: PipelineStage<Awaited<TStage1>, TOriginal, TStage2>,
  stage3: PipelineStage<Awaited<TStage2>, TOriginal, TStage3>,
): Promise<Array<Awaited<TStage3> | null>>;

export function pipeline<
  TOriginal,
  TStage1,
  TStage2,
  TStage3,
  TStage4,
>(
  items: readonly TOriginal[],
  stage1: PipelineStage<TOriginal, TOriginal, TStage1>,
  stage2: PipelineStage<Awaited<TStage1>, TOriginal, TStage2>,
  stage3: PipelineStage<Awaited<TStage2>, TOriginal, TStage3>,
  stage4: PipelineStage<Awaited<TStage3>, TOriginal, TStage4>,
): Promise<Array<Awaited<TStage4> | null>>;

export function pipeline<
  TOriginal,
  TStage1,
  TStage2,
  TStage3,
  TStage4,
  TStage5,
>(
  items: readonly TOriginal[],
  stage1: PipelineStage<TOriginal, TOriginal, TStage1>,
  stage2: PipelineStage<Awaited<TStage1>, TOriginal, TStage2>,
  stage3: PipelineStage<Awaited<TStage2>, TOriginal, TStage3>,
  stage4: PipelineStage<Awaited<TStage3>, TOriginal, TStage4>,
  stage5: PipelineStage<Awaited<TStage4>, TOriginal, TStage5>,
): Promise<Array<Awaited<TStage5> | null>>;

export function pipeline<TOriginal>(
  items: readonly TOriginal[],
  ...stages: RuntimePipelineStage<TOriginal>[]
): Promise<Array<unknown | null>>;

export async function pipeline<TOriginal>(
  items: readonly TOriginal[],
  ...stages: RuntimePipelineStage<TOriginal>[]
): Promise<Array<unknown | null>> {
  return Promise.all(
    Array.from(items, async (original, index) => {
      let value: unknown = original;

      try {
        for (const stage of stages) {
          value = await stage(value as never, original, index);
        }
        return value;
      } catch {
        return null;
      }
    }),
  );
}
