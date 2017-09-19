module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  sourceMaps: false,
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
