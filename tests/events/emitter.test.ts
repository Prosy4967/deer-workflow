import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  createJsonEventWriter,
  WorkflowEventEmitter,
} from "../../src/events";
import type { WorkflowEvent } from "../../src/events";

const eventContext = {
  workflowId: "workflow-1",
  depth: 0,
  scriptPath: "/tmp/workflow.ts",
} as const;

describe("WorkflowEventEmitter", () => {
  test("adds ordered envelope metadata and supports unsubscribe", () => {
    const emitter = new WorkflowEventEmitter();
    const received: WorkflowEvent[] = [];
    const unsubscribe = emitter.on((event) => received.push(event));

    const first = emitter.emit({
      type: "workflow:start",
      ...eventContext,
    });
    unsubscribe();
    emitter.emit({
      type: "workflow:end",
      ...eventContext,
      durationMs: 12,
    });

    expect(first.sequence).toBe(1);
    expect(Number.isNaN(Date.parse(first.timestamp))).toBeFalse();
    expect(Object.isFrozen(first)).toBeTrue();
    expect(received).toEqual([first]);
    expect(emitter.listenerCount).toBe(0);
  });

  test("serializes one compact JSON object per writer call", () => {
    const lines: string[] = [];
    const emitter = new WorkflowEventEmitter();
    emitter.on(createJsonEventWriter((line) => lines.push(line)));

    const event = emitter.emit({
      type: "workflow:start",
      ...eventContext,
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual(event);
    expect(lines[0]).not.toContain("\n");
  });
});
