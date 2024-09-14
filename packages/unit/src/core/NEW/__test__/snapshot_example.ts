import { t, test } from "../index";

t.updateSnapshots(false).test("snapshot", async ctx => {
  ctx.matchesSnapshot(123329, "key");
});
