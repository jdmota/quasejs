module.exports = {
  entries: [
    [ "files/index.js", "atual/dist.js" ]
  ],
  babelOpts: {
    presets: [
      [ "env", {
        targets: { ie: 10 }
      } ]
    ]
  },
  _out: [
    "foo"
  ]
};
