import { describe, expect, test } from "bun:test";

import { parallel } from "@deer-flow/workflow/flow";

describe("parallel", () => {
  test("runs tasks concurrently and preserves input order", async () => {
    const completionOrder: string[] = [];

    const results = await parallel([
      async () => {
        await Bun.sleep(20);
        completionOrder.push("slow");
        return "first";
      },
      async () => {
        completionOrder.push("fast");
        return 2;
      },
    ] as const);

    expect(completionOrder).toEqual(["fast", "slow"]);
    expect(results).toEqual(["first", 2]);
  });

  test("converts individual failures to null", async () => {
    const results = await parallel([
      () => "ok",
      () => {
        throw new Error("synchronous failure");
      },
      async () => {
        throw new Error("asynchronous failure");
      },
    ] as const);

    expect(results).toEqual(["ok", null, null]);
  });

  test("accepts an empty task list", async () => {
    expect(await parallel([])).toEqual([]);
  });
});
