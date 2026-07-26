import {
  describe,
  expect,
  test,
} from "bun:test";

import { pipeline } from "../../src/flow/pipeline";

describe("pipeline", () => {
  test("passes each stage its current value, original item, and index", async () => {
    const results = await pipeline(
      [2, 3],
      (value) => value * 10,
      (value, original, index) => `${index}:${original}:${value}`,
    );

    expect(results).toEqual(["0:2:20", "1:3:30"]);
  });

  test("lets fast items enter the next stage without a global Barrier", async () => {
    const events: string[] = [];

    await pipeline(
      [0, 1],
      async (value) => {
        if (value === 0) {
          await Bun.sleep(20);
        }
        events.push(`stage-1:${value}`);
        return value;
      },
      (value) => {
        events.push(`stage-2:${value}`);
        return value;
      },
    );

    expect(events.indexOf("stage-2:1")).toBeLessThan(
      events.indexOf("stage-1:0"),
    );
  });

  test("isolates an item failure and skips its remaining stages", async () => {
    const secondStageItems: number[] = [];

    const results = await pipeline(
      [1, 2, 3],
      (value) => {
        if (value === 2) {
          throw new Error("item failure");
        }
        return value * 10;
      },
      (value, original) => {
        secondStageItems.push(original);
        return value + 1;
      },
    );

    expect(results).toEqual([11, null, 31]);
    expect(secondStageItems).toEqual([1, 3]);
  });

  test("returns the original items when no stages are provided", async () => {
    expect(await pipeline(["a", "b"])).toEqual(["a", "b"]);
  });
});
