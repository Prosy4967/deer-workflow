import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import {
  getWorkflowContext,
  phase,
  PhaseContextError,
  workflow,
  WorkflowLoadError,
  WorkflowNestingError,
} from "../../src/flow";

let temporaryDirectory: string;
let rootWorkflowPath: string;
let parentWorkflowPath: string;
let nestedParentWorkflowPath: string;
let invalidWorkflowPath: string;

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    join(tmpdir(), "deer-workflow-flow-test-"),
  );

  const flowModuleUrl = pathToFileURL(
    resolve("src/flow/index.ts"),
  ).href;

  rootWorkflowPath = join(temporaryDirectory, "root.ts");
  await writeFile(
    rootWorkflowPath,
    `
import {
  getCurrentPhase,
  phase,
} from ${JSON.stringify(flowModuleUrl)};

export default async function run(args, context) {
  phase("Analyze");
  return {
    args,
    depth: context.depth,
    phase: getCurrentPhase(),
  };
}
`,
    "utf8",
  );

  const childWorkflowPath = join(temporaryDirectory, "child.ts");
  await writeFile(
    childWorkflowPath,
    `
export default function run(args, context) {
  return {
    args,
    depth: context.depth,
    parentId: context.parentId,
  };
}
`,
    "utf8",
  );

  parentWorkflowPath = join(temporaryDirectory, "parent.ts");
  await writeFile(
    parentWorkflowPath,
    `
import { workflow } from ${JSON.stringify(flowModuleUrl)};

export default function run() {
  return workflow("./child.ts", { source: "parent" });
}
`,
    "utf8",
  );

  const grandchildWorkflowPath = join(
    temporaryDirectory,
    "grandchild.ts",
  );
  await writeFile(
    grandchildWorkflowPath,
    "export default () => 'too deep';\n",
    "utf8",
  );

  const nestedChildWorkflowPath = join(
    temporaryDirectory,
    "nested-child.ts",
  );
  await writeFile(
    nestedChildWorkflowPath,
    `
import { workflow } from ${JSON.stringify(flowModuleUrl)};

export default function run() {
  return workflow("./grandchild.ts");
}
`,
    "utf8",
  );

  nestedParentWorkflowPath = join(
    temporaryDirectory,
    "nested-parent.ts",
  );
  await writeFile(
    nestedParentWorkflowPath,
    `
import { workflow } from ${JSON.stringify(flowModuleUrl)};

export default function run() {
  return workflow("./nested-child.ts");
}
`,
    "utf8",
  );

  invalidWorkflowPath = join(temporaryDirectory, "invalid.ts");
  await writeFile(
    invalidWorkflowPath,
    "export const value = 42;\n",
    "utf8",
  );
});

afterAll(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("phase", () => {
  test("requires an active Workflow context", () => {
    expect(() => phase("Analyze")).toThrow(PhaseContextError);
  });
});

describe("workflow", () => {
  test("injects args and tracks the active phase", async () => {
    const result = await workflow<{
      args: { value: number };
      depth: number;
      phase: string;
    }>(rootWorkflowPath, { value: 42 });

    expect(result).toEqual({
      args: { value: 42 },
      depth: 0,
      phase: "Analyze",
    });
    expect(getWorkflowContext()).toBeUndefined();
  });

  test("resolves nested Workflow paths relative to the parent", async () => {
    const result = await workflow<{
      args: { source: string };
      depth: number;
      parentId: string;
    }>({ scriptPath: parentWorkflowPath });

    expect(result.args).toEqual({ source: "parent" });
    expect(result.depth).toBe(1);
    expect(result.parentId).toBeString();
  });

  test("rejects Workflow nesting deeper than one level", async () => {
    expect(workflow(nestedParentWorkflowPath)).rejects.toBeInstanceOf(
      WorkflowNestingError,
    );
  });

  test("requires a default or named run export", async () => {
    expect(workflow(invalidWorkflowPath)).rejects.toBeInstanceOf(
      WorkflowLoadError,
    );
  });
});

