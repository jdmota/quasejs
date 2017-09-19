module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  },
  _warn: "Re-exports 'foo' from ./a (3:0). See files/export.js",
  _out: "b"
};
