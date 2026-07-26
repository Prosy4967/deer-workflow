import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  log,
  withLogSink,
} from "../../src/logging";

describe("log", () => {
  test("routes messages to the active Log Sink", () => {
    const messages: string[] = [];

    withLogSink(
      (message) => messages.push(message),
      () => {
        log("Research started");
        log("Research finished");
      },
    );

    expect(messages).toEqual([
      "Research started",
      "Research finished",
    ]);
  });

  test("keeps concurrent asynchronous Log Sinks isolated", async () => {
    const first: string[] = [];
    const second: string[] = [];

    await Promise.all([
      withLogSink(
        (message) => first.push(message),
        async () => {
          await Bun.sleep(10);
          log("first");
        },
      ),
      withLogSink(
        (message) => second.push(message),
        async () => {
          log("second");
        },
      ),
    ]);

    expect(first).toEqual(["first"]);
    expect(second).toEqual(["second"]);
  });

  test("restores the parent Log Sink after a nested scope", () => {
    const outer: string[] = [];
    const inner: string[] = [];

    withLogSink(
      (message) => outer.push(message),
      () => {
        log("outer-before");
        withLogSink(
          (message) => inner.push(message),
          () => log("inner"),
        );
        log("outer-after");
      },
    );

    expect(outer).toEqual(["outer-before", "outer-after"]);
    expect(inner).toEqual(["inner"]);
  });

  test("rejects empty messages", () => {
    expect(() => log("   ")).toThrow(TypeError);
  });
});

