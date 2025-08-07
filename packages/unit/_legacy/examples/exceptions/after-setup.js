const test = require("../../dist");

test("error", t => {
  t.plan(0);
  setTimeout(() => {
    throw new Error("error");
  }, 1000);
});
