module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  sourceMaps: "inline",
  babelOpts: {
    presets: [
      [ "env", {
        targets: { chrome: 50 },
        loose: true
      } ]
    ]
  },
  _out: [
    "foo"
  ]
};
