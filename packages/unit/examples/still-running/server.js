const test = require("../../dist");

test("server", t => {
  t.plan(0);
  const net = require("net");
  const server = net.createServer();
  server.listen(0);
});
