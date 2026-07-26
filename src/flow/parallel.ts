import type {
  ParallelResults,
  ParallelTask,
} from "./types";

/**
 * Starts every task concurrently and waits at a Barrier until all tasks settle.
 *
 * @remarks
 * Results preserve task order. A rejected or synchronously thrown task
 * produces `null` without cancelling sibling tasks.
 *
 * @typeParam TTasks - Tuple or array of lazy tasks.
 * @param tasks - Thunks to start concurrently.
 * @returns An ordered result tuple with `null` in failed positions.
 *
 * @example
 * ```ts
 * const [lint, test] = await parallel([
 *   () => runLint(),
 *   () => runTests(),
 * ]);
 * ```
 */
export async function parallel<
  const TTasks extends readonly ParallelTask[],
>(tasks: TTasks): Promise<ParallelResults<TTasks>> {
  const results = await Promise.all(
    Array.from(tasks, async (task) => {
      try {
        return await task();
      } catch {
        return null;
      }
    }),
  );

  return results as ParallelResults<TTasks>;
}
