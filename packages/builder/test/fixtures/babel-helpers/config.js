module.exports = {
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
