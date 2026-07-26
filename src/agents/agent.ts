import type {
  Agent,
  AgentFunction,
  AgentOptions,
} from "./types";

/**
 * Binds an {@link Agent} instance to the callable {@link AgentFunction} API.
 *
 * @param runtime - Agent runtime that will handle every invocation.
 * @returns A function that forwards prompts and options to `runtime.run()`.
 */
export function bindAgent(runtime: Agent): AgentFunction {
  return <TOutput = string>(
    prompt: string,
    options?: AgentOptions,
  ): Promise<TOutput> => runtime.run<TOutput>(prompt, options);
}
