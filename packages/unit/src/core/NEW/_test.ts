import { EventEmitter } from "node:events";
import { defaultOpts } from "./runnable-desc";
import { t, test, runner, _setup } from "./index";
import { inspect } from "util";

_setup(defaultOpts, {}, defaultOpts);

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

let intervalId: NodeJS.Timeout;

test("test 2", () => {
  intervalId = setInterval(() => {}, 3000);
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

runner.emitter.on("uncaughtError", err => {
  console.log("uncaughtError", err);
});

Promise.resolve(runner.run()).then(r => {
  console.log(inspect(r, { depth: 10 }));
  clearInterval(intervalId);
});
