import EventEmitter from "node:events";
import { t, test } from "../index";

test("test 1", async ctx => {
  await ctx.step(
    t.test("subtest 1", async () => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          reject({
            stack: new Error().stack,
            actual: { a: 10 },
            expected: { b: 20 },
          });
        }, 500);
      });
    })
  );
});

test("test 2", () => {
  setTimeout(() => {}, 5000);
});

t.skip(true, "cause").test("test 3", async ctx => {
  throw new Error("error 3");
});

test("test 4", () => {
  process.exit(10);
});

test("test 5", () => {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(1);
  emitter.on("foo", () => {});
  emitter.on("foo", () => {});
});

test("test 6", ctx => {
  setTimeout(() => {
    throw new Error("Uncaught");
  }, 1000);

  ctx.cleanup(() => {
    throw new Error("Clean up error");
  });
});
