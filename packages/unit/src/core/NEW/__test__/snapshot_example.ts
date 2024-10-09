import { t as _t } from "../index";

const t = _t.updateSnapshots(false);

t.test("snapshot", async ctx => {
  ctx.matchesSnapshot(123329, "key");

  await ctx.step(
    t.test("inner snapshot", ctx => {
      ctx.matchesSnapshot(3215321, "key2");
    })
  );
});
