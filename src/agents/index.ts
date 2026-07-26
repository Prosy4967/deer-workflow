import { bindAgent } from "./agent";
import { CodexAgent } from "./codex-agent";

export type {
  Agent,
  AgentFunction,
  AgentOptions,
  AgentSandbox,
  CodexAgentConfig,
  JsonPrimitive,
  JsonSchema,
  JsonValue,
} from "./types";
export {
  CodexAgent,
  CodexAgentError,
} from "./codex-agent";

/**
 * Shared default Agent runtime backed by Codex CLI.
 */
export const defaultAgent = new CodexAgent();

/**
 * Runs a task through the default {@link CodexAgent}.
 *
 * @example
 * ```ts
 * const result = await agent<{ ok: boolean }>("Run the checks.", {
 *   schema: {
 *     type: "object",
 *     properties: { ok: { type: "boolean" } },
 *     required: ["ok"],
 *   },
 * });
 * ```
 */
export const agent = bindAgent(defaultAgent);
