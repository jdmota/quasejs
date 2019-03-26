module.exports = {
  babelOpts: {
    presets: [
      [ "@babel/preset-env", {
        targets: { ie: 10 },
        modules: false
      } ]
    ]
  },
  _out: [
    "foo"
  ]
};
